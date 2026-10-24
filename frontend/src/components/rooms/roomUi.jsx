import React from "react";
import { Lock, Globe, Users } from "lucide-react";
import Badge from "../Badge.jsx";

export const MOODS = [
  { value: "social", label: "Social" },
  { value: "revision", label: "Revision" },
  { value: "brainstorming", label: "Brainstorming" },
  { value: "daily_study", label: "Daily Study" },
];
export const moodLabel = (v) => MOODS.find((m) => m.value === v)?.label || v;

// Each mood gets its own tint for the room's letter tile, so rooms are easy to tell apart at a glance.
// (Full class names on purpose: Tailwind can't see classes built from pieces.)
const MOOD_TILE = {
  social: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  revision: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  brainstorming: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  daily_study: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
};
const DEFAULT_TILE = "bg-primary/10 text-primary";

export function RoomCard({ room, onOpen, action }) {
  const isPrivate = room.visibility === "private";
  const blurb = room.topic || room.description;
  const initial = (room.name || "?").trim().charAt(0).toUpperCase();
  const members = `${room.memberCount} member${room.memberCount === 1 ? "" : "s"}`;

  return (
    <div className="lv-card flex flex-col gap-1.5 p-2 transition-colors hover:border-accent/60">
      {/* Tap target: letter tile, name + one-line blurb, and quick facts on the right. */}
      <button onClick={onOpen} className="flex items-center gap-2 text-left">
        <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-bold ${MOOD_TILE[room.mood] || DEFAULT_TILE}`}>{initial}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold leading-tight">{room.name}</span>
          {blurb && <span className={`mt-0.5 block truncate text-[10.5px] leading-tight ${room.topic ? "text-primary" : "lv-meta"}`}>{blurb}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 self-start text-slate-400">
          <span className="flex items-center gap-0.5 text-[10.5px] lv-meta" title={members}><Users className="h-3 w-3" aria-label={members} />{room.memberCount}</span>
          {isPrivate ? <Lock className="h-3 w-3" aria-label="Private" /> : <Globe className="h-3 w-3" aria-label="Public" />}
        </span>
      </button>

      {/* Tags on the left, the card's action (Join, Accept...) on the right. */}
      <div className="flex flex-wrap items-center gap-1">
        <div className="flex flex-wrap items-center gap-1 [&>*]:!px-1.5 [&>*]:!py-0 [&>*]:!text-[9.5px]">
          <Badge tone="violet">{moodLabel(room.mood)}</Badge>
          {room.course?.code && <Badge tone="indigo">{room.course.code}</Badge>}
          {room.myRole === "owner" && <Badge tone="accent">Owner</Badge>}
          {room.myRole === "moderator" && <Badge tone="green">Moderator</Badge>}
          {room.myStatus === "pending" && <Badge tone="amber">Request pending</Badge>}
          {room.audience === "school" && <Badge>School only</Badge>}
        </div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
    </div>
  );
}