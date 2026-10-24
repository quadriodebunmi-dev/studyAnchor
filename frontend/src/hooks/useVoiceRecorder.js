import { useCallback, useEffect, useRef, useState } from "react";

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const pickType = () => (typeof MediaRecorder === "undefined" ? "" : TYPES.find((t) => MediaRecorder.isTypeSupported?.(t)) || "");
const extFor = (mime) => (mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm");

export const voiceSupported = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/**
 * Records a voice note with the microphone.
 * Low bitrate + a hard time cap keep clips small enough to upload everywhere.
 */
export default function useVoiceRecorder({ maxSeconds = 120, onDone, onError } = {}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startedRef = useRef(0);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null; recRef.current = null; chunksRef.current = [];
    setRecording(false); setSeconds(0);
  }, []);

  const start = useCallback(async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = pickType();
      const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      recRef.current = rec; chunksRef.current = []; cancelledRef.current = false;
      rec.ondataavailable = (e) => e.data?.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const type = rec.mimeType || mimeType || "audio/webm";
        const duration = (Date.now() - startedRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type });
        const skip = cancelledRef.current;
        cleanup();
        if (skip || blob.size === 0) return;
        onDone?.(new File([blob], `voice-${Date.now()}.${extFor(type)}`, { type }), duration);
      };
      rec.start(1000);
      startedRef.current = Date.now();
      setRecording(true); setSeconds(0);
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedRef.current) / 1000);
        setSeconds(s);
        if (s >= maxSeconds) rec.state === "recording" && rec.stop();
      }, 250);
    } catch (err) {
      cleanup();
      onError?.(err?.name === "NotAllowedError" ? "Microphone access is blocked. Allow it in your browser settings." : "Couldn't start the microphone.");
    }
  }, [recording, maxSeconds, onDone, onError, cleanup]);

  const stop = useCallback(() => { if (recRef.current?.state === "recording") recRef.current.stop(); }, []);
  const cancel = useCallback(() => { cancelledRef.current = true; if (recRef.current?.state === "recording") recRef.current.stop(); else cleanup(); }, [cleanup]);

  useEffect(() => () => { cancelledRef.current = true; if (recRef.current?.state === "recording") recRef.current.stop(); streamRef.current?.getTracks().forEach((t) => t.stop()); clearInterval(timerRef.current); }, []);

  return { recording, seconds, start, stop, cancel };
}
