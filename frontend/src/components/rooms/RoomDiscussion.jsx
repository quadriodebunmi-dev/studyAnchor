import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Flag, Reply, Send, Trash2, Pencil, ImagePlus, Mic, Square, X, Paperclip, ChevronDown, Maximize2, Minimize2, Download } from "lucide-react";
import Button from "../Button.jsx";
import { Textarea } from "../FormFields.jsx";
import Modal from "../Modal.jsx";
import { InlineLoader } from "../Loader.jsx";
import { useToast } from "../Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { createPost, editPost, listPosts, listReplies, removePost, reportPost } from "../../services/roomService.js";
import { subscribe, isSocketConnected } from "../../services/realtime.js";
import { prepareImage } from "../../utils/image.js";
import useVoiceRecorder, { voiceSupported } from "../../hooks/useVoiceRecorder.js";
import useRoomPresence from "../../hooks/useRoomPresence.js";
import AvatarModal from "./AvatarModal.jsx";

const clock = (d) => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayKey = (d) => new Date(d).toDateString();
const dayLabel = (d) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { dateStyle: "medium" });
};
const authorKey = (p) => p.author?._id || p.author?.id || p.author?.name;
const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

const MAX_ATTACH_BYTES = 4 * 1024 * 1024; // keep in step with PLATFORM.rooms.attachmentMaxBytes on the server
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const previewText = (p) => p.content || (p.attachment?.kind === "audio" ? "Voice message" : p.attachment?.kind === "image" ? "Photo" : "");

