import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, MessageCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { APP_CONFIG } from "../config/appConfig.js";

// Floating WhatsApp button, mounted once in App.jsx so it shows on every page.
//  - Drag it anywhere on screen (mouse or touch); it remembers where you left it.
//  - Tap the small x to hide it. It folds into a little tab on the screen edge that
//    brings it back, and it is ALWAYS shown again when someone logs in.
// It opens the Study Anchor WhatsApp group. If no group link has been configured yet
// (see whatsappGroupUrl in config/appConfig.js) it opens a chat with support instead,
// asking to be added to the group.
const FALLBACK_TEXT = "Hi! i want to ask a question about study anchor";
const POS_KEY = "sa-wa-pos";
const HIDE_KEY = "sa-wa-hidden";
const SIZE = 48;      // button size in px (h-12 w-12)
const MARGIN = 8;     // keep this far from the screen edges
const DRAG_PX = 6;    // moving less than this is a tap, not a drag

function groupHref() {
  if (APP_CONFIG.whatsappGroupUrl) return APP_CONFIG.whatsappGroupUrl;
  if (APP_CONFIG.supportWhatsapp) return `https://wa.me/${APP_CONFIG.supportWhatsapp}?text=${encodeURIComponent(FALLBACK_TEXT)}`;
  return "";
}

const clamp = (p) => ({
  x: Math.min(Math.max(p.x, MARGIN), Math.max(MARGIN, window.innerWidth - SIZE - MARGIN)),
  y: Math.min(Math.max(p.y, MARGIN), Math.max(MARGIN, window.innerHeight - SIZE - MARGIN)),
});

function readPos() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY));
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  } catch { return null; }
}
const readHidden = () => { try { return sessionStorage.getItem(HIDE_KEY) === "1"; } catch { return false; } };

export default function WhatsAppButton() {
  const { user, loading } = useAuth();
  const href = groupHref();
  const [pos, setPos] = useState(() => { const p = readPos(); return p ? clamp(p) : null; }); // null = default corner
  const [hidden, setHidden] = useState(readHidden);
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef(null);
  const drag = useRef(null);
  const posRef = useRef(pos);
  const justDragged = useRef(false);

  const setHiddenSaved = useCallback((value) => {
    setHidden(value);
    try { if (value) sessionStorage.setItem(HIDE_KEY, "1"); else sessionStorage.removeItem(HIDE_KEY); } catch { /* ignore */ }
  }, []);

  // Logging in (or out) always brings the button back. Restoring an existing session on
  // page load is not a login, so a hidden button stays hidden across a refresh.
  const prev = useRef({ user, loading });
  useEffect(() => {
    const was = prev.current;
    const loggedIn = !was.user && user && !was.loading;
    const loggedOut = was.user && !user;
    const switchedUser = was.user && user && was.user._id !== user._id;
    if (loggedIn || loggedOut || switchedUser) setHiddenSaved(false);
    prev.current = { user, loading };
  }, [user, loading, setHiddenSaved]);

  // Keep it on screen when the window is resized or the phone is rotated.
  useEffect(() => {
    const onResize = () => setPos((p) => { if (!p) return p; const c = clamp(p); posRef.current = c; return c; });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("[data-wa-hide]")) return; // the x is a plain button
    const rect = boxRef.current.getBoundingClientRect();
    drag.current = { startX: e.clientX, startY: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, moved: false };
    justDragged.current = false;
    boxRef.current.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_PX) return;
    d.moved = true;
    setDragging(true);
    const next = clamp({ x: e.clientX - d.offX, y: e.clientY - d.offY });
    posRef.current = next;
    setPos(next);
  }

  function endDrag(e) {
    const d = drag.current;
    drag.current = null;
    boxRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d?.moved) return;
    justDragged.current = true; // swallow the click that follows a drag so it doesn't open WhatsApp
    setDragging(false);
    try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch { /* ignore */ }
  }

  function onClick(e) {
    if (justDragged.current) { e.preventDefault(); justDragged.current = false; }
  }

  if (!href) return null;

  // Where it sits: wherever it was dragged, otherwise just above the mobile tab bar
  // (and in the corner on desktop where there is no tab bar).
  const placed = pos ? { left: pos.x, top: pos.y } : undefined;
  const defaultSpot = pos ? "" : "right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6";

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHiddenSaved(false)}
        aria-label="Show the WhatsApp button"
        title="Show the WhatsApp button"
        style={pos ? { top: pos.y + SIZE / 2 - 18 } : undefined}
        className={`fixed right-0 z-40 grid h-9 w-7 place-items-center rounded-l-lg bg-[#25D366] text-white shadow-lift opacity-80 hover:opacity-100 ${pos ? "" : "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-[1.75rem]"}`}
      >
        <MessageCircle className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div ref={boxRef} style={{ ...placed, touchAction: "none" }} className={`fixed z-40 select-none ${defaultSpot}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        onClick={onClick}
        aria-label="Join the Study Anchor WhatsApp group (drag to move)"
        title="Join the Study Anchor WhatsApp group. Drag to move."
        className={`group relative block ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        {!dragging && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30 motion-reduce:hidden" />}
        <span className={`relative grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lift transition-transform ${dragging ? "scale-110" : "group-hover:scale-105"}`}>
          <svg viewBox="0 0 32 32" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M16.04 3C9.4 3 4 8.38 4 15.01c0 2.12.55 4.19 1.6 6.01L4 29l8.14-1.56a12.03 12.03 0 0 0 3.9.65h.01C22.68 28.09 28 22.7 28 16.07 28 9.4 22.68 3 16.04 3zm0 22.02h-.01c-1.2 0-2.38-.32-3.4-.93l-.24-.15-4.83.93.96-4.7-.16-.25a9.97 9.97 0 0 1-1.53-5.3c0-5.5 4.5-9.97 10.02-9.97 5.5 0 9.98 4.46 9.98 9.98 0 5.5-4.48 10.39-10.79 10.39zm5.48-7.47c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.68-1.64-.93-2.25-.25-.58-.5-.5-.68-.51h-.58c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.12-.28-.2-.58-.35z" />
          </svg>
        </span>
      </a>
      <button
        type="button"
        data-wa-hide
        onClick={() => setHiddenSaved(true)}
        aria-label="Hide the WhatsApp button"
        title="Hide"
        className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-night text-white shadow ring-2 ring-white dark:ring-slate-900"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}