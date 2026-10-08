import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Hash, Lock, Chrome, BookOpenCheck, WifiOff, Sparkles } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import BrandMark from "../../components/BrandMark.jsx";
import { InstallPrompt } from "../../components/PwaPrompts.jsx";
import Button from "../../components/Button.jsx";
import { Input } from "../../components/FormFields.jsx";
import { login, googleLogin } from "../../services/authService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { APP_CONFIG } from "../../config/appConfig.js";
import { markStudyTipForNextLoad } from "../../components/StudyTipModal.jsx";

// Drop the provided SVG at public/login.svg (matches the convention used on
// the landing page); adjust the import path if your project differs.
import loginIllustration from "../../../public/login.svg";

const GOOGLE_CONFIGURED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID && import.meta.env.VITE_GOOGLE_CLIENT_ID !== "your_google_oauth_client_id";
// Add this small component near your other imports/components
const GoogleIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await login(identifier, password);
      if (user.role === "student") markStudyTipForNextLoad();
      setUser(user);
      navigate("/");
    } catch (err) {
      if (err.code === "REP_PENDING") navigate("/rep-pending");
      else setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  // Fires with a real Google ID token once the person picks an account in
  // the Google popup. Whether they're brand new or returning is decided by
  // the backend: existing accounts (matched by Google ID or email) log in
  // immediately here — only genuinely first-time sign-ins get redirected to
  // /google-continue to finish their profile. This is the fix for the old
  // bug where every click on "Continue with Google" went straight to that
  // profile page, even for people who'd already signed up before.
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
      setError(err.message || "Google sign-in failed.");
    } finally {
      setGoogleBusy(false);
    }
  }

  function demoNote(role) {
    const creds = {
      student: "aisha@demo.edu / demo123",
      rep: "john@demo.edu / demo123",
      classrep: "tunde@demo.edu / demo123",
      admin: "admin@demo.edu / admin123",
    };
    setIdentifier(creds[role].split(" / ")[0]);
    setPassword(creds[role].split(" / ")[1]);
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[1.05fr_1fr]">
      <ThemeToggle className="fixed top-5 right-5 z-20" />

      {/*
        The illustration leads the panel now — it's the "log in" moment
        itself — with the shelf-of-materials copy grounding it just below,
        so the panel reads top to bottom as one idea rather than two.
      */}
      <aside className="relative hidden overflow-hidden bg-night p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px)", backgroundSize: "100% 34px" }}
        />

        <div className="relative flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <p className="font-display text-lg font-bold">{APP_CONFIG.name}</p>
        </div>
         <h1 className="font-display text-[2.5rem] font-extrabold leading-[1.1] tracking-tight">
            Every handout for your level, in one place.
          </h1>
          <p className="mt-4 text-[0.975rem] leading-relaxed text-slate-300">
            Study Anchor scopes your feed to your department, level and semester, so the
            material you need is the first thing you see.
          </p>

        <div className="relative max-w-md">
          <img
            src={loginIllustration}
            alt="A student signing in on their phone, next to a large key representing account access"
            className="mx-auto mb-8 w-full max-w-[19rem]"
          />
        </div>

     
      </aside>

      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950 lg:min-h-0">
        <div className="w-full max-w-sm animate-rise-in">
        
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="h-11 w-11" />
            <div>
              <p className="font-display text-lg font-bold leading-none text-night dark:text-slate-50">{APP_CONFIG.name}</p>
              <p className="mt-1 text-xs lv-meta">{APP_CONFIG.tagline}</p>
            </div>
          </div>

          <h2 className="font-display text-2xl font-bold text-night dark:text-slate-50">Welcome back</h2>
          <p className="mt-1.5 text-sm lv-meta">Log in with your matric number or email.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-3">
            <Input icon={<Hash className="h-4 w-4" />} placeholder="Matric number or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
            <Input icon={<Lock className="h-4 w-4" />} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />

            {error && (
              <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>
            )}

            <div className="text-right">
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
              {loading ? "Logging in..." : "Log in"}
            </Button>

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs lv-meta">or</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
{GOOGLE_CONFIGURED ? (
  <div className="relative w-full">
    <Button type="button" variant="outline" className="w-full pointer-events-none" disabled={googleBusy}>
      <GoogleIcon className="h-4 w-4" /> {googleBusy ? "Signing in..." : "Continue with Google"}
    </Button>
    {/* Google's real button sits transparently on top, so the flow is
        official while the visuals stay ours. */}
    <div className="absolute inset-0 overflow-hidden opacity-0 [&>div]:w-full">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => setError("Google sign-in failed. Please try again.")}
        width="320"
        text="continue_with"
      />
    </div>
  </div>
) : (
  <Button type="button" variant="outline" className="w-full" onClick={() => setError("Google sign-in isn't configured yet — set VITE_GOOGLE_CLIENT_ID.")}>
    <GoogleIcon className="h-4 w-4" /> Continue with Google
  </Button>
)}

            <div className="flex items-center justify-between pt-2 text-sm">
              <Link to="/signup" className="font-medium text-primary hover:underline">Sign up as a student</Link>
              <Link to="/rep-signup" className="font-medium text-secondary-purple hover:underline">Apply as a rep</Link>
            </div>

            
          </form>

                    <div className="relative max-w-md lg:hidden">
          <img
            src={loginIllustration}
            alt="A student signing in on their phone, next to a large key representing account access"
            className="mx-auto mb-8 h-80 w-full max-w-[19rem]"
          />
        </div>
        </div>
      </main>

      <InstallPrompt />
    </div>
  );
}