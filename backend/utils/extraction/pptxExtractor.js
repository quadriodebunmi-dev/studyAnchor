import JSZip from "jszip";
import { parseStringPromise } from "xml2js";

// A .pptx is a zip of XML parts. Slide text lives in
// ppt/slides/slideN.xml, inside <a:t> runs. This walks every slide in
// order and concatenates its text runs, which is enough context for the
// AI question generator without needing a full OOXML parser.
export async function extractPptxText(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)\.xml/)[1]);
        const nb = Number(b.match(/slide(\d+)\.xml/)[1]);
        return na - nb;
      });

    let text = "";
    for (const name of slideFiles) {
      const xml = await zip.files[name].async("string");
      const parsed = await parseStringPromise(xml);
      const runs = extractTextRuns(parsed);
      if (runs.length) text += runs.join(" ") + "\n";
    }
    return text.trim();
  } catch (err) {
    console.error("PPTX text extraction failed:", err.message);
    return "";
  }
}

// Recursively walks the parsed slide XML object looking for `a:t` (text run)
// nodes, wherever they're nested (shapes, tables, grouped shapes, etc).
function extractTextRuns(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (node["a:t"]) {
    for (const t of node["a:t"]) {
      if (typeof t === "string") out.push(t);
      else if (t?._) out.push(t._);
    }
  }
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) value.forEach((child) => extractTextRuns(child, out));
    else if (typeof value === "object") extractTextRuns(value, out);
  }
  return out;
}
