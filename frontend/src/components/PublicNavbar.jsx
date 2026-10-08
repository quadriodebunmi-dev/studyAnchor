import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Anchor, Menu, X } from "lucide-react";
import { APP_CONFIG } from "../config/appConfig.js";

// `href` = in-page anchor on the landing page, `to` = router route.
const LINKS = [
  { label: "Developer", href: "/developers" },
  { label: "Privacy & policy", href: "/privacy" },
  { label: "Add your school", href: "/#request-school" },
  { label: "Course Reps", to: "/rep-signup" },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function NavItem({ item, className, onClick }) {
  return item.to ? (
    <Link to={item.to} className={className} onClick={onClick}>{item.label}</Link>
  ) : (
    <a href={item.href} className={className} onClick={onClick}>{item.label}</a>
  );
}

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const close = () => setOpen(false);

  // Close on route change and on Escape.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-night/90 text-white backdrop-blur">
      <style>{`
        @keyframes sa-menu { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .sa-menu { animation: sa-menu .18s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .sa-menu { animation: none; } }
      `}</style>

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" onClick={close} className={`flex items-center gap-2 rounded-lg font-display text-lg font-bold ${focusRing}`}>
          <span className="grid h-8 w-8 place-items-center rounded-lg text-night">
            <img src="https://lenspdf.netlify.app/icons/icon-16.png" alt="logo" />
          </span>
          {APP_CONFIG.name}
        </Link>

        {/* Desktop */}
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((item) => (
            <NavItem key={item.label} item={item} className={`rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white ${focusRing}`} />
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link to="/login" className={`rounded-full px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 ${focusRing}`}>Log in</Link>
          <Link to="/signup" className={`rounded-full bg-accent px-4 py-2 text-sm font-semibold text-night hover:brightness-110 ${focusRing}`}>Sign up</Link>
        </div>

        {/* Mobile: keep the main CTA visible next to the menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <Link to="/signup" className={`rounded-full bg-accent px-4 py-2 text-sm font-semibold text-night ${focusRing}`}>Sign up</Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className={`grid h-11 w-11 place-items-center rounded-full hover:bg-white/10 ${focusRing}`}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="sa-menu border-t border-white/10 bg-night md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col px-4 py-2">
            {LINKS.map((item) => (
              <li key={item.label}>
                <NavItem item={item} onClick={close} className={`block rounded-lg px-3 py-3 text-base text-slate-200 hover:bg-white/10 ${focusRing}`} />
              </li>
            ))}
          </ul>
          <div className="mx-auto grid max-w-6xl gap-2 px-4 pb-5 pt-2">
            <Link to="/signup" onClick={close} className={`rounded-full bg-accent px-4 py-3 text-center font-semibold text-night ${focusRing}`}>Sign up as a student</Link>
            <Link to="/login" onClick={close} className={`rounded-full border border-white/25 px-4 py-3 text-center font-medium ${focusRing}`}>Log in</Link>
          </div>
        </nav>
      )}
    </header>
  );
}