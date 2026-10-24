import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles, Trash2, Pencil, Plus, Eye, Lock, Check, AlertTriangle } from "lucide-react";
import UpgradeNotice, { isUpgradeError } from "../../components/UpgradeNotice.jsx";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import Modal from "../../components/Modal.jsx";
import MaterialPicker from "../../components/MaterialPicker.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Field, Input, Select, Textarea } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import { STATE_LABEL } from "../../components/rooms/RoomQuizzesTab.jsx";
import * as api from "../../services/roomQuizService.js";

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (s) => (s ? new Date(s).toISOString() : null);

export default function QuizManagePage() {
  const { roomId, quizId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("questions");
  const [error, setError] = useState("");

  const load = useCallback(() => api.getQuizForManager(roomId, quizId).then(setData).catch((e) => setError(e.message || "Quiz not found.")), [roomId, quizId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <AppShell><p className="py-16 text-center text-danger">{error}</p></AppShell>;
  if (!data) return <AppShell><InlineLoader /></AppShell>;
  const { quiz, questions } = data;
  const [stateLabel, tone] = STATE_LABEL[quiz.state] || ["", "slate"];
  const patch = (next) => setData((d) => ({ ...d, ...next }));

  return (
    <AppShell>
      <button onClick={() => navigate(`/rooms/${roomId}?tab=quizzes`)} className="mb-3 inline-flex items-center gap-1 text-sm lv-meta hover:text-night dark:hover:text-white"><ArrowLeft className="h-4 w-4" />Back to room</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone={tone}>{stateLabel}</Badge><Badge>{quiz.questionCount} questions</Badge><Badge>{quiz.totalMarks} marks</Badge>{quiz.locked && <Badge tone="amber"><Lock className="h-3 w-3" />Questions locked</Badge>}</div>
        </div>
        <Button variant="outline" onClick={() => navigate(`/rooms/${roomId}/quizzes/${quizId}/preview`)}><Eye className="h-4 w-4" />Preview as a member</Button>
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800" role="tablist">
        {[["questions", "Questions"], ["settings", "Settings & publishing"], ["participation", "Participation & grading"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-accent text-night dark:text-white" : "border-transparent text-slate-500 hover:text-night dark:hover:text-white"}`}>{l}</button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "questions" && <QuestionsTab roomId={roomId} quiz={quiz} questions={questions} patch={patch} reload={load} />}
        {tab === "settings" && <SettingsTab roomId={roomId} quiz={quiz} questions={questions} patch={patch} reload={load} />}
        {tab === "participation" && <ParticipationTab roomId={roomId} quiz={quiz} />}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

const blank = (type) => ({ type, prompt: "", marks: type === "theory" ? 5 : 1, options: ["", "", "", ""], correctIndex: 0, explanation: "", expectedAnswer: "", rubric: "" });

function QuestionsTab({ roomId, quiz, questions, patch, reload }) {
  const toast = useToast();
  const locked = quiz.locked || quiz.status === "published";
  const [editing, setEditing] = useState(null); // question draft (with _id when editing)
  const [gen, setGen] = useState(false);
  const pending = questions.filter((q) => q.reviewStatus !== "approved").length;

  async function remove(q) {
    if (!window.confirm("Delete this question?")) return;
    try { await api.deleteQuestion(roomId, quiz._id, q._id); reload(); } catch (e) { toast(e.message, "error"); }
  }

  return (
    <div className="space-y-4">
      {locked && (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          {quiz.locked ? "Members have started this quiz, so its questions are locked to keep scoring fair." : "Unpublish the quiz (in Settings) to edit its questions."}
        </p>
      )}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(blank("objective"))}><Plus className="h-4 w-4" />Multiple choice</Button>
          <Button variant="outline" onClick={() => setEditing(blank("theory"))}><Plus className="h-4 w-4" />Written question</Button>
          <Button variant="accent" onClick={() => setGen(true)}><Sparkles className="h-4 w-4" />Generate with AI</Button>
        </div>
      )}
      {pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent/15 p-3 text-sm">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{pending} AI-generated question{pending === 1 ? "" : "s"} need your review before you can publish. Check each answer is correct.</span>
          {!locked && <Button size="sm" onClick={async () => { await api.approveQuestion(roomId, quiz._id, "all"); reload(); }}>Approve all</Button>}
        </div>
      )}

      {questions.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm lv-meta dark:border-slate-700">No questions yet.</p> : (
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li key={q._id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium"><span className="mr-1.5 text-slate-400">{i + 1}.</span>{q.prompt}</p>
                <span className="flex shrink-0 items-center gap-1.5">
                  {q.source === "ai" && <Badge tone={q.reviewStatus === "approved" ? "green" : "amber"}>{q.reviewStatus === "approved" ? "AI · reviewed" : "AI · needs review"}</Badge>}
                  <Badge>{q.marks} mk</Badge>
                </span>
              </div>
              {q.type === "objective" ? (
                <ul className="mt-2 space-y-1 text-sm">{q.options.map((o, idx) => <li key={idx} className={idx === q.correctIndex ? "font-medium text-success" : ""}>{String.fromCharCode(65 + idx)}. {o}{idx === q.correctIndex && " ✓"}</li>)}</ul>
              ) : (
                <div className="mt-2 text-sm">{q.expectedAnswer && <p><span className="lv-meta">Model answer: </span>{q.expectedAnswer}</p>}{q.rubric && <p><span className="lv-meta">Marking points: </span>{q.rubric}</p>}</div>
              )}
              {q.explanation && <p className="mt-1 text-xs lv-meta">Explanation: {q.explanation}</p>}
              {!locked && (
                <div className="mt-3 flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ ...q })}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                  {q.reviewStatus !== "approved" && <Button size="sm" variant="ghost" onClick={async () => { await api.approveQuestion(roomId, quiz._id, q._id); reload(); }}><Check className="h-3.5 w-3.5" />Approve</Button>}
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(q)}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {editing && <QuestionEditor roomId={roomId} quizId={quiz._id} draft={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {gen && <GenerateModal roomId={roomId} quiz={quiz} onClose={() => setGen(false)} onDone={() => { setGen(false); reload(); }} />}
    </div>
  );
}

function QuestionEditor({ roomId, quizId, draft, onClose, onSaved }) {
  const toast = useToast();
  const [q, setQ] = useState(draft);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setQ((p) => ({ ...p, [k]: e.target.value }));
  const setOpt = (i) => (e) => setQ((p) => ({ ...p, options: p.options.map((o, j) => (j === i ? e.target.value : o)) }));

  async function save() {
    setBusy(true);
    try {
      const body = { ...q, marks: Number(q.marks) };
      if (q._id) await api.updateQuestion(roomId, quizId, q._id, body); else await api.addQuestion(roomId, quizId, body);
      onSaved();
    } catch (e) { toast(e.message || "Couldn't save.", "error"); } finally { setBusy(false); }
  }

  return (
    <Modal title={`${q._id ? "Edit" : "New"} ${q.type === "theory" ? "written" : "multiple-choice"} question`} onClose={onClose} wide>
      <div className="space-y-4">
        <Field label="Question"><Textarea value={q.prompt} onChange={set("prompt")} rows={3} maxLength={1500} /></Field>
        {q.type === "objective" ? (
          <>
            <fieldset className="space-y-2"><legend className="mb-1 text-sm font-medium">Options — select the correct one</legend>
              {q.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={q.correctIndex === i} onChange={() => setQ((p) => ({ ...p, correctIndex: i }))} aria-label={`Option ${i + 1} is correct`} />
                  <Input value={o} onChange={setOpt(i)} placeholder={`Option ${String.fromCharCode(65 + i)}`} maxLength={500} />
                </div>
              ))}
            </fieldset>
            <Field label="Explanation" hint="Shown to members after results are released (if review is on)."><Textarea value={q.explanation} onChange={set("explanation")} rows={2} /></Field>
          </>
        ) : (
          <>
            <Field label="Model answer"><Textarea value={q.expectedAnswer} onChange={set("expectedAnswer")} rows={3} /></Field>
            <Field label="Marking points" hint="What earns marks — used for AI-assisted marking and by you."><Textarea value={q.rubric} onChange={set("rubric")} rows={2} /></Field>
          </>
        )}
        <Field label="Marks"><Input type="number" min="0.5" step="0.5" value={q.marks} onChange={set("marks")} /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save question"}</Button></div>
      </div>
    </Modal>
  );
}

function GenerateModal({ roomId, quiz, onClose, onDone }) {
  const toast = useToast();
  const [materials, setMaterials] = useState([]);
  const [f, setF] = useState({ topic: quiz.topic || "", count: 5, format: quiz.format, difficulty: "Medium" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function run() {
    setBusy(true); setError("");
    try {
      const r = await api.generateQuestions(roomId, quiz._id, { ...f, count: Number(f.count), materialIds: materials.map((m) => m._id) });
      toast(`${r.questions.length} question(s) added for your review`, "success");
      onDone();
    } catch (e) { setUpgrade(isUpgradeError(e)); setError(e.message || "Couldn't generate questions."); } finally { setBusy(false); }
  }

  return (
    <Modal title="Generate questions with AI" onClose={onClose} wide>
      <div className="space-y-4">
        <MaterialPicker selected={materials} onChange={setMaterials} max={3} label="Source material (optional)" />
        <Field label="Topic" hint={materials.length ? "Optional — narrows the questions." : "Required when no material is chosen."}><Input value={f.topic} onChange={set("topic")} maxLength={120} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="How many"><Input type="number" min="1" max="30" value={f.count} onChange={set("count")} /></Field>
          <Field label="Type"><Select value={f.format} onChange={set("format")}><option value="objective">Multiple choice</option><option value="theory">Written</option><option value="mixed">Mixed</option></Select></Field>
          <Field label="Difficulty"><Select value={f.difficulty} onChange={set("difficulty")}><option>Easy</option><option>Medium</option><option>Hard</option></Select></Field>
        </div>
        <p className="rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-800">AI can make mistakes. Every generated question is saved as <b>needs review</b> and can't be published until you've checked it.</p>
        {upgrade ? <UpgradeNotice message={error} /> : error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="accent" onClick={run} disabled={busy || (!materials.length && !f.topic.trim())}><Sparkles className="h-4 w-4" />{busy ? "Generating…" : "Generate"}</Button></div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Settings + lifecycle
// ---------------------------------------------------------------------------

function SettingsTab({ roomId, quiz, questions, patch, reload }) {
  const toast = useToast();
  const published = quiz.status === "published";
  const lockedCore = published; // core settings can't change once live
  const [f, setF] = useState({
    title: quiz.title, instructions: quiz.instructions, topic: quiz.topic, format: quiz.format, timeLimitMinutes: quiz.timeLimitMinutes,
    opensAt: toLocalInput(quiz.opensAt), closesAt: toLocalInput(quiz.closesAt), releaseMode: quiz.releaseMode, releaseAt: toLocalInput(quiz.releaseAt),
    showReview: quiz.showReview, allowLateJoiners: quiz.allowLateJoiners, tieBreak: quiz.tieBreak, theoryGrading: quiz.theoryGrading,
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const body = () => ({
    ...f, timeLimitMinutes: Number(f.timeLimitMinutes) || 0,
    opensAt: fromLocalInput(f.opensAt), closesAt: fromLocalInput(f.closesAt), releaseAt: fromLocalInput(f.releaseAt),
  });

  async function act(fn, ok) {
    setBusy(true); setErrors([]);
    try { await fn(); if (ok) toast(ok, "success"); await reload(); }
    catch (e) { setErrors(e.errors || [e.message || "Something went wrong."]); } finally { setBusy(false); }
  }
  const save = () => act(() => api.updateQuiz(roomId, quiz._id, body()), "Settings saved");
  const publish = () => act(async () => { await api.updateQuiz(roomId, quiz._id, body()); await api.publishQuiz(roomId, quiz._id); }, "Quiz published");

  return (
    <div className="max-w-2xl space-y-5">
      <Field label="Title"><Input value={f.title} onChange={set("title")} maxLength={120} /></Field>
      <Field label="Instructions"><Textarea value={f.instructions} onChange={set("instructions")} rows={3} maxLength={2000} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quiz type"><Select value={f.format} onChange={set("format")} disabled={lockedCore}><option value="objective">Multiple choice only</option><option value="theory">Written only</option><option value="mixed">Mixed</option></Select></Field>
        <Field label="Time limit (minutes)" hint="0 = no limit. The clock starts when each member begins."><Input type="number" min="0" max="300" value={f.timeLimitMinutes} onChange={set("timeLimitMinutes")} disabled={lockedCore} /></Field>
        <Field label="Opens at" hint="Leave empty to open as soon as it's published."><Input type="datetime-local" value={f.opensAt} onChange={set("opensAt")} disabled={lockedCore} /></Field>
        <Field label="Deadline" hint={quiz.attemptCount > 0 ? "You can extend it, not shorten it." : "Leave empty to close it yourself."}><Input type="datetime-local" value={f.closesAt} onChange={set("closesAt")} /></Field>
        <Field label="Release results"><Select value={f.releaseMode} onChange={set("releaseMode")} disabled={lockedCore}>
          <option value="on_close">When the quiz closes</option><option value="immediate">Immediately after each submission</option><option value="scheduled">At a set time</option><option value="manual">When I release them</option>
        </Select></Field>
        {f.releaseMode === "scheduled" && <Field label="Release at" hint="Must be on or after the deadline."><Input type="datetime-local" value={f.releaseAt} onChange={set("releaseAt")} /></Field>}
        <Field label="Marking written answers"><Select value={f.theoryGrading} onChange={set("theoryGrading")} disabled={lockedCore}>
          <option value="ai_assisted">AI suggests marks, I confirm</option><option value="manual">I mark them myself</option><option value="ai_final">AI marks count as final</option>
        </Select></Field>
      </div>
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.showReview} onChange={set("showReview")} />Show correct answers and explanations when results are out</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.allowLateJoiners} onChange={set("allowLateJoiners")} disabled={lockedCore} />Let members who join after publishing take it</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.tieBreak === "time"} onChange={(e) => setF((p) => ({ ...p, tieBreak: e.target.checked ? "time" : "none" }))} />Break ties by completion time <span className="lv-meta">(only fair if everyone has the same time limit)</span></label>
      </div>

      {errors.length > 0 && <ul role="alert" className="space-y-1 rounded-xl bg-danger/10 p-3 text-sm text-danger">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <Button variant="outline" onClick={save} disabled={busy}>Save settings</Button>
        {!published && <Button onClick={publish} disabled={busy || questions.length === 0}>Publish quiz</Button>}
        {published && quiz.attemptCount === 0 && <Button variant="outline" onClick={() => act(() => api.unpublishQuiz(roomId, quiz._id), "Quiz unpublished")} disabled={busy}>Unpublish</Button>}
        {published && !["closed", "results_released"].includes(quiz.state) && <Button variant="outline" onClick={() => window.confirm("Close the quiz now? Members still in progress will be submitted.") && act(() => api.closeQuiz(roomId, quiz._id), "Quiz closed")} disabled={busy}>Close now</Button>}
        {published && quiz.releaseMode !== "immediate" && quiz.state !== "results_released" && <Button variant="accent" onClick={() => window.confirm("Close the quiz (if open) and release everyone's results now?") && act(() => api.releaseResults(roomId, quiz._id), "Results released")} disabled={busy}>Release results now</Button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Participation + grading
// ---------------------------------------------------------------------------

function ParticipationTab({ roomId, quiz }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [board, setBoard] = useState(null);
  const load = useCallback(() => {
    api.getParticipation(roomId, quiz._id).then(setData).catch(() => setData({ participation: [], summary: {} }));
    api.getLeaderboard(roomId, quiz._id).then(setBoard).catch(() => {});
  }, [roomId, quiz._id]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <InlineLoader />;
  const s = data.summary;
  const statusBadge = { not_started: ["Not started", "slate"], in_progress: ["In progress", "amber"], submitted: ["Submitted", "green"] };

  return (
    <div className="space-y-5">
      {quiz.status !== "published" ? <p className="text-sm lv-meta">Publish the quiz to start collecting submissions.</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Eligible", s.eligible], ["Submitted", s.submitted], ["In progress", s.inProgress], ["Need grading", s.needsGrading]].map(([l, v]) => (
              <div key={l} className="rounded-2xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900"><p className="font-display text-2xl font-bold">{v ?? 0}</p><p className="text-xs lv-meta">{l}</p></div>
            ))}
          </div>
          {s.averagePercentage !== null && s.averagePercentage !== undefined && <p className="text-sm lv-meta">Average {s.averagePercentage}% · Highest {s.highestPercentage}%</p>}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase lv-meta"><tr><th className="px-4 py-2">Member</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Score</th><th className="px-4 py-2" /></tr></thead>
              <tbody>
                {data.participation.map((r) => (
                  <tr key={r.user._id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-2">{r.user.name}{!r.eligible && <span className="ml-2 text-xs lv-meta">(joined after publish)</span>}</td>
                    <td className="px-4 py-2"><Badge tone={statusBadge[r.status][1]}>{statusBadge[r.status][0]}</Badge>{r.submitReason === "time_expired" && <span className="ml-2 text-xs text-warning">auto-submitted</span>}</td>
                    <td className="px-4 py-2">{r.status === "submitted" ? <>{r.score}/{r.maxScore} ({r.percentage}%){r.gradingStatus !== "complete" && <span className="ml-2 text-xs text-warning">{r.gradingStatus === "provisional" ? "provisional" : "needs marking"}</span>}</> : "—"}</td>
                    <td className="px-4 py-2 text-right">{r.status === "submitted" && <Button size="sm" variant="ghost" onClick={() => setOpen(r.attemptId)}>View / grade</Button>}</td>
                  </tr>
                ))}
                {data.participation.length === 0 && <tr><td className="px-4 py-6 text-center lv-meta" colSpan={4}>No members yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {open && <GradeModal roomId={roomId} quiz={quiz} attemptId={open} onClose={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function GradeModal({ roomId, quiz, attemptId, onClose }) {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [marks, setMarks] = useState({});
  const [fb, setFb] = useState({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.getAttemptForGrading(roomId, quiz._id, attemptId).then((r) => {
    setD(r);
    setMarks(Object.fromEntries(r.questions.filter((q) => q.type === "theory").map((q) => [q._id, q.grade?.marks ?? ""])));
    setFb(Object.fromEntries(r.questions.filter((q) => q.type === "theory").map((q) => [q._id, q.grade?.feedback ?? ""])));
  }), [roomId, quiz._id, attemptId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => { setBusy(true); try { await fn(); if (ok) toast(ok, "success"); await load(); } catch (e) { toast(e.message || "Something went wrong.", "error"); } finally { setBusy(false); } };

  if (!d) return <Modal title="Attempt" onClose={onClose} wide><InlineLoader /></Modal>;
  const theory = d.questions.filter((q) => q.type === "theory");

  return (
    <Modal title={`${d.attempt.user.name} — ${d.attempt.score}/${d.attempt.maxScore}`} onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm lv-meta">Status: {d.attempt.gradingStatus === "complete" ? "fully marked" : d.attempt.gradingStatus === "provisional" ? "AI-marked, awaiting your confirmation" : "written answers need marking"}</p>
        {theory.length === 0 ? <p className="text-sm">This quiz has no written questions — it was marked automatically.</p> : theory.map((q) => (
          <div key={q._id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-sm font-medium">{q.prompt}</p>
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-800">{q.answer.text || "No answer given."}</p>
            {q.expectedAnswer && <p className="mt-2 text-xs"><span className="lv-meta">Model answer: </span>{q.expectedAnswer}</p>}
            {q.grade?.graderType === "ai" && <p className="mt-2 text-xs text-warning">AI suggestion ({q.grade.confidence || "unknown"} confidence): {q.grade.marks}/{q.marks}. {q.grade.feedback}</p>}
            <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr]">
              <Input type="number" min="0" max={q.marks} step="0.5" value={marks[q._id]} onChange={(e) => setMarks((m) => ({ ...m, [q._id]: e.target.value }))} placeholder={`/ ${q.marks}`} aria-label="Marks" />
              <Input value={fb[q._id]} onChange={(e) => setFb((m) => ({ ...m, [q._id]: e.target.value }))} placeholder="Feedback (optional)" aria-label="Feedback" />
            </div>
          </div>
        ))}
        {theory.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {quiz.theoryGrading !== "manual" && <Button variant="outline" disabled={busy} onClick={() => run(() => api.aiGradeAttempt(roomId, quiz._id, attemptId), "AI marks suggested")}><Sparkles className="h-4 w-4" />AI suggest marks</Button>}
            {theory.some((q) => q.grade?.status === "provisional") && <Button variant="outline" disabled={busy} onClick={() => run(() => api.confirmAiGrades(roomId, quiz._id, attemptId), "AI marks confirmed")}>Confirm AI marks</Button>}
            <Button disabled={busy} onClick={() => run(() => api.gradeAttempt(roomId, quiz._id, attemptId, theory.filter((q) => marks[q._id] !== "" && marks[q._id] !== null).map((q) => ({ question: q._id, marks: Number(marks[q._id]), feedback: fb[q._id] }))), "Marks saved")}>Save my marks</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
