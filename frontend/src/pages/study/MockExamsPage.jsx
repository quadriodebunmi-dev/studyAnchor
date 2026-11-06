import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Play, Sparkles, Trash2, TrendingUp, TrendingDown, History } from "lucide-react";
import UpgradeNotice, { isUpgradeError } from "../../components/UpgradeNotice.jsx";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import Modal from "../../components/Modal.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Pager from "../../components/Pager.jsx";
import MaterialPicker from "../../components/MaterialPicker.jsx";
import { CardSkeleton } from "../../components/Loader.jsx";
import { Field, Input, Select } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import { deleteExam, examAnalytics, examHistory, generateExam, listExams, startExam } from "../../services/studyService.js";

export default function MockExamsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [hist, setHist] = useState(null);
  const [preview, setPreview] = useState(null);
  const load = () => listExams({ page }).then(setData).catch(() => setData({ exams: [], pagination: null }));
  useEffect(() => { setData(null); load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { examAnalytics().then(setAnalytics).catch(() => {}); examHistory({ limit: 5 }).then(setHist).catch(() => {}); }, []);

  async function begin(exam) {
    try { const r = await startExam(exam._id); navigate(`/study/exams/attempt/${r.attempt._id}`); } catch (e) { toast(e.message || "Couldn't start the exam.", "error"); }
  }
  async function remove(exam) {
    if (!window.confirm(`Delete "${exam.title}" and its results?`)) return;
    await deleteExam(exam._id).catch(() => {});
    load();
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Mock exams</h1><p className="text-sm lv-meta">Practise under exam conditions, then see which topics need work.</p></div>
        <Button onClick={() => setCreating(true)}><Sparkles className="h-4 w-4" />New mock exam</Button>
      </div>

      {analytics && analytics.attemptsAnalysed > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display font-semibold">Your strengths &amp; weaknesses</h2>
          <p className="text-xs lv-meta">Based on your last {analytics.attemptsAnalysed} exam(s) · average {analytics.averagePercentage}%{analytics.note && ` · ${analytics.note}`}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div><p className="mb-1.5 flex items-center gap-1 text-sm font-medium text-danger"><TrendingDown className="h-4 w-4" />Needs work</p>{analytics.weak.length ? <div className="flex flex-wrap gap-1.5">{analytics.weak.map((t) => <Badge key={t} tone="red">{t}</Badge>)}</div> : <p className="text-xs lv-meta">No clearly weak topics yet.</p>}</div>
            <div><p className="mb-1.5 flex items-center gap-1 text-sm font-medium text-success"><TrendingUp className="h-4 w-4" />Strong</p>{analytics.strong.length ? <div className="flex flex-wrap gap-1.5">{analytics.strong.map((t) => <Badge key={t} tone="green">{t}</Badge>)}</div> : <p className="text-xs lv-meta">Keep practising to find your strengths.</p>}</div>
          </div>
          {analytics.topics.some((t) => t.level === "insufficient_data") && <p className="mt-3 text-xs lv-meta">Topics with fewer than 3 marked questions aren't classified yet.</p>}
        </section>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {!data ? <CardSkeleton count={2} /> : data.exams.length === 0 ? (
          <EmptyState icon={<ClipboardCheck className="h-7 w-7" />} title="No mock exams yet" message="Choose a material or course and we'll build a practice exam." action={<Button onClick={() => setCreating(true)}>Create one</Button>} />
        ) : data.exams.map((e) => (
          <div key={e._id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="font-display font-semibold leading-snug">{e.title}</p>
            <p className="mt-1 text-xs lv-meta">{e.questionCount} questions · {e.totalMarks} marks · {e.difficulty}{e.timeLimitMinutes > 0 && ` · ${e.timeLimitMinutes} min`}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{e.topics.slice(0, 4).map((t) => <Badge key={t} tone="violet">{t}</Badge>)}{e.topics.length > 4 && <Badge>+{e.topics.length - 4}</Badge>}</div>
            <p className="mt-2 text-xs lv-meta">{e.attemptCount} attempt(s){e.bestPercentage != null && ` · best ${e.bestPercentage}%`}</p>
            <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => setPreview(e)}><Play className="h-3.5 w-3.5" />Preview &amp; start</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(e)}><Trash2 className="h-3.5 w-3.5" />Delete</Button></div>
          </div>
        ))}
      </div>
      {data && <Pager pagination={data.pagination} onPageChange={setPage} />}

      {hist?.history?.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><History className="h-4 w-4" />Recent attempts</h2>
          <ul className="space-y-2">
            {hist.history.map((h) => (
              <li key={h._id}><button onClick={() => navigate(`/study/exams/attempt/${h._id}`)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-accent dark:border-slate-800 dark:bg-slate-900">
                <span className="truncate">{h.title}</span><span className="shrink-0 font-medium">{h.percentage}%{h.gradingStatus !== "complete" && <span className="ml-2 text-xs text-warning">provisional</span>}</span>
              </button></li>
            ))}
          </ul>
        </section>
      )}

      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          <ul className="space-y-1.5 text-sm">
            <li>{preview.questionCount} questions · {preview.totalMarks} marks · {preview.difficulty}</li>
            <li>{preview.timeLimitMinutes > 0 ? `Time limit: ${preview.timeLimitMinutes} minutes` : "No time limit"}</li>
            <li>{preview.explanationMode === "immediate" ? "You can check answers as you go (a checked answer locks)." : "Explanations appear after you submit."}</li>
            {preview.materialTitles?.length > 0 && <li className="lv-meta">From: {preview.materialTitles.join(", ")}</li>}
            <li className="lv-meta">Topics: {preview.topics.join(", ")}</li>
          </ul>
          <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setPreview(null)}>Not now</Button><Button onClick={() => begin(preview)}>Start exam</Button></div>
        </Modal>
      )}
      {creating && <CreateExam onClose={() => setCreating(false)} onCreated={(e) => { setCreating(false); toast(`Exam ready with ${e.questionCount} questions`, "success"); setPage(1); load(); }} />}
    </AppShell>
  );
}

