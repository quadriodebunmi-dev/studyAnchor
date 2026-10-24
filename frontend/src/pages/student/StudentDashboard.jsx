import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, FolderKanban, ChevronRight, FileText, DownloadCloud, Search, X, UploadCloud, Compass, Library, Sparkles, MessagesSquare, Target, Trophy, Bookmark } from "lucide-react";
import StreakCard from "../../components/StreakCard.jsx";
import AppShell from "../AppShell.jsx";
import { StreakChip, ProgressBar } from "../../components/StudyStats.jsx";
import { useStudyProgress } from "../../hooks/useStudyProgress.js";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll.js";
import InfiniteScrollSentinel from "../../components/InfiniteScrollSentinel.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { ListSkeleton } from "../../components/Loader.jsx";
import Button from "../../components/Button.jsx";
import MaterialCard from "../../components/MaterialCard.jsx";
import { Select, Input } from "../../components/FormFields.jsx";
import { getDashboard, getFeedMaterials } from "../../services/feedService.js";
import { downloadAllMaterials } from "../../services/materialService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import StudyTipModal from "../../components/StudyTipModal.jsx";
import PlanBadge from "../../components/PlanBadge.jsx";
import booksIllustration from "../../../public/Books.svg";

import { studentNavItems, repNavItemsFor } from "../../config/navItems.jsx";
export { studentNavItems };

