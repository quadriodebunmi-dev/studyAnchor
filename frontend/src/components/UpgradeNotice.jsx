import React from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

// Shown instead of a raw error when the server answers 403 UPGRADE_REQUIRED.
export const isUpgradeError = (err) => err?.code === "UPGRADE_REQUIRED";

export default function UpgradeNotice({ message }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/50 bg-accent/10 p-4 text-sm">
      <span className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0" />{message || "This feature is part of a paid plan."}</span>
      <Link to="/billing" className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-fg">See plans</Link>
    </div>
  );
}
