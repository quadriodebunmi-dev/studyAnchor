import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, CheckCircle2 } from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import BrandMark from "../../components/BrandMark.jsx";
import Button from "../../components/Button.jsx";
import { Input } from "../../components/FormFields.jsx";
import { resetPassword } from "../../services/authService.js";
import { APP_CONFIG } from "../../config/appConfig.js";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!token) { setError("This reset link is missing its token — request a new one."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message || "Reset link is invalid or has expired.");
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
          {done ? (
            <div className="text-center space-y-3">
              <div className="mx-auto w-fit rounded-full bg-success/10 p-3"><CheckCircle2 className="w-6 h-6 text-success" /></div>
              <p className="font-semibold">Password updated</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">You can now log in with your new password.</p>
              <Button className="w-full" onClick={() => navigate("/login")}>Go to login</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="font-semibold">Reset your password</p>
              {!token && <p className="text-sm text-danger">This link is missing its reset token. Request a new one from the forgot password page.</p>}
              <Input icon={<Lock className="w-4 h-4" />} type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Input icon={<Lock className="w-4 h-4" />} type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">{loading ? "Updating..." : "Reset password"}</Button>
              <p className="text-center text-sm"><Link to="/login" className="text-primary font-medium">Back to login</Link></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
