import { useEffect, useRef, useState } from "react";

// Counts down to a server-issued deadline. The device clock may be wrong, so we
// measure the offset between it and the server's clock (from `serverTime`) once
// and apply it — the server still enforces the real deadline either way.
export default function useCountdown(expiresAt, serverTime) {
  const offset = useRef(0);
  const [left, setLeft] = useState(null);

  useEffect(() => {
    if (serverTime) offset.current = new Date(serverTime).getTime() - Date.now();
  }, [serverTime]);

  useEffect(() => {
    if (!expiresAt) { setLeft(null); return undefined; }
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - (Date.now() + offset.current)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return left; // ms remaining, or null when there's no limit
}

export function formatClock(ms) {
  if (ms === null || ms === undefined) return "";
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
