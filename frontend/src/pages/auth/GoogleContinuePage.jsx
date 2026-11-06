import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Hash, BookOpen } from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import Button from "../../components/Button.jsx";
import { Input, Select, Field } from "../../components/FormFields.jsx";
import SchoolPicker from "../../components/SchoolPicker.jsx";
import DepartmentPicker from "../../components/DepartmentPicker.jsx";
import { googleLogin } from "../../services/authService.js";
import { getSchoolStructure } from "../../services/schoolService.js";
import BrandMark from "../../components/BrandMark.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { APP_CONFIG, LEVELS, SEMESTERS, SESSIONS } from "../../config/appConfig.js";
import { markStudyTipForNextLoad } from "../../components/StudyTipModal.jsx";

// One-time step shown ONLY the first time someone signs up with Google — the
// backend only returns the NEEDS_PROFILE code for accounts it has never seen
// before. Returning users are logged in directly on the login page and never
// land here. We arrive with the real Google idToken carried over via
// navigation state so we can finish creating the account with the same
// verified credential instead of ever faking one.
export default function GoogleContinuePage() {
  const location = useLocation();
  const { idToken, email, name } = location.state || {};
  const [form, setForm] = useState({ semester: SEMESTERS[0], session: SESSIONS[0] });
  const [school, setSchool] = useState(null);
  const [structure, setStructure] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [indepLoading, setIndepLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!school) { setStructure(null); return; }
    getSchoolStructure(school._id).then(setStructure).catch(() => setStructure(null));
  }, [school]);

  const levels = structure?.levels?.length ? structure.levels : LEVELS;

  // If someone lands here directly (refresh, bookmark, back button) without
  // a token in flight, send them back to log in properly rather than
  // showing a form that can only fail.
  if (!idToken) return <Navigate to="/login" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!school) { setError("Pick your school from the list, or add it."); return; }
    if (!form.department) { setError("Pick your department from the list, or add it."); return; }
    if (!form.matricNumber || !form.department || !form.level || !form.session) {
      setError("Please fill in all fields."); return;
    }
    setLoading(true);
    try {
      const result = await googleLogin({ idToken, ...form, level: Number(form.level), schoolId: school._id });
      if (result.user) { markStudyTipForNextLoad(); setUser(result.user); navigate("/"); }
    } catch (err) {
      setError(err.message || "Couldn't finish setting up your account.");
    } finally {
      setLoading(false);
    }
  }

  // No school? Finish the same Google sign-up as an independent learner: a private
  // library and the AI study tools, no academic details needed. The backend creates
  // the account from the verified idToken. They can join a school later from Profile.
  async function handleIndependent() {
    setError("");
    setIndepLoading(true);
    try {
      const result = await googleLogin({ idToken, learnerType: "independent" });
      if (result.user) { markStudyTipForNextLoad(); setUser(result.user); navigate("/"); }
    } catch (err) {
      setError(err.message || "Couldn't finish setting up your account.");
    } finally {
      setIndepLoading(false);
    }
  }

  const busy = loading || indepLoading;

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-10 bg-slate-50 dark:bg-slate-950">
      <ThemeToggle className="fixed top-5 right-5" />
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6">
          <BrandMark className="h-11 w-11" />
          <p className="text-xl font-bold">{APP_CONFIG.name}</p>
        </div>


        
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="font-semibold">Finish setting up your account</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {name ? `Welcome, ${name}. ` : ""}One-time step for Google sign-in — we need your academic details.
              {email && <span className="block mt-1 text-slate-400">{email}</span>}
            </p>
             <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4" /> Not in a university?</p>
            <Button type="button" variant="outline" disabled={busy} onClick={handleIndependent} className="mt-3 w-full">
              {indepLoading ? "Setting up..." : "Continue as independent learner"}
            </Button>
          </div>

            <div className="flex items-center gap-1 py-0">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs lv-meta">or</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>
       


            <Field label="Are you in a University?">
              <SchoolPicker value={school} onSelect={setSchool} />
            </Field>
            <Input icon={<Hash className="w-4 h-4" />} placeholder="Matric Number" onChange={(e) => update("matricNumber", e.target.value)} />
            <DepartmentPicker
              value={form.department || ""}
              onChange={(v) => update("department", v)}
              schoolId={school?._id}
              requireSchool
              placeholder="Search for your department"
            />
            <div className="grid grid-cols-2 gap-3">
              <Select onChange={(e) => update("level", e.target.value)} defaultValue="">
                <option value="" disabled>Select Level</option>
                {levels.map((l) => <option key={l} value={l}>{l} Level</option>)}
              </Select>
              <Select onChange={(e) => update("semester", e.target.value)} defaultValue={SEMESTERS[0]}>
                {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <Select onChange={(e) => update("session", e.target.value)} defaultValue={SESSIONS[0]}>
              {SESSIONS.map((s) => <option key={s} value={s}>{s} Session</option>)}
            </Select>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">{loading ? "Setting up..." : "Continue to Dashboard"}</Button>
          </form>
        
        </div>
      </div>
    </div>
  );
}
