import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";
import AppShell from "../AppShell.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { myAnalytics } from "../../services/quizService.js";
import { useTheme } from "../../context/ThemeContext.jsx";

export default function StudyAnalyticsPage() {
  const [data, setData] = useState(null);
  const { dark } = useTheme();

  useEffect(() => { myAnalytics().then(setData); }, []);

  if (!data) return <AppShell><InlineLoader /></AppShell>;

  const chartData = data.trend.map((t, i) => ({ name: `Q${i + 1}`, score: t.score }));

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Study Analytics</h1>
      <div className="mt-5 grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"><p className="text-xs text-slate-500 dark:text-slate-400">Quizzes taken</p><p className="text-2xl font-bold">{data.totalAttempts}</p></div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"><p className="text-xs text-slate-500 dark:text-slate-400">Average score</p><p className="text-2xl font-bold">{data.avgScore}%</p></div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"><p className="text-xs text-slate-500 dark:text-slate-400">Weakest topic</p><p className="text-sm font-semibold mt-1">{data.weakestTopic || "—"}</p></div>
      </div>
      <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="font-semibold mb-4">Score trend</p>
        {chartData.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1e293b" : "#e2e8f0"} />
              <XAxis dataKey="name" stroke={dark ? "#64748b" : "#94a3b8"} fontSize={12} />
              <YAxis stroke={dark ? "#64748b" : "#94a3b8"} fontSize={12} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: dark ? "#0f172a" : "#ffffff", border: "none", borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={<BarChart3 className="w-8 h-8" />} title="No quiz history yet" message="Take a quiz to start tracking your performance." />
        )}
      </div>
    </AppShell>
  );
}
