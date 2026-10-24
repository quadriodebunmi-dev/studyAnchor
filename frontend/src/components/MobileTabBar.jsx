import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, X } from "lucide-react";

const SLOTS = 5; // tab slots on a phone, including "More"

const isItemActive = (it, pathname) =>
  pathname === it.to || (it.end ? false : pathname.startsWith(it.to) && it.to !== "/");

// Below `lg` the sidebar is hidden, so this bar is the way around the app.
// Items flagged `tab: true` in config/navItems.jsx get the primary slots (max 4);
// everything else lives in the "More" sheet. Roles with no flagged items
// (Admin) fall back to the first items in order.
export default function MobileTabBar({ items }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  if (!items || items.length === 0) return null;

  const flagged = items.filter((it) => it.tab);
  const primary = flagged.length ? flagged : items;
  const fitsAll = !flagged.length && items.length <= SLOTS;
  const visible = fitsAll ? items : primary.slice(0, SLOTS - 1);
  const rest = fitsAll ? [] : items.filter((it) => !visible.includes(it));
  const overflow = rest.length > 0;

  const restActive = rest.some((it) => isItemActive(it, location.pathname));
  const restBadgeTotal = rest.reduce((sum, it) => sum + (Number(it.badge) || 0), 0);

  const tabClass = (active) =>
    `relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 pb-1 pt-1.5 text-[10.5px] font-medium transition-colors ${
      active ? "text-night dark:text-accent" : "text-slate-500 dark:text-slate-400"
    }`;

  const badge = (n) => (
    <span className="absolute left-1/2 top-1 ml-2 min-w-[1rem] rounded-full bg-danger px-1 text-center text-[9px] font-semibold leading-4 text-white">
      {n > 9 ? "9+" : n}
    </span>
  );

  return (
    <>
      <nav
        aria-label="Main"
        className="lv-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
      >
        <div
          className="mx-auto grid max-w-lg"
          style={{ gridTemplateColumns: `repeat(${visible.length + (overflow ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {visible.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => tabClass(isActive)}>
              {({ isActive }) => (
                <>
                  <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${isActive ? "bg-accent text-accent-fg" : ""}`}>
                    {it.icon}
                  </span>
                  <span className="leading-none">{it.short || it.label}</span>
                  {!!it.badge && badge(Number(it.badge))}
                </>
              )}
            </NavLink>
          ))}

          {overflow && (
            <button onClick={() => setMoreOpen(true)} className={tabClass(restActive)} aria-haspopup="dialog">
              <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${restActive ? "bg-accent text-accent-fg" : ""}`}>
                <MoreHorizontal className="h-4 w-4" />
              </span>
              <span className="leading-none">More</span>
              {restBadgeTotal > 0 && badge(restBadgeTotal)}
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-night/60 backdrop-blur-sm lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More"
            className="max-h-[80vh] w-full animate-slide-up overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white px-3 pt-2 dark:border-slate-800 dark:bg-slate-900"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-1 h-1 w-9 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center justify-between px-1 py-1.5">
              <p className="lv-section-title text-sm">More</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {rest.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `relative flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-center text-[11px] font-medium leading-tight transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-slate-200 text-night hover:border-accent/60 dark:border-slate-800 dark:text-slate-100"
                    }`
                  }
                >
                  <span className="[&>svg]:h-5 [&>svg]:w-5">{it.icon}</span>
                  <span>{it.short || it.label}</span>
                  {!!it.badge && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-accent-fg">{it.badge}</span>
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
