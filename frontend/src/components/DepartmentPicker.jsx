import React, { useEffect, useRef, useState } from "react";
import { Building2, Search, Plus, Check, Loader2 } from "lucide-react";
import { Input } from "./FormFields.jsx";
import Button from "./Button.jsx";
import { searchDepartments, requestDepartment } from "../services/departmentService.js";

// Search-and-request typeahead for department, built like SchoolPicker:
// debounces search-as-you-type against GET /api/departments (scoped to the
// current school when one is known). `value` / `onChange` carry the department
// NAME, but a name is only ever reported once it was picked from the list or
// added through "Can't find your department?". Typing clears the value back to
// "", so a half-typed or misspelt name can never be submitted.
//
// requireSchool: for signup-style forms where the department only makes sense
// inside a school — the field stays disabled until a school is chosen.
export default function DepartmentPicker({ schoolId, value, onChange, placeholder = "Search for your department", requireSchool = false }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [existing, setExisting] = useState(null); // the department that blocked a duplicate request
  const [shortName, setShortName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const requestIdRef = useRef(0); // lets us ignore out-of-date responses
  const prevSchoolRef = useRef(schoolId);

  // Show a selection that was set elsewhere (e.g. a prefilled profile). An
  // empty value never overwrites what the person is in the middle of typing.
  useEffect(() => { if (value) setQuery(value); }, [value]);

  // Switching school invalidates the pick and whatever was searched against
  // the old school.
  useEffect(() => {
    if (prevSchoolRef.current === schoolId) return;
    prevSchoolRef.current = schoolId;
    requestIdRef.current++;
    clearTimeout(debounceRef.current);
    setResults([]); setOpen(false); setSearching(false); setSearchError("");
    setRequesting(false); setQuery("");
    if (value) onChange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      clearTimeout(debounceRef.current);
    };
  }, []);

  function handleQueryChange(q) {
    setQuery(q);
    if (value) onChange(""); // typing again clears a prior selection
    clearTimeout(debounceRef.current);
    const term = q.trim();
    const id = ++requestIdRef.current;
    if (!term) {
      setResults([]); setSearching(false); setSearchError(""); setOpen(false);
      return;
    }
    // Open straight away so the "Searching…" state is visible while we wait.
    setSearching(true); setSearchError(""); setOpen(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchDepartments(term, schoolId);
        if (id !== requestIdRef.current) return;
        setResults(found);
      } catch {
        if (id !== requestIdRef.current) return;
        setResults([]);
        setSearchError("Couldn't search right now. Check your connection and try again.");
      } finally {
        if (id === requestIdRef.current) setSearching(false);
      }
    }, 250);
  }

  function pick(dept) {
    requestIdRef.current++; // drop any search still in flight
    clearTimeout(debounceRef.current);
    setSearching(false);
    setQuery(dept.name);
    onChange(dept.name);
    setOpen(false);
  }

  async function handleRequestSubmit(e) {
    e.preventDefault();
    setRequestError("");
    setExisting(null);
    const name = query.trim();
    if (!name) { setRequestError("Department name is required."); return; }
    setSubmitting(true);
    try {
      const dept = await requestDepartment({ name, shortName: shortName.trim() || undefined, schoolId });
      pick(dept);
      setRequesting(false);
      setShortName("");
    } catch (err) {
      // 409: it's already there (maybe under its abbreviation) — offer the existing one.
      setExisting(err.department || null);
      setRequestError(err.message || "Couldn't add that department. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const blocked = requireSchool && !schoolId;
  const needsPick = !!query.trim() && !value && !searching && !open && !requesting;

  return (
    <div ref={containerRef} className="relative">
      {!requesting ? (
        <>
          <div className="relative">
            <Input
              icon={value ? <Check className="w-4 h-4 text-success" /> : <Building2 className="w-4 h-4" />}
              placeholder={blocked ? "Select your school first" : placeholder}
              className="pr-9 disabled:cursor-not-allowed disabled:opacity-60"
              autoComplete="off"
              disabled={blocked}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => { if (query.trim() && !value && (results.length || searching || searchError)) setOpen(true); }}
            />
            {searching && (
              <Loader2 aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>
          {needsPick && (
            <p className="mt-1 text-xs text-warning">Pick your department from the list, or add it.</p>
          )}
          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card max-h-56 overflow-y-auto" role="listbox" aria-busy={searching}>
              {searching ? (
                <p className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-slate-400" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching departments…
                </p>
              ) : searchError ? (
                <p className="px-3 py-2 text-sm text-danger">{searchError}</p>
              ) : (
                <>
                  {results.map((d) => (
                    <button
                      type="button"
                      key={d._id}
                      role="option"
                      onClick={() => pick(d)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span>{d.name}{d.shortName ? <span className="text-slate-400"> ({d.shortName})</span> : null}</span>
                      {!d.verified && <span className="text-[10px] rounded-full bg-warning/20 text-warning px-2 py-0.5">Unverified</span>}
                    </button>
                  ))}
                  {results.length === 0 && (
                    <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No matches.</p>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => { setRequesting(true); setOpen(false); }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-primary border-t border-slate-100 dark:border-slate-800"
              >
                <Plus className="w-3.5 h-3.5" /> Can't find your department? Add it
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <p className="text-sm font-medium">Add your department</p>
          <Input icon={<Search className="w-4 h-4" />} placeholder="Department name" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Input placeholder="Short name (optional), e.g. MLS" maxLength={20} value={shortName} onChange={(e) => setShortName(e.target.value)} />
          {requestError && <p className="text-xs text-danger">{requestError}</p>}
          {existing && (
            <Button type="button" size="sm" variant="outline" onClick={() => { pick(existing); setRequesting(false); setExisting(null); setRequestError(""); }}>
              Use {existing.name}{existing.shortName ? ` (${existing.shortName})` : ""}
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={submitting} onClick={handleRequestSubmit}>{submitting ? "Adding..." : "Add department"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setRequesting(false); setRequestError(""); setExisting(null); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
