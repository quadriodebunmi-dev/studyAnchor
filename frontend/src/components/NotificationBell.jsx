import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationService.js";
import { subscribe } from "../services/realtime.js";
import usePushNotifications from "../hooks/usePushNotifications.js";
import { useToast } from "./Toast.jsx";

// Bell with an unread badge. Live over Socket.IO when available; otherwise it
// re-checks the count every 60 seconds (and whenever the tab regains focus).
// The dropdown also has the on/off switch for push notifications on this device.
export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const box = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const push = usePushNotifications();

  const refreshCount = useCallback(() => getUnreadCount().then(setUnread).catch(() => {}), []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 60000);
    const onFocus = () => refreshCount();
    window.addEventListener("focus", onFocus);
    let off = () => {};
    subscribe({ "notification:new": () => { setUnread((n) => n + 1); setItems(null); } }).then((fn) => { off = fn; });
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); off(); };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return undefined;
    listNotifications({ limit: 8 }).then((res) => { setItems(res.notifications); setUnread(res.unread); }).catch(() => setItems([]));
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function openItem(n) {
    setOpen(false);
    if (!n.readAt) { markNotificationRead(n._id).catch(() => {}); setUnread((c) => Math.max(0, c - 1)); }
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    await markAllNotificationsRead().catch(() => {});
    setUnread(0);
    setItems((list) => list?.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
  }

  async function togglePush() {
    const r = await push.toggle();
    if (r.message) toast(r.message, r.ok ? "success" : "error");
  }

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 sm:h-auto sm:w-auto sm:border sm:border-slate-200 sm:bg-white sm:p-2 sm:hover:border-accent sm:hover:bg-white dark:sm:border-slate-800 dark:sm:bg-slate-900">
        <Bell className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
        {unread > 0 && (
          <span className="absolute right-0 top-0 min-w-[1.1rem] sm:-right-1 sm:-top-1 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-[1.1rem] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-lift dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <button onClick={readAll} className="text-xs text-primary hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items === null ? <p className="p-3 text-sm lv-meta">Loading…</p> : items.length === 0 ? (
              <p className="p-3 text-sm lv-meta">You're all caught up.</p>
            ) : items.map((n) => (
              <button key={n._id} onClick={() => openItem(n)} className="flex w-full gap-2 rounded-xl px-2 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{n.title}</span>
                  {n.body && <span className="block truncate text-xs lv-meta">{n.body}</span>}
                </span>
              </button>
            ))}
          </div>

          {push.supported && push.configured && (
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-slate-200 px-2 py-2.5 dark:border-slate-800">
              <span className="min-w-0">
                <span className="block text-sm font-medium">Push notifications</span>
                <span className="block text-xs lv-meta">{push.enabled ? "On for this device" : "Off for this device"}</span>
              </span>
              <button type="button" role="switch" aria-checked={push.enabled} aria-label="Push notifications on this device"
                disabled={push.busy} onClick={togglePush}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${push.enabled ? "bg-accent" : "bg-slate-300 dark:bg-slate-700"}`}>
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${push.enabled ? "translate-x-5" : ""}`} />
              </button>
            </div>
          )}

          <Link to="/notifications" onClick={() => setOpen(false)} className="block rounded-xl px-2 py-2 text-center text-xs font-medium text-primary hover:bg-slate-100 dark:hover:bg-slate-800">
            See all &amp; settings
          </Link>
        </div>
      )}
    </div>
  );
}