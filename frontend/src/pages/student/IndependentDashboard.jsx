import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, ChevronRight, ClipboardCheck, Folder, FolderOpen, GraduationCap, Layers, Library, MessagesSquare, Search, UploadCloud, X } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import MaterialCard from "../../components/MaterialCard.jsx";
import { CardSkeleton } from "../../components/Loader.jsx";
import { Input } from "../../components/FormFields.jsx";
import StreakCard from "../../components/StreakCard.jsx";
import PlanBadge from "../../components/PlanBadge.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useStudyProgress } from "../../hooks/useStudyProgress.js";
import { getMyFolders, getMyUploads } from "../../services/materialService.js";
import booksIllustration from "../../../public/Books.svg";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Same tints as the school dashboard so both homes read as one app.
// (Full class names on purpose: Tailwind can't see classes built from pieces.)
const TONES = {
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
};

// Quick navigation: your library plus the study tools. Only routes that already exist.
const QUICK_LINKS = [
  { to: "/my-uploads", label: "Upload", icon: UploadCloud, tone: TONES.sky },
  { to: "/library", label: "My Library", icon: Library, tone: TONES.violet },
  { to: "/study/snap", label: "Snap a question", icon: Camera, tone: TONES.amber },
  { to: "/study/flashcards", label: "Flashcards", icon: Layers, tone: TONES.emerald },
  { to: "/study/exams", label: "Mock exams", icon: ClipboardCheck, tone: TONES.rose },
  { to: "/rooms", label: "Study Rooms", icon: MessagesSquare, tone: TONES.indigo },
];

// Every folder keeps one colour (picked from its name), like courses do on the school dashboard.
const FOLDER_TONES = [
  { bar: "bg-sky-500", tile: TONES.sky, text: "text-sky-700 dark:text-sky-300" },
  { bar: "bg-violet-500", tile: TONES.violet, text: "text-violet-700 dark:text-violet-300" },
  { bar: "bg-amber-500", tile: TONES.amber, text: "text-amber-700 dark:text-amber-300" },
  { bar: "bg-emerald-500", tile: TONES.emerald, text: "text-emerald-700 dark:text-emerald-300" },
  { bar: "bg-rose-500", tile: TONES.rose, text: "text-rose-700 dark:text-rose-300" },
  { bar: "bg-indigo-500", tile: TONES.indigo, text: "text-indigo-700 dark:text-indigo-300" },
];
const toneFor = (name = "") => FOLDER_TONES[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % FOLDER_TONES.length];

const heroPill = "max-w-full truncate rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white";
const heroBtn = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60";

