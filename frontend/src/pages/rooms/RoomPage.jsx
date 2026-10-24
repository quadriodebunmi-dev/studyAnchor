import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { useToast } from "../../components/Toast.jsx";
import RoomDiscussion from "../../components/rooms/RoomDiscussion.jsx";
import RoomMembers from "../../components/rooms/RoomMembers.jsx";
import RoomQuizzesTab from "../../components/rooms/RoomQuizzesTab.jsx";
import RoomAbout from "../../components/rooms/RoomAbout.jsx";
import { moodLabel } from "../../components/rooms/roomUi.jsx";
import { getRoom, joinRoom } from "../../services/roomService.js";
import { joinRoomChannel, subscribe } from "../../services/realtime.js";

const TABS = [["discussion", "Discussion"], ["quizzes", "Quizzes"], ["members", "Members"], ["about", "About"]];

export default function RoomPage() {
  const { roomId } = useParams();
  const [params, setParams] = useSearchParams();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const toast = useToast();
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "discussion";

  const load = useCallback(() => getRoom(roomId).then(setRoom).catch((e) => setError(e.message || "Room not found.")), [roomId]);
  useEffect(() => { load(); }, [load]);

  // Live channel: only opens once we know the user is a member (the server checks again).
  const isMember = room?.myStatus === "active";
  useEffect(() => {
    if (!isMember) return undefined;
    let leave = () => {};
    let off = () => {};
    joinRoomChannel(roomId).then((fn) => { leave = fn; });
    subscribe({
      "room:deleted": () => { toast("This room was deleted", "info"); navigate("/rooms"); },
      "room:updated": load,
      "member:joined": () => setRoom((r) => (r ? { ...r, memberCount: r.memberCount + 1 } : r)),
    }).then((fn) => { off = fn; });
    return () => { leave(); off(); };
  }, [isMember, roomId, load, navigate, toast]);

  async function join() {
    try { const r = await joinRoom(roomId); toast(r.message, "success"); load(); } catch (e) { toast(e.message || "Couldn't join.", "error"); }
  }

  if (error) return <AppShell><div className="py-16 text-center"><p className="text-danger">{error}</p><Button className="mt-4" onClick={() => navigate("/rooms")}>Back to rooms</Button></div></AppShell>;
  if (!room) return <AppShell><InlineLoader /></AppShell>;

  return (
    <AppShell>
      <button onClick={() => navigate("/rooms")} className="mb-3 inline-flex items-center gap-1 text-sm lv-meta hover:text-night dark:hover:text-white"><ArrowLeft className="h-4 w-4" />All rooms</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">{room.name}{room.visibility === "private" && <Lock className="h-4 w-4 text-slate-400" aria-label="Private room" />}</h1>
          {room.topic && <p className="text-primary">{room.topic}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone="violet">{moodLabel(room.mood)}</Badge><Badge>{room.memberCount} members</Badge>{room.course?.code && <Badge tone="indigo">{room.course.code}</Badge>}</div>
        </div>
      </div>

      {!room.canViewContent ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="font-display text-lg font-semibold">Join to see the discussion and quizzes</p>
          {room.description && <p className="mx-auto mt-2 max-w-md text-sm lv-meta">{room.description}</p>}
          <div className="mt-5">
            {room.myStatus === "pending" ? <Badge tone="amber">Your request is waiting for approval</Badge>
              : room.myStatus === "invited" ? <Button onClick={join}>Accept invitation</Button>
              : <Button onClick={join}>{room.joinPolicy === "open" ? "Join room" : "Request to join"}</Button>}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800" role="tablist">
            {TABS.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={tab === key} onClick={() => setParams({ tab: key })}
                className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? "border-accent text-night dark:text-white" : "border-transparent text-slate-500 hover:text-night dark:hover:text-white"}`}>
                {label}{key === "members" && room.pendingRequests > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-fg">{room.pendingRequests}</span>}
              </button>
            ))}
          </div>
          <div className="mt-6">
            {tab === "discussion" && <RoomDiscussion room={room} />}
            {tab === "quizzes" && <RoomQuizzesTab room={room} />}
            {tab === "members" && <RoomMembers room={room} />}
            {tab === "about" && <RoomAbout room={room} onChanged={load} onLeft={() => navigate("/rooms")} />}
          </div>
        </>
      )}
    </AppShell>
  );
}
