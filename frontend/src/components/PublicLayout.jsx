import React from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle.jsx";
import BrandMark from "./BrandMark.jsx";
import Button from "./Button.jsx";
import { APP_CONFIG } from "../config/appConfig.js";

// Shell for the logged-out marketing pages. Deliberately has no AuthContext
// dependency, so these render fine with no session at all.
export default function PublicLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark className="h-8 w-8" />
            <span className="font-display text-base font-bold tracking-tight text-night dark:text-slate-50">{APP_CONFIG.name}</span>
          </Link>
          <nav className="ml-auto flex items-center gap-2" aria-label="Site">
            <Link to="/developers" className="hidden px-2 text-sm font-medium lv-meta hover:text-primary sm:block">Developers</Link>
            <Link to="/privacy" className="hidden px-2 text-sm font-medium lv-meta hover:text-primary sm:block">Privacy</Link>
            <ThemeToggle />
            <Link to="/login"><Button variant="outline" size="sm">Log in</Button></Link>
            <Link to="/signup" className="hidden sm:block"><Button variant="accent" size="sm">Sign up</Button></Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm lv-meta">
          <p>© {new Date().getFullYear()} {APP_CONFIG.name}</p>
          <div className="flex gap-4">
            <Link to="/developers" className="hover:text-primary">Developers</Link>
            <Link to="/privacy" className="hover:text-primary">Privacy policy</Link>
            <Link to="/login" className="hover:text-primary">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
