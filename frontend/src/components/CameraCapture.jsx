import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { captureFromVideo } from "../utils/image.js";

export const cameraSupported = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && (window.isSecureContext ?? true);

/**
 * Full-screen in-app camera. Using getUserMedia keeps the page alive (opening
 * the phone's camera app can make Android browsers reload the page and lose
 * your place) and works on desktop webcams too.
 *
 * onCapture(file)  — a JPEG File
 * onClose()        — user cancelled
 * onUnavailable(err) — camera denied/missing; caller should fall back to a file picker
 */
export default function CameraCapture({ onCapture, onClose, onUnavailable }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState("environment");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canFlip, setCanFlip] = useState(false);

  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };

  const start = useCallback(async (mode) => {
    stop(); setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return stop();
      v.srcObject = stream;
      await v.play().catch(() => {});
      setReady(true);
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
    } catch (err) {
      stop();
      onUnavailable?.(err);
    }
  }, [onUnavailable]);

  useEffect(() => { start(facing); return stop; }, [facing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function shoot() {
    if (busy || !ready) return;
    setBusy(true);
    try {
      const file = await captureFromVideo(videoRef.current);
      stop();
      onCapture(file);
    } catch (err) {
      onUnavailable?.(err);
    } finally { setBusy(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Camera" className="fixed inset-0 z-[70] flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white lv-safe-top">
        <button onClick={onClose} aria-label="Close camera" className="rounded-full bg-white/10 p-2.5 hover:bg-white/20"><X className="h-5 w-5" /></button>
        <p className="text-sm">Fill the frame with just the question</p>
        {canFlip ? (
          <button onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} aria-label="Switch camera" className="rounded-full bg-white/10 p-2.5 hover:bg-white/20"><RefreshCw className="h-5 w-5" /></button>
        ) : <span className="w-10" />}
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-contain" />
        {!ready && <p className="absolute inset-0 grid place-items-center text-sm text-white/80">Starting camera…</p>}
      </div>
      <div className="grid place-items-center p-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <button onClick={shoot} disabled={!ready || busy} aria-label="Take photo" className="grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40">
          <Camera className="h-6 w-6 text-white" />
        </button>
      </div>
    </div>
  );
}
