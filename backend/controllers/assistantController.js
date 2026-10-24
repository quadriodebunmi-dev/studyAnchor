import Material from "../models/Material.js";
import School from "../models/School.js";
import { chatWithAssistant, streamAssistant } from "../utils/aiService.js";
import { AIError } from "../utils/aiClient.js";
import { canViewMaterial } from "../utils/materialAccess.js";
import { normalizeMode } from "../utils/assistantContext.js";

const MAX_HISTORY = 16;          // most recent turns sent to the model
const MAX_USER_CONTENT = 2000;   // characters per student turn
const MAX_REPLY_CONTENT = 4500;  // assistant turns are longer; don't cut earlier answers short

const friendly = (err) => (err.statusCode === 503
  ? "The AI assistant isn't available right now."
  : "The AI assistant couldn't respond. Please try again in a moment.");

// Validates the request and gathers context. Sends the error response itself and
// returns null when the request can't proceed.
// Stateless: the client keeps the conversation and resends it each turn. Only
// "user"/"assistant" roles are accepted so a client can't inject its own system prompt.
async function prepare(req, res) {
  const { messages, materialId } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ message: "Send at least one message." }); return null;
  }
  const clean = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, m.role === "user" ? MAX_USER_CONTENT : MAX_REPLY_CONTENT) }))
    .slice(-MAX_HISTORY);
  if (!clean.length || clean[clean.length - 1].role !== "user") {
    res.status(400).json({ message: "The last message must be from you." }); return null;
  }

  let material = null;
  if (materialId) {
    const doc = await Material.findById(materialId).populate("courseId", "code");
    if (!doc || !canViewMaterial(req.user, doc)) { res.status(404).json({ message: "Material not found." }); return null; }
    material = { title: doc.title, courseCode: doc.courseId?.code, text: doc.extractedText };
  }

  const school = req.user.schoolId ? await School.findById(req.user.schoolId).select("name") : null;
  const student = { department: req.user.department, level: req.user.level, schoolName: school?.name };
  return { messages: clean, material, student, mode: normalizeMode(req.body.mode) };
}

// POST /api/assistant/chat  { messages: [{ role, content }], materialId?, mode? }
export async function chat(req, res, next) {
  try {
    const args = await prepare(req, res); if (!args) return;
    let reply;
    try {
      reply = await chatWithAssistant(args);
    } catch (err) {
      if (err instanceof AIError) {
        console.error("Assistant failed:", err.message);
        return res.status(err.statusCode === 503 ? 503 : 502).json({ message: friendly(err) });
      }
      throw err;
    }
    if (!reply) return res.status(502).json({ message: "The AI assistant returned an empty answer. Please try again." });
    res.json({ reply });
  } catch (err) { next(err); }
}

// POST /api/assistant/chat/stream — same body, but the reply arrives as server-sent
// events while the model writes it:  data: {"delta":"…"}  …  data: {"done":true}
// Problems found BEFORE streaming starts are ordinary JSON error responses.
export async function chatStream(req, res, next) {
  try {
    const args = await prepare(req, res); if (!args) return;

    const abort = new AbortController();
    res.on("close", () => { if (!res.writableEnded) abort.abort(); }); // browser pressed Stop / left

    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // tell nginx-style proxies not to hold the stream back
    });
    res.flushHeaders?.();
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    let sent = 0;
    try {
      for await (const delta of streamAssistant(args, abort.signal)) { sent += delta.length; send({ delta }); }
      if (!abort.signal.aborted) send(sent ? { done: true } : { error: "The AI assistant returned an empty answer. Please try again." });
    } catch (err) {
      if (!(err instanceof AIError)) console.error("Assistant stream crashed:", err);
      else console.error("Assistant failed:", err.message);
      if (!res.writableEnded) send({ error: err instanceof AIError ? friendly(err) : "Something went wrong. Please try again." });
    }
    res.end();
  } catch (err) { next(err); }
}
