import { ENV } from "../config/env.js";

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
export async function chatCompletion({ messages, temperature = 0.4, maxTokens = 1000, model = ENV.groqModel }) {
  if (!ENV.groqKey) throw new AIError("AI is not configured (GROQ_API_KEY is missing).", 503);

  let res;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ENV.groqKey}` },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });
  } catch (err) {
    throw new AIError(`Couldn't reach the AI service: ${err.message}`, 502);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AIError(`Groq API error ${res.status}: ${body.slice(0, 300)}`, 502);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}
