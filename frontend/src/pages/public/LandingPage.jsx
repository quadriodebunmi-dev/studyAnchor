import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Sparkles, Bot, WifiOff, Lock, UploadCloud, CheckCircle2 } from "lucide-react";
import PublicLayout from "../../components/PublicLayout.jsx";
import PublicNavbar from "../../components/PublicNavbar.jsx";
import Button from "../../components/Button.jsx";
import { Input } from "../../components/FormFields.jsx";
import { requestSchool } from "../../services/schoolService.js";
import { APP_CONFIG } from "../../config/appConfig.js";

import thinkingIllustration from "../../../public/Thinking.svg";
import mappingIllustration from "../../../public/Mapping-learning.svg";
import studentsPhoto from "../../../public/students-jumping.svg";

// This is a real sequence, so numbering it is meaningful.
const STEPS = [
  { title: "Pick your school", text: "Choose your school, department and level. Not listed? Add it in under a minute." },
  { title: "Find your materials", text: "Browse by semester or search a course code. Everything is uploaded by your own reps." },
  { title: "Study your way", text: "Read, download, take a quiz, or ask the AI assistant about a handout." },
];

// The first feature is the headline one and gets a larger, darker tile.
const FEATURES = [
  { icon: ShieldCheck, title: "Checked before it goes live", text: "Course Reps approve what students share with the class, so the material you find is the material you can trust.", span: "lg:col-span-4" },
  { icon: Lock, title: "Private uploads, too", text: "Keep your own notes on your dashboard, or share them with your class when you're ready.", span: "lg:col-span-2" },
  { icon: Sparkles, title: "Quizzes from your slides", text: "Turn any material into multiple-choice or theory questions with model answers.", span: "lg:col-span-2" },
  { icon: Bot, title: "An AI study assistant", text: "Ask about a concept or a specific handout and get a clear explanation.", span: "lg:col-span-2" },
  { icon: WifiOff, title: "Works offline", text: "Install it on your phone. Materials you've opened stay readable without data.", span: "lg:col-span-2" },
];

