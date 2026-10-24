import React, { useCallback, useEffect, useState } from "react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import Pager from "../../components/Pager.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { Field, Input, Select, Textarea } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import { archiveAnnouncement, createAnnouncement, getAnnouncements, publishAnnouncement } from "../../services/adminPlatformService.js";
import { listSchoolsAdmin } from "../../services/schoolService.js";

const AUD = { all: "Everyone", students: "Students", reps: "Course reps", independent: "Independent learners", school: "One school" };

export default function AdminAnnouncementsPage() {
  const nav = useAdminNavItems();
  const toast = useToast();
  const [f, setF] = useState({ title: "", body: "", audience: "all", schoolId: "", expiresAt: "" });
  const [schools, setSchools] = useState([]);
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  const load = useCallback(() => getAnnouncements({ page }).then(setD).catch(() => setD({ announcements: [] })), [page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { listSchoolsAdmin({ limit: 100 }).then((r) => setSchools(r.schools || [])).catch(() => {}); }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save(publish) {
    try {
      const a = await createAnnouncement({ ...f, schoolId: f.audience === "school" ? f.schoolId : undefined, expiresAt: f.expiresAt || undefined });
      if (publish) { const r = await publishAnnouncement(a._id); toast(`Published to ${r.recipients} people`, "success"); } else toast("Draft saved", "success");
      setF({ title: "", body: "", audience: "all", schoolId: "", expiresAt: "" }); load();
    } catch (e) { toast(e.message || "Couldn't save.", "error"); }
  }
  async function pub(a) {
    if (!window.confirm(`Send "${a.title}" to ${AUD[a.audience]} now? This can't be unsent.`)) return;
    try { const r = await publishAnnouncement(a._id); toast(`Published to ${r.recipients} people`, "success"); load(); } catch (e) { toast(e.message, "error"); }
  }

  return (
    <AppShell sidebarItems={nav}>
      <h1 className="text-2xl font-bold">Announcements</h1>
      <p className="text-sm lv-meta">Publishing sends a notification once and shows a banner until it expires or you archive it.</p>
      <div className="mt-5 max-w-2xl space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <Field label="Title"><Input value={f.title} onChange={set("title")} maxLength={120} /></Field>
        <Field label="Message"><Textarea rows={3} value={f.body} onChange={set("body")} maxLength={1500} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Audience"><Select value={f.audience} onChange={set("audience")}>{Object.entries(AUD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          {f.audience === "school" && <Field label="School"><Select value={f.schoolId} onChange={set("schoolId")}><option value="">Choose…</option>{schools.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</Select></Field>}
          <Field label="Banner expires (optional)"><Input type="datetime-local" value={f.expiresAt} onChange={set("expiresAt")} /></Field>
        </div>
        <div className="flex gap-2"><Button variant="outline" disabled={f.title.trim().length < 3 || f.body.trim().length < 3} onClick={() => save(false)}>Save draft</Button><Button disabled={f.title.trim().length < 3 || f.body.trim().length < 3 || (f.audience === "school" && !f.schoolId)} onClick={() => window.confirm("Publish and notify now?") && save(true)}>Publish now</Button></div>
      </div>

      <section className="mt-8 max-w-3xl">
        {!d ? <InlineLoader /> : <ul className="space-y-3">{d.announcements.map((a) => (
          <li key={a._id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2"><p className="font-semibold">{a.title}</p><span className="flex gap-1.5"><Badge tone={a.status === "published" ? "green" : a.status === "draft" ? "amber" : "slate"}>{a.status}</Badge><Badge>{AUD[a.audience]}</Badge></span></div>
            <p className="mt-1 whitespace-pre-wrap text-sm lv-meta">{a.body}</p>
            {a.status === "published" && <p className="mt-1 text-xs lv-meta">Sent to {a.notifiedCount} · {new Date(a.publishedAt).toLocaleString()}</p>}
            <div className="mt-2 flex gap-2">{a.status === "draft" && <Button size="sm" onClick={() => pub(a)}>Publish</Button>}{a.status !== "archived" && <Button size="sm" variant="ghost" onClick={async () => { await archiveAnnouncement(a._id); load(); }}>Archive</Button>}</div>
          </li>))}
          {d.announcements.length === 0 && <li className="text-sm lv-meta">No announcements yet.</li>}</ul>}
        {d && <Pager pagination={d.pagination} onPageChange={setPage} />}
      </section>
    </AppShell>
  );
}
