import React, { useEffect, useState } from "react";
import { UserCircle2, Lock, Save, TriangleAlert } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import { Input, Select, Field } from "../../components/FormFields.jsx";
import SchoolPicker from "../../components/SchoolPicker.jsx";
import DepartmentPicker from "../../components/DepartmentPicker.jsx";
import { getSchoolStructure } from "../../services/schoolService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { updateProfile } from "../../services/authService.js";
import { LEVELS, SEMESTERS, SESSIONS } from "../../config/appConfig.js";

// Shared by students AND Course/Class Reps — both edit the same academic
// details (school, department, level, semester, session) and password here.
// Only Admins are blocked from switching schools from this page (they
// aren't tied to one school in the first place) — the backend enforces the
// same rule on PUT /api/auth/me.
export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const showToast = useToast();
  const canSwitchSchool = user.role !== "admin";
  const [form, setForm] = useState({
    name: user.name || "",
    department: user.department || "",
    level: user.level ? String(user.level) : "",
    semester: user.semester || SEMESTERS[0],
    session: user.session || SESSIONS[0],
  });
  // School: starts as the user's current school; picking a different one
  // means department and level must be re-chosen from that school's setup.
  const [school, setSchool] = useState(user.school || null);
  const [structure, setStructure] = useState(null);
  const schoolChanged = canSwitchSchool && !!school && String(school._id) !== String(user.schoolId || "");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!school?._id) { setStructure(null); return; }
    getSchoolStructure(school._id).then(setStructure).catch(() => setStructure(null));
  }, [school?._id]);

  function handleSchoolSelect(next) {
    setSchool(next);
    if (next && String(next._id) !== String(user.schoolId || "")) setForm((f) => ({ ...f, department: "", level: "" }));
    if (next && String(next._id) === String(user.schoolId || "")) setForm((f) => ({ ...f, department: user.department || "", level: user.level ? String(user.level) : "" }));
  }

  const levelOptions = structure?.levels?.length ? structure.levels : LEVELS.map(String);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updatePassword = (k, v) => setPasswordForm((f) => ({ ...f, [k]: v }));

  async function handleSaveDetails(e) {
    e.preventDefault();
    if (canSwitchSchool) {
      if (!school) { showToast("Pick your school from the list.", "error"); return; }
      if (schoolChanged) {
        if (!form.department || !form.level) { showToast("Choose your department and level at the new school.", "error"); return; }
        if (!window.confirm(`Switch to ${school.name}? Your dashboard will show ${school.name}'s courses. Uploads you've already made stay with your previous school.`)) return;
      }
    }
    setSavingDetails(true);
    try {
      const payload = { ...form, level: form.level ? Number(form.level) : undefined };
      if (schoolChanged) payload.schoolId = school._id;
      const updated = await updateProfile(payload);
      setUser(updated);
      if (canSwitchSchool) setSchool(updated.school || school);
      showToast(schoolChanged ? `Switched to ${school.name}` : "Profile updated", "success");
    } catch (err) {
      showToast(err.message || "Couldn't update your profile.", "error");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!passwordForm.newPassword) { showToast("Enter a new password.", "error"); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { showToast("New passwords don't match.", "error"); return; }
    setSavingPassword(true);
    try {
      await updateProfile({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      showToast("Password updated", "success");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      showToast(err.message || "Couldn't update your password.", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-full bg-accent text-accent-fg text-lg font-semibold flex items-center justify-center">
          {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {user.email}{user.matricNumber ? ` · ${user.matricNumber}` : ""}
            {user.role === "rep" ? ` · ${user.repType === "class" ? "Class Rep" : "Course Rep"}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserCircle2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Academic details</h2>
        </div>
        <form onSubmit={handleSaveDetails} className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Full Name" value={form.name} onChange={(e) => update("name", e.target.value)} className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <Field label="School">
              {canSwitchSchool ? (
                <SchoolPicker value={school} onSelect={handleSchoolSelect} />
              ) : (
                <Input value={school?.name || "—"} disabled />
              )}
            </Field>
            {schoolChanged && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Changing school updates the courses and materials you see. Choose your department and level at the new school below.
              </p>
            )}
          </div>
          <DepartmentPicker
            value={form.department}
            onChange={(v) => update("department", v)}
            schoolId={school?._id}
            placeholder="Search for your department"
          />
          <Select value={form.level} onChange={(e) => update("level", e.target.value)} aria-label="Level">
            <option value="" disabled>Level</option>
            {levelOptions.map((l) => <option key={l} value={l}>{l} Level</option>)}
          </Select>
          <Select value={form.semester} onChange={(e) => update("semester", e.target.value)}>
            {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={form.session} onChange={(e) => update("session", e.target.value)}>
            {SESSIONS.map((s) => <option key={s} value={s}>{s} Session</option>)}
          </Select>
          <p className="sm:col-span-2 text-xs text-slate-500 dark:text-slate-400">
            Matric number and email can't be changed here — contact an admin if either needs correcting.
          </p>
          <Button type="submit" disabled={savingDetails} className="sm:col-span-2 w-full sm:w-auto">
            <Save className="w-4 h-4" /> {savingDetails ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-secondary-purple" />
          <h2 className="font-semibold">Change password</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          If you signed up with Google and have never set a password, leave "Current password" blank.
        </p>
        <form onSubmit={handleChangePassword} className="grid sm:grid-cols-2 gap-3">
          <Input type="password" placeholder="Current password" value={passwordForm.currentPassword} onChange={(e) => updatePassword("currentPassword", e.target.value)} className="sm:col-span-2" />
          <Input type="password" placeholder="New password" value={passwordForm.newPassword} onChange={(e) => updatePassword("newPassword", e.target.value)} />
          <Input type="password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={(e) => updatePassword("confirmPassword", e.target.value)} />
          <Button type="submit" variant="secondary" disabled={savingPassword} className="sm:col-span-2 w-full sm:w-auto">
            {savingPassword ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}