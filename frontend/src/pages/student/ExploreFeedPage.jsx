import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, School } from "lucide-react";
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

  const CourseCard = ({ c }) => (
    <button onClick={() => navigate(`/course/${c._id}`)} className="lv-card-interactive text-left p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-primary">{c.code}</p>
        <div className="flex items-center gap-1.5">
          {scope === "mine" && user.level && (c.department !== user.department || c.level !== user.level) && <Badge tone="violet">Other</Badge>}
          {c.feedReason && <Badge tone="slate">{c.feedReason}</Badge>}
        </div>
      </div>
      <p className="mt-0.5 font-semibold text-sm">{c.title}</p>
      <p className="mt-1.5 text-xs lv-meta">
        {c.department} · {c.level} Level{c.session && ` · ${c.session}`}
        {typeof c.materialCount === "number" && ` · ${c.materialCount} material${c.materialCount === 1 ? "" : "s"}`}
      </p>
    </button>
  );

  return (
    <AppShell>
      <h1 className="text-lg font-bold">Explore Feed</h1>
      <p className="mt-1 text-xs lv-meta">
        {scope === "mine"
          ? "Browse other departments and levels at your school — read-only, doesn't affect your dashboard."
          : pickedSchool
            ? `Browsing ${pickedSchool.name} — read-only.`
            : "Browsing courses from every school on Study Anchor — read-only."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-700" role="group" aria-label="Which schools to show">
          {[["mine", "My school"], ["all", "All schools"]].map(([value, label]) => (
            <Button key={value} size="sm" variant={scope === value ? "primary" : "ghost"} aria-pressed={scope === value} onClick={() => changeScope(value)}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      {scope === "all" && (
        <div className="mt-3 max-w-sm">
          <Field label="Sorted by school">
            <SchoolPicker key={pickerKey} value={pickedSchool} onSelect={setPickedSchool} />
          </Field>
          {pickedSchool && (
            <button onClick={clearPickedSchool} className="mt-1.5 text-xs font-medium text-primary">
              ← Browse all
            </button>
          )}
        </div>
      )}

      <div className="mt-4 relative max-w-md">
        <Input icon={<Search className="w-3 h-3" />} placeholder="Search by code, title or department..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="flex flex-col gap-0.5">
          <label htmlFor="filter-department" className="text-xs font-medium lv-meta">Department</label>
          <Select id="filter-department" value={filters.department} onChange={setFilter("department")} className="text-xs">
            <option>All</option>{departments.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label htmlFor="filter-level" className="text-xs font-medium lv-meta">Level</label>
          <Select id="filter-level" value={filters.level} onChange={setFilter("level")} className="text-xs">
            <option>All</option>{levels.map((l) => <option key={l}>{l}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label htmlFor="filter-semester" className="text-xs font-medium lv-meta">Semester</label>
          <Select id="filter-semester" value={filters.semester} onChange={setFilter("semester")} className="text-xs">
            <option>All</option>{SEMESTERS.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label htmlFor="filter-session" className="text-xs font-medium lv-meta">Session</label>
          <Select id="filter-session" value={filters.session} onChange={setFilter("session")} className="text-xs">
            <option>All</option>{SESSIONS.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
      </div>

      {error && !loading && (
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger" role="alert">{error}</div>
      )}

      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <img src={searchingIllustration} alt="" aria-hidden="true" className="h-32 w-32" />
          <p className="text-xs lv-meta">Searching for courses…</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-1 py-6 text-center">
          <img src={notFoundIllustration} alt="" aria-hidden="true" className="h-50 w-50" />
          <h3 className="mt-2 font-display text-sm font-semibold text-night dark:text-slate-100">No courses match</h3>
          <p className="max-w-sm text-xs lv-meta">Try a different keyword or adjust your filters.</p>
        </div>
      ) : groups ? (
        <>
          {groups.map((g, i) => (
            <section key={`${g.key}-${i}`} className="mt-8">
              <h2 className="lv-section-title mb-3 text-sm flex items-center gap-1.5">
                <School className="h-3.5 w-3.5" /> {g.school?.name || "Unassigned"} 
                {g.key === idOf(user.schoolId) && <Badge tone="accent">Your school</Badge>}
                {g.school && !g.school.verified && <Badge tone="amber">Unverified</Badge>}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{g.courses.map((c) => <CourseCard key={c._id} c={c} />)}</div>
            </section>
          ))}
          <InfiniteScrollSentinel sentinelRef={sentinelRef} hasMore={hasMore} loadingMore={loadingMore} />
        </>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => <CourseCard key={c._id} c={c} />)}
          <InfiniteScrollSentinel sentinelRef={sentinelRef} hasMore={hasMore} loadingMore={loadingMore} />
        </div>
      )}
    </AppShell>
  );
}