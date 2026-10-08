import React from "react";

// Tiny, dependency-free renderer for the simple formatting the assistant is
// told to use: paragraphs, "-" / "1." lists, **bold**, `code`, ``` fences.
// Everything is rendered as React elements (no innerHTML), so model output
// can never inject markup.
function inline(text, keyBase) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] dark:bg-slate-800">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function parseBlocks(text) {
  const lines = String(text).replace(/\r/g, "").split("\n");
  const blocks = [];
  let para = [], list = null, code = null;
  const flushPara = () => { if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };

  for (const line of lines) {
    if (code) {
      if (line.trim().startsWith("```")) { blocks.push(code); code = null; } else code.lines.push(line);
      continue;
    }
    if (line.trim().startsWith("```")) { flushPara(); flushList(); code = { type: "code", lines: [] }; continue; }
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      flushPara();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((ul || ol)[1]);
      continue;
    }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    flushList();
    para.push(line.replace(/^#{1,6}\s+/, "").trim());
  }
  if (code) blocks.push(code); // unterminated fence while streaming/truncated
  flushPara(); flushList();
  return blocks;
}

export default function ChatMarkdown({ text }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parseBlocks(text).map((b, i) => {
        if (b.type === "code")
          return <pre key={i} className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800"><code>{b.lines.join("\n")}</code></pre>;
        if (b.type === "ul")
          return <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((t, j) => <li key={j}>{inline(t, `${i}-${j}`)}</li>)}</ul>;
        if (b.type === "ol")
          return <ol key={i} className="list-decimal space-y-1 pl-5">{b.items.map((t, j) => <li key={j}>{inline(t, `${i}-${j}`)}</li>)}</ol>;
        return <p key={i}>{inline(b.text, String(i))}</p>;
      })}
    </div>
  );
}
