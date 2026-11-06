import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Info, Settings2 } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Badge from "../../components/Badge.jsx";
import Pager from "../../components/Pager.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { getLeaderboard, getPointRules, getPointsHistory } from "../../services/progressService.js";

const TABS = [["leaderboard", "Leaderboard"], ["history", "My points"], ["rules", "How points work"]];

export default function PointsPage() {
  const [tab, setTab] = useState("leaderboard");
  return (
    <AppShell>
      <h1 className="lv-page-title">Points &amp; leaderboard</h1>
      <div className="lv-tabs mt-3" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="lv-tab">{l}</button>)}
      </div>
      <div className="mt-4">{tab === "leaderboard" ? <Board /> : tab === "history" ? <History /> : <Rules />}</div>
    </AppShell>
  );
}

function Board() {
  const [period, setPeriod] = useState("week");
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); getLeaderboard(period).then(setD).catch(() => setD({ entries: [], me: {} })); }, [period]);
  console.log(d)
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-1.5">{[["week", "This week"], ["all", "All time"]].map(([k, l]) => <button key={k} onClick={() => setPeriod(k)} aria-pressed={period === k} className="lv-chip">{l}</button>)}</div>
      {!d ? <InlineLoader /> : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            {d.me.hidden ? <p className="flex items-start gap-2 text-sm"><Settings2 className="mt-0.5 h-4 w-4" />You're hidden from the leaderboard. Change this in <Link className="text-primary underline" to="/profile">your profile</Link>.</p>
              : d.me.rank ? <p className="text-sm">You're <b>#{d.me.rank}</b> with <b>{d.me.points}</b> points{period === "week" ? " this week" : ""}.</p>
              : <p className="text-sm lv-meta">Earn points by studying to appear on the leaderboard.</p>}
          </div>
          <p className="text-xs lv-meta">{d.note} Showing the top {d.entries.length}.</p>
          <ol className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {d.entries.map((e, i) => (
              <li key={i} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${e.me ? "bg-accent/15 font-semibold" : ""}`}>
                <span className="w-8 text-center">{e.rank === 1 ? <Crown className="mx-auto h-4 w-4 text-warning" aria-label="First" /> : e.rank}</span>
                <span className="min-w-0 flex-1 truncate">{e.ref.name}{e.me && " (you)"}{e.school && <span className="ml-2 text-xs lv-meta">{e.school}</span>}</span>
                <span>{e.points}</span>
              </li>
            ))}
            {d.entries.length === 0 && <li className="p-6 text-center text-sm lv-meta">Nobody has points yet — be the first!</li>}
          </ol>
        </>
      )}
    </div>
  );
}

function History() {
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); getPointsHistory({ page }).then(setD).catch(() => setD({ transactions: [], total: 0, pagination: null })); }, [page]);
  if (!d) return <InlineLoader />;
  return (
    <div className="max-w-2xl">
      <p className="mb-3 font-display text-3xl font-bold">{d.total}<span className="ml-1 text-sm font-normal lv-meta">points</span></p>
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {d.transactions.map((t) => <li key={t._id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="min-w-0"><span className="block truncate">{t.reason}</span><span className="text-xs lv-meta">{new Date(t.createdAt).toLocaleString()}</span></span><Badge tone={t.points >= 0 ? "green" : "red"}>{t.points > 0 ? "+" : ""}{t.points}</Badge></li>)}
        {d.transactions.length === 0 && <li className="p-6 text-center text-sm lv-meta">No points yet. Review flashcards, finish a quiz or hit a streak to start earning.</li>}
      </ul>
      <Pager pagination={d.pagination} onPageChange={setPage} />
    </div>
  );
}

function Rules() {
  const [d, setD] = useState(null);
  useEffect(() => { getPointRules().then(setD).catch(() => setD({ rules: [] })); }, []);
  if (!d) return <InlineLoader />;
  return (
    <div className="max-w-2xl space-y-4">
      <ul className="space-y-2">{d.rules.map((r) => <li key={r.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">{r.label}</li>)}</ul>
      {d.streak && <p className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800"><Info className="mt-0.5 h-4 w-4 shrink-0" />{d.streak}</p>}
      {d.fairPlay && <p className="text-xs lv-meta">{d.fairPlay}</p>}
    </div>
  );
}
