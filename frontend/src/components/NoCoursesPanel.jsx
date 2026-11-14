import React from "react";
import { FolderKanban, UploadCloud, Copy, Share2, Library } from "lucide-react";
import Button from "./Button.jsx";
import { useToast } from "./Toast.jsx";

// Shown on the student dashboard when no courses have been set up for them yet.
// Two ways forward: put files in their own library, or send the course-rep signup
// link to their rep so the rep can add the courses and upload each course's materials.

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / non-secure pages: fall back to a hidden textarea.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function NoCoursesPanel({ onUpload }) {
  const showToast = useToast();
  const link = `${window.location.origin}/rep-signup`;
  const message = `Hi! Please sign up as our course rep on Study Anchor so you can add our courses and upload the materials for each one: ${link}`;

  async function handleCopy() {
    const ok = await copyText(message);
    showToast(ok ? "Copied. Send it to your course rep." : "Couldn't copy. Please try again.", ok ? "success" : "error");
  }

  return (
    <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-highlight-deep dark:text-accent"><FolderKanban className="h-5 w-5" /></div>
      <p className="font-display text-sm font-semibold text-night dark:text-slate-100">Your courses aren't set up yet</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed lv-meta">There are two ways to get started:</p>

      <div className="mt-3 grid gap-2 text-left sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="flex items-center gap-1.5 text-xs font-semibold"><Share2 className="h-3.5 w-3.5 text-primary" />Ask your course rep</p>
          <p className="mt-1 text-xs leading-relaxed lv-meta">Copy the course rep signup link and send it to your rep. He/She can add your courses and upload the materials for each course. all students will have access to it too</p>
          <Button size="sm" variant="outline" className="mt-2.5 w-full" onClick={handleCopy}><Copy className="h-3.5 w-3.5" />Copy course rep signup</Button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="flex items-center gap-1.5 text-xs font-semibold"><Library className="h-3.5 w-3.5 text-primary" />Upload to your library</p>
          <p className="mt-1 text-xs leading-relaxed lv-meta">Add your own notes, slides or PDFs and study from them right away.</p>
          <Button size="sm" className="mt-2.5 w-full" onClick={onUpload}><UploadCloud className="h-3.5 w-3.5" />Upload to my library</Button>
        </div>
      
      </div>
    </div>
  );
}