function CreateExam({ onClose, onCreated }) {
  const [materials, setMaterials] = useState([]);
  const [f, setF] = useState({ title: "", numQuestions: 10, format: "objective", difficulty: "Medium", timeLimitMinutes: 0, explanationMode: "after" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function run() {
    setBusy(true); setError("");
    try {
      const r = await generateExam({ ...f, numQuestions: Number(f.numQuestions), timeLimitMinutes: Number(f.timeLimitMinutes), materialIds: materials.map((m) => m._id) });
      onCreated(r.exam);
    } catch (e) { setUpgrade(isUpgradeError(e)); setError(e.message || "Couldn't create the exam."); setBusy(false); }
  }

  return (
    <Modal title="New mock exam" onClose={onClose} wide>
      <div className="space-y-4">
        <MaterialPicker selected={materials} onChange={setMaterials} max={5} label="Choose materials" />
        <Field label="Title (optional)"><Input value={f.title} onChange={set("title")} maxLength={140} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Questions"><Input type="number" min="3" max="30" value={f.numQuestions} onChange={set("numQuestions")} /></Field>
          <Field label="Type"><Select value={f.format} onChange={set("format")}><option value="objective">Multiple choice</option><option value="theory">Written</option><option value="mixed">Mixed</option></Select></Field>
          <Field label="Difficulty"><Select value={f.difficulty} onChange={set("difficulty")}><option>Easy</option><option>Medium</option><option>Hard</option></Select></Field>
          <Field label="Time limit (minutes)" hint="0 = untimed"><Input type="number" min="0" max="240" value={f.timeLimitMinutes} onChange={set("timeLimitMinutes")} /></Field>
        </div>
        <Field label="Explanations"><Select value={f.explanationMode} onChange={set("explanationMode")}><option value="after">After I submit</option><option value="immediate">Let me check answers as I go</option></Select></Field>
        {upgrade ? <UpgradeNotice message={error} /> : error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="accent" disabled={!materials.length || busy} onClick={run}><Sparkles className="h-4 w-4" />{busy ? "Building exam…" : "Generate exam"}</Button></div>
      </div>
    </Modal>
  );
}