import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import Modal from "../../components/Modal.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import EventForm from "../../components/calendar/EventForm.jsx";
import { EVENT_TYPES, audienceLabel, eventDayKeys, formatWhen, localKey } from "../../components/calendar/calendarUi.js";
import { createEvent, deleteEvent, listEvents, updateEvent } from "../../services/calendarService.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// The grid always shows whole weeks (Monday first) around the month.
function gridDays(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const total = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, i) => new Date(year, month, 1 - lead + i));
}

export default function CalendarPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canPublish = user.role === "rep" && user.repStatus === "active";
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [events, setEvents] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState(null); // "YYYY-MM-DD" or null = whole month
  const [editor, setEditor] = useState(null); // { event?, day? }

  const days = useMemo(() => gridDays(cursor.year, cursor.month), [cursor]);

  const load = useCallback(() => {
    // A day either side so all-day events (stored at UTC midnight) are never clipped.
    const from = new Date(days[0].getTime() - 86400000);
    const to = new Date(days[days.length - 1].getTime() + 2 * 86400000);
    return listEvents({ from, to }).then(setEvents).catch((e) => { setEvents([]); toast(e.message || "Couldn't load the calendar.", "error"); });
  }, [days, toast]);
  useEffect(() => { setEvents(null); load(); }, [load]);

  const visible = useMemo(() => (events || []).filter((e) => !typeFilter || e.type === typeFilter), [events, typeFilter]);
  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of visible) for (const k of eventDayKeys(e)) { if (!map.has(k)) map.set(k, []); map.get(k).push(e); }
    return map;
  }, [visible]);

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
  const listed = useMemo(() => {
    if (selected) return byDay.get(selected) || [];
    return visible.filter((e) => eventDayKeys(e).some((k) => k.startsWith(monthPrefix)));
  }, [selected, byDay, visible, monthPrefix]);

  const move = (delta) => { setSelected(null); setCursor(({ year, month }) => { const d = new Date(year, month + delta, 1); return { year: d.getFullYear(), month: d.getMonth() }; }); };
  const todayKey = localKey(today);

  async function save(payload) {
    if (editor.event) { await updateEvent(editor.event._id, payload); toast("Event updated", "success"); }
    else { await createEvent(payload); toast(payload.scope === "school" ? "Added — your class will be notified" : "Added to your calendar", "success"); }
    setEditor(null);
    load();
  }
  async function remove() {
    if (!window.confirm(`Delete "${editor.event.title}"?`)) return;
    try { await deleteEvent(editor.event._id); toast("Event deleted", "success"); setEditor(null); load(); }
    catch (e) { toast(e.message || "Couldn't delete the event.", "error"); }
  }

  const chip = (active) => `lv-chip !px-2.5 !py-1 !text-[11px] ${active ? "lv-chip-active" : ""}`;
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl text-[13px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="lv-page-title flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Education Calendar</h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {canPublish ? "Exams, deadlines and dates for your class, plus your own reminders." : "Exams, deadlines and dates from your school, plus your own reminders."}
            </p>
          </div>
          <Button size="sm" onClick={() => setEditor({ day: selected })}><Plus className="h-3.5 w-3.5" />Add event</Button>
        </div>

        <div className="lv-chips mt-3">
          <button onClick={() => setTypeFilter("")} className={chip(typeFilter === "")}>All</button>
          {Object.entries(EVENT_TYPES).map(([k, m]) => <button key={k} onClick={() => setTypeFilter(typeFilter === k ? "" : k)} className={chip(typeFilter === k)}>{m.label}</button>)}
        </div>

        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <button onClick={() => move(-1)} aria-label="Previous month" className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm font-semibold">{monthLabel}</h2>
              <button onClick={() => { setCursor({ year: today.getFullYear(), month: today.getMonth() }); setSelected(todayKey); }} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium dark:bg-slate-800">Today</button>
            </div>
            <button onClick={() => move(1)} aria-label="Next month" className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase lv-meta">{WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
            {days.map((d) => {
              const key = localKey(d);
              const dayEvents = byDay.get(key) || [];
              const inMonth = d.getMonth() === cursor.month;
              const isSel = selected === key;
              return (
                <button key={key} onClick={() => setSelected(isSel ? null : key)} aria-pressed={isSel}
                  aria-label={`${d.toLocaleDateString([], { dateStyle: "full" })}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ""}`}
                  className={`flex min-h-[3.25rem] flex-col items-center gap-1 bg-white p-1 text-xs transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 sm:min-h-[4.25rem] ${inMonth ? "" : "opacity-40"} ${isSel ? "!bg-accent/15 ring-2 ring-inset ring-accent" : ""}`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-full ${key === todayKey ? "bg-primary font-bold text-primary-fg" : ""}`}>{d.getDate()}</span>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {dayEvents.slice(0, 3).map((e) => <span key={e._id} className={`h-1.5 w-1.5 rounded-full ${EVENT_TYPES[e.type]?.dot || "bg-slate-400"}`} />)}
                    {dayEvents.length > 3 && <span className="text-[9px] leading-none lv-meta">+{dayEvents.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold">
            {selected ? new Date(`${selected}T00:00:00`).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) : `In ${monthLabel}`}
          </h2>
          {selected && <button onClick={() => setSelected(null)} className="text-xs font-medium text-primary hover:underline">Show whole month</button>}
        </div>

        <div className="mt-2 space-y-2">
          {events === null ? <InlineLoader /> : listed.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={selected ? "Nothing on this day" : "Nothing this month"}
              message="Add an exam, deadline or reminder and it will show up here."
              action={<Button size="sm" onClick={() => setEditor({ day: selected })}>Add event</Button>} />
          ) : listed.map((e) => {
            const meta = EVENT_TYPES[e.type] || EVENT_TYPES.other;
            return (
              <article key={e._id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{e.title}</p>
                  <p className="mt-0.5 text-xs lv-meta">{formatWhen(e)}</p>
                  {e.description && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{e.description}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <Badge tone={e.scope === "personal" ? "violet" : "slate"}>{audienceLabel(e)}</Badge>
                    {e.course && <Badge tone="indigo">{e.course.code}</Badge>}
                    {e.scope === "school" && e.createdBy?.name && <Badge>by {e.createdBy.name}</Badge>}
                  </div>
                </div>
                {e.canEdit && <button onClick={() => setEditor({ event: e })} aria-label={`Edit ${e.title}`} className="shrink-0 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></button>}
              </article>
            );
          })}
        </div>
      </div>

      {editor && (
        <Modal title={editor.event ? "Edit event" : "Add event"} onClose={() => setEditor(null)} wide>
          <EventForm event={editor.event} day={editor.day} canPublish={canPublish} user={user} onSubmit={save} onDelete={editor.event ? remove : undefined} onCancel={() => setEditor(null)} />
        </Modal>
      )}
    </AppShell>
  );
}