const SORT_OPTIONS = [
  { value: "for_you", label: "For you" },
  { value: "recent", label: "Most recent" },
  { value: "downloads", label: "Most downloaded" },
  { value: "session", label: "By session/year" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Compact skeletons while data loads (spans the whole grid).
function LoadingBooks() {
  return <div className="col-span-full"><ListSkeleton rows={3} /></div>;
}

// Each shortcut gets its own tint so the row reads as a set of places, not one grey strip.
// (Full class names on purpose: Tailwind can't see classes built from pieces.)
const TONES = {
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
};

// Quick navigation: only routes that already exist. Library is student-only.
function quickLinks(isRep) {
  return [
    { to: "/my-uploads", label: "Upload", icon: UploadCloud, tone: TONES.sky },
    isRep
      ? { to: "/bookmarks", label: "Bookmarks", icon: Bookmark, tone: TONES.violet }
      : { to: "/library", label: "My Library", icon: Library, tone: TONES.violet },
    { to: "/study", label: "Study Tools", icon: Sparkles, tone: TONES.amber },
    { to: "/rooms", label: "Study Rooms", icon: MessagesSquare, tone: TONES.emerald },
    { to: "/goals", label: "Goals", icon: Target, tone: TONES.rose },
    { to: "/points", label: "Leaderboard", icon: Trophy, tone: TONES.indigo },
  ];
}

// Every course keeps one colour (picked from its code), so you learn to spot your courses by colour.
const COURSE_TONES = [
  { bar: "bg-sky-500", tile: TONES.sky, text: "text-sky-700 dark:text-sky-300" },
  { bar: "bg-violet-500", tile: TONES.violet, text: "text-violet-700 dark:text-violet-300" },
  { bar: "bg-amber-500", tile: TONES.amber, text: "text-amber-700 dark:text-amber-300" },
  { bar: "bg-emerald-500", tile: TONES.emerald, text: "text-emerald-700 dark:text-emerald-300" },
  { bar: "bg-rose-500", tile: TONES.rose, text: "text-rose-700 dark:text-rose-300" },
  { bar: "bg-indigo-500", tile: TONES.indigo, text: "text-indigo-700 dark:text-indigo-300" },
];
const toneFor = (code = "") => COURSE_TONES[[...code].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COURSE_TONES.length];

const heroPill = "max-w-full truncate rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white";
const heroBtn = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60";

// The student experience — courses, private uploads, and a ranked, infinite-
// scroll feed of materials. Course Reps get this exact page too (as their
// "Student Dashboard"): same search, same download-all, same feed, just
// reached from a different nav item. RepDashboard (their uploads/queue) is
// still their landing page.
export default function StudentDashboard() {
  const { user } = useAuth();
  const isRep = user.role === "rep";
  const [dash, setDash] = useState(null);
  const [dashError, setDashError] = useState("");
  const [sort, setSort] = useState("for_you");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const navigate = useNavigate();
  const showToast = useToast();
  const progress = useStudyProgress(dash?.privateMaterials || []);

  useEffect(() => {
    setDash(null); setDashError("");
    getDashboard().then(setDash).catch((err) => setDashError(err.message || "Couldn't load your dashboard."));
  }, []);

  // Debounce the feed search so we're not firing a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    (cursor) => getFeedMaterials({ sort, q: debouncedQuery, cursor }),
    [sort, debouncedQuery]
  );
  const {
    items: materials, loading, loadingMore, error: feedError, hasMore, sentinelRef,
  } = useInfiniteScroll({
    fetchPage,
    getItems: (res) => res.materials,
    getNextCursor: (res) => res.pagination?.nextCursor,
    deps: [sort, debouncedQuery],
  });

  const q = debouncedQuery.toLowerCase();
  const filteredCourses = useMemo(() => {
    if (!dash) return [];
    if (!q) return dash.courses;
    return dash.courses.filter((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
  }, [dash, q]);
  const filteredPrivate = useMemo(() => {
    const list = dash?.privateMaterials || [];
    if (!q) return list;
    return list.filter((m) => m.title.toLowerCase().includes(q) || m.courseId?.code?.toLowerCase().includes(q));
  }, [dash, q]);

  // Average reading progress across all of the learner's courses, for the header summary.
  const overall = dash?.courses?.length
    ? Math.round(dash.courses.reduce((sum, c) => sum + progress.courseProgress(c._id), 0) / dash.courses.length)
    : 0;

  async function handleDownloadAll() {
    if (materials.length === 0) { showToast("Nothing to download yet.", "info"); return; }
    setDownloadingAll(true);
    try {
      // No explicit ids — the server zips the caller's own dashboard courses,
      // so "Download all" always reflects everything, not just this scroll page.
      await downloadAllMaterials({});
      showToast("Your zip download has started.", "success");
    } catch (err) {
      showToast(err.message || "Couldn't download all materials.", "error");
    } finally {
      setDownloadingAll(false);
    }
  }

  const sidebarItems = isRep ? repNavItemsFor(user) : studentNavItems;

  return (
    <AppShell sidebarItems={sidebarItems}>
      {!isRep && <StudyTipModal />}

      {/* Width cap keeps everything moderate on large screens. */}
      <div className="mx-auto w-full max-w-4xl text-[13px]">
        {/* Header: greeting, who/where you are, the main actions and search, in one panel. */}
        <section className="overflow-hidden rounded-2xl bg-primary p-3 text-white">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {/* !-prefixed so these win over the .lv-page-title defaults */}
              <h1 className="lv-page-title !text-lg !text-white sm:!text-xl truncate">
                {greeting()}, {user.name.split(" ")[0]}
              </h1>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {user.school?.name && <span className={heroPill}>{user.school.name}</span>}
                {user.department && <span className={heroPill}>{user.department}</span>}
                {user.level && <span className={heroPill}>{user.level} Level</span>}
                {user.semester && <span className={heroPill}>{user.semester}</span>}
                {user.session && <span className={heroPill}>{user.session}</span>}
                
              </div>
            </div>
            <img src={booksIllustration} alt="" aria-hidden="true" className="h-14 w-14 shrink-0 rounded-xl bg-white/90 object-contain p-1 sm:h-16 sm:w-16" />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button onClick={handleDownloadAll} disabled={downloadingAll} aria-label="Download all" className={`${heroBtn} bg-white text-primary hover:bg-white/90`}>
              <DownloadCloud className="h-3.5 w-3.5" />{downloadingAll ? "Preparing..." : "Download all"}
            </button>
            {!isRep && (
              <button onClick={() => navigate("/my-uploads")} aria-label="Upload" className={`${heroBtn} bg-white/15 text-white hover:bg-white/25`}>
                <UploadCloud className="h-3.5 w-3.5" />Upload
              </button>
            )}
            {dash && (
              <span className="ml-auto flex items-center gap-1 text-[10.5px] font-medium text-white/90">
                <span className="rounded-full bg-black/15 px-2 py-0.5">{dash.courses.length} course{dash.courses.length === 1 ? "" : "s"}</span>
                <span className="rounded-full bg-black/15 px-2 py-0.5">{overall}% read</span>
              </span>
            )}
          </div>

          <div className="relative mt-2.5 max-w-sm">
            <Input
              icon={<Search className="h-3.5 w-3.5" />}
              placeholder="Search courses and materials..."
              className="!py-1.5 !text-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </section>

        {/* Quick navigation */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {quickLinks(isRep).map(({ to, label, icon: Icon, tone }) => (
            <Link key={to} to={to} className="lv-card-interactive flex flex-col items-center gap-1 p-2 text-center text-[10.5px] font-medium">
              <span className={`grid h-8 w-8 place-items-center rounded-full ${tone}`}><Icon className="h-4 w-4" /></span>
              {label}
            </Link>
          ))}
        </div>

        {/* Server-side streak, points and today's goals. */}
        <div className="mt-3"><StreakCard /></div>

        {dashError && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger" role="alert">
            <span>{dashError}</span>
            <Button size="sm" variant="outline" onClick={() => { setDashError(""); getDashboard().then(setDash).catch((err) => setDashError(err.message || "Couldn't load your dashboard.")); }}>Retry</Button>
          </div>
        )}

        {!dash && !dashError ? (
          <div className="mt-4"><LoadingBooks /></div>
        ) : dash && (
          <>
            <section className="mt-4">
              <div className="mb-1.5 flex items-center gap-1.5">
                <h2 className="lv-section-title !text-[13px]">Your courses</h2>
                <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium lv-meta dark:bg-slate-800">{filteredCourses.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {filteredCourses.map((c) => {
                  const tone = toneFor(c.code);
                  const pct = progress.courseProgress(c._id);
                  return (
                    <button
                      key={c._id}
                      onClick={() => navigate(`/course/${c._id}`)}
                      className="lv-card-interactive relative flex flex-col overflow-hidden p-2.5 pt-3 text-left"
                    >
                      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} />
                      <span className="flex items-center gap-1.5">
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${tone.tile}`}><FolderKanban className="h-3 w-3" /></span>
                        <span className={`truncate font-display text-[10.5px] font-bold tracking-wide ${tone.text}`}>{c.code}</span>
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-night dark:text-slate-100">{c.title}</span>
                      <span className="mt-auto pt-1.5">
                        <ProgressBar value={pct} />
                        <span className="mt-1 flex items-center justify-between text-[10px] lv-meta">
                          <span className="truncate">{c.semester}{c.session && `, ${c.session}`}</span>
                          <span className="shrink-0 pl-1 font-medium">{pct}% read</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
                {filteredCourses.length === 0 && (
                  <EmptyState
                    icon={<FolderKanban className="h-5 w-5" />}
                    title={q ? "No courses match" : "No courses yet"}
                    message={q ? "Try the course code instead." : "Courses for your department, level and session appear here as soon as a rep sets them up."}
                  />
                )}
              </div>
            </section>

            {filteredPrivate.length > 0 && (
              <section className="mt-5">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <h2 className="lv-section-title flex items-center gap-1.5 !text-[13px]"><Lock className="h-3 w-3" /> Just for you</h2>
                  <Button size="sm" variant="ghost" className="!px-2 !py-1 !text-xs text-primary" onClick={() => navigate("/my-uploads")}>
                    {dash.privateTotal > filteredPrivate.length ? `See all (${dash.privateTotal})` : "Manage"} <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredPrivate.map((m) => (
                    <MaterialCard key={m._id} material={m} isBookmarked={progress.isOpened(m._id)} onOpen={() => navigate(`/material/${m._id}`)} />
                  ))}
                </div>
              </section>
            )}

            {/* <section className="mt-5">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <h2 className="lv-section-title !text-[13px]">{sort === "for_you" ? "For you" : "Latest materials"}</h2>
                <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort materials" className="w-auto py-1 text-xs">
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>

              {feedError && !loading && (
                <div className="mb-2 rounded-xl border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger" role="alert">{feedError}</div>
              )}

              {loading ? (
                <LoadingBooks />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {materials.map((m) => (
                    <MaterialCard key={m._id} material={m} isBookmarked={progress.isOpened(m._id)} onOpen={() => navigate(`/material/${m._id}`)} />
                  ))}
                  {materials.length === 0 && !feedError && (
                    <EmptyState
                      icon={<FileText className="h-5 w-5" />}
                      title={q ? "No materials match" : "No materials yet"}
                      message={q ? "Try the course code instead." : "Nothing has been uploaded for your courses yet. Check the explore feed for related material."}
                    />
                  )}
                  {materials.length > 0 && <InfiniteScrollSentinel sentinelRef={sentinelRef} hasMore={hasMore} loadingMore={loadingMore} />}
                </div>
              )}
            </section> */}

            {/* Closing banner: a clear next step once you've seen your own courses. */}
            <Link to="/explore" className="group mt-5 flex items-center justify-between gap-3 rounded-2xl bg-night p-3 text-white transition-opacity hover:opacity-95 dark:bg-slate-800">
              <span className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15"><Compass className="h-4 w-4" /></span>
                <span>
                  <span className="block text-xs font-semibold">Explore other departments</span>
                  <span className="block text-[10.5px] text-white/70">Browse courses beyond your own</span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
