// LLMs wrap JSON in prose and code fences, or stop mid-array. This pulls the
// first complete JSON value out of a reply and fails loudly (AIParseError)
// instead of letting a half-parsed answer through.

export class AIParseError extends Error {
  constructor(message = "The AI returned an answer in an unexpected format.") {
    super(message);
    this.name = "AIParseError";
    this.statusCode = 502;
  }
}

function findBalanced(text, open, close) {
  const start = text.indexOf(open);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/** expect: "array" | "object". */
export function extractJson(raw, expect = "array") {
  const text = String(raw || "").replace(/```(?:json)?/gi, "").trim();
  if (!text) throw new AIParseError("The AI returned an empty answer.");
  const [open, close] = expect === "array" ? ["[", "]"] : ["{", "}"];
  const candidate = findBalanced(text, open, close);
  if (!candidate) throw new AIParseError();
  try {
    const parsed = JSON.parse(candidate);
    if (expect === "array" && !Array.isArray(parsed)) throw new AIParseError();
    if (expect === "object" && (Array.isArray(parsed) || typeof parsed !== "object" || !parsed)) throw new AIParseError();
    return parsed;
  } catch (err) {
    if (err instanceof AIParseError) throw err;
    throw new AIParseError();
  }
}
