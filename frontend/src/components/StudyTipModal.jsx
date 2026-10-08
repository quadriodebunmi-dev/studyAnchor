import React, { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { getStudyTip } from "../services/feedService.js";
import openBookIllustration from "../../public/Open-book.svg";

// Shown once per login on the student dashboard. LoginPage sets the
// "study-anchor-show-study-tip" sessionStorage flag right after a
// successful student login; this component consumes (clears) that flag the
// first time the dashboard mounts, so refreshing or navigating back to the
// dashboard later in the same session doesn't keep re-popping it up.
const FLAG_KEY = "study-anchor-show-study-tip";

export function markStudyTipForNextLoad() {
  sessionStorage.setItem(FLAG_KEY, "1");
}

export default function StudyTipModal() {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    if (sessionStorage.getItem(FLAG_KEY) !== "1") return;
    sessionStorage.removeItem(FLAG_KEY);
    setOpen(true);
    setTimeout(() => {
      getStudyTip().then(setTip).catch(() => setTip("Take short breaks between study sessions — your brain retains more that way."));
    }, 3000);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-xl bg-secondary-purple/10 p-2.5">
            <Lightbulb className="w-5 h-5 text-secondary-purple" />
          </div>
          <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-4 font-semibold">Today's Study Tip</p>
        {tip ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{tip}</p>
        ) : (
          <div className="mt-3 flex flex-col items-center gap-2 py-2">
            <img
              src={openBookIllustration}
              alt="An open book, animating gently while your tip loads"
              className="h-54 w-74"
            />
            <p className="text-xs lv-meta">Finding today's tip…</p>
          </div>
        )}
      </div>
    </div>
  );
}