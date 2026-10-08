import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bot, Send, Trash2, X, Copy, Check, RotateCw, FileText } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import ChatMarkdown from "../../components/ChatMarkdown.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { sendChatMessage } from "../../services/assistantService.js";
import { getMaterial } from "../../services/materialService.js";

const MAX_INPUT = 2000;
const MAX_STORED = 40;

const GENERAL_PROMPTS = [
  "Explain a concept I'm stuck on",
  "Help me make a revision timetable",
  "Give me tips for answering theory questions",
  "Quiz me on a topic I name",
];
const MATERIAL_PROMPTS = [
  "Summarise this material in simple terms",
  "List the key terms and their meanings",
  "What are the most likely exam questions from this?",
  "Quiz me on this material",
];

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard unavailable */ } }}
      className="mt-2 inline-flex items-center gap-1 text-xs lv-meta hover:text-primary"
      aria-label="Copy answer"
    >
      {done ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />} {done ? "Copied" : "Copy"}
    </button>
  );
}

export default function AssistantPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const materialId = params.get("material");

  // Conversations are kept on this device only (never stored server-side),
  // one per context: general chat, or per material.
  const storeKey = `lv-assistant:${user._id}:${materialId || "general"}`;
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storeKey)) || []; } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [material, setMaterial] = useState(null);
  const bottomRef = useRef(null);

  // Switching between general chat and a material: load that thread.
  useEffect(() => {
    try { setMessages(JSON.parse(localStorage.getItem(storeKey)) || []); } catch { setMessages([]); }
    setError("");
  }, [storeKey]);

  useEffect(() => {
    try { localStorage.setItem(storeKey, JSON.stringify(messages.slice(-MAX_STORED))); } catch { /* storage full/blocked */ }
  }, [messages, storeKey]);

  useEffect(() => {
    setMaterial(null);
    if (!materialId) return;
    getMaterial(materialId).then(setMaterial).catch(() => {
      showToast("Couldn't open that material for the assistant.", "error");
      navigate("/assistant", { replace: true });
    });
  }, [materialId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  async function run(history) {
    setLoading(true); setError("");
    try {
      const reply = await sendChatMessage(history, materialId || undefined);
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err.message || "The assistant couldn't respond. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function send(text) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    run(history);
  }

  function clearChat() {
    if (messages.length && !window.confirm("Start a new conversation? This clears the current one.")) return;
    setMessages([]); setError("");
  }

  const prompts = useMemo(() => (materialId ? MATERIAL_PROMPTS : GENERAL_PROMPTS), [materialId]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="h-6 w-6 text-primary" /> AI Assistant</h1>
          <p className="mt-1 text-sm lv-meta">Ask questions about your courses, get concepts explained, or plan your revision.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} disabled={!messages.length && !error}>
          <Trash2 className="h-4 w-4" /> New chat
        </Button>
      </div>

      {materialId && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Chatting about: <strong>{material?.title || "loading…"}</strong></span>
          </span>
          <button onClick={() => navigate("/assistant")} aria-label="Stop using this material" className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="lv-card mt-4 flex h-[calc(100dvh-17rem)] min-h-[22rem] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && !loading && (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-md">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/20 text-primary"><Bot className="h-6 w-6" /></span>
                <p className="mt-3 font-display font-semibold">How can I help you study?</p>
                <p className="mt-1 text-sm lv-meta">AI answers can be wrong — double-check anything important against your lecture notes.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {prompts.map((p) => (
                    <button key={p} onClick={() => send(p)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs hover:border-accent hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-primary text-primary-fg" : "border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"}`}>
                {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : (<><ChatMarkdown text={m.content} /><CopyBtn text={m.content} /></>)}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60" role="status" aria-label="Assistant is typing">
                {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-pulse rounded-full bg-slate-400" style={{ animationDelay: `${d * 150}ms` }} />)}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              <span>{error}</span>
              <button onClick={() => run(messages)} className="inline-flex shrink-0 items-center gap-1 font-medium hover:underline"><RotateCw className="h-3.5 w-3.5" /> Retry</button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            maxLength={MAX_INPUT}
            rows={1}
            placeholder={materialId ? "Ask about this material…" : "Ask anything about your studies…"}
            aria-label="Message the AI assistant"
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-night outline-none focus:border-accent focus:ring-2 focus:ring-accent/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <Button type="submit" variant="accent" disabled={loading || !input.trim()} aria-label="Send message"><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </AppShell>
  );
}
