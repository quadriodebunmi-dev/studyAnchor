import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Hash, Lock, Mail } from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import BrandMark from "../../components/BrandMark.jsx";
import Button from "../../components/Button.jsx";
import { Input, Select, Textarea, Field } from "../../components/FormFields.jsx";
import SchoolPicker from "../../components/SchoolPicker.jsx";
import DepartmentPicker from "../../components/DepartmentPicker.jsx";
import { repSignup } from "../../services/authService.js";
import { getSchoolStructure } from "../../services/schoolService.js";
import { APP_CONFIG, SESSIONS , LEVELS, SEMESTERS,} from "../../config/appConfig.js";


export default function RepSignupPage() {
  const [form, setForm] = useState({ session: SESSIONS[0], repType: "course" ,semester: SEMESTERS[0],});
  const [school, setSchool] = useState(null);
  const [structure, setStructure] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!school) { setStructure(null); return; }
    getSchoolStructure(school._id).then(setStructure).catch(() => setStructure(null));
  }, [school]);

   const levelOptions = structure?.levels?.length ? structure.levels : LEVELS.map(String);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!school) { setError("Select your school first."); return; }
    if (!form.matricNumber || !form.name || !form.department || !form.email || !form.password) {
      setError("Please fill in all required fields."); return;
    }
    setLoading(true);
    try {
      await repSignup({ ...form, schoolId: school._id });
      navigate("/rep-pending");
    } catch (err) {
      setError(err.message || "Application failed.");
    } finally {
      setLoading(false);
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
            <p className="font-semibold">Apply to become a Rep</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Applications are reviewed by an admin before you get Rep access.</p>
            <Field label="School">
              <SchoolPicker value={school} onSelect={setSchool} />
            </Field>
          
            <Input placeholder="Full Name" onChange={(e) => update("name", e.target.value)} />
            <Input icon={<Mail className="w-4 h-4" />} type="email" placeholder="Email" onChange={(e) => update("email", e.target.value)} />
            <Input icon={<Hash className="w-4 h-4" />} placeholder="Matric Number" onChange={(e) => update("matricNumber", e.target.value)} />
            <DepartmentPicker
              value={form.department || ""}
              onChange={(v) => update("department", v)}
              schoolId={school?._id}
              placeholder={structure?.orgUnitLabel ? `Search for your ${structure.orgUnitLabel} / Department` : "Search for your department"}
            />
           <Select value={form.level} onChange={(e) => update("level", e.target.value)} aria-label="Level">
                       <option value="" disabled>Level</option>
                       {levelOptions.map((l) => <option key={l} value={l}>{l} Level</option>)}
                     </Select>
                     <Select value={form.semester} onChange={(e) => update("semester", e.target.value)}>
                       {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                     </Select>
            <Select onChange={(e) => update("session", e.target.value)} defaultValue={SESSIONS[0]}>
              {SESSIONS.map((s) => <option key={s} value={s}>{s} Session</option>)}
            </Select>
            <Input icon={<Lock className="w-4 h-4" />} type="password" placeholder="Password" onChange={(e) => update("password", e.target.value)} />
            <Textarea placeholder="Why are you applying? (optional)" rows={2} onChange={(e) => update("repNote", e.target.value)} />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" variant="secondary" disabled={loading} className="w-full">{loading ? "Submitting..." : "Submit Application"}</Button>
            <p className="text-center text-sm"><Link to="/login" className="text-primary font-medium">Back to login</Link></p>
          </form>
        </div>
      </div>
    </div>
  );
}
