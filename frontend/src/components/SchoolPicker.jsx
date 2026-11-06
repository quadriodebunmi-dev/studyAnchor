import React, { useEffect, useRef, useState } from "react";
import { Building2, Search, Plus, Check, Loader2 } from "lucide-react";
import { Input } from "./FormFields.jsx";
import Button from "./Button.jsx";
import { searchSchools, requestSchool } from "../services/schoolService.js";

// Typeahead used at signup (student + rep + Google continue). Debounces
// search-as-you-type against GET /api/schools. A school only counts once it
// has been picked from the list (or added through "Can't find your school?"):
// typing clears any earlier pick, and the parent only ever receives a real
// school record. If nothing matches, the visitor can add their school on the
// spot — it's usable immediately and waits on an admin's verification badge.
export default function SchoolPicker({ value, onSelect }) {
  const [query, setQuery] = useState(value?.name || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestForm, setRequestForm] = useState({ name: "", domain: "", city: "" });
  const [requestError, setRequestError] = useState("");
  const [existing, setExisting] = useState(null); // the school that blocked a duplicate request
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const requestIdRef = useRef(0); // lets us ignore out-of-date responses

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
    if (value) onSelect(null); // typing again clears a prior selection
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
        const found = await searchSchools(term);
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

  function pick(school) {
    requestIdRef.current++; // drop any search still in flight
    clearTimeout(debounceRef.current);
    setSearching(false);
    onSelect(school);
    setQuery(school.name);
    setOpen(false);
  }

  async function handleRequestSubmit(e) {
    e.preventDefault();
    setRequestError("");
    setExisting(null);
    if (!requestForm.name.trim()) { setRequestError("School name is required."); return; }
    setSubmitting(true);
    try {
      const school = await requestSchool(requestForm);
      pick(school);
      setRequesting(false);
    } catch (err) {
      // 409: that school is already on the platform — offer it instead.
      setExisting(err.school || null);
      setRequestError(err.message || "Couldn't add that school. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const needsPick = !!query.trim() && !value && !searching && !open;

  return (
    <div ref={containerRef} className="relative">
      {!requesting ? (
        <>
          <div className="relative">
            <Input
              icon={value ? <Check className="w-4 h-4 text-success" /> : <Building2 className="w-4 h-4" />}
              placeholder="Search for your school"
              className="pr-9"
              autoComplete="off"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => { if (query.trim() && !value && (results.length || searching || searchError)) setOpen(true); }}
            />
            {searching && (
              <Loader2 aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>
          {needsPick && (
            <p className="mt-1 text-xs text-warning">Pick your school from the list, or add it.</p>
          )}
          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card max-h-56 overflow-y-auto" role="listbox" aria-busy={searching}>
              {searching ? (
                <p className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-slate-400" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching schools…
                </p>
              ) : searchError ? (
                <p className="px-3 py-2 text-sm text-danger">{searchError}</p>
              ) : (
                <>
                  {results.map((s) => (
                    <button
                      type="button"
                      key={s._id}
                      role="option"
                      onClick={() => pick(s)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span>{s.name}{s.city ? <span className="text-slate-400"> · {s.city}</span> : null}</span>
                      {!s.verified && <span className="text-[10px] rounded-full bg-warning/20 text-warning px-2 py-0.5">Unverified</span>}
                    </button>
                  ))}
                  {results.length === 0 && (
                    <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No matches.</p>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => { setRequesting(true); setRequestForm((f) => ({ ...f, name: query })); setOpen(false); }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-primary border-t border-slate-100 dark:border-slate-800"
              >
                <Plus className="w-3.5 h-3.5" /> Can't find your school? Add it
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <p className="text-sm font-medium">Add your school</p>
          <Input icon={<Search className="w-4 h-4" />} placeholder="School name" value={requestForm.name} onChange={(e) => setRequestForm((f) => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Domain (optional)" value={requestForm.domain} onChange={(e) => setRequestForm((f) => ({ ...f, domain: e.target.value }))} />
            <Input placeholder="City (optional)" value={requestForm.city} onChange={(e) => setRequestForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
          {requestError && <p className="text-xs text-danger">{requestError}</p>}
          {existing && (
            <Button type="button" size="sm" variant="outline" onClick={() => { pick(existing); setRequesting(false); setExisting(null); setRequestError(""); }}>
              Use {existing.name}
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={submitting} onClick={handleRequestSubmit}>{submitting ? "Adding..." : "Add school"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setRequesting(false); setRequestError(""); setExisting(null); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
