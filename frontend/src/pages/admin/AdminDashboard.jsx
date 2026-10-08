import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LayoutDashboard, UserCheck, Users, FileText, FolderKanban, Flag, History, ClipboardCheck, Building2 } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { getPlatformAnalytics, listPendingReps, listPendingMaterials } from "../../services/adminService.js";
import { useTheme } from "../../context/ThemeContext.jsx";

export function useAdminNavItems() {
  const [pendingReps, setPendingReps] = useState(0);
  const [pendingMaterials, setPendingMaterials] = useState(0);
  useEffect(() => { listPendingReps({ limit: 1 }).then((res) => setPendingReps(res.pagination.total)).catch(() => {}); }, []);
  useEffect(() => { listPendingMaterials({ limit: 1 }).then((res) => setPendingMaterials(res.pagination.total)).catch(() => {}); }, []);
  return [
    { to: "/", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" />, end: true },
    { to: "/admin/approvals", label: "Rep Approvals", icon: <UserCheck className="w-4 h-4" />, badge: pendingReps },
    { to: "/admin/pending-materials", label: "Pending Materials", icon: <ClipboardCheck className="w-4 h-4" />, badge: pendingMaterials },
    { to: "/admin/users", label: "All Users", icon: <Users className="w-4 h-4" /> },
    { to: "/admin/materials", label: "All Materials", icon: <FileText className="w-4 h-4" /> },
    { to: "/admin/courses", label: "All Courses", icon: <FolderKanban className="w-4 h-4" /> },
    { to: "/admin/schools", label: "Schools", icon: <Building2 className="w-4 h-4" /> },
    { to: "/admin/reports", label: "Reports", icon: <Flag className="w-4 h-4" /> },
    { to: "/admin/log", label: "Activity Log", icon: <History className="w-4 h-4" /> },
  ];
}

export default function AdminDashboard() {
  const navItems = useAdminNavItems();
  const [data, setData] = useState(null);
  const { dark } = useTheme();

  useEffect(() => { getPlatformAnalytics().then(setData); }, []);

  if (!data) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  const deptData = Object.entries(data.downloadsByDept).map(([name, downloads]) => ({ name: name.split(" ").map((w) => w[0]).join(""), downloads }));

  return (
    <AppShell sidebarItems={navItems}>
      <h1 className="text-2xl font-bold">Platform Overview</h1>
      <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total students", value: data.totalStudents },
          { label: "Active reps", value: data.activeReps },
          { label: "Pending applications", value: data.pendingReps },
          { label: "Total materials", value: data.totalMaterials },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"><p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="font-semibold mb-4">Downloads by department</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={deptData}>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1e293b" : "#e2e8f0"} />
            <XAxis dataKey="name" stroke={dark ? "#64748b" : "#94a3b8"} fontSize={12} />
            <YAxis stroke={dark ? "#64748b" : "#94a3b8"} fontSize={12} />
            <Tooltip contentStyle={{ background: dark ? "#0f172a" : "#ffffff", border: "none", borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="downloads" fill="#4F46E5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AppShell>
  );
}
