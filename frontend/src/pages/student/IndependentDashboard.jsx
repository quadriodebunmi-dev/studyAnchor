import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, ClipboardCheck, FolderOpen, Layers, MessagesSquare, UploadCloud, GraduationCap } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import MaterialCard from "../../components/MaterialCard.jsx";
import { CardSkeleton } from "../../components/Loader.jsx";
import StreakCard from "../../components/StreakCard.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getMyFolders, getMyUploads } from "../../services/materialService.js";

const SHORTCUTS = [
  { to: "/study/snap", icon: Camera, label: "Snap a question" },
  { to: "/study/flashcards", icon: Layers, label: "Flashcards" },
  { to: "/study/exams", icon: ClipboardCheck, label: "Mock exams" },
  { to: "/rooms", icon: MessagesSquare, label: "Discussion rooms" },
];

// Home for learners with no school: their private library plus the study tools.
// Nothing here comes from any school's courses.
export default function IndependentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recent, setRecent] = useState(null);
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    getMyUploads({ limit: 6 }).then((r) => setRecent(r.materials)).catch(() => setRecent([]));
    getMyFolders().then(setFolders).catch(() => {});
  }, []);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Welcome, {user.name.split(" ")[0]}</h1>
      <p className="text-sm lv-meta">Your private library and study tools. Only you can see what you upload.</p>

      <div className="mt-5"><StreakCard /></div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SHORTCUTS.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm font-medium shadow-card transition-shadow hover:shadow-lift dark:border-slate-800 dark:bg-slate-900">
            <span className="rounded-xl bg-accent/20 p-2.5 text-highlight-deep dark:text-accent"><Icon className="h-5 w-5" /></span>{label}
          </Link>
        ))}
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Recently added</h2>
          <Button size="sm" onClick={() => navigate("/my-uploads")}><UploadCloud className="h-4 w-4" />Upload</Button>
        </div>
        {folders.filter((f) => f.name).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {folders.filter((f) => f.name).map((f) => (
              <Link key={f.name} to="/my-uploads" className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium dark:bg-slate-800"><FolderOpen className="h-3.5 w-3.5" />{f.name} ({f.count})</Link>
            ))}
          </div>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {!recent ? <CardSkeleton count={3} /> : recent.length === 0 ? (
            <EmptyState icon={<UploadCloud className="h-7 w-7" />} title="Your library is empty" message="Upload a PDF, Word or PowerPoint file, or a photo of your notes to start generating flashcards and mock exams." action={<Button onClick={() => navigate("/my-uploads")}>Upload your first file</Button>} />
          ) : recent.map((m) => <MaterialCard key={m._id} material={m} onOpen={() => navigate(`/material/${m._id}`)} />)}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 font-display font-semibold"><GraduationCap className="h-5 w-5" />Studying at a school?</h2>
        <p className="mt-1 text-sm lv-meta">Join your school to see its courses and shared materials. You keep everything in your library.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/profile")}>Join a school</Button>
      </section>
    </AppShell>
  );
}
