import React, { useState } from "react";
import { User as UserIcon, Users } from "lucide-react";
import Button from "../Button.jsx";
import { Field, Input, Select, Textarea } from "../FormFields.jsx";
import { DEPARTMENTS, LEVELS } from "../../config/appConfig.js";
import { EVENT_TYPES, utcKey, localKey } from "./calendarUi.js";

const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (d) => `${localKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Turns the stored event (or a blank one for `day`) into the form's string fields.
function initial(event, day, canPublish, user) {
  if (event) {
    const s = new Date(event.startsAt);
    const en = event.endsAt ? new Date(event.endsAt) : null;
    return {
      title: event.title, description: event.description || "", type: event.type, allDay: event.allDay, scope: event.scope,
      start: event.allDay ? utcKey(s) : toLocalInput(s), end: en ? (event.allDay ? utcKey(en) : toLocalInput(en)) : "",
      department: event.department || "", level: event.level ? String(event.level) : "",
    };
  }
  const d = day || localKey(new Date());
  return {
    title: "", description: "", type: "exam", allDay: true, scope: "personal",
    start: d, end: "", department: canPublish ? user?.department || "" : "", level: canPublish && user?.level ? String(user.level) : "",
  };
}

// Create or edit one event. `canPublish` = a Course Rep who may also add class-wide events.
export default function EventForm({ event, day, canPublish, user, onSubmit, onDelete, onCancel }) {
  const [f, setF] = useState(() => initial(event, day, canPublish, user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const editing = Boolean(event);

  // Swapping between all-day and timed keeps the date and picks a sensible time.
  function toggleAllDay(allDay) {
    const conv = (v, hour) => (!v ? "" : allDay ? v.slice(0, 10) : v.length === 10 ? `${v}T${hour}` : v);
    set({ allDay, start: conv(f.start, "09:00"), end: conv(f.end, "10:00") });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!f.start) return setError("Pick a start date.");
    const iso = (v) => (f.allDay ? v : new Date(v).toISOString());
    const payload = {
      title: f.title, description: f.description, type: f.type, allDay: f.allDay, scope: f.scope,
      startsAt: iso(f.start), endsAt: f.end ? iso(f.end) : null,
    };
    if (f.scope === "school") { payload.department = f.department; payload.level = f.level ? Number(f.level) : null; }
    setBusy(true);
    try { await onSubmit(payload); }
    catch (err) { setError(err.message || "Couldn't save the event."); setBusy(false); }
  }

  const inputType = f.allDay ? "date" : "datetime-local";
  return (
    <form onSubmit={submit} className="space-y-4">
      {canPublish && !editing && (
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Who is this for?">
          {[["personal", UserIcon, "Just me", "Only you see it."], ["school", Users, "My class", "Students it targets see it and get a reminder."]].map(([k, Icon, title, text]) => (
            <button type="button" key={k} role="radio" aria-checked={f.scope === k} onClick={() => set({ scope: k })}
              className={`rounded-xl border p-3 text-left transition-colors ${f.scope === k ? "border-accent bg-accent/10" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"}`}>
              <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" />{title}</span>
              <span className="mt-1 block text-xs lv-meta">{text}</span>
            </button>
          ))}
        </div>
      )}

      <Field label="Title"><Input value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder="e.g. CSC 201 mid-semester test" required autoFocus /></Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          <Select value={f.type} onChange={(e) => set({ type: e.target.value })}>
            {Object.entries(EVENT_TYPES).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </Select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={f.allDay} onChange={(e) => toggleAllDay(e.target.checked)} className="h-4 w-4" /> All day
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={f.allDay ? "Date" : "Starts"}><Input type={inputType} value={f.start} onChange={(e) => set({ start: e.target.value })} required /></Field>
        <Field label={f.allDay ? "Last day (optional)" : "Ends (optional)"}><Input type={inputType} value={f.end} min={f.start || undefined} onChange={(e) => set({ end: e.target.value })} /></Field>
      </div>

      {f.scope === "school" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Department" hint="Leave on “Everyone” to reach the whole school.">
            <Select value={f.department} onChange={(e) => set({ department: e.target.value })}>
              <option value="">Everyone</option>
              {[...new Set([...DEPARTMENTS, f.department].filter(Boolean))].map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Level">
            <Select value={f.level} onChange={(e) => set({ level: e.target.value })}>
              <option value="">All levels</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l} Level</option>)}
            </Select>
          </Field>
        </div>
      )}

      <Field label="Notes (optional)"><Textarea rows={2} maxLength={600} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Venue, what to bring…" /></Field>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || f.title.trim().length < 3}>{busy ? "Saving…" : editing ? "Save changes" : "Add to calendar"}</Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
        {editing && onDelete && <Button type="button" variant="outline" onClick={onDelete} className="!text-danger">Delete</Button>}
      </div>
    </form>
  );
}
