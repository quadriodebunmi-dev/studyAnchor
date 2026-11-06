import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileQuestion, Search, UploadCloud, X } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import MaterialCard from "../../components/MaterialCard.jsx";
import Pager from "../../components/Pager.jsx";
import { CardSkeleton } from "../../components/Loader.jsx";
import { Input, Select } from "../../components/FormFields.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPastQuestions } from "../../services/materialService.js";

const SOURCES = [["all", "All"], ["class", "From my class"], ["personal", "My uploads"]];

// Old exam and test papers: the ones your school shares (approved by a Course Rep)
// plus the ones you saved yourself. Reps upload through their own upload page.
export default function PastQuestionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const independent = user.learnerType === "independent";
  const courseId = params.get("courseId") || "";

  const [source, setSource] = useState(independent ? "personal" : "all");
  const [q, setQ] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [years, setYears] = useState([]);

  useEffect(() => { setPage(1); }, [source, q, year, courseId]);
  useEffect(() => {
    let live = true;
    setData(null);
    const t = setTimeout(() => {
      getPastQuestions({ source, q: q.trim() || undefined, year: year || undefined, courseId: courseId || undefined, page, limit: 12 })
        .then((res) => { if (live) { setData(res); setYears(res.years || []); } })
        .catch(() => live && setData({ materials: [], pagination: null }));
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [source, q, year, courseId, page]);

  const uploadPath = user.role === "rep" ? "/rep/upload?kind=past_question" : "/my-uploads?kind=past_question";
  const chip = (active) => `lv-chip !px-2.5 !py-1 !text-[11px] ${active ? "lv-chip-active" : ""}`;
  const filtered = Boolean(q || year || courseId || source !== (independent ? "personal" : "all"));

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl text-[13px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="lv-page-title flex items-center gap-2"><FileQuestion className="h-5 w-5 text-primary" /> Past Questions</h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {independent ? "Old exam and test papers you've saved. Practise with them in Mock exams." : "Old exam and test papers from your class and your own collection."}
            </p>
          </div>
          <Button size="sm" onClick={() => navigate(uploadPath)}><UploadCloud className="h-3.5 w-3.5" />Upload past questions</Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Input icon={<Search className="h-3.5 w-3.5" />} className="!py-1.5 !text-xs" placeholder="Search by course code, title or tag" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search past questions" />
          </div>
          <Select className="w-auto !py-1.5 !text-xs" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filter by year">
            <option value="">Any year</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {!independent && SOURCES.map(([k, l]) => <button key={k} onClick={() => setSource(k)} className={chip(source === k)}>{l}</button>)}
          {courseId && (
            <button onClick={() => { const n = new URLSearchParams(params); n.delete("courseId"); setParams(n); }} className={`${chip(true)} inline-flex items-center gap-1`}>
              One course <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {!data ? <CardSkeleton count={4} /> : data.materials.length === 0 ? (
            <div className="sm:col-span-2">
              <EmptyState
                icon={<FileQuestion className="h-5 w-5" />}
                title={filtered ? "No past questions match" : "No past questions yet"}
                message={filtered ? "Try a different search, year or source." : "Upload an old exam or test paper and it will be listed here."}
                action={!filtered && <Button size="sm" onClick={() => navigate(uploadPath)}>Upload one</Button>}
              />
            </div>
          ) : data.materials.map((m) => <MaterialCard key={m._id} material={m} onOpen={() => navigate(`/material/${m._id}`)} />)}
        </div>
        <Pager pagination={data?.pagination} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}
