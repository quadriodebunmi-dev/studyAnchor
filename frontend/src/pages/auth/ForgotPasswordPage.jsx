import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import BrandMark from "../../components/BrandMark.jsx";
import Button from "../../components/Button.jsx";
import { Input } from "../../components/FormFields.jsx";
import { forgotPassword } from "../../services/authService.js";
import { APP_CONFIG } from "../../config/appConfig.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email) { setError("Enter your email."); return; }
    setLoading(true);
    try {
      await forgotPassword(email);
      // The backend always returns success here, whether or not the email
      // exists, so this page never reveals which accounts are real.
      setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
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
          {sent ? (
            <div className="text-center space-y-3">
              <p className="font-semibold">Check your inbox</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                If an account exists for <span className="font-medium">{email}</span>, we've sent a link to reset your password. It expires in 1 hour.
              </p>
              <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary font-medium"><ArrowLeft className="w-3.5 h-3.5" /> Back to login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="font-semibold">Forgot your password?</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Enter your email and we'll send you a link to reset it.</p>
              <Input icon={<Mail className="w-4 h-4" />} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">{loading ? "Sending..." : "Send reset link"}</Button>
              <p className="text-center text-sm"><Link to="/login" className="text-primary font-medium">Back to login</Link></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
