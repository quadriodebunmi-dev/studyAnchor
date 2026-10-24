import React, { useState } from "react";
import Button from "../Button.jsx";
import UpgradeNotice, { isUpgradeError } from "../UpgradeNotice.jsx";
import { Field, Input, Select, Textarea } from "../FormFields.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { MOODS } from "./roomUi.jsx";

// Used for both creating a room and editing its settings (owner).
export default function RoomForm({ initial = {}, onSubmit, submitLabel = "Create room", editing = false }) {
  const { user } = useAuth();
  const [f, setF] = useState({
    name: "", topic: "", description: "", mood: "revision", visibility: "public", joinPolicy: "open",
    audience: user?.schoolId ? "school" : "everyone", ...initial,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const isPrivate = f.visibility === "private";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (f.name.trim().length < 3) return setError("Give the room a name (at least 3 characters).");
    setBusy(true);
    try { await onSubmit(f); } catch (err) { setUpgrade(isUpgradeError(err)); setError(err.message || "Something went wrong."); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Room name"><Input value={f.name} onChange={set("name")} maxLength={80} placeholder="e.g. CSC 201 exam revision" required /></Field>
      <Field label="Topic" hint="Optional — what you'll study or discuss."><Input value={f.topic} onChange={set("topic")} maxLength={80} /></Field>
      <Field label="Description"><Textarea value={f.description} onChange={set("description")} maxLength={600} rows={3} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mood"><Select value={f.mood} onChange={set("mood")}>{MOODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></Field>
        <Field label="Visibility" hint={isPrivate ? "Hidden from Discover. People join with an invite link or invitation, then you approve them." : "Listed in Discover."}>
          <Select value={f.visibility} onChange={set("visibility")}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Select>
        </Field>
        {!isPrivate && (
          <Field label="Who can join">
            <Select value={f.joinPolicy} onChange={set("joinPolicy")}>
              <option value="open">Anyone, instantly</option>
              <option value="approval">Anyone, after I approve</option>
            </Select>
          </Field>
        )}
        {!isPrivate && user?.schoolId && (
          <Field label="Discoverable by">
            <Select value={f.audience} onChange={set("audience")}>
              <option value="school">My school only</option>
              <option value="everyone">Everyone on Study Anchor</option>
            </Select>
          </Field>
        )}
      </div>
      {upgrade ? <UpgradeNotice message={error} /> : error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
