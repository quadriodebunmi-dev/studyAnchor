import api from "./api.js";

// The conversation lives on the client; the whole thread is sent each turn.
// `materialId` (optional) grounds the answer in one material's content;
// `mode` is one of tutor | simple | quiz | exam.
export async function sendChatMessage(messages, materialId, mode) {
  const res = await api.post("/assistant/chat", { messages, materialId, mode });
  return res.data.reply;
}

/**
 * Streams the reply: `onDelta(text)` is called with each new piece as the model
 * writes it. Resolves with the full reply. Pass an AbortSignal to stop early
 * (rejects with an AbortError — the caller keeps whatever it already received).
 *
 * axios can't read a response while it is still arriving in the browser, so this
 * uses fetch. If streaming isn't available (a proxy that buffers, an old browser)
 * it quietly falls back to the normal one-shot request.
 */
export async function streamChatMessage({ messages, materialId, mode, signal, onDelta }) {
  let res;
  try {
    const token = localStorage.getItem("study-anchor-token");
    res = await fetch(`${api.defaults.baseURL}/assistant/chat/stream`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages, materialId, mode }),
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    return fallback();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { message: body.message || (res.status === 429 ? "Too many requests — please wait a moment." : "The assistant couldn't respond. Please try again."), status: res.status };
  }
  if (!res.body) return fallback();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let finished = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      let evt;
      try { evt = JSON.parse(line.slice(5)); } catch { continue; }
      if (evt.error) throw { message: evt.error };
      if (evt.delta) { full += evt.delta; onDelta?.(evt.delta); }
      if (evt.done) finished = true;
    }
  }
  if (!finished && !full) return fallback(); // stream ended with nothing: a buffering proxy, try once normally
  return full;

  async function fallback() {
    const reply = await sendChatMessage(messages, materialId, mode);
    onDelta?.(reply);
    return reply;
  }
}
