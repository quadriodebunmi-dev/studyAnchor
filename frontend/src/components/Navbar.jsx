import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, LogOut, X, Moon, Sun, UserCircle2 } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";
import InstallButton from "./InstallButton.jsx";
import NotificationBell from "./NotificationBell.jsx";
import PlanBadge from "./PlanBadge.jsx";
import { closeSocket } from "../services/realtime.js";
import BrandMark from "./BrandMark.jsx";
import Avatar from "./Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { logout } from "../services/authService.js";
import { APP_CONFIG } from "../config/appConfig.js";

// Compact app bar. Below `sm` it is just brand + search + bell + avatar menu
// (theme, install and log out live in the menu); from `sm` up the full set of
// actions is shown inline, exactly as before.
export default function Navbar({ search, setSearch }) {
  const { user, setUser } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  async function handleLogout() {
    await logout();
    closeSocket();
    setUser(null);
    navigate("/login");
  }

  // Close the account menu on outside tap / Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const identity = user && (
    <>
      <Avatar user={user} size={30} />
      <span className="leading-tight">
        <span className="block text-sm font-medium text-night dark:text-slate-100">{user.name}</span>
        <span className="block text-xs capitalize lv-meta">{user.role}</span>
      </span>
    </>
  );

  const menuItem = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-night hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800";

  return (
    <header className="lv-safe-top sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-4 sm:h-14 sm:gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label={`${APP_CONFIG.name} home`}>
          <BrandMark className="h-7 w-7" />
          <span className="font-display text-[15px] font-bold tracking-tight text-night dark:text-slate-50">
            {APP_CONFIG.name}
          </span>
        </Link>



        {/* One action cluster so the notification bell (which polls and holds a
            socket subscription) is only mounted once. Phone: search, bell,
            avatar menu. sm+: install, theme, bell, identity, log out. */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <span className="hidden sm:inline-flex"><InstallButton variant="navLight" label="Install" iconOnlyOnMobile /></span>
          <span className="hidden sm:inline-flex"><ThemeToggle /></span>

     

          {user && user.role !== "admin" && <PlanBadge />}
          {user && user.role !== "admin" && <NotificationBell />}

          {user && (
            <div className="hidden items-center gap-2 sm:flex">
              {user.role === "student" ? (
                <Link to="/profile" className="-mr-1 flex items-center gap-2 rounded-xl py-1 pl-2 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                  {identity}
                </Link>
              ) : (
                <div className="flex items-center gap-2 pl-2">{identity}</div>
              )}
              <button
                onClick={handleLogout}
                aria-label="Log out"
                className="rounded-full border border-slate-200 bg-white p-2 text-danger hover:border-danger dark:border-slate-800 dark:bg-slate-900"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}

          {user && (
            <div className="relative sm:hidden" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                className="grid h-9 w-9 place-items-center rounded-full"
              >
                <Avatar user={user} size={28} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 z-50 w-60 animate-rise-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-lift dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2.5 px-3 py-2">{identity}</div>
                  <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
                  {user.role === "student" && (
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className={menuItem}>
                      <UserCircle2 className="h-4 w-4" /> Profile
                    </Link>
                  )}
                  <button onClick={toggleTheme} className={menuItem}>
                    {dark ? <Sun className="h-4 w-4 text-accent" /> : <Moon className="h-4 w-4" />}
                    {dark ? "Light theme" : "Dark theme"}
                  </button>
                  <div className="[&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-3 [&>button]:py-2.5 [&>button]:text-sm [&>button]:font-medium">
                    <InstallButton variant="navLight" label="Install app" />
                  </div>
                  <button onClick={handleLogout} className={`${menuItem} text-danger dark:text-danger`}>
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Phone search row */}
      {setSearch && searchOpen && (
        <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-800 sm:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search every course and material"
              aria-label="Search materials"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-base outline-none placeholder-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/40 dark:border-slate-800 dark:bg-slate-800"
            />
          </div>
        </div>
      )}
    </header>
  );
}
