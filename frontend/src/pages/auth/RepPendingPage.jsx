import React from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, ArrowLeft } from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import Button from "../../components/Button.jsx";

export default function RepPendingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-10 bg-slate-50 dark:bg-slate-950">
      <ThemeToggle className="fixed top-5 right-5" />
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
        <div className="mx-auto mb-4 w-fit rounded-full bg-warning/10 p-3"><ClipboardList className="w-6 h-6 text-warning" /></div>
        <p className="font-semibold">Course Rep Account created</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Your Course Rep application is Approved
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/login")}><ArrowLeft className="w-4 h-4" /> Back to login</Button>
      </div>
    </div>
  );
}
