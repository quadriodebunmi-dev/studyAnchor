import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle({ className = "" }) {
  const { dark, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`rounded-full border border-slate-200 bg-white p-2 transition-colors
        hover:border-accent hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900
        dark:hover:bg-slate-800 ${className}`}
    >
      {dark ? <Sun className="h-4 w-4 text-accent" /> : <Moon className="h-4 w-4 text-primary" />}
    </button>
  );
}
