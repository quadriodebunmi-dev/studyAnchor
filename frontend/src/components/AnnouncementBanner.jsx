import React, { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { getActiveAnnouncements } from "../services/adminPlatformService.js";
import { updatePreferences } from "../services/progressService.js";
import { useAuth } from "../context/AuthContext.jsx";

// Admin announcements as a dismissible banner (dismissals last for the browser session).
// Also keeps the learner's stored time zone in step with their device once.
export default function AnnouncementBanner() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [hidden, setHidden] = useState(() => JSON.parse(sessionStorage.getItem("sa-hidden-ann") || "[]"));

  useEffect(() => {
    if (!user || user.role === "admin") return;
    getActiveAnnouncements().then(setItems).catch(() => {});
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && (user.timezone || "UTC") !== tz && localStorage.getItem("sa-tz-synced") !== tz) {
        localStorage.setItem("sa-tz-synced", tz);
        updatePreferences({ timezone: tz }).catch(() => {});
      }
    } catch { /* no Intl support: server falls back to UTC */ }
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = items.filter((a) => !hidden.includes(a._id));
  if (!shown.length) return null;
  const hide = (id) => { const next = [...hidden, id]; setHidden(next); sessionStorage.setItem("sa-hidden-ann", JSON.stringify(next)); };
  return (
    <div className="space-y-2 px-4 pt-3 sm:px-6">
      {shown.map((a) => (
        <div key={a._id} role="status" className="mx-auto flex max-w-7xl items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1"><p className="font-semibold">{a.title}</p><p className="whitespace-pre-wrap lv-meta">{a.body}</p></div>
          <button onClick={() => hide(a._id)} aria-label="Dismiss announcement" className="rounded-full p-1 hover:bg-slate-200 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}
