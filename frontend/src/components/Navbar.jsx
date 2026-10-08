import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, LogOut, Menu } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";
import BrandMark from "./BrandMark.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { logout } from "../services/authService.js";
import { APP_CONFIG } from "../config/appConfig.js";

function initials(name = "") {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("");
}

export default function Navbar({ search, setSearch, onMenu }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    setUser(null);
    navigate("/login");
  }

  const identity = user && (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-fg">
        {initials(user.name)}
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-medium text-night dark:text-slate-100">{user.name}</span>
        <span className="block text-xs capitalize lv-meta">{user.role}</span>
      </span>
    </>
  );

  return (
    <header className="lv-safe-top sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        {onMenu && (
          <button onClick={onMenu} aria-label="Open menu" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        )}

        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <BrandMark className="h-8 w-8" />
          <span className="font-display text-base font-bold tracking-tight text-night dark:text-slate-50">
            {APP_CONFIG.name}
          </span>
        </Link>

        {setSearch && (
          <div className="relative mx-auto hidden w-full max-w-xl sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search every course and material"
              aria-label="Search materials"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors
                placeholder-slate-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/40
                dark:border-slate-800 dark:bg-slate-800 dark:focus:bg-slate-800"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        

          {user &&
            (user.role === "student" ? (
              <Link
                to="/profile"
                className="-mr-1 hidden items-center gap-2 rounded-xl py-1 pl-2 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800 sm:flex"
              >
                {identity}
              </Link>
            ) : (
              <div className="hidden items-center gap-2 pl-2 sm:flex">{identity}</div>
            ))}

          <button
            onClick={handleLogout}
            aria-label="Log out"
            className="rounded-full border border-slate-200 bg-white p-2 text-danger hover:border-danger dark:border-slate-800 dark:bg-slate-900"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
