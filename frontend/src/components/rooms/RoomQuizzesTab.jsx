import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus, Clock } from "lucide-react";
import Button from "../Button.jsx";
import Badge from "../Badge.jsx";
import Modal from "../Modal.jsx";
import EmptyState from "../EmptyState.jsx";
import { InlineLoader } from "../Loader.jsx";
import { Field, Input } from "../FormFields.jsx";
import { useToast } from "../Toast.jsx";
import { createQuiz, listQuizzes } from "../../services/roomQuizService.js";
import { subscribe } from "../../services/realtime.js";

export const STATE_LABEL = {
  draft: ["Draft", "slate"], scheduled: ["Scheduled", "amber"], available: ["Open", "green"],
  closed: ["Closed", "red"], results_released: ["Results out", "indigo"],
};
const fmt = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");

export default function RoomQuizzesTab({ room }) {
  // Any member can create a quiz; they manage the ones they made (owners and moderators manage all).
  const [quizzes, setQuizzes] = useState(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(() => listQuizzes(room._id).then(setQuizzes).catch(() => setQuizzes([])), [room._id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let off = () => {};
    subscribe({ "quiz:published": load, "quiz:updated": load, "quiz:opened": load, "quiz:results_released": load }).then((fn) => { off = fn; });
    return () => off();
  }, [load]);

  async function create(e) {
    e.preventDefault();
    try { const q = await createQuiz(room._id, { title }); navigate(`/rooms/${room._id}/quizzes/${q._id}/manage`); }
    catch (err) { toast(err.message || "Couldn't create the quiz.", "error"); }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end"><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New quiz</Button></div>
      {quizzes === null ? <InlineLoader /> : quizzes.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No quizzes yet" message="Create a quiz for the room — write questions yourself or generate them from study material." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {quizzes.map((q) => {
            const [label, tone] = STATE_LABEL[q.state] || ["", "slate"];
            const mine = q.myAttempt;
            return (
              <li key={q._id}>
                <button onClick={() => navigate(`/rooms/${room._id}/quizzes/${q._id}`)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-card hover:shadow-lift dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display font-semibold">{q.title}</p>
                    <Badge tone={tone}>{label}</Badge>
                  </div>
                  {q.creator?.name && <p className="mt-0.5 text-xs lv-meta">By {q.creator.name}</p>}
                  <p className="mt-1 text-xs lv-meta">{q.questionCount} question{q.questionCount === 1 ? "" : "s"} · {q.totalMarks} marks{q.timeLimitMinutes > 0 && ` · ${q.timeLimitMinutes} min`}</p>
                  {q.state === "scheduled" && <p className="mt-2 flex items-center gap-1 text-xs"><Clock className="h-3 w-3" />Opens {fmt(q.opensAt)}</p>}
                  {q.state === "available" && q.closesAt && <p className="mt-2 flex items-center gap-1 text-xs"><Clock className="h-3 w-3" />Due {fmt(q.closesAt)}</p>}
                  {mine?.status === "submitted" && <p className="mt-2 text-xs text-success">You submitted this quiz</p>}
                  {mine?.status === "in_progress" && <p className="mt-2 text-xs text-warning">In progress — resume</p>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {creating && (
        <Modal title="New quiz" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="space-y-4">
            <Field label="Quiz title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Week 4 recap" required autoFocus /></Field>
            <p className="text-xs lv-meta">You'll add questions and choose timing next. Nothing is visible to members until you publish.</p>
            <Button type="submit" disabled={title.trim().length < 3}>Create draft</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
