import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, School, FileText } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { Select, Input, Field } from "../../components/FormFields.jsx";
import SchoolPicker from "../../components/SchoolPicker.jsx";
import Badge from "../../components/Badge.jsx";
import Button from "../../components/Button.jsx";
import InfiniteScrollSentinel from "../../components/InfiniteScrollSentinel.jsx";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll.js";
import { getExploreFeed } from "../../services/feedService.js";
import { getSchoolStructure } from "../../services/schoolService.js";
import { DEPARTMENTS, LEVELS, SEMESTERS, SESSIONS } from "../../config/appConfig.js";
import { useAuth } from "../../context/AuthContext.jsx";
import searchingIllustration from "../../../public/Searching-for-word.svg";
import notFoundIllustration from "../../../public/404-Page-Animation.svg";

const idOf = (v) => String(v?._id || v || "");

// Level -> chip colour. Full class names on purpose: Tailwind can't see classes built from pieces.
const LEVEL_CHIP = {
  100: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  200: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  300: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  400: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  500: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  600: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};
const DEFAULT_LEVEL_CHIP = "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";

// Defined at module level (not inside the page) so cards don't remount on every render.
// Built to sit two across on a phone: code + material count on top, a two-line title,
// the department, then small chips for level, session and any feed tags.
function CourseCard({ c, scope, user, onOpen }) {
  const other = scope === "mine" && user.level && (c.department !== user.department || c.level !== user.level);
  const count = typeof c.materialCount === "number" ? c.materialCount : null;
  const materials = count === null ? "" : `${count} material${count === 1 ? "" : "s"}`;
  return (
    <button onClick={() => onOpen(c)} className="lv-card-interactive flex h-full flex-col gap-1 p-2 text-left">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10.5px] font-bold tracking-wide text-primary">{c.code}</span>
        {count !== null && (
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] lv-meta" title={materials}>
            <FileText className="h-3 w-3" aria-label={materials} />{count}
          </span>
        )}
      </div>
      <p className="line-clamp-2 text-xs font-semibold leading-snug">{c.title}</p>
      <p className="truncate text-[10px] lv-meta">{c.department}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5">
        <span className={`rounded-full px-1.5 text-[9.5px] font-medium ${LEVEL_CHIP[c.level] || DEFAULT_LEVEL_CHIP}`}>{c.level} Level</span>
        {c.session && <span className="rounded-full bg-slate-100 px-1.5 text-[9.5px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{c.session}</span>}
        <span className="contents [&>*]:!px-1.5 [&>*]:!py-0 [&>*]:!text-[9.5px]">
          {other && <Badge tone="violet">Other</Badge>}
          {c.feedReason && <Badge tone="slate">{c.feedReason}</Badge>}
        </span>
      </div>
    </button>
  );
}

