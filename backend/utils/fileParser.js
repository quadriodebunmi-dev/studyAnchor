import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import xlsx from "xlsx";
import { extractPptxText } from "./extraction/pptxExtractor.js";
import { extractImageText } from "./extraction/imageExtractor.js";

/**
 * Extracts plain text from an uploaded file buffer so it can be fed to the
 * AI question generator. Falls back to an empty string on unsupported types
 * or parsing failures rather than blocking the upload.
 */
export async function extractText(buffer, fileType) {
  try {
    if (!buffer) return "";
    if (fileType === "pdf") {
      const data = await pdfParse(buffer);
      return data.text?.slice(0, 20000) || "";
    }
    if (fileType === "docx") {
      const { value } = await mammoth.extractRawText({ buffer });
      return value?.slice(0, 20000) || "";
    }
    if (fileType === "xlsx") {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      let text = "";
      workbook.SheetNames.forEach((name) => {
        text += xlsx.utils.sheet_to_csv(workbook.Sheets[name]) + "\n";
      });
      return text.slice(0, 20000);
    }
    if (fileType === "pptx") {
      return (await extractPptxText(buffer)).slice(0, 20000);
    }
    if (fileType === "image") {
      return (await extractImageText(buffer)).slice(0, 20000);
    }
    return "";
  } catch (err) {
    console.error("Text extraction failed:", err.message);
    return "";
  }
}

export function inferFileType(originalName, mimetype) {
  const ext = originalName.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["ppt", "pptx"].includes(ext)) return "pptx";
  if (["doc", "docx"].includes(ext)) return "docx";
  if (["xls", "xlsx"].includes(ext)) return "xlsx";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  return "pdf";
}