function RequestSchool() {
  const [form, setForm] = useState({ name: "", city: "", domain: "" });
  const [state, setState] = useState({ status: "idle", message: "" });
  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setState({ status: "error", message: "Please enter your school's name." }); return; }
    setState({ status: "loading", message: "" });
    try {
      const school = await requestSchool(form);
      setState({ status: "done", message: `${school.name} has been added. You can sign up with it right away — it just needs verifying by an admin.` });
      setForm({ name: "", city: "", domain: "" });
    } catch (err) {
      // 409 = the school is already on the platform, which is good news.
      setState({ status: err.school ? "exists" : "error", message: err.message || "Couldn't send your request. Please try again." });
    }
  }

  if (state.status === "done" || state.status === "exists") {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 p-5 text-sm" role="status">
        <p className="flex items-start gap-2 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {state.message}</p>
        <Link to="/signup" className="mt-3 inline-block font-medium text-primary hover:underline">Sign up as a student →</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input placeholder="School name" value={form.name} onChange={update("name")} aria-label="School name" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="City (optional)" value={form.city} onChange={update("city")} aria-label="City" />
        <Input placeholder="Website domain (optional)" value={form.domain} onChange={update("domain")} aria-label="Website domain" />
      </div>
      {state.status === "error" && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{state.message}</p>}
      <Button type="submit" variant="accent" disabled={state.status === "loading"} className="w-full sm:w-auto">
        {state.status === "loading" ? "Sending..." : "Request my school"}
      </Button>
    </form>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* One orchestrated moment: the hero rises in on load. Nothing else animates on scroll. */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
        @keyframes sa-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .sa-rise { animation: sa-rise .7s cubic-bezier(.2,.7,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .sa-rise { animation: none; } }
      `}</style>

      <PublicNavbar />

      {/* HERO */}
      <section className="relative overflow-hidden bg-night text-white">
        <div className="pointer-events-none inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px)", backgroundSize: "100% 34px" }} />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-5 sm:pb-24 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8">
          <div className="max-w-xl">
            <a
              href="https://buyonuma.shop"
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="sa-rise inline-flex rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/15 hover:text-white"
            >
              Sponsored by buyonuma.shop
            </a>
            <h1 className="sa-rise mt-5 font-display text-2xl font-extrabold leading-[1.08] tracking-tight sm:text-3xl lg:text-4xl" style={{ animationDelay: "80ms" }}>
              Every lecture handout for your school, in one place.
            </h1>
            <p className="sa-rise mt-5 max-w-md text-sm leading-relaxed text-slate-300" style={{ animationDelay: "160ms" }}>
              {APP_CONFIG.name} brings course materials together by department, level and semester. Your own reps upload them, and you study straight from them.
            </p>
            <div className="sa-rise mt-8 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "240ms" }}>
              <Link to="/signup" className="w-full sm:w-auto"><Button variant="accent" size="lg" className="w-full sm:w-auto">Sign up as a student</Button></Link>
              <Link to="/login" className="w-full sm:w-auto"><Button variant="outline" size="lg" className="w-full border-white/30 text-white hover:bg-white/10 sm:w-auto dark:text-white">Log in</Button></Link>
            </div>
            <p className="sa-rise mt-4 text-xs text-slate-400" style={{ animationDelay: "300ms" }}>
              Course Rep? <Link to="/rep-signup" className="font-medium text-accent hover:underline">Apply here</Link>
            </p>
          </div>
          <img
            src={mappingIllustration}
            alt="Course materials being sorted and filed by department and level"
            className="sa-rise mx-auto w-full max-w-sm lg:max-w-none"
            style={{ animationDelay: "200ms" }}
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="font-display text-lg font-bold sm:text-xl">From sign-up to studying in three steps</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="lv-card flex gap-4 p-5 md:block">
              <span className="font-display text-3xl font-extrabold leading-none text-accent">{i + 1}</span>
              <div className="md:mt-4">
                <h3 className="font-display text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 text-xs lv-meta">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <img
            src={thinkingIllustration}
            alt="A student thinking through a question, with an idea forming above her head"
            className="mx-auto w-full max-w-xs lg:max-w-sm"
          />
          <div>
            <h2 className="font-display text-lg font-bold sm:text-xl">Everything you need to study</h2>
            <p className="mt-3 max-w-md text-xs lv-meta sm:text-sm">
              Each school gets its own courses, levels and Course Reps, so your feed only shows material that's relevant to you.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map(({ icon: Icon, title, text, span }, i) => {
            const lead = i === 0;
            return (
              <div
                key={title}
                className={`${span} ${lead ? "rounded-2xl border border-white/10 bg-night p-6 text-white sm:col-span-2 sm:p-8" : "lv-card p-5"}`}
              >
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${lead ? "bg-accent text-night" : "bg-accent/20 text-primary"}`}><Icon className="h-5 w-5" /></span>
                <h3 className={`mt-3 font-display font-semibold ${lead ? "text-base" : "text-sm"}`}>{title}</h3>
                <p className={`mt-1 text-xs ${lead ? "max-w-md text-slate-300" : "lv-meta"}`}>{text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* COMMUNITY */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="lv-card grid overflow-hidden md:grid-cols-2">
          <img
            src={studentsPhoto}
            alt="A group of students jumping together outdoors, celebrating"
            className="h-56 w-full object-cover md:h-full"
          />
          <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
            <p className="font-display text-base font-semibold sm:text-lg">
              Thousands of students already study through {APP_CONFIG.name}. Find your school and join them.
            </p>
            <Link to="/signup" className="w-full sm:w-fit"><Button variant="accent" className="w-full sm:w-auto">Sign up as a student</Button></Link>
          </div>
        </div>
      </section>

      {/* REQUEST A SCHOOL */}
      <section id="request-school" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16">
        <div className="lv-card grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-primary"><UploadCloud className="h-5 w-5" /></span>
            <h2 className="mt-3 font-display text-lg font-bold">Don't see your school?</h2>
            <p className="mt-2 max-w-md text-xs lv-meta">
              Tell us where you study. You don't need an account to ask. Your school is added straight away, and students and reps can sign up with it while an admin verifies it.
            </p>
          </div>
          <RequestSchool />
        </div>
      </section>
    </>
  );
}