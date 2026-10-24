import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MessagesSquare, Plus, Search } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import Modal from "../../components/Modal.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Pager from "../../components/Pager.jsx";
import { CardSkeleton } from "../../components/Loader.jsx";
import { Input, Select } from "../../components/FormFields.jsx";
import { useToast } from "../../components/Toast.jsx";
import RoomForm from "../../components/rooms/RoomForm.jsx";
import { RoomCard, MOODS } from "../../components/rooms/roomUi.jsx";
import { createRoom, discoverRooms, joinRoom, myInvitations, myRooms, previewRoomByCode, respondToInvitation } from "../../services/roomService.js";

const TABS = [["discover", "Discover"], ["mine", "My rooms"], ["invitations", "Invitations"]];

// Shared sizing so every list on this page stays compact.
const GRID = "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3";
const smallBtn = "!px-2.5 !py-1 !text-xs";

export default function RoomsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "discover";
  const { code } = useParams(); // /rooms/join/:code
  const [creating, setCreating] = useState(false);
  const [invites, setInvites] = useState([]);
  const navigate = useNavigate();
  const toast = useToast();

  const loadInvites = useCallback(() => myInvitations().then(setInvites).catch(() => {}), []);
  useEffect(() => { loadInvites(); }, [loadInvites]);

  async function handleCreate(data) {
    const room = await createRoom(data);
    toast("Room created", "success");
    navigate(`/rooms/${room._id}`);
  }

  return (
    <AppShell>
      {/* Width cap keeps everything moderate on large screens. */}
      <div className="mx-auto w-full max-w-4xl text-[13px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="lv-page-title !text-lg sm:!text-xl">Discussion rooms</h1>
            <p className="mt-0.5 text-[10.5px] lv-meta">Study together, ask questions and take quizzes.</p>
          </div>
          <Button size="sm" className={smallBtn} onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />Create</Button>
        </div>

        <div className="lv-tabs mt-3" role="tablist">
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setParams({ tab: key })}
              className="lv-tab !text-xs">
              {label}{key === "invitations" && invites.length > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[9.5px] text-accent-fg">{invites.length}</span>}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {tab === "discover" && <Discover />}
          {tab === "mine" && <Mine />}
          {tab === "invitations" && <Invitations invites={invites} reload={loadInvites} />}
        </div>
      </div>

      {creating && <Modal title="Create a room" onClose={() => setCreating(false)} wide><RoomForm onSubmit={handleCreate} /></Modal>}
      {code && <JoinByCode code={code} onClose={() => navigate("/rooms")} />}
    </AppShell>
  );
}

