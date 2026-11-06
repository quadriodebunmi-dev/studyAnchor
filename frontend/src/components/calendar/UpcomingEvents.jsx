import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight } from "lucide-react";
import { upcomingEvents } from "../../services/calendarService.js";
import { EVENT_TYPES, formatWhen } from "./calendarUi.js";

// Dashboard card: the next few dates from the education calendar. Renders nothing
// until there is something to show, so an empty calendar never takes up space.
export default function UpcomingEvents({ limit = 3 }) {
  const [events, setEvents] = useState(null);
  useEffect(() => { upcomingEvents(limit).then(setEvents).catch(() => setEvents([])); }, [limit]);
  if (!events?.length) return null;
  return (
    <Link to="/calendar" className="lv-card-interactive block p-3">
      <span className="flex items-center justify-between text-[11px] lv-meta">
        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-accent" /> Coming up</span>
        <span className="flex items-center gap-0.5">Calendar <ChevronRight className="h-3 w-3" /></span>
      </span>
      <ul className="mt-1.5 space-y-1.5">
        {events.map((e) => (
          <li key={e._id} className="flex items-start gap-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${EVENT_TYPES[e.type]?.dot || "bg-slate-400"}`} aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium">{e.title}</span>
              <span className="block text-[10.5px] lv-meta">{formatWhen(e)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
