import React from "react";
import { Link } from "react-router-dom";
import { Camera, Layers, ClipboardCheck, Bot, ChevronRight } from "lucide-react";
import AppShell from "../AppShell.jsx";

const TOOLS = [
  { to: "/study/snap", icon: Camera, title: "Snap a Question", text: "Photograph a question and get a worked explanation, hints and topics to review." },
  { to: "/study/flashcards", icon: Layers, title: "Flashcards", text: "Turn a PDF or topic into flashcards and track what you've understood." },
  { to: "/study/exams", icon: ClipboardCheck, title: "Mock exams", text: "Timed practice exams built from your materials, with topic-level feedback." },
  { to: "/assistant", icon: Bot, title: "AI assistant", text: "Chat about your courses and materials." },
];

export default function StudyToolsPage() {
  return (
    <AppShell>
      <h1 className="lv-page-title">Study tools</h1>
      <p className="mt-0.5 text-[11px] lv-meta">AI-assisted practice. AI can make mistakes — double-check important answers.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {TOOLS.map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} className="lv-card-interactive group flex items-center gap-3 p-3">
            <span className="lv-tile-icon h-11 w-11 shrink-0"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs lv-meta">{text}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
