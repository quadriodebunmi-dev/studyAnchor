import React, { useEffect, useRef, useState } from "react";
import { Building2, Search, Plus, Check } from "lucide-react";
import { Input } from "./FormFields.jsx";
import Button from "./Button.jsx";
import { searchDepartments, requestDepartment } from "../services/departmentService.js";

// Search-and-request typeahead for department, built exactly like
// SchoolPicker: debounces search-as-you-type against GET /api/departments
// (scoped to the current school when one is known), and if nothing matches
// lets the visitor request their department on the spot — it's created
// unverified and usable immediately, and just waits on an admin's
// verification badge, same as an unverified school.
export default function DepartmentPicker({ schoolId, value, onChange, placeholder = "Search for your department" }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Stay in sync if the value changes elsewhere (school switched, form reset).
  useEffect(() => { setQuery(value || ""); }, [value]);

  // Switching school invalidates whatever was searched against the old one.
  useEffect(() => { setResults([]); setOpen(false); }, [schoolId]);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleQueryChange(q) {
    setQuery(q);
    // Typing counts as the value, same as before — the form can be
    // submitted without an extra click even on a department that isn't in
    // the list yet.
    onChange(q);
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        setResults(await searchDepartments(q.trim(), schoolId));
        setOpen(true);
      } catch { /* silent — typeahead is best-effort */ }
    }, 250);
  }

  function pick(dept) {
    setQuery(dept.name);
    onChange(dept.name);
    setOpen(false);
  }

  async function handleRequestSubmit(e) {
    e.preventDefault();
    setRequestError("");
    const name = query.trim();
    if (!name) { setRequestError("Department name is required."); return; }
    setSubmitting(true);
    try {
      const dept = await requestDepartment({ name, schoolId });
      pick(dept);
      setRequesting(false);
    } catch (err) {
      setRequestError(err.message || "Couldn't add that department. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const exactMatch = results.some((d) => d.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative">
      {!requesting ? (
        <>
          <Input
            icon={exactMatch ? <Check className="w-4 h-4 text-success" /> : <Building2 className="w-4 h-4" />}
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
          />
          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card max-h-56 overflow-y-auto">
              {results.map((d) => (
                <button
                  type="button"
                  key={d._id}
                  onClick={() => pick(d)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span>{d.name}</span>
                  {!d.verified && <span className="text-[10px] rounded-full bg-warning/20 text-warning px-2 py-0.5">Unverified</span>}
                </button>
              ))}
              {results.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No matches.</p>
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
          {requestError && <p className="text-xs text-danger">{requestError}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={submitting} onClick={handleRequestSubmit}>{submitting ? "Adding..." : "Add department"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRequesting(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
