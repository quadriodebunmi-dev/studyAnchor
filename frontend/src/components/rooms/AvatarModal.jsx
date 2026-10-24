import React, { useEffect, useState } from "react";
import Modal from "../Modal.jsx";

const initialsOf = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

// Large view of a member's profile picture (initials when they haven't set one or it fails to load).
export default function AvatarModal({ person, onClose }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [person?.avatarUrl]);
  if (!person) return null;
  const showImg = person.avatarUrl && /^https?:\/\//.test(person.avatarUrl) && !failed;
  return (
    <Modal title={person.name || "Member"} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 pb-1">
        {showImg ? (
          <img src={person.avatarUrl} alt={`${person.name}'s profile picture`} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="aspect-square w-full max-w-xs rounded-2xl bg-slate-200 object-cover dark:bg-slate-700" />
        ) : (
          <span aria-hidden="true" className="grid aspect-square w-48 place-items-center rounded-full bg-primary/15 font-display text-6xl font-bold text-primary">{initialsOf(person.name)}</span>
        )}
        {!showImg && <p className="text-sm lv-meta">No profile picture yet.</p>}
        {person.online && <p className="inline-flex items-center gap-1.5 text-xs lv-meta"><span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />Online now</p>}
      </div>
    </Modal>
  );
}