function Discover() {
  const [q, setQ] = useState("");
  const [mood, setMood] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => { setPage(1); }, [q, mood]);
  useEffect(() => {
    let live = true;
    setData(null);
    const t = setTimeout(() => {
      discoverRooms({ q: q.trim() || undefined, mood: mood || undefined, page })
        .then((r) => live && setData(r)).catch((e) => live && setError(e.message || "Couldn't load rooms."));
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q, mood, page]);

  async function join(room) {
    try {
      const r = await joinRoom(room._id);
      toast(r.message, "success");
      if (r.status === "active") navigate(`/rooms/${room._id}`);
      else setData((d) => ({ ...d, rooms: d.rooms.map((x) => (x._id === room._id ? { ...x, myStatus: "pending" } : x)) }));
    } catch (e) { toast(e.message || "Couldn't join.", "error"); }
  }

  return (
    <>
      <div className="mb-2.5 grid gap-1.5 sm:grid-cols-[1fr_10rem]">
        <Input icon={<Search className="h-3.5 w-3.5" />} className="!py-1.5 !text-xs" placeholder="Search rooms by name, topic or department" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search rooms" />
        <Select value={mood} onChange={(e) => setMood(e.target.value)} className="!py-1.5 !text-xs" aria-label="Filter by mood">
          <option value="">Any mood</option>
          {MOODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </Select>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : !data ? <div className={GRID}><CardSkeleton count={6} /></div> : (
        <>
          <div className={GRID}>
            {data.rooms.map((r) => (
              <RoomCard key={r._id} room={r} onOpen={() => navigate(`/rooms/${r._id}`)}
                action={r.myStatus === "active" ? <Badge tone="green">Joined</Badge>
                  : r.myStatus === "pending" ? null
                  : <Button size="sm" className={smallBtn} onClick={() => join(r)}>{r.joinPolicy === "open" ? "Join" : "Request to join"}</Button>} />
            ))}
            {data.rooms.length === 0 && <EmptyState icon={<MessagesSquare className="h-5 w-5" />} title="No rooms found" message="Try a different search, or create the first room for this topic." />}
          </div>
          <Pager pagination={data.pagination} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

function Mine() {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { setPage(1); }, [filter]);
  useEffect(() => { setData(null); myRooms({ filter, page }).then(setData).catch(() => setData({ rooms: [], pagination: null })); }, [filter, page]);

  return (
    <>
      <div className="lv-chips mb-2.5">
        {[["all", "All"], ["created", "Created by me"], ["joined", "Joined"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`lv-chip !px-2.5 !py-1 !text-[11px] ${filter === k ? "lv-chip-active" : ""}`}>{l}</button>
        ))}
      </div>
      {!data ? <div className={GRID}><CardSkeleton count={3} /></div> : (
        <>
          <div className={GRID}>
            {data.rooms.map((r) => <RoomCard key={r._id} room={r} onOpen={() => navigate(`/rooms/${r._id}`)} />)}
            {data.rooms.length === 0 && <EmptyState icon={<MessagesSquare className="h-5 w-5" />} title="No rooms yet" message="Join a room from Discover or create your own." />}
          </div>
          <Pager pagination={data.pagination} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

function Invitations({ invites, reload }) {
  const navigate = useNavigate();
  const toast = useToast();
  async function respond(room, accept) {
    try {
      await respondToInvitation(room._id, accept);
      toast(accept ? "You joined the room" : "Invitation declined", "success");
      reload();
      if (accept) navigate(`/rooms/${room._id}`);
    } catch (e) { toast(e.message || "Couldn't respond.", "error"); }
  }
  if (!invites.length) return <EmptyState icon={<MessagesSquare className="h-5 w-5" />} title="No invitations" message="When someone invites you to a room, it shows up here." />;
  return (
    <div className={GRID}>
      {invites.map((r) => (
        <RoomCard key={r._id} room={r} onOpen={() => {}} action={
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className={smallBtn} onClick={() => respond(r, false)}>Decline</Button>
            <Button size="sm" className={smallBtn} onClick={() => respond(r, true)}>Accept</Button>
          </div>} />
      ))}
    </div>
  );
}

// A private room's invite link: show a preview, then ask to join (the owner still approves).
function JoinByCode({ code, onClose }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const toast = useToast();
  useEffect(() => { previewRoomByCode(code).then(setRoom).catch((e) => setError(e.message || "That invite link isn't valid any more.")); }, [code]);

  async function ask() {
    try { const r = await joinRoom(room._id, code); toast(r.message, "success"); onClose(); } catch (e) { toast(e.message || "Couldn't send the request.", "error"); }
  }
  return (
    <Modal title="Room invitation" onClose={onClose}>
      {error ? <p className="text-xs text-danger">{error}</p> : !room ? <p className="text-xs lv-meta">Loading…</p> : (
        <div className="space-y-2.5">
          <p className="font-display text-base font-semibold">{room.name}</p>
          {room.description && <p className="text-xs lv-meta">{room.description}</p>}
          <p className="text-[11px] lv-meta">{room.memberCount} member(s). The room owner will review your request.</p>
          {room.myStatus === "active" ? <Badge tone="green">You're already in this room</Badge>
            : room.myStatus === "pending" ? <Badge tone="amber">Request pending</Badge>
            : <Button size="sm" onClick={ask}>Ask to join</Button>}
        </div>
      )}
    </Modal>
  );
}