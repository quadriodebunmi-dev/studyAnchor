import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Brain, Camera, Clock, Flame, Layers, Sparkles, Target, Trophy, CalendarCheck, GraduationCap } from "lucide-react";
import AppShell from "../AppShell.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { ProgressBar, StatTile } from "../../components/StudyStats.jsx";
import { getStudyAnalytics } from "../../services/progressService.js";
import { useTheme } from "../../context/ThemeContext.jsx";

const RANGES = [{ d: 7, label: "7 days" }, { d: 30, label: "30 days" }, { d: 90, label: "90 days" }];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const SOURCE_LABELS = { room_quiz: "Room quizzes", mock_exam: "Mock exams", personal_quiz: "Quizzes", flashcards: "Flashcards", goal: "Goals", streak: "Streaks", room_post: "Room discussion", room_created: "Rooms created", snap: "Snap a Question" };
const TYPE_LABELS = { session: "Study sessions", flashcards: "Flashcard rounds", mock_exam: "Mock exams", room_quiz: "Room quizzes", personal_quiz: "Quizzes", snap: "Snapped questions" };

const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });

function Card({ title, subtitle, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <h2 className="font-display font-semibold">{title}</h2>
      {subtitle && <p className="text-xs lv-meta">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ text }) { return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm lv-meta dark:border-slate-700">{text}</p>; }

function Heatmap({ cells }) {
  // 12 columns (weeks) x 7 rows, Sunday first; pad the first week so days line up.
  const lead = new Date(`${cells[0].day}T00:00:00Z`).getUTCDay();
  const padded = [...Array(lead).fill(null), ...cells];
  const max = Math.max(1, ...cells.map((c) => c.count));
  const shade = (n) => (n === 0 ? "bg-slate-100 dark:bg-slate-800" : n / max > 0.66 ? "bg-accent" : n / max > 0.33 ? "bg-accent/60" : "bg-accent/30");
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridAutoColumns: "minmax(14px, 1fr)" }} role="img" aria-label="Study activity over the last 12 weeks">
        {padded.map((c, i) => c
          ? <div key={c.day} title={`${shortDate(c.day)}: ${c.count} ${c.count === 1 ? "activity" : "activities"}${c.minutes ? `, ${fmtMin(c.minutes)} logged` : ""}`} className={`aspect-square rounded-[4px] ${shade(c.count)}`} />
          : <div key={`p${i}`} className="aspect-square" />)}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] lv-meta">Less{["bg-slate-100 dark:bg-slate-800", "bg-accent/30", "bg-accent/60", "bg-accent"].map((c) => <span key={c} className={`h-3 w-3 rounded-[3px] ${c}`} />)}More</div>
    </div>
  );
}

