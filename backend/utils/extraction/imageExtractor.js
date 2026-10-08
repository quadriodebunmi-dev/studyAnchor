import { ENV } from "../../config/env.js";
import { chatCompletion, isAIConfigured } from "../aiClient.js";

function inferMimeType(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer.slice(0, 4).toString("ascii") === "GIF8") return "image/gif";
  if (buffer.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "image/jpeg";
}

// Sends the image to the env-configured vision model (GROQ_VISION_MODEL) and
// asks it to transcribe any readable text so it can feed the same AI
// question generator PDFs/DOCX/XLSX use. Returns "" on any failure so the
// generator falls back to the material's title/description.
export async function extractImageText(buffer) {
  try {
    if (!isAIConfigured() || !buffer) return "";
    const mimeType = inferMimeType(buffer);
    const text = await chatCompletion({
      model: ENV.groqVisionModel,
      temperature: 0.2,
      maxTokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe every piece of readable text in this image (handwritten or printed notes, slide photos, diagram labels, etc). Return ONLY the transcribed text, no commentary. If there's no readable text, briefly describe the image's subject matter instead." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}` } },
          ],
        },
      ],
    });
    return text.slice(0, 20000);
  } catch (err) {
    console.error("Image text extraction failed, falling back to no extracted text:", err.message);
    return "";
  }
}
