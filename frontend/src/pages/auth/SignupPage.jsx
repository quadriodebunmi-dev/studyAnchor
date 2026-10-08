import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Hash, Lock, Mail } from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import Button from "../../components/Button.jsx";
import { Input, Select, Field } from "../../components/FormFields.jsx";
import SchoolPicker from "../../components/SchoolPicker.jsx";
import DepartmentPicker from "../../components/DepartmentPicker.jsx";
import { signup, googleLogin } from "../../services/authService.js";
import GoogleContinueButton from "../../components/GoogleContinueButton.jsx";
import { getSchoolStructure } from "../../services/schoolService.js";
import BrandMark from "../../components/BrandMark.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { APP_CONFIG, LEVELS, SEMESTERS, SESSIONS } from "../../config/appConfig.js";
import { markStudyTipForNextLoad } from "../../components/StudyTipModal.jsx";

export default function SignupPage() {
  const [form, setForm] = useState({ semester: SEMESTERS[0], session: SESSIONS[0] });
  const [school, setSchool] = useState(null);
  // Stage 1.4 — once a school is picked, its own level scheme and the
  // departments already in use there replace the generic app-wide defaults.
  const [structure, setStructure] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!school) { setStructure(null); return; }
    getSchoolStructure(school._id).then(setStructure).catch(() => setStructure(null));
  }, [school]);

  const levels = structure?.levels?.length ? structure.levels : LEVELS;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!school) { setError("Select your school first."); return; }
    if (!form.matricNumber || !form.name || !form.department || !form.level || !form.session || !form.email || !form.password) {
      setError("Please fill in all fields."); return;
    }
    setLoading(true);
    try {
      const user = await signup({ ...form, level: Number(form.level), schoolId: school._id });
      markStudyTipForNextLoad();
      setUser(user);
      navigate("/");
    } catch (err) {
      setError(err.message || "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  // Same flow as the login page: returning Google users are logged straight
  // in; first-timers go to /google-continue to add matric number, department
  // and level. (Rep applications stay email/password — they need extra fields.)
  async function handleGoogleSuccess(credentialResponse) {
    const idToken = credentialResponse?.credential;
    if (!idToken) { setError("Google didn't return a valid credential. Please try again."); return; }
    setError(""); setGoogleBusy(true);
    try {
      const result = await googleLogin({ idToken });
      if (result.code === "NEEDS_PROFILE") {
        navigate("/google-continue", { state: { idToken, email: result.email, name: result.name } });
      } else if (result.user) {
        if (result.user.role === "student") markStudyTipForNextLoad();
        setUser(result.user);
        navigate("/");
      }
    } catch (err) {
      setError(err.message || "Google sign-up failed.");
    } finally {
      setGoogleBusy(false);
    }
  }

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
            <p className="font-semibold">Create your student account</p>
            <GoogleContinueButton onSuccess={handleGoogleSuccess} onError={setError} busy={googleBusy} />
            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs lv-meta">or sign up with email</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
            <Field label="School">
              <SchoolPicker value={school} onSelect={setSchool} />
            </Field>
            <Input icon={<Hash className="w-4 h-4" />} placeholder="Matric Number" onChange={(e) => update("matricNumber", e.target.value)} />
            <Input placeholder="Full Name" onChange={(e) => update("name", e.target.value)} />
            <DepartmentPicker
              value={form.department}
              onChange={(v) => update("department", v)}
              schoolId={school?._id}
              placeholder={structure?.orgUnitLabel ? `Search for your ${structure.orgUnitLabel} / Department` : "Search for your department"}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select onChange={(e) => update("level", e.target.value)} defaultValue="">
                <option value="" disabled>Level</option>
                {levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
              <Select onChange={(e) => update("semester", e.target.value)} defaultValue={SEMESTERS[0]}>
                {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <Select onChange={(e) => update("session", e.target.value)} defaultValue={SESSIONS[0]}>
              {SESSIONS.map((s) => <option key={s} value={s}>{s} Session</option>)}
            </Select>
            <Input icon={<Mail className="w-4 h-4" />} type="email" placeholder="Email" onChange={(e) => update("email", e.target.value)} />
            <Input icon={<Lock className="w-4 h-4" />} type="password" placeholder="Password" onChange={(e) => update("password", e.target.value)} />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating account..." : "Sign Up"}</Button>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">Already have an account? <Link to="/login" className="text-primary font-medium">Log in</Link></p>
          </form>
        </div>
      </div>
    </div>
  );
}
