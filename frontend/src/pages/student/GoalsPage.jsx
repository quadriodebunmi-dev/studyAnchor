import React, { useCallback, useEffect, useState } from "react";
import { Check, Flame, Pause, Play, Plus, Target, Trash2, Pencil } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import Modal from "../../components/Modal.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import StreakCard from "../../components/StreakCard.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Field, Input, Textarea } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import { completeGoal, createGoal, deleteGoal, listGoals, updateGoal } from "../../services/progressService.js";
import { useStudyTimer } from "../../context/StudyTimerContext.jsx";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function GoalsPage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [streakKey, setStreakKey] = useState(0);
  const load = useCallback(() => listGoals().then(setData).catch(() => setData({ goals: [], today: "" })), []);
  useEffect(() => { load(); }, [load]);
  // A timed session was just saved (by the floating timer): refresh progress and the streak.
  useEffect(() => {
    const onLogged = () => { load(); setStreakKey((k) => k + 1); };
    window.addEventListener("sa:session-logged", onLogged);
    return () => window.removeEventListener("sa:session-logged", onLogged);
  }, [load]);

  const open = data?.goals.filter((g) => g.status !== "completed") || [];
  const done = data?.goals.filter((g) => g.status === "completed") || [];

  async function act(fn, ok) { try { const r = await fn(); if (ok) toast(r?.message || ok, "success"); load(); setStreakKey((k) => k + 1); } catch (e) { toast(e.message || "Something went wrong.", "error"); } }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Study goals</h1><p className="text-sm lv-meta">Set a daily target, start a goal and the timer logs your study time for you.</p></div>
        <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" />New goal</Button>
      </div>

      <div className="mt-5" key={streakKey}><StreakCard /></div>

      <div className="mt-6 space-y-4">
        {!data ? <InlineLoader /> : open.length === 0 ? (
          <EmptyState icon={<Target className="h-7 w-7" />} title="No goals yet" message="A goal like '30 minutes, Mon–Fri' keeps you consistent. We'll remind you at the time you choose." action={<Button onClick={() => setEditing({})}>Create your first goal</Button>} />
        ) : open.map((g) => <GoalCard key={g._id} g={g} onEdit={() => setEditing(g)}
          onPause={() => act(() => updateGoal(g._id, { status: g.status === "paused" ? "active" : "paused" }), g.status === "paused" ? "Goal resumed" : "Goal paused")}
          onComplete={() => window.confirm("Mark this goal as completed?") && act(() => completeGoal(g._id), "Goal completed")}
          onDelete={() => window.confirm("Delete this goal? Your logged time stays in your history.") && act(() => deleteGoal(g._id), "Goal deleted")} />)}
      </div>

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-lg font-semibold">Completed</h2>
          <ul className="space-y-2">{done.map((g) => <li key={g._id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />{g.title}</span>{g.completionRewarded && <Badge tone="green">Points earned</Badge>}</li>)}</ul>
        </section>
      )}

      {editing && <GoalForm goal={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </AppShell>
  );
}

