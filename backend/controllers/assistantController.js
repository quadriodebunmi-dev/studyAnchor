import Material from "../models/Material.js";
import School from "../models/School.js";
import { chatWithAssistant } from "../utils/aiService.js";
import { AIError } from "../utils/aiClient.js";
import { canViewMaterial } from "../utils/materialAccess.js";

const MAX_HISTORY = 12; // most recent turns sent to the model
const MAX_CONTENT = 2000; // characters per turn

// POST /api/assistant/chat  { messages: [{ role, content }], materialId? }
// Stateless: the client keeps the conversation and resends it each turn. Only
// "user"/"assistant" roles are accepted so a client can't inject its own
// system prompt.
export async function chat(req, res, next) {
  try {
    const { messages, materialId } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Send at least one message." });
    }
    const clean = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CONTENT) }))
      .slice(-MAX_HISTORY);
    if (!clean.length || clean[clean.length - 1].role !== "user") {
      return res.status(400).json({ message: "The last message must be from you." });
    }

    let material = null;
    if (materialId) {
      const doc = await Material.findById(materialId).populate("courseId", "code");
      if (!doc || !canViewMaterial(req.user, doc)) return res.status(404).json({ message: "Material not found." });
      material = { title: doc.title, courseCode: doc.courseId?.code, text: doc.extractedText };
    }

    const school = req.user.schoolId ? await School.findById(req.user.schoolId).select("name") : null;
    const student = { department: req.user.department, level: req.user.level, schoolName: school?.name };

    let reply;
    try {
      reply = await chatWithAssistant({ messages: clean, material, student });
    } catch (err) {
      if (err instanceof AIError) {
        console.error("Assistant failed:", err.message);
        return res.status(err.statusCode === 503 ? 503 : 502).json({
          message: err.statusCode === 503
            ? "The AI assistant isn't available right now."
            : "The AI assistant couldn't respond. Please try again in a moment.",
        });
      }
      throw err;
    }
    if (!reply) return res.status(502).json({ message: "The AI assistant returned an empty answer. Please try again." });
    res.json({ reply });
  } catch (err) { next(err); }
}
