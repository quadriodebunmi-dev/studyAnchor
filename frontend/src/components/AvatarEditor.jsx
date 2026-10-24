import React, { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCw, ZoomIn } from "lucide-react";
import Modal from "./Modal.jsx";
import Button from "./Button.jsx";
import UploadProgress from "./UploadProgress.jsx";
import { useToast } from "./Toast.jsx";
import { decodeImage } from "../utils/image.js";
import { clampState, drawAvatar, MAX_ZOOM, MIN_ZOOM } from "../utils/avatarCrop.js";
import { uploadAvatar } from "../services/authService.js";

const VIEW = 280;     // on-screen size of the crop square
const OUT = 512;      // size of the picture that is actually uploaded
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const fmt = (b) => (b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const toBlob = (canvas, q) => new Promise((res) => canvas.toBlob(res, "image/jpeg", q));

/**
 * Pick a photo, drag / zoom / rotate it inside a round frame, and save.
 * Only the EDITED result (a 512×512 JPEG, typically under 150 KB) is sent to the server —
 * the original photo never leaves the device.
 *
 * onSaved(updatedUser) — upload finished.   onClose() — cancelled.
 */
export default function AvatarEditor({ onSaved, onClose }) {
  const toast = useToast();
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const [src, setSrc] = useState(null); // { bitmap, name, bytes }
  const srcRef = useRef(null);
  srcRef.current = src;
  const [view, setView] = useState({ zoom: 1, ox: 0, oy: 0, rot: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [sending, setSending] = useState(null); // { edited, original }

  async function choose(file) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a photo (JPG, PNG or WebP).");
    if (file.size > MAX_INPUT_BYTES) return setError("That photo is too large. Choose one under 25 MB.");
    try {
      const bitmap = await decodeImage(file);
      setSrc((old) => { old?.bitmap.close?.(); return { bitmap, name: file.name, bytes: file.size }; });
      setView({ zoom: 1, ox: 0, oy: 0, rot: 0 });
    } catch {
      setError("We couldn't read that photo. Try a JPG or PNG.");
    }
  }

  useEffect(() => () => srcRef.current?.bitmap.close?.(), []);

  // Repaint the preview whenever the crop changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!src || !canvas) return;
    const px = Math.round(VIEW * (window.devicePixelRatio || 1));
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
    drawAvatar(canvas.getContext("2d"), src.bitmap, px, view);
  }, [src, view]);

  const change = useCallback((patch) => {
    setView((v) => (src ? clampState(src.bitmap.width, src.bitmap.height, { ...v, ...patch }) : v));
  }, [src]);

  // Scroll-wheel zoom (needs a non-passive listener to stop the page scrolling).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const onWheel = (e) => { e.preventDefault(); setView((v) => (src ? clampState(src.bitmap.width, src.bitmap.height, { ...v, zoom: v.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) }) : v)); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [src]);

  const onPointerDown = (e) => { dragRef.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onPointerMove = (e) => {
    const d = dragRef.current; if (!d) return;
    const dx = (e.clientX - d.x) / VIEW, dy = (e.clientY - d.y) / VIEW;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setView((v) => (src ? clampState(src.bitmap.width, src.bitmap.height, { ...v, ox: v.ox + dx, oy: v.oy + dy }) : v));
  };
  const onPointerUp = () => { dragRef.current = null; };
  const onKeyDown = (e) => {
    const step = 0.03;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (move) { e.preventDefault(); change({ ox: view.ox + move[0], oy: view.oy + move[1] }); }
  };

  async function save() {
    if (!src || busy) return;
    setBusy(true); setError(""); setPercent(0);
    try {
      // Render ONLY the framed square at the output size → this small JPEG is all that is uploaded.
      const out = document.createElement("canvas");
      out.width = OUT; out.height = OUT;
      drawAvatar(out.getContext("2d"), src.bitmap, OUT, view);
      let blob = await toBlob(out, 0.88);
      for (let q = 0.75; blob && blob.size > 400 * 1024 && q > 0.4; q -= 0.15) blob = await toBlob(out, q);
      if (!blob) throw new Error("We couldn't prepare that picture. Please try another photo.");
      setSending({ edited: blob.size, original: src.bytes });

      const file = new File([blob], "avatar.jpg", { type: "image/jpeg", lastModified: Date.now() });
      const updated = await uploadAvatar(file, setPercent);
      toast("Profile picture updated", "success");
      onSaved(updated);
    } catch (err) {
      setError(err.message || "Couldn't save your picture.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Profile picture" onClose={busy ? undefined : onClose}>
      {!src ? (
        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 hover:border-accent dark:border-slate-700 dark:text-slate-400">
            <ImagePlus className="h-7 w-7" />
            <span className="font-medium text-night dark:text-slate-100">Choose a photo</span>
            <span className="text-xs">JPG, PNG or WebP. You'll crop it next.</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="mx-auto overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800" style={{ width: VIEW, height: VIEW, position: "relative", touchAction: "none" }}>
            <canvas
              ref={canvasRef} tabIndex={0} aria-label="Photo editor. Drag, or use the arrow keys, to move the photo."
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}
              style={{ width: VIEW, height: VIEW, cursor: "grab", display: "block" }}
            />
            {/* round frame: everything outside the circle is dimmed */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 999px rgba(15,23,42,.55)", border: "2px solid rgba(255,255,255,.9)" }} />
          </div>

          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
            <input
              type="range" min={MIN_ZOOM} max={MAX_ZOOM} step="0.01" value={view.zoom} disabled={busy}
              onChange={(e) => change({ zoom: Number(e.target.value) })} aria-label="Zoom" className="w-full accent-accent"
            />
            <button type="button" onClick={() => change({ rot: (view.rot + 1) % 4 })} disabled={busy} aria-label="Rotate 90 degrees" className="rounded-full border border-slate-300 p-2 hover:border-accent disabled:opacity-50 dark:border-slate-700">
              <RotateCw className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs lv-meta">
            {sending
              ? `Sending the edited ${OUT}×${OUT} picture (${fmt(sending.edited)}) — not your original (${fmt(sending.original)}).`
              : "Only the cropped picture is uploaded. Your original photo stays on your device."}
          </p>

          {busy && <UploadProgress percent={percent} label="Saving your picture" />}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <div className="flex justify-between gap-2">
            <label className={`inline-flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 ${busy ? "pointer-events-none opacity-50" : ""}`}>
              Choose another
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button type="button" onClick={save} disabled={busy}>{busy ? `Saving… ${percent}%` : "Save picture"}</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