function GoalCard({ g, onEdit, onPause, onComplete, onDelete }) {
  const toast = useToast();
  const { timer, start } = useStudyTimer();
  const p = g.progress;
  const isTiming = timer?.goalId === g._id;
  const otherTiming = Boolean(timer) && !isTiming;
  // Count down what's left of today's target; if it's already met (or it's not a study day), a full session.
  const left = p.todayScheduled ? Math.max(0, p.todayTarget - p.todayMinutes) : 0;
  const sessionMinutes = left > 0 ? left : g.targetMinutes;
  function startGoal() {
    if (start(g, sessionMinutes * 60)) toast(`Timer started — ${sessionMinutes} min for “${g.title}”.`, "success");
  }
  const pct = Math.min(100, p.todayTarget ? Math.round((p.todayMinutes / p.todayTarget) * 100) : 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-display font-semibold">{g.title}</h3>
          <p className="text-xs lv-meta">{g.targetMinutes} min · {g.studyDays.map((d) => DAYS[d]).join(", ")} · from {g.startDay}{g.endDay && ` to ${g.endDay}`}</p></div>
        <div className="flex gap-1.5">{g.status === "paused" && <Badge tone="amber">Paused</Badge>}{g.reminderEnabled && <Badge tone="violet">Reminder {g.reminderTime}</Badge>}</div>
      </div>
      {g.description && <p className="mt-2 text-sm lv-meta">{g.description}</p>}

      {p.todayScheduled && g.status === "active" ? (
        <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>Today</span><span>{p.todayMinutes}/{p.todayTarget} min{p.todayMet && " ✓"}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className={`h-full ${p.todayMet ? "bg-success" : "bg-accent"}`} style={{ width: `${pct}%` }} /></div></div>
      ) : <p className="mt-4 text-xs lv-meta">{g.status === "paused" ? "Paused" : "Not a study day today."}</p>}

      <p className="mt-3 text-sm"><span className="font-semibold">{p.metDays}</span> of {p.scheduledSoFar} study days met ({p.percent}%){p.ended && " · period ended"}</p>
      {g.canEarnReward && <p className="mt-1 flex items-center gap-1 text-xs text-success"><Flame className="h-3 w-3" />Completing this goal now earns points.</p>}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {g.status === "active" && (isTiming
          ? <Badge tone="green">Timer running — top right</Badge>
          : <Button size="sm" onClick={startGoal} disabled={otherTiming} title={otherTiming ? "Finish the timer that's already running first" : undefined}><Play className="h-3.5 w-3.5" />Start goal · {sessionMinutes} min</Button>)}
        <Button size="sm" variant="ghost" onClick={onPause}>{g.status === "paused" ? <><Play className="h-3.5 w-3.5" />Resume</> : <><Pause className="h-3.5 w-3.5" />Pause</>}</Button>
        <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-3.5 w-3.5" />Edit</Button>
        <Button size="sm" variant="ghost" onClick={onComplete}><Check className="h-3.5 w-3.5" />Complete</Button>
        <Button size="sm" variant="ghost" className="text-danger" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
      </div>
    </div>
  );
}

function GoalForm({ goal, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ title: "", description: "", targetMinutes: 30, studyDays: [1, 2, 3, 4, 5], startDay: "", endDay: "", reminderEnabled: false, reminderTime: "18:00", ...goal, endDay: goal.endDay || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const toggleDay = (d) => setF((p) => ({ ...p, studyDays: p.studyDays.includes(d) ? p.studyDays.filter((x) => x !== d) : [...p.studyDays, d].sort() }));

  async function save(e) {
    e.preventDefault(); setBusy(true); setError("");
    const body = { title: f.title, description: f.description, targetMinutes: Number(f.targetMinutes), studyDays: f.studyDays, endDay: f.endDay || null, reminderEnabled: f.reminderEnabled, reminderTime: f.reminderTime };
    if (f.startDay) body.startDay = f.startDay;
    try { goal._id ? await updateGoal(goal._id, body) : await createGoal(body); toast("Goal saved", "success"); onSaved(); }
    catch (err) { setError(err.message || "Couldn't save the goal."); } finally { setBusy(false); }
  }
  return (
    <Modal title={goal._id ? "Edit goal" : "New study goal"} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <Field label="What are you working on?"><Input value={f.title} onChange={set("title")} maxLength={100} placeholder="e.g. Revise CSC 201" required /></Field>
        <Field label="Notes (optional)"><Textarea rows={2} value={f.description} onChange={set("description")} maxLength={400} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Minutes per study day"><Input type="number" min="5" max="480" value={f.targetMinutes} onChange={set("targetMinutes")} /></Field>
          <Field label="Start date" hint="Empty = today"><Input type="date" value={f.startDay} onChange={set("startDay")} /></Field>
          <Field label="End date (optional)"><Input type="date" value={f.endDay} onChange={set("endDay")} /></Field>
        </div>
        <fieldset><legend className="mb-1.5 text-sm font-medium">Study days</legend>
          <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => <button type="button" key={d} aria-pressed={f.studyDays.includes(i)} onClick={() => toggleDay(i)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${f.studyDays.includes(i) ? "bg-primary text-primary-fg" : "bg-slate-100 dark:bg-slate-800"}`}>{d}</button>)}</div></fieldset>
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.reminderEnabled} onChange={set("reminderEnabled")} />Remind me on study days</label>
          {f.reminderEnabled && <Field label="Reminder time (your local time)"><Input type="time" value={f.reminderTime} onChange={set("reminderTime")} /></Field>}
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !f.title.trim() || !f.studyDays.length}>{busy ? "Saving…" : "Save goal"}</Button></div>
      </form>
    </Modal>
  );
}
