import React, { useCallback, useEffect, useState } from "react";
import { UserPlus, Shield, Trash2, Ban, Check, X } from "lucide-react";
import Button from "../Button.jsx";
import Badge from "../Badge.jsx";
import { Input } from "../FormFields.jsx";
import { InlineLoader } from "../Loader.jsx";
import { useToast } from "../Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import Avatar from "../Avatar.jsx";
import useRoomPresence from "../../hooks/useRoomPresence.js";
import AvatarModal from "./AvatarModal.jsx";
import { decideRequest, inviteToRoom, listMembers, listRequests, removeMember, setMemberRole } from "../../services/roomService.js";

export default function RoomMembers({ room }) {
  const { user } = useAuth();
  const toast = useToast();
  const isOwner = room.myRole === "owner";
  const canModerate = isOwner || room.myRole === "moderator";
  const [members, setMembers] = useState(null);
  const [requests, setRequests] = useState([]);
  const [email, setEmail] = useState("");
  const [avatarView, setAvatarView] = useState(null);
  const { online } = useRoomPresence(room._id, user._id);

  const load = useCallback(() => {
    listMembers(room._id, { limit: 100 }).then((r) => setMembers(r.members)).catch(() => setMembers([]));
    if (canModerate) listRequests(room._id).then(setRequests).catch(() => {});
  }, [room._id, canModerate]);
  useEffect(() => { load(); }, [load]);

  const run = (fn, ok) => async (...args) => {
    try { const r = await fn(...args); toast(ok || r?.message || "Done", "success"); load(); } catch (e) { toast(e.message || "Something went wrong.", "error"); }
  };

  async function invite(e) {
    e.preventDefault();
    if (!email.trim()) return;
    try { const r = await inviteToRoom(room._id, email.trim()); toast(r.message, "success"); setEmail(""); } catch (err) { toast(err.message || "Couldn't invite.", "error"); }
  }

  return (
    <div className="space-y-6">
      {avatarView && <AvatarModal person={avatarView} onClose={() => setAvatarView(null)} />}
      {canModerate && (
        <>
          {requests.length > 0 && (
            <section className="rounded-2xl border border-amber-300/50 bg-warning/5 p-4">
              <h3 className="mb-2 font-display font-semibold">Join requests ({requests.length})</h3>
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.user._id} className="flex items-center justify-between gap-2">
                    <span className="text-sm">{r.user.name}</span>
                    <span className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => run(decideRequest, "Request declined")(room._id, r.user._id, "reject")}><X className="h-3.5 w-3.5" />Decline</Button>
                      <Button size="sm" onClick={() => run(decideRequest, "Member approved")(room._id, r.user._id, "approve")}><Check className="h-3.5 w-3.5" />Approve</Button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <form onSubmit={invite} className="flex gap-2">
            <div className="flex-1"><Input type="email" placeholder="Invite by email address" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email to invite" /></div>
            <Button type="submit" variant="outline"><UserPlus className="h-4 w-4" />Invite</Button>
          </form>
        </>
      )}

      {members === null ? <InlineLoader /> : (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {members.map((m) => {
            const self = m.user._id === user._id;
            return (
              <li key={m.user._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <button type="button" onClick={() => setAvatarView({ name: m.user.name, avatarUrl: m.user.avatarUrl, online: self || online.has(m.user._id) })} aria-label={`View ${m.user.name}'s profile picture`} className="relative inline-flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                    <Avatar user={m.user} size={28} />
                    {(self || online.has(m.user._id)) && <span title="Online" className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />}
                  </button>
                  {m.user.name}{self && <span className="lv-meta">(you)</span>}
                  {m.role === "owner" && <Badge tone="accent">Owner</Badge>}
                  {m.role === "moderator" && <Badge tone="green">Moderator</Badge>}
                </span>
                {!self && m.role !== "owner" && canModerate && (
                  <span className="flex gap-1.5">
                    {isOwner && (
                      <Button size="sm" variant="ghost" onClick={() => run(setMemberRole, m.role === "moderator" ? "Moderator removed" : "Moderator added")(room._id, m.user._id, m.role === "moderator" ? "member" : "moderator")}>
                        <Shield className="h-3.5 w-3.5" />{m.role === "moderator" ? "Demote" : "Make moderator"}
                      </Button>
                    )}
                    {(isOwner || m.role === "member") && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => window.confirm(`Remove ${m.user.name}?`) && run(removeMember, "Member removed")(room._id, m.user._id, false)}><Trash2 className="h-3.5 w-3.5" />Remove</Button>
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => window.confirm(`Ban ${m.user.name}? They won't be able to rejoin.`) && run(removeMember, "Member banned")(room._id, m.user._id, true)}><Ban className="h-3.5 w-3.5" />Ban</Button>
                      </>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