// Profile picture (User.avatarUrl) with an initials fallback when there's none or it fails to load.
// A green dot marks people who are online in the room right now.
function Avatar({ name, url, online }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const showImg = url && /^https?:\/\//.test(url) && !failed;
  return (
    <span className="relative inline-block h-6 w-6">
      {showImg ? (
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-6 w-6 rounded-full bg-slate-200 object-cover dark:bg-slate-700" />
      ) : (
        <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-[9.5px] font-semibold text-primary">{initials(name)}</span>
      )}
      {online && <span title="Online" className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-slate-100 dark:ring-slate-950" />}
    </span>
  );
}

function Attachment({ a, onImage }) {
  if (!a?.url || !/^https?:\/\//.test(a.url)) return null;
  if (a.kind === "image") {
    return (
      <button type="button" onClick={() => onImage(a.url)} aria-label="View photo" className="mt-1 block cursor-zoom-in">
        <img src={a.url} alt="Photo shared in the room" loading="lazy" width={a.width || undefined} height={a.height || undefined} className="max-h-48 max-w-full rounded-lg object-contain" />
      </button>
    );
  }
  return <audio controls preload="metadata" src={a.url} className="mt-1 h-8 w-48 max-w-full sm:w-56" aria-label="Voice message" />;
}

// Full-screen photo viewer. Click the dark area, the X, or press Esc to close; the download button saves the photo.
function ImageLightbox({ src, onClose, toast }) {
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.stopPropagation();
    setSaving(true);
    try {
      // Fetch as a blob so the browser really downloads it (a plain <a download> is ignored for images on another domain).
      const res = await fetch(src);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "jpg").split("+")[0].replace("jpeg", "jpg");
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `study-anchor-photo-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      // Fallback if the image host blocks cross-site fetches.
      window.open(src, "_blank", "noopener");
      toast?.("Couldn't save it directly. The photo opened in a new tab: press and hold (or right-click) it to save.", "info");
    } finally { setSaving(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3">
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <button type="button" onClick={save} disabled={saving} aria-label="Save photo to device" title="Save to device" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-50">
          <Download className="h-[18px] w-[18px]" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close photo" title="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">
          <X className="h-5 w-5" />
        </button>
      </div>
      <img src={src} alt="Photo shared in the room" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain" />
    </div>
  );
}

// Defined at module level (not inside RoomDiscussion): a component created during render
// would remount on every keystroke and cut off a playing voice message.
function Msg({ p, nested, first, me, online, onAvatar, canModerate, onReply, onEdit, onRemove, onReport, onImage }) {
  const [menu, setMenu] = useState(false);
  const mine = !!p.mine;
  const showName = !mine && (first || nested);
  const act = (fn) => () => { setMenu(false); fn(p); };
  const name = p.author?.name || (mine ? me?.name : "") || "";
  const avatarUrl = p.author?.avatarUrl || (mine ? me?.avatarUrl : "") || "";
  const authorId = p.author?._id || (mine ? me?._id : "");
  const isOnline = mine ? true : Boolean(authorId && online?.has(authorId));

  return (
    <div className={`flex items-start gap-1.5 ${mine ? "flex-row-reverse" : ""} ${first ? "mt-2" : "mt-0.5"}`}>
      <div className="w-6 shrink-0">{first && (
        <button type="button" onClick={() => onAvatar?.({ name, avatarUrl, online: isOnline })} aria-label={`View ${name || "member"}'s profile picture`} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <Avatar name={name} url={avatarUrl} online={isOnline} />
        </button>
      )}</div>
      <div
        className={`relative max-w-[78%] rounded-2xl px-2.5 py-1 shadow-sm sm:max-w-[68%] ${
          mine ? "bg-primary/15 dark:bg-primary/30" : "bg-white dark:bg-slate-800"
        } ${first && !nested ? (mine ? "rounded-tr-md" : "rounded-tl-md") : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          {showName ? <span className="text-[11px] font-semibold text-primary">{name}</span> : <span />}
          {!p.removed && (
            <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Message options" aria-expanded={menu} className="-mr-1 -mt-0.5 shrink-0 rounded-full p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>

        {p.removed ? (
          <p className="text-xs italic lv-meta">This message was removed.</p>
        ) : (
          <>
            {p.content && <p className="whitespace-pre-wrap break-words text-xs leading-snug">{p.content}</p>}
            <Attachment a={p.attachment} onImage={onImage} />
          </>
        )}

        <p className="mt-0.5 text-right text-[9.5px] lv-meta">{clock(p.createdAt)}{p.editedAt && " · edited"}</p>

        {menu && !p.removed && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200/70 pt-1 text-[10.5px] lv-meta dark:border-slate-700">
            {!nested && <button onClick={act(onReply)} className="inline-flex items-center gap-1 hover:text-night dark:hover:text-white"><Reply className="h-3 w-3" />Reply</button>}
            {mine && <button onClick={act(onEdit)} className="inline-flex items-center gap-1 hover:text-night dark:hover:text-white"><Pencil className="h-3 w-3" />{p.attachment ? "Edit caption" : "Edit"}</button>}
            {(mine || canModerate) && <button onClick={act(onRemove)} className="inline-flex items-center gap-1 hover:text-danger"><Trash2 className="h-3 w-3" />Delete</button>}
            {!mine && <button onClick={act(onReport)} className="inline-flex items-center gap-1 hover:text-danger"><Flag className="h-3 w-3" />Report</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoomDiscussion({ room }) {
  const { user } = useAuth();
  const toast = useToast();
  const canModerate = ["owner", "moderator"].includes(room.myRole);
  const [posts, setPosts] = useState(null); // newest first (as the API returns); shown oldest -> newest
  const [more, setMore] = useState({ hasMore: false, next: null });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [reporting, setReporting] = useState(null);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(null);
  const [replies, setReplies] = useState({}); // postId -> array | undefined
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState(null); // image url being viewed
  const [avatarView, setAvatarView] = useState(null); // { name, avatarUrl, online } of the member whose picture is open
  const scrollRef = useRef(null);
  const stickRef = useRef(true); // keep the view pinned to the newest message unless the reader scrolled up
  const keepHeightRef = useRef(null); // set while loading older messages so the view doesn't jump
  const taRef = useRef(null);
  const imgRef = useRef(null);
  const audioRef = useRef(null);
  const [attachment, setAttachment] = useState(null); // { file, kind: "image"|"audio", url, duration? }
  const [preparing, setPreparing] = useState(false);
  const { online, typing, setTyping } = useRoomPresence(room._id, user?._id);
  const typingTimer = useRef(null);
  const onlineCount = online.size;

  const load = useCallback(async () => {
    const r = await listPosts(room._id, { limit: 20 });
    setPosts(r.posts);
    setMore({ hasMore: r.hasMore, next: r.nextBefore });
  }, [room._id]);

  useEffect(() => { load().catch(() => setPosts([])); }, [load]);

  // Live updates over Socket.IO; without sockets, poll gently while the tab is visible.
  useEffect(() => {
    let off = () => {};
    subscribe({
      "post:new": ({ post }) => {
        if (post.room !== room._id) return;
        if (post.parent) {
          setReplies((m) => (m[post.parent] ? { ...m, [post.parent]: [...m[post.parent], post] } : m));
          setPosts((ps) => ps?.map((p) => (p._id === post.parent ? { ...p, replyCount: p.replyCount + 1 } : p)));
        } else setPosts((ps) => (ps && !ps.some((p) => p._id === post._id) ? [post, ...ps] : ps));
      },
      "post:removed": ({ postId, parent }) => {
        if (parent) setReplies((m) => (m[parent] ? { ...m, [parent]: m[parent].map((r) => (r._id === postId ? { ...r, removed: true, content: "" } : r)) } : m));
        setPosts((ps) => ps?.map((p) => (p._id === postId ? { ...p, removed: true, content: "" } : p)));
      },
      "post:edited": ({ post }) => setPosts((ps) => ps?.map((p) => (p._id === post._id ? { ...p, ...post, mine: p.mine } : p))),
    }).then((fn) => { off = fn; });
    const id = setInterval(() => { if (!document.hidden && !isSocketConnected()) load().catch(() => {}); }, 20000);
    return () => { off(); clearInterval(id); };
  }, [room._id, load]);

  useEffect(() => () => { if (attachment?.url) URL.revokeObjectURL(attachment.url); }, [attachment]);

  // Esc closes the photo viewer first, then leaves expanded mode.
  useEffect(() => {
    if (!expanded && !lightbox) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (lightbox) setLightbox(null);
      else setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, lightbox]);

  // Stop the page behind from scrolling while the chat is full screen.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [expanded]);

  // Typing signal: on while there's text, off after a short pause, on send/blur, or when leaving.
  function handleTextChange(value) {
    setText(value);
    clearTimeout(typingTimer.current);
    if (!value.trim()) return setTyping(false);
    setTyping(true);
    typingTimer.current = setTimeout(() => setTyping(false), 3000);
  }
  useEffect(() => () => { clearTimeout(typingTimer.current); setTyping(false); }, [setTyping]);

  // Oldest at the top, newest at the bottom, like a normal chat.
  const ordered = useMemo(() => (posts ? [...posts].reverse() : []), [posts]);

  function onScroll() {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || posts === null) return;
    if (keepHeightRef.current != null) {
      el.scrollTop = el.scrollHeight - keepHeightRef.current;
      keepHeightRef.current = null;
      return;
    }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [posts, replies, expanded]);

  // Grow the message box with its text (up to a few lines).
  useEffect(() => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 104)}px`;
  }, [text]);

  const voice = useVoiceRecorder({
    maxSeconds: 120,
    onDone: (file, duration) => setAttachment({ file, kind: "audio", url: URL.createObjectURL(file), duration }),
    onError: (msg) => toast(msg, "error"),
  });

  async function pickImage(e) {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;
    setPreparing(true);
    try {
      const file = await prepareImage(raw, { maxDim: 1600, maxBytes: MAX_ATTACH_BYTES });
      setAttachment({ file, kind: "image", url: URL.createObjectURL(file) });
    } catch (err) { toast(err.message || "Couldn't use that photo.", "error"); } finally { setPreparing(false); }
  }

  function pickAudio(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_ATTACH_BYTES) return toast("That sound file is too large (max 4 MB).", "error");
    setAttachment({ file, kind: "audio", url: URL.createObjectURL(file) });
  }

  async function send(e) {
    e.preventDefault();
    if ((!text.trim() && !attachment) || sending || voice.recording) return;
    setSending(true);
    clearTimeout(typingTimer.current);
    setTyping(false);
    try {
      const post = await createPost(room._id, text, replyTo?._id, attachment?.file, attachment?.duration);
      stickRef.current = true; // jump to your own message
      setText(""); setAttachment(null);
      if (replyTo) {
        setReplies((m) => (m[replyTo._id] ? { ...m, [replyTo._id]: [...m[replyTo._id], post] } : m));
        setPosts((ps) => ps.map((p) => (p._id === replyTo._id ? { ...p, replyCount: p.replyCount + 1 } : p)));
        setReplyTo(null);
      } else setPosts((ps) => [post, ...ps.filter((p) => p._id !== post._id)]);
    } catch (err) { toast(err.message || "Couldn't send.", "error"); } finally { setSending(false); }
  }

  // Enter sends and Shift+Enter adds a new line on desktop; on touch screens Enter stays a new line.
  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia?.("(pointer: fine)").matches) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  async function loadOlder() {
    const el = scrollRef.current;
    const r = await listPosts(room._id, { before: more.next, limit: 20 }).catch(() => null);
    if (!r) return toast("Couldn't load older messages.", "error");
    if (el) keepHeightRef.current = el.scrollHeight;
    setPosts((ps) => [...ps, ...r.posts]);
    setMore({ hasMore: r.hasMore, next: r.nextBefore });
  }

  async function toggleReplies(p) {
    if (replies[p._id]) return setReplies((m) => { const { [p._id]: _, ...rest } = m; return rest; });
    const r = await listReplies(room._id, p._id).catch(() => ({ replies: [] }));
    setReplies((m) => ({ ...m, [p._id]: r.replies }));
  }

  async function remove(p) {
    if (!window.confirm("Remove this message?")) return;
    try { await removePost(room._id, p._id); setPosts((ps) => ps.map((x) => (x._id === p._id ? { ...x, removed: true, content: "" } : x))); setReplies((m) => (m[p.parent] ? { ...m, [p.parent]: m[p.parent].map((x) => (x._id === p._id ? { ...x, removed: true, content: "" } : x)) } : m)); }
    catch (err) { toast(err.message || "Couldn't remove.", "error"); }
  }

  async function saveEdit() {
    try {
      const p = await editPost(room._id, editing._id, editing.content);
      const patch = (x) => (x._id === p._id ? { ...x, content: p.content, editedAt: p.editedAt } : x);
      setPosts((ps) => ps.map(patch));
      setReplies((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.map(patch)])));
      setEditing(null);
    } catch (err) { toast(err.message || "Couldn't save.", "error"); }
  }

  async function submitReport() {
    try { await reportPost(room._id, reporting._id, reason); toast("Thanks — a moderator will take a look.", "success"); setReporting(null); setReason(""); }
    catch (err) { toast(err.message || "Couldn't report.", "error"); }
  }

  const msgProps = { me: user, online, onAvatar: setAvatarView, canModerate, onReply: setReplyTo, onEdit: (p) => setEditing({ _id: p._id, content: p.content }), onRemove: remove, onReport: setReporting, onImage: setLightbox };
  const iconBtn = "grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800";
  const canSend = !(sending || preparing || voice.recording || (!text.trim() && !attachment));

  // Normal: a fixed-height card in the page. Expanded: the chat takes over the whole screen.
  const shell = expanded
    ? "fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900"
    : "flex h-[calc(100dvh-11rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800";

  return (
    <div>
      {/* Height is a starting point: tweak the 11rem to match your AppShell header/padding. */}
      <div className={shell}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight">{room.name}</p>
            <p className="flex items-center gap-1.5 text-[10.5px] lv-meta">
              {typeof room.memberCount === "number" && <span>{room.memberCount} member{room.memberCount === 1 ? "" : "s"}</span>}
              {onlineCount > 0 && (
                <span className="inline-flex items-center gap-1" aria-live="polite">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  {onlineCount} online
                </span>
              )}
            </p>
          </div>
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Collapse discussion" : "Expand discussion"} title={expanded ? "Collapse" : "Expand"} className={iconBtn}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto bg-slate-100 px-2.5 pb-3 pt-2 dark:bg-slate-950">
          <div className={expanded ? "mx-auto w-full max-w-3xl" : ""}>
            {more.hasMore && (
              <div className="py-2 text-center">
                <Button variant="outline" size="sm" className="!px-3 !py-1 !text-xs" onClick={loadOlder}>Load older messages</Button>
              </div>
            )}

            {posts === null ? <InlineLoader /> : ordered.length === 0 ? (
              <p className="mx-auto mt-10 max-w-xs rounded-xl bg-white/70 px-4 py-3 text-center text-xs lv-meta dark:bg-slate-900/70">No messages yet. Start the conversation!</p>
            ) : ordered.map((p, i) => {
              const prev = ordered[i - 1];
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(p.createdAt);
              const first = newDay || authorKey(prev) !== authorKey(p) || prev.removed || prev.replyCount > 0;
              return (
                <div key={p._id}>
                  {newDay && (
                    <div className="my-2 flex justify-center">
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-medium shadow-sm lv-meta dark:bg-slate-800">{dayLabel(p.createdAt)}</span>
                    </div>
                  )}
                  <Msg p={p} first={first} {...msgProps} />
                  {p.replyCount > 0 && (
                    <div className={`mt-0.5 flex ${p.mine ? "justify-end pr-8" : "justify-start pl-8"}`}>
                      <button onClick={() => toggleReplies(p)} className="text-[10.5px] font-medium text-primary hover:underline">
                        {replies[p._id] ? "Hide replies" : `View ${p.replyCount} repl${p.replyCount === 1 ? "y" : "ies"}`}
                      </button>
                    </div>
                  )}
                  {replies[p._id] && (
                    <div className="ml-8 mt-0.5 border-l-2 border-slate-300 pl-1.5 dark:border-slate-700">
                      {replies[p._id].map((r) => <Msg key={r._id} p={r} nested first {...msgProps} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Typing indicator (fixed height so the chat doesn't jump when it appears) */}
        <div className="h-5 shrink-0 border-t border-slate-200 bg-white px-3 text-[11px] italic lv-meta dark:border-slate-800 dark:bg-slate-900" aria-live="polite">
          {typing.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex gap-0.5" aria-hidden="true">
                {[0, 150, 300].map((d) => <span key={d} className="h-1 w-1 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />)}
              </span>
              {typing.length === 1 ? `${typing[0]} is typing…` : typing.length === 2 ? `${typing[0]} and ${typing[1]} are typing…` : `${typing.length} people are typing…`}
            </span>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={send} className="bg-white px-2 pb-1.5 pt-0.5 dark:border-slate-800 dark:bg-slate-900">
          <div className={expanded ? "mx-auto w-full max-w-3xl" : ""}>
            {replyTo && (
              <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border-l-4 border-primary bg-slate-100 px-2.5 py-1 text-[11px] dark:bg-slate-800">
                <span className="min-w-0 truncate"><span className="font-semibold text-primary">{replyTo.author.name}</span> {previewText(replyTo)}</span>
                <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="shrink-0 text-slate-500 hover:text-danger"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
            {attachment && (
              <div className="mb-1.5 flex items-start gap-2 rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                {attachment.kind === "image"
                  ? <img src={attachment.url} alt="Photo to send" className="max-h-24 rounded-lg" />
                  : <audio controls src={attachment.url} className="h-8 w-full max-w-xs" aria-label="Sound to send" />}
                <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" className="ml-auto shrink-0 rounded-full p-1 hover:bg-slate-200 dark:hover:bg-slate-700"><X className="h-4 w-4" /></button>
              </div>
            )}

            <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/*" className="hidden" onChange={pickImage} />
            <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={pickAudio} />

            {voice.recording ? (
              <div role="status" className="flex items-center gap-2 rounded-full bg-danger/10 px-3 py-1.5 text-xs">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
                <span className="font-medium">Recording… {fmtTime(voice.seconds)} / 2:00</span>
                <Button type="button" size="sm" variant="ghost" className="ml-auto !px-2 !py-1 !text-xs" onClick={voice.cancel}>Cancel</Button>
                <Button type="button" size="sm" className="!px-2.5 !py-1 !text-xs" onClick={voice.stop}><Square className="h-3 w-3" />Done</Button>
              </div>
            ) : (
              <div className="flex items-end gap-1">
                <button type="button" onClick={() => imgRef.current?.click()} disabled={sending || preparing || !!attachment} aria-label="Attach a photo" title="Photo" className={iconBtn}><ImagePlus className="h-4 w-4" /></button>
                <button type="button" onClick={() => audioRef.current?.click()} disabled={sending || !!attachment} aria-label="Attach a sound file" title="Sound file" className={iconBtn}><Paperclip className="h-4 w-4" /></button>
                <textarea
                  ref={taRef}
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onBlur={() => { clearTimeout(typingTimer.current); setTyping(false); }}
                  onKeyDown={onKeyDown}
                  maxLength={2000}
                  rows={1}
                  placeholder={attachment ? "Add a caption (optional)…" : "Type a message"}
                  aria-label="Write a message"
                  className="max-h-[6.5rem] min-h-[2rem] flex-1 resize-none rounded-2xl border-0 bg-slate-100 px-3 py-1.5 text-xs leading-snug outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800"
                />
                {!text.trim() && !attachment && voiceSupported() ? (
                  <button type="button" onClick={voice.start} disabled={sending} aria-label="Record a voice message" title="Voice message" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40"><Mic className="h-4 w-4" /></button>
                ) : (
                  <button type="submit" disabled={!canSend} aria-label="Send" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
                )}
              </div>
            )}
            {(preparing || (sending && attachment) || text.length > 1800) && (
              <p className="mt-1 px-2 text-[10px] lv-meta">{preparing ? "Preparing photo…" : sending && attachment ? "Uploading…" : `${text.length}/2000`}</p>
            )}
          </div>
        </form>
      </div>

      {avatarView && <AvatarModal person={avatarView} onClose={() => setAvatarView(null)} />}
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} toast={toast} />}

      {editing && (
        <Modal title="Edit message" onClose={() => setEditing(null)}>
          <Textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} maxLength={2000} rows={4} />
          <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={saveEdit}>Save</Button></div>
        </Modal>
      )}
      {reporting && (
        <Modal title="Report message" onClose={() => setReporting(null)}>
          <p className="mb-2 text-sm lv-meta">Tell the moderators what's wrong with this message.</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} />
          <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={() => setReporting(null)}>Cancel</Button><Button variant="destructive" disabled={reason.trim().length < 3} onClick={submitReport}>Report</Button></div>
        </Modal>
      )}
    </div>
  );
}