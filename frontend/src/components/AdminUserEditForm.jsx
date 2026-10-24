import React, { useEffect, useState } from "react";
import { Save, KeyRound } from "lucide-react";
import Button from "./Button.jsx";
import { Field } from "./FormFields.jsx";
import { Input, Select } from "./FormFields.jsx";
import { useToast } from "./Toast.jsx";
import { listSchoolsAdmin } from "../services/schoolService.js";
import { updateUserDetails } from "../services/adminPlatformService.js";

const LEVELS = [100, 200, 300, 400, 500, 600];
const fromUser = (u) => ({
  name: u.name || "", email: u.email || "", matricNumber: u.matricNumber || "",
  learnerType: u.learnerType || "school", schoolId: u.schoolId?._id || u.schoolId || "",
  department: u.department || "", level: u.level ? String(u.level) : "", semester: u.semester || "", session: u.session || "",
  timezone: u.timezone || "UTC", leaderboardVisibility: u.leaderboardVisibility || "public",
  showSchoolOnLeaderboard: !!u.showSchoolOnLeaderboard, isEmailVerified: !!u.isEmailVerified,
  repType: u.repType || "course", repStatus: u.repStatus || "", repCourses: u.repCourses || "", repNote: u.repNote || "", rejectionReason: u.rejectionReason || "",
  newPassword: "",
});

/** Admin form for every editable detail of a user. Sends only what actually changed. */
export default function AdminUserEditForm({ user, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(() => fromUser(user));
  const [schools, setSchools] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const original = fromUser(user);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target?.type === "checkbox" ? e.target.checked : e.target.value }));
  const independent = f.learnerType === "independent";
  const isRep = user.role === "rep" || !!user.repStatus;

  useEffect(() => { setF(fromUser(user)); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listSchoolsAdmin({ limit: 100 }).then((r) => setSchools(r.schools || [])).catch(() => {}); }, []);

  const changed = Object.keys(f).filter((k) => f[k] !== original[k]);

  async function save(e) {
    e.preventDefault();
    if (!changed.length) return;
    setError(""); setBusy(true);
    try {
      const body = Object.fromEntries(changed.map((k) => [k, f[k]]));
      const r = await updateUserDetails(user._id, body);
      toast(r.changed?.length ? "User details saved" : "Nothing to change", "success");
      if (r.changed?.length) onSaved?.(r.user);
    } catch (err) { setError(err.message || "Couldn't save."); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><Input value={f.name} onChange={set("name")} required maxLength={100} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} required /></Field>
        <Field label="Matric number" hint="Leave empty for none."><Input value={f.matricNumber} onChange={set("matricNumber")} maxLength={40} /></Field>
        <Field label="Learner type"><Select value={f.learnerType} onChange={set("learnerType")}><option value="school">School student</option><option value="independent">Independent learner</option></Select></Field>
      </div>

      {independent ? (
        <p className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">Independent learners have no school, department, level or session — those are cleared when you save.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School">
            <Select value={f.schoolId} onChange={set("schoolId")}>
              <option value="">— none —</option>
              {user.schoolId?._id && !schools.some((s) => s._id === user.schoolId._id) && <option value={user.schoolId._id}>{user.schoolId.name}</option>}
              {schools.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Department"><Input value={f.department} onChange={set("department")} maxLength={120} /></Field>
          <Field label="Level"><Select value={f.level} onChange={set("level")}><option value="">—</option>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</Select></Field>
          <Field label="Semester"><Select value={f.semester} onChange={set("semester")}><option value="">—</option><option>First Semester</option><option>Second Semester</option></Select></Field>
          <Field label="Academic session" hint="e.g. 2025/2026"><Input value={f.session} onChange={set("session")} placeholder="2025/2026" maxLength={9} /></Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Time zone" hint="e.g. Africa/Lagos — streaks use this."><Input value={f.timezone} onChange={set("timezone")} maxLength={60} /></Field>
        <Field label="Leaderboard"><Select value={f.leaderboardVisibility} onChange={set("leaderboardVisibility")}><option value="public">Public name</option><option value="anonymous">Anonymous</option><option value="hidden">Hidden</option></Select></Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.isEmailVerified} onChange={set("isEmailVerified")} />Email verified</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.showSchoolOnLeaderboard} onChange={set("showSchoolOnLeaderboard")} />Show school on leaderboard</label>
      </div>

      {isRep && (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Course rep details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rep type"><Select value={f.repType} onChange={set("repType")}><option value="course">Course rep (materials)</option><option value="class">Class rep (courses)</option></Select></Field>
            <Field label="Rep status"><Select value={f.repStatus} onChange={set("repStatus")}><option value="">—</option><option value="pending">pending</option><option value="active">active</option><option value="rejected">rejected</option></Select></Field>
            <Field label="Courses / levels represented"><Input value={f.repCourses} onChange={set("repCourses")} maxLength={300} /></Field>
            <Field label="Applicant note"><Input value={f.repNote} onChange={set("repNote")} maxLength={500} /></Field>
            <Field label="Rejection reason"><Input value={f.rejectionReason} onChange={set("rejectionReason")} maxLength={300} /></Field>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" />Reset password</h3>
        <p className="mb-2 mt-1 text-xs lv-meta">Optional. Sets a new password immediately; share it with the user securely. The password is never logged.</p>
        <Input type="password" autoComplete="new-password" value={f.newPassword} onChange={set("newPassword")} placeholder="New password (min 6 characters)" />
      </div>

      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || !changed.length}><Save className="h-4 w-4" />{busy ? "Saving…" : "Save changes"}</Button>
        <Button type="button" variant="ghost" disabled={busy || !changed.length} onClick={() => { setF(original); setError(""); }}>Discard</Button>
        {changed.length > 0 && <span className="text-xs lv-meta">{changed.length} unsaved change{changed.length === 1 ? "" : "s"}</span>}
      </div>
    </form>
  );
}
