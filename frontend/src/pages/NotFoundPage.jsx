import React from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950">
      <p className="text-4xl font-bold">404</p>
      <p className="text-slate-500 dark:text-slate-400">Page not found.</p>
      <Link to="/" className="text-primary font-medium">Go home</Link>
    </div>
  );
}
