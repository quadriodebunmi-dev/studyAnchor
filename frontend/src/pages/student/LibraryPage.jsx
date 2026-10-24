import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, ClipboardCheck, FolderOpen, Layers, Library, Search, UploadCloud, X } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import MaterialCard from "../../components/MaterialCard.jsx";
import Pager from "../../components/Pager.jsx";
import { CardSkeleton } from "../../components/Loader.jsx";
import { Input } from "../../components/FormFields.jsx";
import { getMyFolders, getMyUploads } from "../../services/materialService.js";

// Each study tool gets its own tint, matching the dashboard shortcuts.
// (Full class names on purpose: Tailwind can't see classes built from pieces.)
const SHORTCUTS = [
  { to: "/study/snap", icon: Camera, label: "Snap a question", tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
  { to: "/study/flashcards", icon: Layers, label: "Flashcards", tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" },
  { to: "/study/exams", icon: ClipboardCheck, label: "Mock exams", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
];

const heroBtn = "inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-white/90";

// A school student's personal library: everything they've uploaded (private notes
// and class submissions), organised by folder. Mirrors what independent learners
// get as their home page, so it works the same for everyone. School materials stay
// on the Dashboard; the study tools draw from both.
export default function LibraryPage() {
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [folder, setFolder] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState(null);
  const [pagination, setPagination] = useState(null);

  useEffect(() => { getMyFolders().then(setFolders).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [folder, q]);
  useEffect(() => {
    let live = true;
    setItems(null);
    const t = setTimeout(() => {
      getMyUploads({ page, limit: 12, folder: folder || undefined, q: q.trim() || undefined })
        .then((res) => { if (live) { setItems(res.materials); setPagination(res.pagination); } })
        .catch(() => live && setItems([]));
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [page, folder, q]);

  const chip = (active) => `lv-chip !px-2.5 !py-1 !text-[11px] ${active ? "lv-chip-active" : ""}`;
  const total = folders.reduce((n, f) => n + f.count, 0);
  const namedFolders = folders.filter((f) => f.name).length;

  return (
    <AppShell>
      {/* Width cap keeps everything moderate on large screens. */}
      <div className="mx-auto w-full max-w-4xl text-[13px]">
        {/* Header panel: title, quick stats, upload and search in one place. */}
        <section className="overflow-hidden rounded-2xl bg-primary p-3 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* !-prefixed so these win over the .lv-page-title defaults */}
              <h1 className="lv-page-title flex items-center gap-1.5 !text-lg !text-white sm:!text-xl"><Library className="h-4 w-4 shrink-0" /> My Library</h1>
              <p className="mt-0.5 text-[10.5px] text-white/80">Your notes and uploads, in folders. Use them with the study tools.</p>
            </div>
            <button onClick={() => navigate("/my-uploads")} aria-label="Upload" className={`${heroBtn} shrink-0`}>
              <UploadCloud className="h-3.5 w-3.5" />Upload
            </button>
          </div>

          {folders.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-medium">
              <span className="rounded-full bg-white/15 px-2 py-0.5">{total} file{total === 1 ? "" : "s"}</span>
              {namedFolders > 0 && <span className="rounded-full bg-white/15 px-2 py-0.5">{namedFolders} folder{namedFolders === 1 ? "" : "s"}</span>}
            </div>
          )}

          <div className="relative mt-2.5 max-w-sm">
            <Input icon={<Search className="h-3.5 w-3.5" />} className="!py-1.5 !text-xs" placeholder="Search your library" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search your library" />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
            )}
          </div>
        </section>

        {/* Study tools */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {SHORTCUTS.map(({ to, icon: Icon, label, tone }) => (
            <Link key={to} to={to} className="lv-card-interactive flex flex-col items-center gap-1 p-2 text-center text-[10.5px] font-medium">
              <span className={`grid h-8 w-8 place-items-center rounded-full ${tone}`}><Icon className="h-4 w-4" /></span>{label}
            </Link>
          ))}
        </div>

        {folders.length > 0 && (
          <div className="lv-chips mt-3">
            <button onClick={() => setFolder("")} className={chip(folder === "")}>All ({total})</button>
            {folders.map((f) => (
              <button key={f.name || "__none__"} onClick={() => setFolder(f.name || "__none__")} className={`${chip(folder === (f.name || "__none__"))} inline-flex items-center gap-1`}>
                <FolderOpen className="h-3 w-3" />{f.name || "Unfiled"} ({f.count})
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {!items ? <CardSkeleton count={3} /> : items.length === 0 ? (
            <EmptyState icon={<Library className="h-5 w-5" />} title={q || folder ? "Nothing matches" : "Your library is empty"}
              message={q || folder ? "Try a different search or folder." : "Upload a PDF, document, slides or a photo of your notes and it will show up here, ready for flashcards and mock exams."}
              action={!q && !folder && <Button size="sm" onClick={() => navigate("/my-uploads")}>Upload your first file</Button>} />
          ) : items.map((m) => <MaterialCard key={m._id} material={m} onOpen={() => navigate(`/material/${m._id}`)} />)}
        </div>
        <Pager pagination={pagination} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}