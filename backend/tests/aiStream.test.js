import test from "node:test";
import assert from "node:assert/strict";

process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "test-key";
const { chatCompletionStream, AIError } = await import("../utils/aiClient.js");

const sse = (...events) => events.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("");
const delta = (content) => ({ choices: [{ delta: { content } }] });
function streamOf(text, step = 7) {
  const enc = new TextEncoder();
  return new ReadableStream({ start(c) { for (let i = 0; i < text.length; i += step) c.enqueue(enc.encode(text.slice(i, i + step))); c.close(); } });
}
async function collect(gen) { let out = ""; for await (const d of gen) out += d; return out; }

test("stream: reassembles pieces even when network chunks split lines", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(streamOf(sse({ choices: [{ delta: { role: "assistant" } }] }, delta("Hel"), delta("lo, "), delta("world"), "[DONE]")), { status: 200 });
  try {
    assert.equal(await collect(chatCompletionStream({ messages: [{ role: "user", content: "hi" }] })), "Hello, world");
  } finally { globalThis.fetch = realFetch; }
});

test("stream: provider error becomes an AIError", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("rate limited", { status: 429 });
  try {
    await assert.rejects(collect(chatCompletionStream({ messages: [] })), (e) => e instanceof AIError && /429/.test(e.message));
  } finally { globalThis.fetch = realFetch; }
});

test("stream: aborting stops quietly instead of throwing", async () => {
  const realFetch = globalThis.fetch;
  const ac = new AbortController();
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(sse(delta("one")))); },
    pull() { ac.abort(); return new Promise(() => {}); },
  }), { status: 200 });
  try {
    const got = [];
    const run = (async () => { for await (const d of chatCompletionStream({ messages: [], signal: ac.signal })) got.push(d); })();
    await Promise.race([run, new Promise((r) => setTimeout(r, 500))]);
    assert.deepEqual(got, ["one"]);
  } finally { globalThis.fetch = realFetch; }
});
