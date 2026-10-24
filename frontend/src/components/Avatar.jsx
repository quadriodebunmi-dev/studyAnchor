import React, { useEffect, useState } from "react";

const initialsOf = (name = "") => name.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();

// A person's profile picture, or their initials when they have none (or it fails to load).
export default function Avatar({ user, size = 32, className = "" }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user?.avatarUrl]);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (user?.avatarUrl && !broken) {
    return <img src={user.avatarUrl} alt="" style={style} onError={() => setBroken(true)} className={`shrink-0 rounded-full bg-slate-200 object-cover dark:bg-slate-700 ${className}`} />;
  }
  return (
    <span style={style} aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-fg ${className}`}>
      {initialsOf(user?.name)}
    </span>
  );
}
