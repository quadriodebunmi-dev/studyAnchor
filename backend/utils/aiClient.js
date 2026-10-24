import { ENV } from "../config/env.js";
import { PLATFORM } from "../config/platform.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export class AIError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "AIError";
    this.statusCode = statusCode;
  }
}

export const isAIConfigured = () => Boolean(ENV.groqKey);

/**
 * The single doorway to the AI provider. Every AI feature (quiz, theory
 * questions, study tips, image transcription, chat assistant) goes through
 * here, so the model always comes from the environment (GROQ_MODEL, or
 * GROQ_VISION_MODEL for images) and nowhere else.
 */
export async function chatCompletion({ messages, temperature = 0.4, maxTokens = 1000, model = ENV.groqModel, timeoutMs = PLATFORM.ai.requestTimeoutMs }) {
  if (!ENV.groqKey) throw new AIError("AI is not configured (GROQ_API_KEY is missing).", 503);

  let res;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ENV.groqKey}` },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      // A hung provider must not hold a request (or a quiz submission) open forever.
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new AIError(timedOut ? "The AI service took too long to respond." : `Couldn't reach the AI service: ${err.message}`, 502);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AIError(`Groq API error ${res.status}: ${body.slice(0, 300)}`, 502);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Streaming variant: an async generator that yields the reply in small pieces as
 * the model writes it. `signal` lets the caller cancel (e.g. the browser went away).
 */
export async function* chatCompletionStream({ messages, temperature = 0.4, maxTokens = 1000, model = ENV.groqModel, timeoutMs = PLATFORM.ai.requestTimeoutMs, signal }) {
  if (!ENV.groqKey) throw new AIError("AI is not configured (GROQ_API_KEY is missing).", 503);

  const timeout = AbortSignal.timeout(timeoutMs);
  let res;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ENV.groqKey}` },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new AIError(timedOut ? "The AI service took too long to respond." : `Couldn't reach the AI service: ${err.message}`, 502);
  }
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new AIError(`Groq API error ${res.status}: ${body.slice(0, 300)}`, 502);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch { /* a keep-alive or partial line: ignore */ }
      }
    }
  } catch (err) {
    if (signal?.aborted) return; // the client left — not an error
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new AIError(timedOut ? "The AI service took too long to respond." : `The AI stream was interrupted: ${err.message}`, 502);
  }
}
