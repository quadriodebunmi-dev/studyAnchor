import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Target, Trophy } from "lucide-react";
import { getProgressSummary } from "../services/progressService.js";

const CARD = "lv-card-interactive flex min-w-0 flex-col gap-1 p-3";

// Dashboard widget: streak, points and today's goals, as three compact tiles.
export default function StreakCard() {
  const [d, setD] = useState(null);
  useEffect(() => { getProgressSummary().then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const s = d.streak;
  const met = d.todayGoals.filter((g) => g.todayMet).length;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Link to="/goals" className={CARD}>
        <span className="flex items-center gap-1 text-[11px] lv-meta"><Flame className="h-3.5 w-3.5 text-accent" /> Streak</span>
        <span className="font-display text-xl font-bold leading-none">{s.current}<span className="ml-0.5 text-[11px] font-normal lv-meta">d</span></span>
        <span className="truncate text-[10.5px] lv-meta">{s.activeToday ? "Studied today ✓" : s.atRisk ? "Study to keep it" : "Start today"} · best {s.longest}</span>
      </Link>
      <Link to="/points" className={CARD}>
        <span className="flex items-center gap-1 text-[11px] lv-meta"><Trophy className="h-3.5 w-3.5 text-accent" /> Points</span>
        <span className="font-display text-xl font-bold leading-none">{d.points}</span>
        <span className="truncate text-[10.5px] lv-meta">Leaderboard</span>
      </Link>
      <Link to="/goals" className={CARD}>
        <span className="flex items-center gap-1 text-[11px] lv-meta"><Target className="h-3.5 w-3.5 text-accent" /> Goals</span>
        <span className="font-display text-xl font-bold leading-none">{d.todayGoals.length ? `${met}/${d.todayGoals.length}` : "—"}</span>
        <span className="truncate text-[10.5px] lv-meta">{d.todayGoals.length ? (d.todayGoals.find((g) => !g.todayMet)?.title || "All met today") : "Set a goal"}</span>
      </Link>
    </div>
  );
}
