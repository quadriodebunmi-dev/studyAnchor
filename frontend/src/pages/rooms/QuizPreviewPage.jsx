import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { previewQuiz } from "../../services/roomQuizService.js";

// Managers see exactly what members will see — and nothing is recorded.
export default function QuizPreviewPage() {
  const { roomId, quizId } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  useEffect(() => { previewQuiz(roomId, quizId).then(setD).catch(() => navigate(-1)); }, [roomId, quizId, navigate]);
  if (!d) return <AppShell><InlineLoader /></AppShell>;
  return (
    <AppShell>
      <button onClick={() => navigate(`/rooms/${roomId}/quizzes/${quizId}/manage`)} className="mb-3 inline-flex items-center gap-1 text-sm lv-meta"><ArrowLeft className="h-4 w-4" />Back to editing</button>
      <h1 className="text-2xl font-bold">{d.quiz.title} <span className="text-sm font-normal lv-meta">(preview)</span></h1>
      <p className="mt-1 text-sm lv-meta">{d.quiz.timeLimitMinutes > 0 ? `${d.quiz.timeLimitMinutes} minute time limit` : "No time limit"} · {d.quiz.totalMarks} marks</p>
      {d.quiz.instructions && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-100 p-4 text-sm dark:bg-slate-800">{d.quiz.instructions}</p>}
      <ol className="mt-5 space-y-4">
        {d.questions.map((q, i) => (
          <li key={q._id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs lv-meta">Question {i + 1} · {q.marks} mark(s)</p>
            <p className="mt-1 font-medium">{q.prompt}</p>
            {q.type === "objective" ? <ul className="mt-3 space-y-2">{q.options.map((o, idx) => <li key={idx} className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">{String.fromCharCode(65 + idx)}. {o}</li>)}</ul>
              : <div className="mt-3 h-20 rounded-xl border border-dashed border-slate-300 p-3 text-sm lv-meta dark:border-slate-700">Written answer…</div>}
          </li>
        ))}
      </ol>
    </AppShell>
  );
}