export default function StudyAnalyticsPage() {
  const { dark } = useTheme();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    getStudyAnalytics(days).then(setData).catch(() => setError(true));
  }, [days]);

  const axis = dark ? "#64748b" : "#94a3b8";
  const grid = dark ? "#1e293b" : "#e2e8f0";
  const tip = { background: dark ? "#0f172a" : "#ffffff", border: "none", borderRadius: 12, fontSize: 12 };

  const study = useMemo(() => data?.studyTime.series.map((p) => ({ name: shortDate(p.day), minutes: p.value })) || [], [data]);
  const trend = useMemo(() => data?.scoreTrend.map((p, i) => ({ name: `#${i + 1}`, score: p.score, kind: p.kind === "exam" ? "Mock exam" : "Quiz" })) || [], [data]);

  if (error) return <AppShell><EmptyState icon={<BarChart3 className="h-8 w-8" />} title="Couldn't load your analytics" message="Check your connection and try again." /></AppShell>;
  if (!data) return <AppShell><InlineLoader /></AppShell>;

  const o = data.overview;
  const hasAnything = o.totalMinutes || o.assessmentsTaken || data.flashcards.cards || data.snap.total || o.streak?.current;
  const fc = data.flashcards;
  const bestDay = data.studyTime.bestWeekday;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Study Analytics</h1>
          <p className="text-sm lv-meta">How you've been studying, what's working and what needs attention.</p>
        </div>
        <div role="group" aria-label="Time range" className="inline-flex rounded-full border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {RANGES.map((r) => (
            <button key={r.d} onClick={() => setDays(r.d)} aria-pressed={days === r.d} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${days === r.d ? "bg-primary text-primary-fg" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{r.label}</button>
          ))}
        </div>
      </div>

      {!hasAnything && (
        <div className="mt-6"><EmptyState icon={<BarChart3 className="h-8 w-8" />} title="Nothing to show yet" message="Log a study session, take a quiz or review flashcards and your analytics will fill in." /></div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile tone="accent" icon={<Flame className="h-4 w-4" />} value={o.streak?.current || 0} label={`Day streak · best ${o.streak?.longest ?? o.streak?.best ?? o.streak?.current ?? 0}`} />
        <StatTile icon={<Clock className="h-4 w-4" />} value={fmtMin(o.totalMinutes)} label={`Logged study time · ${data.range}d`} />
        <StatTile icon={<CalendarCheck className="h-4 w-4" />} value={`${o.activeDays}/${data.range}`} label={`Active days (${o.activeRatio}%)`} />
        <StatTile icon={<Trophy className="h-4 w-4" />} value={o.points} label={`Points · +${o.pointsEarned} this period`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Study time" subtitle={`Minutes you logged, per ${data.studyTime.bucket}${o.sessions ? ` · ${o.sessions} session${o.sessions === 1 ? "" : "s"}, avg ${fmtMin(o.avgMinutesPerActiveDay)} per active day` : ""}`}>
          {o.totalMinutes ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={study}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="name" stroke={axis} fontSize={11} interval="preserveStartEnd" minTickGap={24} />
                <YAxis stroke={axis} fontSize={11} width={32} />
                <Tooltip contentStyle={tip} formatter={(v) => [fmtMin(v), "Studied"]} cursor={{ fill: dark ? "#1e293b" : "#f1f5f9" }} />
                <Bar dataKey="minutes" fill="#f9b17a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="No study sessions logged in this period. Log one from the Goals page to see your time here." />}
          {bestDay !== null && <p className="mt-3 text-sm">You study most on <b>{WEEKDAYS_FULL[bestDay]}</b>.</p>}
        </Card>

        <Card title="By day of week" subtitle="Total logged minutes">
          {o.totalMinutes ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.studyTime.weekdayMinutes.map((m, i) => ({ name: WEEKDAYS[i], minutes: m }))}>
                <XAxis dataKey="name" stroke={axis} fontSize={11} />
                <Tooltip contentStyle={tip} formatter={(v) => [fmtMin(v), "Studied"]} cursor={{ fill: dark ? "#1e293b" : "#f1f5f9" }} />
                <Bar dataKey="minutes" fill="#4F46E5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="Appears once you log study time." />}
        </Card>
      </div>

      <Card className="mt-4" title="Consistency" subtitle="Every study action over the last 12 weeks — darker means a busier day">
        <Heatmap cells={data.heatmap} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Score trend" subtitle="Your latest quizzes and mock exams, oldest to newest">
          {trend.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="name" stroke={axis} fontSize={11} />
                <YAxis stroke={axis} fontSize={11} domain={[0, 100]} width={32} />
                <Tooltip contentStyle={tip} formatter={(v, _n, p) => [`${v}%`, p.payload.kind]} />
                <Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty text="Take a quiz or a mock exam to start tracking your scores." />}
        </Card>

        <Card title="Assessments" subtitle="All time">
          <dl className="space-y-3 text-sm">
            {[["Personal quizzes", data.quizzes.taken, data.quizzes.avg], ["Mock exams", data.mockExams.taken, data.mockExams.avg], ["Room quizzes", data.roomQuizzes.taken, data.roomQuizzes.avg]].map(([label, n, avg]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between"><dt>{label}</dt><dd className="lv-meta">{n ? `${n} taken · avg ${avg}%` : "none yet"}</dd></div>
                <ProgressBar value={n ? avg : 0} className="mt-1.5" />
              </div>
            ))}
          </dl>
          {data.mockExams.taken > 0 && <p className="mt-3 text-xs lv-meta">Best mock exam: <b>{data.mockExams.best}%</b>{data.mockExams.pendingReview > 0 && ` · ${data.mockExams.pendingReview} awaiting full grading`}</p>}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Topics to work on" subtitle="From your recent mock exams (needs a few questions per topic)">
          {data.topics.weakest.length ? (
            <ul className="space-y-3">{data.topics.weakest.map((t) => (
              <li key={t.topic}><div className="flex items-baseline justify-between text-sm"><span className="truncate pr-2">{t.topic}</span><span className="font-semibold text-danger">{t.percent}%</span></div><ProgressBar value={t.percent} className="mt-1" /></li>
            ))}</ul>
          ) : <Empty text={data.topics.all ? "No weak topics — nice work." : "Complete a mock exam and we'll show which topics need attention."} />}
          {data.topics.weakest.length > 0 && <Link to="/study/flashcards" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><Layers className="h-4 w-4" />Make flashcards for these</Link>}
        </Card>
        <Card title="Your strengths" subtitle="Topics you're doing well in">
          {data.topics.strongest.length ? (
            <ul className="space-y-3">{data.topics.strongest.map((t) => (
              <li key={t.topic}><div className="flex items-baseline justify-between text-sm"><span className="truncate pr-2">{t.topic}</span><span className="font-semibold text-success">{t.percent}%</span></div><ProgressBar value={t.percent} className="mt-1" /></li>
            ))}</ul>
          ) : <Empty text="Strengths appear after a few graded mock-exam questions." />}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Flashcards" subtitle={fc.decks ? `${fc.decks} deck${fc.decks === 1 ? "" : "s"} · ${fc.cards} cards` : undefined}>
          {fc.cards ? (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="img" aria-label={`${fc.mastery}% of cards understood`}>
                <div className="bg-success" style={{ width: `${(fc.understood / fc.cards) * 100}%` }} />
                <div className="bg-warning" style={{ width: `${(fc.needsReview / fc.cards) * 100}%` }} />
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                <li className="flex justify-between"><span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-success" />Understood</span><b>{fc.understood}</b></li>
                <li className="flex justify-between"><span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-warning" />Needs review</span><b>{fc.needsReview}</b></li>
                <li className="flex justify-between"><span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />Not studied yet</span><b>{fc.fresh}</b></li>
              </ul>
              <p className="mt-3 text-xs lv-meta">Mastery {fc.mastery}%{fc.lastStudiedAt && ` · last studied ${new Date(fc.lastStudiedAt).toLocaleDateString()}`}</p>
            </>
          ) : <Empty text="Create a deck from any material to track mastery." />}
        </Card>

        <Card title="Goals" subtitle="Your study plans">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Active", data.goals.active], ["Done", data.goals.completed], ["Paused", data.goals.paused]].map(([l, n]) => (
              <div key={l} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><p className="font-display text-xl font-bold">{n}</p><p className="text-xs lv-meta">{l}</p></div>
            ))}
          </div>
          {data.goals.list.length > 0 && <ul className="mt-3 space-y-1.5 text-sm">{data.goals.list.slice(0, 4).map((g) => <li key={g._id} className="flex justify-between gap-2"><span className="truncate">{g.title}</span><span className="shrink-0 lv-meta">{g.targetMinutes}m/day</span></li>)}</ul>}
          <Link to="/goals" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><Target className="h-4 w-4" />{data.goals.active ? "Manage goals" : "Set a goal"}</Link>
        </Card>

        <Card title="Where your points came from" subtitle={`Earned in the last ${data.range} days`}>
          {data.points.bySource.length ? (
            <ul className="space-y-2.5">{data.points.bySource.map((p) => (
              <li key={p.source}><div className="flex justify-between text-sm"><span>{SOURCE_LABELS[p.source] || p.source.replace(/_/g, " ")}</span><b>+{p.points}</b></div><ProgressBar value={(p.points / data.points.bySource[0].points) * 100} className="mt-1" /></li>
            ))}</ul>
          ) : <Empty text="Study to start earning points." />}
        </Card>
      </div>

      <Card className="mt-4" title="What you did" subtitle={`Study actions in the last ${data.range} days`}>
        {Object.keys(data.activityByType).length || data.snap.inRange ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.activityByType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
              <div key={t} className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-800"><span>{TYPE_LABELS[t] || t}</span><b>{n}</b></div>
            ))}
          </div>
        ) : <Empty text="Your study actions will be listed here." />}
        <p className="mt-3 flex items-center gap-2 text-xs lv-meta"><Camera className="h-3.5 w-3.5" />{data.snap.total} question{data.snap.total === 1 ? "" : "s"} solved with Snap in total ({data.snap.inRange} this period)</p>
      </Card>
    </AppShell>
  );
}