export default function ExploreFeedPage() {
  const { user } = useAuth();
  // "mine" = the user's own school; "all" = every school. Deliberately plain
  // state (not persisted), so every visit starts back on "mine".
  const [scope, setScope] = useState("mine");
  // A specific school picked from the search box below, when scope is "all".
  // Picking one takes over from the "group by school" view and narrows the
  // feed to just that school's courses.
  const [pickedSchool, setPickedSchool] = useState(null);
  // Forces SchoolPicker to remount (and so clear its own search text) when
  // the person clicks "Browse all schools" — it only reads its initial
  // value once, so this is the reset switch.
  const [pickerKey, setPickerKey] = useState(0);
  const [filters, setFilters] = useState({ department: "All", level: "All", semester: "All", session: "All" });
  const [structure, setStructure] = useState(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const navigate = useNavigate();

  // Level/department options come from the user's school, not app-wide constants.
  useEffect(() => {
    if (user.schoolId) getSchoolStructure(user.schoolId).then(setStructure).catch(() => {});
  }, [user.schoolId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  function changeScope(next) {
    setScope(next);
    setPickedSchool(null);
    setPickerKey((k) => k + 1);
  }

  function clearPickedSchool() {
    setPickedSchool(null);
    setPickerKey((k) => k + 1);
  }

  // Picking a specific school makes "grouped by school" redundant (there's
  // only one), so that view sorts by relevance within the chosen school;
  // "all schools, nothing picked" is the grouped browse; "my school" is
  // always just relevance.
  const sort = pickedSchool ? "relevance" : scope === "all" ? "school" : "relevance";

  const fetchPage = useCallback(
    (cursor) => getExploreFeed({ scope, schoolId: pickedSchool?._id, sort, q: debouncedQuery, ...filters, cursor }),
    [scope, pickedSchool, sort, debouncedQuery, filters]
  );
  const { items: courses, loading, loadingMore, error, hasMore, sentinelRef } = useInfiniteScroll({
    fetchPage,
    getItems: (res) => res.courses,
    getNextCursor: (res) => res.pagination?.nextCursor,
    deps: [scope, pickedSchool, sort, debouncedQuery, filters],
  });

  const levels = structure?.levels?.length ? structure.levels : LEVELS;
  const departments = useMemo(() => {
    const base = structure?.departments?.length ? structure.departments : DEPARTMENTS;
    return [...new Set([...base, ...courses.map((c) => c.department)])].sort();
  }, [structure, courses]);

  // Grouping is display-only: the server already orders "school" sort with the
  // caller's own school first, then A→Z, so consecutive same-school runs just
  // need a header — we never re-sort the loaded pages client-side (that would
  // break cursor paging).
  const groups = useMemo(() => {
    if (sort !== "school") return null;
    const out = [];
    for (const c of courses) {
      const key = idOf(c.schoolId) || "none";
      const last = out[out.length - 1];
      if (last && last.key === key) last.courses.push(c);
      else out.push({ key, school: c.schoolId && typeof c.schoolId === "object" ? c.schoolId : null, courses: [c] });
    }
    return out;
  }, [courses, sort]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const openCourse = (c) => navigate(`/course/${c._id}`);

  // Shared label/select styling so all four filters stay compact.
  const filterLabel = "text-[10.5px] font-medium lv-meta";
  const filterSelect = "!py-1 !text-xs";

  return (
    <AppShell>
      {/* Width cap keeps everything moderate on large screens. */}
      <div className="mx-auto w-full max-w-4xl text-[13px]">
        <h1 className="!text-base sm:!text-lg font-bold">Explore Feed</h1>
        <p className="mt-0.5 text-[11px] lv-meta">
          {scope === "mine"
            ? "Browse other departments and levels at your school — read-only, doesn't affect your dashboard."
            : pickedSchool
              ? `Browsing ${pickedSchool.name} — read-only.`
              : "Browsing courses from every school on Study Anchor — read-only."}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label="Which schools to show">
            {[["mine", "My school"], ["all", "All schools"]].map(([value, label]) => (
              <Button key={value} size="sm" variant={scope === value ? "primary" : "ghost"} className="!px-2.5 !py-1 !text-xs" aria-pressed={scope === value} onClick={() => changeScope(value)}>
                {label}
              </Button>
            ))}
          </div>
        </div>

        {scope === "all" && (
          <div className="mt-2.5 max-w-xs">
            <Field label="Sorted by school">
              <SchoolPicker key={pickerKey} value={pickedSchool} onSelect={setPickedSchool} />
            </Field>
            {pickedSchool && (
              <button onClick={clearPickedSchool} className="mt-1 text-[11px] font-medium text-primary">
                ← Browse all
              </button>
            )}
          </div>
        )}

        <div className="mt-3 relative max-w-sm">
          <Input icon={<Search className="w-3 h-3" />} className="!py-1.5 !text-xs" placeholder="Search by code, title or department..." value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="filter-department" className={filterLabel}>Department</label>
            <Select id="filter-department" value={filters.department} onChange={setFilter("department")} className={filterSelect}>
              <option>All</option>{departments.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label htmlFor="filter-level" className={filterLabel}>Level</label>
            <Select id="filter-level" value={filters.level} onChange={setFilter("level")} className={filterSelect}>
              <option>All</option>{levels.map((l) => <option key={l}>{l}</option>)}
            </Select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label htmlFor="filter-semester" className={filterLabel}>Semester</label>
            <Select id="filter-semester" value={filters.semester} onChange={setFilter("semester")} className={filterSelect}>
              <option>All</option>{SEMESTERS.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label htmlFor="filter-session" className={filterLabel}>Session</label>
            <Select id="filter-session" value={filters.session} onChange={setFilter("session")} className={filterSelect}>
              <option>All</option>{SESSIONS.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
        </div>

        {error && !loading && (
          <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger" role="alert">{error}</div>
        )}

        {loading ? (
          <div className="mt-8 flex flex-col items-center gap-2 text-center">
            <img src={searchingIllustration} alt="" aria-hidden="true" className="h-24 w-24" />
            <p className="text-[11px] lv-meta">Searching for courses…</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-1 py-4 text-center">
            {/* h-50/w-50 aren't default Tailwind classes, so use a real size */}
            <img src={notFoundIllustration} alt="" aria-hidden="true" className="h-36 w-36" />
            <h3 className="mt-1.5 font-display text-[13px] font-semibold text-night dark:text-slate-100">No courses match</h3>
            <p className="max-w-xs text-[11px] lv-meta">Try a different keyword or adjust your filters.</p>
          </div>
        ) : groups ? (
          <>
            {groups.map((g, i) => (
              <section key={`${g.key}-${i}`} className="mt-5">
                <h2 className="lv-section-title mb-2 !text-[13px] flex items-center gap-1.5">
                  <School className="h-3 w-3" /> {g.school?.name || "Unassigned"}
                  {g.key === idOf(user.schoolId) && <Badge tone="accent">Your school</Badge>}
                  {g.school && !g.school.verified && <Badge tone="amber">Unverified</Badge>}
                </h2>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">{g.courses.map((c) => <CourseCard key={c._id} c={c} scope={scope} user={user} onOpen={openCourse} />)}</div>
              </section>
            ))}
            <InfiniteScrollSentinel sentinelRef={sentinelRef} hasMore={hasMore} loadingMore={loadingMore} />
          </>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
            {courses.map((c) => <CourseCard key={c._id} c={c} scope={scope} user={user} onOpen={openCourse} />)}
            <div className="col-span-full"><InfiniteScrollSentinel sentinelRef={sentinelRef} hasMore={hasMore} loadingMore={loadingMore} /></div>
          </div>
        )}
      </div>
    </AppShell>
  );
}