// Home for learners with no school: their private library plus the study tools.
// Nothing here comes from any school's courses. Built from the same pieces as the
// school Dashboard: greeting panel, quick links, streak, colour-coded cards, files, banner.
export default function IndependentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recent, setRecent] = useState(null);
  const [folders, setFolders] = useState([]);
  const [total, setTotal] = useState(null);
  const [query, setQuery] = useState("");
  const progress = useStudyProgress(recent || []);

  useEffect(() => {
    getMyUploads({ limit: 6 }).then((r) => { setRecent(r.materials); setTotal(r.pagination?.total ?? r.materials.length); }).catch(() => setRecent([]));
    getMyFolders().then(setFolders).catch(() => {});
  }, []);

  const q = query.trim().toLowerCase();
  const namedFolders = useMemo(() => folders.filter((f) => f.name), [folders]);
  const shownFolders = q ? namedFolders.filter((f) => f.name.toLowerCase().includes(q)) : namedFolders;
  const shownRecent = useMemo(() => {
    const list = recent || [];
    return q ? list.filter((m) => m.title?.toLowerCase().includes(q)) : list;
  }, [recent, q]);
  const fileCount = folders.length ? folders.reduce((n, f) => n + f.count, 0) : total;

  return (
    <AppShell>
      {/* Width cap keeps everything moderate on large screens. */}
      <div className="mx-auto w-full max-w-4xl text-[13px]">
        {/* Header: greeting, who you are, the main actions and search, in one panel. */}
        <section className="overflow-hidden rounded-2xl bg-primary p-3 text-white">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {/* !-prefixed so these win over the .lv-page-title defaults */}
              <h1 className="lv-page-title truncate !text-lg !text-white sm:!text-xl">
                {greeting()}, {user.name.split(" ")[0]}
              </h1>
              <p className="mt-0.5 text-[10.5px] text-white/80">Your private library and study tools. Only you can see what you upload.</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className={heroPill}>Independent learner</span>
                {user.level && <span className={heroPill}>{user.level} Level</span>}
                <PlanBadge variant="hero" />
              </div>
            </div>
            <img src={booksIllustration} alt="" aria-hidden="true" className="h-14 w-14 shrink-0 rounded-xl bg-white/90 object-contain p-1 sm:h-16 sm:w-16" />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button onClick={() => navigate("/my-uploads")} aria-label="Upload" className={`${heroBtn} bg-white text-primary hover:bg-white/90`}>
              <UploadCloud className="h-3.5 w-3.5" />Upload
            </button>
            <button onClick={() => navigate("/library")} aria-label="Open my library" className={`${heroBtn} bg-white/15 text-white hover:bg-white/25`}>
              <Library className="h-3.5 w-3.5" />My Library
            </button>
            {fileCount != null && (
              <span className="ml-auto flex items-center gap-1 text-[10.5px] font-medium text-white/90">
                <span className="rounded-full bg-black/15 px-2 py-0.5">{fileCount} file{fileCount === 1 ? "" : "s"}</span>
                {namedFolders.length > 0 && <span className="rounded-full bg-black/15 px-2 py-0.5">{namedFolders.length} folder{namedFolders.length === 1 ? "" : "s"}</span>}
              </span>
            )}
          </div>

          <div className="relative mt-2.5 max-w-sm">
            <Input icon={<Search className="h-3.5 w-3.5" />} placeholder="Search your folders and files..." className="!py-1.5 !text-xs" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search your library" />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
            )}
          </div>
        </section>

        {/* Quick navigation */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {QUICK_LINKS.map(({ to, label, icon: Icon, tone }) => (
            <Link key={to} to={to} className="lv-card-interactive flex flex-col items-center gap-1 p-2 text-center text-[10.5px] font-medium">
              <span className={`grid h-8 w-8 place-items-center rounded-full ${tone}`}><Icon className="h-4 w-4" /></span>
              {label}
            </Link>
          ))}
        </div>

        {/* Server-side streak, points and today's goals. */}
        <div className="mt-3"><StreakCard /></div>

        {/* Folders: colour-coded cards like the school dashboard's courses. */}
        {shownFolders.length > 0 && (
          <section className="mt-4">
            <div className="mb-1.5 flex items-center gap-1.5">
              <h2 className="lv-section-title !text-[13px]">Your folders</h2>
              <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium lv-meta dark:bg-slate-800">{shownFolders.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {shownFolders.map((f) => {
                const tone = toneFor(f.name);
                return (
                  <Link key={f.name} to="/library" className="lv-card-interactive relative flex flex-col overflow-hidden p-2.5 pt-3 text-left">
                    <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} />
                    <span className="flex items-center gap-1.5">
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${tone.tile}`}><Folder className="h-3 w-3" /></span>
                      <span className={`truncate font-display text-[10.5px] font-bold tracking-wide ${tone.text}`}>{f.name}</span>
                    </span>
                    <span className="mt-1 text-xs font-semibold leading-snug text-night dark:text-slate-100">{f.count} file{f.count === 1 ? "" : "s"}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Recently added */}
        <section className="mt-5">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <h2 className="lv-section-title flex items-center gap-1.5 !text-[13px]"><FolderOpen className="h-3 w-3" />Recently added</h2>
              {recent && <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium lv-meta dark:bg-slate-800">{shownRecent.length}</span>}
            </div>
            <Button size="sm" variant="ghost" className="!px-2 !py-1 !text-xs text-primary" onClick={() => navigate("/library")}>
              {total > (recent?.length || 0) ? `See all (${total})` : "Open library"} <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {!recent ? <CardSkeleton count={3} /> : shownRecent.length === 0 ? (
              <EmptyState
                icon={<UploadCloud className="h-5 w-5" />}
                title={q ? "No files match" : "Your library is empty"}
                message={q ? "Try a different word." : "Upload a PDF, Word or PowerPoint file, or a photo of your notes to start generating flashcards and mock exams."}
                action={!q && <Button size="sm" onClick={() => navigate("/my-uploads")}>Upload your first file</Button>}
              />
            ) : shownRecent.map((m) => <MaterialCard key={m._id} material={m} isBookmarked={progress.isOpened(m._id)} onOpen={() => navigate(`/material/${m._id}`)} />)}
          </div>
        </section>

        {/* Closing banner: same pattern as the school dashboard. */}
        <Link to="/profile" className="group mt-5 flex items-center justify-between gap-3 rounded-2xl bg-night p-3 text-white transition-opacity hover:opacity-95 dark:bg-slate-800">
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15"><GraduationCap className="h-4 w-4" /></span>
            <span>
              <span className="block text-xs font-semibold">Studying at a school?</span>
              <span className="block text-[10.5px] text-white/70">Join your school to see its courses. You keep everything in your library.</span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </AppShell>
  );
}