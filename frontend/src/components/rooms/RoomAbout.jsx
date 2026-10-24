import React, { useEffect, useState } from "react";
import { Copy, Trash2, DoorOpen, Flag } from "lucide-react";
import Button from "../Button.jsx";
import Modal from "../Modal.jsx";
import { InlineLoader } from "../Loader.jsx";
import { useToast } from "../Toast.jsx";
import RoomForm from "./RoomForm.jsx";
import { moodLabel } from "./roomUi.jsx";
import { deleteRoom, dismissReport, leaveRoom, listReports, removePost, roomActivity, updateRoom } from "../../services/roomService.js";

export default function RoomAbout({ room, onChanged, onLeft }) {
  const toast = useToast();
  const isOwner = room.myRole === "owner";
  const canModerate = isOwner || room.myRole === "moderator";
  const [events, setEvents] = useState(null);
  const [reports, setReports] = useState([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    roomActivity(room._id).then(setEvents).catch(() => setEvents([]));
    if (canModerate) listReports(room._id).then(setReports).catch(() => {});
  }, [room._id, canModerate]);

  const inviteLink = room.inviteCode ? `${window.location.origin}/rooms/join/${room.inviteCode}` : "";

  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink); toast("Invite link copied", "success"); } catch { toast(inviteLink, "info"); }
  }
  async function leave() {
    if (!window.confirm("Leave this room?")) return;
    try { await leaveRoom(room._id); toast("You left the room", "success"); onLeft(); } catch (e) { toast(e.message || "Couldn't leave.", "error"); }
  }
  async function destroy() {
    if (!window.confirm("Delete this room, its messages, quizzes and results? This can't be undone.")) return;
    try { await deleteRoom(room._id); toast("Room deleted", "success"); onLeft(); } catch (e) { toast(e.message || "Couldn't delete.", "error"); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-display font-semibold">About this room</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="lv-meta">Created by</dt><dd>{room.creator?.name}</dd></div>
          <div><dt className="lv-meta">Mood</dt><dd>{moodLabel(room.mood)}</dd></div>
          <div><dt className="lv-meta">Visibility</dt><dd className="capitalize">{room.visibility}{room.visibility === "public" && ` · ${room.joinPolicy === "open" ? "open to all" : "approval needed"}`}</dd></div>
          {room.course && <div><dt className="lv-meta">Course</dt><dd>{room.course.code} {room.course.title}</dd></div>}
          {room.material && <div><dt className="lv-meta">Material</dt><dd>{room.material.title}</dd></div>}
        </dl>
        {room.description && <p className="mt-3 text-sm">{room.description}</p>}
        {inviteLink && (
          <div className="mt-4 rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-800">
            <p className="mb-1 font-medium">Invite link (people still need your approval)</p>
            <p className="break-all lv-meta">{inviteLink}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={copyLink}><Copy className="h-3.5 w-3.5" />Copy link</Button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {isOwner && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit settings</Button>}
          {!isOwner && <Button variant="outline" size="sm" onClick={leave}><DoorOpen className="h-3.5 w-3.5" />Leave room</Button>}
          {isOwner && <Button variant="destructive" size="sm" onClick={destroy}><Trash2 className="h-3.5 w-3.5" />Delete room</Button>}
        </div>
      </section>

      {canModerate && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 font-display font-semibold"><Flag className="h-4 w-4" />Reported messages</h3>
          {reports.length === 0 ? <p className="mt-2 text-sm lv-meta">Nothing reported.</p> : (
            <ul className="mt-3 space-y-3">
              {reports.map((r) => (
                <li key={r._id} className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                  {r.post.content && <p className="whitespace-pre-wrap break-words">{r.post.content}</p>}
                  {r.post.attachment?.kind === "image" && <a href={r.post.attachment.url} target="_blank" rel="noreferrer"><img src={r.post.attachment.url} alt="Reported photo" loading="lazy" className="mt-1 max-h-48 rounded-lg" /></a>}
                  {r.post.attachment?.kind === "audio" && <audio controls preload="metadata" src={r.post.attachment.url} className="mt-1 w-full max-w-sm" aria-label="Reported voice message" />}
                  <p className="mt-1 text-xs lv-meta">Reported by {r.reportedBy}: {r.reason}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="ghost" onClick={async () => { await dismissReport(room._id, r._id); setReports((l) => l.filter((x) => x._id !== r._id)); }}>Dismiss</Button>
                    <Button size="sm" variant="destructive" onClick={async () => { await removePost(room._id, r.post._id); setReports((l) => l.filter((x) => x._id !== r._id)); toast("Message removed", "success"); }}>Remove message</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-display font-semibold">Recent activity</h3>
        {events === null ? <InlineLoader /> : events.length === 0 ? <p className="mt-2 text-sm lv-meta">Nothing yet.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {events.map((ev, i) => <li key={i} className="flex justify-between gap-3"><span>{ev.text}</span><span className="shrink-0 text-xs lv-meta">{new Date(ev.createdAt).toLocaleDateString()}</span></li>)}
          </ul>
        )}
      </section>

      {editing && (
        <Modal title="Room settings" onClose={() => setEditing(false)} wide>
          <RoomForm editing submitLabel="Save changes" initial={room}
            onSubmit={async (f) => { await updateRoom(room._id, f); setEditing(false); toast("Saved", "success"); onChanged(); }} />
        </Modal>
      )}
    </div>
  );
}
