import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket, subscribe } from "../services/realtime.js";

const TYPING_TTL_MS = 5000; // a "typing" signal expires on its own if the stop event never arrives

// Who is online in a room and who is typing right now (Socket.IO only; empty when sockets aren't available).
// Typing is never reported for the current user.
export default function useRoomPresence(roomId, selfId) {
  const [online, setOnline] = useState(() => new Set());
  const [typing, setTypingMap] = useState({}); // userId -> name
  const timers = useRef({});
  const lastSent = useRef({ typing: false, at: 0 });

  useEffect(() => {
    let off = () => {};
    let dead = false;
    let retry;

    const dropTyping = (userId) => {
      clearTimeout(timers.current[userId]);
      delete timers.current[userId];
      setTypingMap((m) => { if (!(userId in m)) return m; const { [userId]: _, ...rest } = m; return rest; });
    };

    subscribe({
      "presence:update": (p) => { if (p.roomId === roomId) setOnline(new Set(p.online || [])); },
      typing: (p) => {
        if (p.roomId !== roomId || !p.userId || p.userId === selfId) return;
        if (!p.typing) return dropTyping(p.userId);
        setTypingMap((m) => ({ ...m, [p.userId]: p.name || "Someone" }));
        clearTimeout(timers.current[p.userId]);
        timers.current[p.userId] = setTimeout(() => dropTyping(p.userId), TYPING_TTL_MS);
      },
    }).then((fn) => { if (dead) fn(); else off = fn; });

    // Ask for the current list. The room channel may still be joining, so retry once or twice.
    const ask = (tries = 0) => {
      getSocket().then((s) => {
        if (dead || !s) return;
        if (!s.connected) { retry = setTimeout(() => ask(tries + 1), 1000); return; }
        s.emit("presence:get", { roomId }, (res) => {
          if (dead) return;
          if (res?.ok) setOnline(new Set(res.online || []));
          else if (tries < 4) retry = setTimeout(() => ask(tries + 1), 800);
        });
      });
    };
    ask();

    return () => {
      dead = true;
      off();
      clearTimeout(retry);
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
      setTypingMap({});
    };
  }, [roomId, selfId]);

  // Tell the room we started/stopped typing (throttled so a keystroke doesn't mean a message).
  const setTyping = useCallback((isTyping) => {
    const now = Date.now();
    const last = lastSent.current;
    if (isTyping && last.typing && now - last.at < 2500) return;
    if (!isTyping && !last.typing) return;
    lastSent.current = { typing: isTyping, at: now };
    getSocket().then((s) => { if (s?.connected) s.emit("typing", { roomId, typing: isTyping }); });
  }, [roomId]);

  return { online, typing: Object.values(typing), setTyping };
}
