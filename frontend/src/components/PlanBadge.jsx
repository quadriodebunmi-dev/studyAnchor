import React from "react";
import { Link } from "react-router-dom";
import { Crown, Sparkles } from "lucide-react";
import useBilling from "../hooks/useBilling.js";

// The plan the user is on right now (the active purchase that ends last), or "Free".
// Always a link to the billing page.
export function currentPlanOf(billing) {
  const active = (billing?.entitlements || [])
    .filter((e) => !e.expiresAt || new Date(e.expiresAt) > new Date())
    .sort((a, b) => new Date(b.expiresAt || 0) - new Date(a.expiresAt || 0));
  return active[0] || null;
}

const daysLeft = (d) => Math.max(0, Math.ceil((new Date(d) - Date.now()) / 86400000));

/**
 * variant "nav"  — compact pill for the top bar (light surface)
 * variant "hero" — translucent pill for the dark dashboard header
 */
export default function PlanBadge({ variant = "nav", className = "" }) {
  const { billing } = useBilling();
  if (!billing) return null; // still loading (or the request failed): show nothing rather than a wrong plan
  const plan = currentPlanOf(billing);
  const paid = Boolean(plan);
  const label = paid ? plan.planName : "Free plan";
  const Icon = paid ? Crown : Sparkles;
  const title = paid
    ? `${plan.planName} · ${daysLeft(plan.expiresAt)} day${daysLeft(plan.expiresAt) === 1 ? "" : "s"} left. Manage your plan`
    : "You're on the Free plan. See plans & billing";

  const look = variant === "hero"
    ? (paid ? "bg-accent text-accent-fg hover:opacity-90" : "bg-white/15 text-white hover:bg-white/25")
    : (paid
      ? "bg-accent/20 text-highlight-deep hover:bg-accent/30 dark:text-accent"
      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700");

  return (
    <Link to="/billing" title={title} aria-label={title} className={`inline-flex max-w-[9.5rem] shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-semibold transition-colors ${look} ${className}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className={`truncate ${variant === "nav" ? "sm:inline" : ""}`}>{label}</span>
    </Link>
  );
}
