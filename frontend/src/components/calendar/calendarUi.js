// Shared by the calendar page and the dashboard "coming up" card.
export const EVENT_TYPES = {
  exam: { label: "Exam", tone: "red", dot: "bg-danger" },
  test: { label: "Test", tone: "amber", dot: "bg-warning" },
  assignment: { label: "Assignment", tone: "indigo", dot: "bg-primary" },
  class: { label: "Class", tone: "green", dot: "bg-success" },
  registration: { label: "Registration", tone: "violet", dot: "bg-secondary-purple" },
  holiday: { label: "Holiday", tone: "green", dot: "bg-success" },
  deadline: { label: "Deadline", tone: "red", dot: "bg-danger" },
  other: { label: "Other", tone: "slate", dot: "bg-slate-400" },
};

const pad = (n) => String(n).padStart(2, "0");
export const localKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const utcKey = (d) => d.toISOString().slice(0, 10);

// All-day events are stored at UTC midnight (so they never slide to another day
// in a different time zone); timed events are real instants shown in local time.
export const startKey = (e) => (e.allDay ? utcKey(new Date(e.startsAt)) : localKey(new Date(e.startsAt)));

/** Every calendar day (YYYY-MM-DD) an event touches. Capped so a bad range can't loop for long. */
export function eventDayKeys(e) {
  const start = new Date(e.startsAt);
  const end = e.endsAt ? new Date(e.endsAt) : start;
  const keys = [];
  if (e.allDay) {
    for (let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()), i = 0;
      t <= end.getTime() && i < 62; t += 86400000, i++) keys.push(utcKey(new Date(t)));
  } else {
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    for (let i = 0; cur <= last && i < 62; i++) { keys.push(localKey(cur)); cur.setDate(cur.getDate() + 1); }
  }
  return keys.length ? keys : [startKey(e)];
}

export function formatWhen(e) {
  const s = new Date(e.startsAt);
  const day = (d, utc) => d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", ...(utc ? { timeZone: "UTC" } : {}) });
  if (e.allDay) {
    const end = e.endsAt ? new Date(e.endsAt) : null;
    return end && utcKey(end) !== utcKey(s) ? `${day(s, true)} – ${day(end, true)}` : `${day(s, true)} · All day`;
  }
  const time = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const end = e.endsAt ? new Date(e.endsAt) : null;
  if (!end) return `${day(s)} · ${time(s)}`;
  return localKey(end) === localKey(s) ? `${day(s)} · ${time(s)} – ${time(end)}` : `${day(s)} ${time(s)} – ${day(end)} ${time(end)}`;
}

export function audienceLabel(e) {
  if (e.scope === "personal") return "Personal";
  if (e.platformWide) return "All schools";
  const parts = [e.department, e.level ? `${e.level} Level` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Whole school";
}
