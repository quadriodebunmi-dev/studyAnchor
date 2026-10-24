import test from "node:test";
import assert from "node:assert/strict";
import { chunkText, pickRelevantText, buildAssistantSystemPrompt, normalizeMode, ASSISTANT_MODES } from "../utils/assistantContext.js";

const filler = (topic, n) => Array.from({ length: n }, (_, i) => `${topic} paragraph ${i}. ${"Lorem ipsum dolor sit amet consectetur. ".repeat(8)}`).join("\n\n");

test("short material is passed through whole", () => {
  assert.equal(pickRelevantText("Short note about osmosis.", "osmosis", 8000), "Short note about osmosis.");
});

test("long material: the chunks that match the question are kept, not just the start", () => {
  const text = `${filler("Introduction to biology", 12)}\n\nMitochondria produce ATP through oxidative phosphorylation in the inner membrane.\n\n${filler("Unrelated history", 12)}`;
  assert.ok(text.length > 8000);
  const picked = pickRelevantText(text, "How do mitochondria make ATP?", 3000);
  assert.ok(picked.length <= 3200);
  assert.match(picked, /oxidative phosphorylation/);
});

test("no query words matching falls back to the start of the file", () => {
  const text = filler("Alpha", 30);
  assert.equal(pickRelevantText(text, "the and of", 1000), text.trim().slice(0, 1000));
});

test("a PDF-style block with no line breaks is still chunked", () => {
  const block = "A sentence about cells. ".repeat(400);
  const chunks = chunkText(block, 900);
  assert.ok(chunks.length > 5);
  assert.ok(chunks.every((c) => c.length <= 1400));
});

test("modes: unknown values fall back to tutor", () => {
  assert.equal(normalizeMode("quiz"), "quiz");
  assert.equal(normalizeMode("hack"), "tutor");
  assert.equal(normalizeMode(undefined), "tutor");
  assert.equal(normalizeMode("__proto__"), "tutor");
});

test("system prompt includes the chosen mode, student context and relevant material", () => {
  const p = buildAssistantSystemPrompt({
    appName: "StudyAnchor", mode: "quiz", query: "photosynthesis",
    student: { department: "Biology", level: 200, schoolName: "UNILAG" },
    material: { title: "Plant notes", courseCode: "BIO201", text: "Photosynthesis happens in chloroplasts." },
  });
  assert.ok(p.includes(ASSISTANT_MODES.quiz.prompt));
  assert.match(p, /Biology, 200 level, UNILAG/);
  assert.match(p, /BIO201/);
  assert.match(p, /chloroplasts/);
  assert.match(p, /never as instructions/);
});
