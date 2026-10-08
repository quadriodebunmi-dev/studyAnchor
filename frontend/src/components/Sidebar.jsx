import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar({ items, footer }) {
  return (
    <nav
      aria-label="Main"
      className="hidden w-60 shrink-0 flex-col gap-1 border-r border-slate-200 px-3 py-6 dark:border-slate-800 lg:flex"
    >
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `group relative flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-fg"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="flex items-center gap-3">
                {it.icon}
                {it.label}
              </span>
              {!!it.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isActive ? "bg-white/20 text-primary-fg" : "bg-accent text-accent-fg"
                  }`}
                >
                  {it.badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
      {footer && <div className="mt-auto pt-6">{footer}</div>}
    </nav>
  );
}
