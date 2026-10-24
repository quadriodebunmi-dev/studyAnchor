import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Settings2 } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { STATE_LABEL } from "../../components/rooms/RoomQuizzesTab.jsx";
import { Leaderboard, ResultSummary, ReviewList } from "../../components/rooms/QuizResultView.jsx";
import { getLeaderboard, getMyResult, getQuiz } from "../../services/roomQuizService.js";
import { subscribe } from "../../services/realtime.js";

const fmt = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");

export default function QuizDetailPage() {
  const { roomId, quizId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [board, setBoard] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await getQuiz(roomId, quizId);
      setData(d);
      const q = d.quiz;
      if (q.myAttempt?.status === "submitted") {
        getMyResult(roomId, quizId).then(setResult).catch(() => {});
        getLeaderboard(roomId, quizId).then(setBoard).catch(() => {});
      } else if (!d.canAttempt) getLeaderboard(roomId, quizId).then(setBoard).catch(() => {});
    } catch (e) { setError(e.message || "Quiz not found."); }
  }, [roomId, quizId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let off = () => {};
    subscribe({ "quiz:results_released": load, "quiz:updated": load, "quiz:opened": load }).then((fn) => { off = fn; });
    // Without sockets, check again every 30s so an opening/closing quiz doesn't look stale.
    const id = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => { off(); clearInterval(id); };
  }, [load]);

  if (error) return <AppShell><p className="py-16 text-center text-danger">{error}</p></AppShell>;
  if (!data) return <AppShell><InlineLoader /></AppShell>;

  const { quiz, canAttempt } = data;
  const [stateLabel, tone] = STATE_LABEL[quiz.state] || ["", "slate"];
  const mine = quiz.myAttempt;
  const canStart = canAttempt && quiz.state === "available" && (!mine || mine.status === "in_progress");

  return (
    <AppShell>
      <button onClick={() => navigate(`/rooms/${roomId}?tab=quizzes`)} className="mb-3 inline-flex items-center gap-1 text-sm lv-meta hover:text-night dark:hover:text-white"><ArrowLeft className="h-4 w-4" />Back to room</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone={tone}>{stateLabel}</Badge><Badge>{quiz.questionCount} questions</Badge><Badge>{quiz.totalMarks} marks</Badge>{quiz.timeLimitMinutes > 0 && <Badge tone="amber"><Clock className="h-3 w-3" />{quiz.timeLimitMinutes} min</Badge>}</div>
        </div>
        {!canAttempt && <Link to={`/rooms/${roomId}/quizzes/${quizId}/manage`}><Button variant="outline"><Settings2 className="h-4 w-4" />Manage quiz</Button></Link>}
      </div>

      {quiz.instructions && <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-100 p-4 text-sm dark:bg-slate-800">{quiz.instructions}</p>}
      <ul className="mt-4 space-y-1 text-sm lv-meta">
        {quiz.opensAt && <li>Opens: {fmt(quiz.opensAt)}</li>}
        {quiz.closesAt && <li>Deadline: {fmt(quiz.closesAt)}</li>}
        <li>Results: {quiz.releaseMode === "immediate" ? "shown right after you submit" : quiz.releaseMode === "manual" ? "released by the quiz creator" : quiz.releaseMode === "scheduled" ? `released ${fmt(quiz.releaseAt)}` : "released when the quiz closes"}</li>
      </ul>

      {canAttempt && (
        <div className="mt-6">
          {canStart && (
            <Button size="lg" onClick={() => navigate(`/rooms/${roomId}/quizzes/${quizId}/take`)}>{mine?.status === "in_progress" ? "Resume quiz" : "Start quiz"}</Button>
          )}
          {!mine && quiz.state === "scheduled" && <p className="text-sm">This quiz opens {fmt(quiz.opensAt)}.</p>}
          {!mine && ["closed", "results_released"].includes(quiz.state) && <p className="text-sm">This quiz is closed and you didn't take it.</p>}
          {mine?.status === "submitted" && !result && <p className="rounded-2xl bg-slate-100 p-4 text-sm dark:bg-slate-800">You submitted this quiz. Your results will appear when they're released.</p>}
        </div>
      )}

      {result?.result && (
        <section className="mt-8 space-y-4">
          <h2 className="font-display text-xl font-semibold">Your result</h2>
          <ResultSummary result={result.result} />
          <ReviewList review={result.review} />
        </section>
      )}
      {board && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-xl font-semibold">Leaderboard</h2>
          <Leaderboard data={board} />
        </section>
      )}
    </AppShell>
  );
}
