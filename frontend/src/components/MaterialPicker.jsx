import React, { useEffect, useState } from "react";
import { Search, Check, FileText } from "lucide-react";
import { Input } from "./FormFields.jsx";
import { InlineLoader } from "./Loader.jsx";
import { getPickableMaterials } from "../services/materialService.js";
import { useAuth } from "../context/AuthContext.jsx";

// Pick study materials the user can already see. A switch chooses the search
// scope: "All of study-anchor" (own library + every approved material they may
// see) or "My library & department" (own library + approved materials from their
// current department, level, semester and session). Independent learners only
// have a library, so no switch is shown. Used by flashcards, mock exams and the
// room-quiz AI generator. The backend re-checks access on every request.
export default function MaterialPicker({ selected, onChange, max = 1, label = "Choose material" }) {
  const { user } = useAuth();
  const inSchool = user?.learnerType !== "independent" && Boolean(user?.schoolId);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [items, setItems] = useState(null);

  useEffect(() => {
    let live = true;
    setItems(null);
    const t = setTimeout(() => {
      getPickableMaterials({ q: q.trim(), limit: 12, scope: inSchool ? scope : undefined })
        .then((res) => live && setItems(res.materials)).catch(() => live && setItems([]));
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q, scope, inSchool]);

  const isSelected = (m) => selected.some((s) => s._id === m._id);
  function toggle(m) {
    if (isSelected(m)) return onChange(selected.filter((s) => s._id !== m._id));
    if (max === 1) return onChange([{ _id: m._id, title: m.title }]);
    if (selected.length >= max) return;
    onChange([...selected, { _id: m._id, title: m.title }]);
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}{max > 1 && <span className="lv-meta"> (up to {max})</span>}</p>
      {inSchool && (
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs dark:bg-slate-800" role="tablist" aria-label="Where to search">
          {[["all", "All of study-anchor"], ["mine", "My library & department"]].map(([k, l]) => (
            <button type="button" key={k} role="tab" aria-selected={scope === k} onClick={() => setScope(k)}
              className={`rounded-lg px-2 py-1.5 font-medium transition-colors ${scope === k ? "bg-white shadow-card dark:bg-slate-900" : "text-slate-500"}`}>{l}</button>
          ))}
        </div>
      )}
      {inSchool && scope === "mine" && (
        <p className="mb-2 text-xs lv-meta">
          Your uploads plus materials for {[user.department, user.level && `${user.level} Level`, user.semester, user.session && `${user.session} session`].filter(Boolean).join(" · ") || "your current courses"}.
        </p>
      )}
      <Input icon={<Search className="h-4 w-4" />} placeholder={!inSchool ? "Search your library" : scope === "mine" ? "Search your library and department materials" : "Search all study-anchor materials"} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search materials" />
      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1 dark:border-slate-800">
        {items === null ? <InlineLoader /> : items.length === 0 ? (
          <p className="p-3 text-sm lv-meta">{q ? "No matches." : inSchool ? (scope === "mine" ? "Nothing in your library or current courses yet. Try searching all of study-anchor." : "Nothing here yet. Upload to your library, or wait for materials to be approved.") : "Your library is empty. Upload a PDF first."}</p>
        ) : items.map((m) => (
          <button type="button" key={m._id} onClick={() => toggle(m)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${isSelected(m) ? "bg-accent/20" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
            {isSelected(m) ? <Check className="h-4 w-4 shrink-0 text-success" /> : <FileText className="h-4 w-4 shrink-0 text-slate-400" />}
            <span className="min-w-0 flex-1 truncate">{m.title}</span>
            {m.courseId?.code && <span className="shrink-0 text-xs lv-meta">{m.courseId.code}</span>}
            {inSchool && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.source === "school" ? "bg-primary/10 text-primary" : "bg-slate-100 dark:bg-slate-800"}`}>{m.source === "school" ? "School" : "Library"}</span>}
          </button>
        ))}
      </div>
      {selected.length > 0 && <p className="mt-1.5 text-xs lv-meta">Selected: {selected.map((s) => s.title).join(", ")}</p>}
    </div>
  );
}
