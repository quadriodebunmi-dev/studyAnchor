import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Pager from "../../components/Pager.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { useToast } from "../../components/Toast.jsx";
import { getNotificationPreferences, listNotifications, markAllNotificationsRead, markNotificationRead, updateNotificationPreferences } from "../../services/notificationService.js";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [prefs, setPrefs] = useState(null);

  const load = () => listNotifications({ page }).then(setData).catch(() => setData({ notifications: [], pagination: null }));
  useEffect(() => { setData(null); load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { getNotificationPreferences().then(setPrefs).catch(() => {}); }, []);

  async function open(n) {
    if (!n.readAt) markNotificationRead(n._id).catch(() => {});
    if (n.link) navigate(n.link);
  }
  async function toggle(p) {
    setPrefs((list) => list.map((x) => (x.key === p.key ? { ...x, enabled: !x.enabled } : x)));
    try { await updateNotificationPreferences({ [p.key]: !p.enabled }); } catch { toast("Couldn't save that setting.", "error"); getNotificationPreferences().then(setPrefs); }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button size="sm" variant="outline" onClick={async () => { await markAllNotificationsRead(); load(); }}><CheckCheck className="h-4 w-4" />Mark all read</Button>
      </div>

      <div className="mt-5 space-y-2">
        {!data ? <InlineLoader /> : data.notifications.length === 0 ? (
          <EmptyState icon={<Bell className="h-7 w-7" />} title="You're all caught up" message="Invitations, quiz deadlines and results will show up here." />
        ) : data.notifications.map((n) => (
          <button key={n._id} onClick={() => open(n)} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left ${n.readAt ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" : "border-accent/50 bg-accent/10"}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`} />
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{n.title}</span>{n.body && <span className="block text-sm lv-meta">{n.body}</span>}<span className="mt-1 block text-xs lv-meta">{new Date(n.createdAt).toLocaleString()}</span></span>
          </button>
        ))}
      </div>
      {data && <Pager pagination={data.pagination} onPageChange={setPage} />}

      <section className="mt-10 max-w-xl">
        <h2 className="font-display text-lg font-semibold">What should we notify you about?</h2>
        <ul className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {prefs?.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>{p.label}{p.locked && <span className="ml-2 text-xs lv-meta">(always on)</span>}</span>
              <input type="checkbox" checked={p.enabled} disabled={p.locked} onChange={() => toggle(p)} aria-label={p.label} className="h-4 w-4" />
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
