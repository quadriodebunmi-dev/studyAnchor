import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, X } from "lucide-react";

const MAX_VISIBLE = 4;

// Below `lg` the sidebar is hidden, so these are the only way to move around
// the app. Roles with more sections than fit (Admin) get a "More" sheet.
export default function MobileTabBar({ items }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  if (!items || items.length === 0) return null;

  const overflow = items.length > MAX_VISIBLE;
  const visible = overflow ? items.slice(0, MAX_VISIBLE - 1) : items;
  const rest = overflow ? items.slice(MAX_VISIBLE - 1) : [];
  const restActive = rest.some(
    (it) => location.pathname === it.to || (it.end ? false : location.pathname.startsWith(it.to))
  );
  const restBadgeTotal = rest.reduce((sum, it) => sum + (Number(it.badge) || 0), 0);

  const tabClass = (active) =>
    `relative flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
      active ? "text-night dark:text-accent" : "text-slate-500 dark:text-slate-400"
    }`;

  return (
    <>
      <nav
        aria-label="Main"
        className="lv-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${visible.length + (overflow ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {visible.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => tabClass(isActive)}>
              {({ isActive }) => (
                <>
                  {/* Peach pill behind the current tab, matching the sidebar rail. */}
                  <span
                    className={`rounded-xl px-3 py-1.5 transition-colors ${
                      isActive ? "bg-accent text-accent-fg" : ""
                    }`}
                  >
                    {it.icon}
                  </span>
                  <span className="leading-none">{it.label}</span>
                  {!!it.badge && (
                    <span className="absolute right-1/2 top-0.5 translate-x-4 rounded-full bg-danger px-1 py-0.5 text-[9px] font-semibold leading-none text-white">
                      {it.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}

          {overflow && (
            <button onClick={() => setMoreOpen(true)} className={tabClass(restActive)}>
              <span className={`rounded-xl px-3 py-1.5 ${restActive ? "bg-accent text-accent-fg" : ""}`}>
                <MoreHorizontal className="h-4 w-4" />
              </span>
              <span className="leading-none">More</span>
              {restBadgeTotal > 0 && (
                <span className="absolute right-1/2 top-0.5 translate-x-4 rounded-full bg-danger px-1 py-0.5 text-[9px] font-semibold leading-none text-white">
                  {restBadgeTotal}
                </span>
              )}
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-night/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full animate-slide-up rounded-t-3xl border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center justify-between px-2 py-2">
              <p className="lv-section-title text-sm">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {rest.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                      isActive
                        ? "bg-primary text-primary-fg"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`
                  }
                >
                  <span className="flex items-center gap-3">
                    {it.icon}
                    {it.label}
                  </span>
                  {!!it.badge && (
                    <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg">
                      {it.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
