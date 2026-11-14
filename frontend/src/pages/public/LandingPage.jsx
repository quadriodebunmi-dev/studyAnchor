import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, Sparkles, Bot, WifiOff, Lock, UploadCloud, CheckCircle2, GraduationCap, Users, ClipboardCheck, ArrowRight,
  Compass, FileQuestion, Layers, Camera, ListChecks, MessagesSquare, Trophy, Target, CalendarDays, BarChart3, Library, Upload, FolderKanban, ChevronDown,
} from "lucide-react";
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

// Who it is for. The course rep card is the big one: reps are how a class gets onto Study Anchor.
const AUDIENCES = [
  { icon: GraduationCap, title: "Students", text: "Study from the materials your own course rep uploads for your department, level and semester.", points: ["Courses and materials for your class", "Past questions, quizzes and flashcards", "AI assistant, study rooms and goals"], to: "/signup", cta: "Sign up as a student" },
  { icon: Library, title: "Independent learners", text: "Not at a school on the list? Keep a private library and use every AI study tool.", points: ["Upload PDFs, Word, slides and photos of notes", "Snap a question, flashcards, mock exams", "Join a school later from your profile"], to: "/signup", cta: "Start learning" },
];

// What a course rep does, in order. Step 3 is the part students need to know.
const REP_STEPS = [
  { icon: ClipboardCheck, title: "Apply as a course rep", text: "Choose your school, department, level and session. An admin approves your application." },
  { icon: FolderKanban, title: "Add your courses", text: "Set up the courses for your class for each semester, or let your class rep manage the course list." },
  { icon: Upload, title: "Upload the materials", text: "Add lecture notes, slides and past questions to each course. Students can read, download and quiz themselves on them." },
  { icon: Users, title: "Tell your classmates to sign up as students", text: "They pick the same school, department, level, semester and session as you, and everything you upload shows up for them automatically." },
];

// Everything inside the app, in a little more detail than the headline features.
const INSIDE = [
  { icon: Library, title: "Your courses", text: "Courses for your department, level and session, with your reading progress on each." },
  { icon: Compass, title: "Explore feed", text: "Browse and search materials from other departments." },
  { icon: FileQuestion, title: "Past questions", text: "Practise with questions from earlier sessions." },
  { icon: Camera, title: "Snap a Question", text: "Take a photo of a question and get it explained step by step." },
  { icon: Layers, title: "Flashcards", text: "Generate decks from any material and revise anywhere." },
  { icon: ListChecks, title: "Mock exams", text: "Timed practice exams built from your courses, with marking." },
  { icon: MessagesSquare, title: "Study rooms", text: "Discuss with classmates and take room quizzes together." },
  { icon: Target, title: "Goals & streaks", text: "Set study goals, run the timer and keep your streak alive." },
  { icon: Trophy, title: "Leaderboard", text: "Earn points for studying and see how you rank." },
  { icon: CalendarDays, title: "Calendar", text: "Keep exams, deadlines and study sessions in one place." },
  { icon: BarChart3, title: "Study analytics", text: "See what you've read and where your time goes." },
  { icon: Bot, title: "AI assistant", text: "Ask about a concept or a specific handout in plain language." },
];

const FAQ = [
  { q: "Is Study Anchor free?", a: "You can sign up and start studying for free. Some AI tools may be part of a paid plan, which you can see and manage on the Billing page. Auto-renew is optional and you can switch it off at any time." },
  { q: "How do I see my course materials?", a: "Sign up as a student and choose your school, department, level, semester and session. Your course rep uploads the materials for your class, and they appear on your dashboard." },
  { q: "My course rep hasn't set up our courses yet. What do I do?", a: "Upload your own files to your library and study from them straight away. You can also copy the course rep signup link from your dashboard and send it to your rep." },
  { q: "I'm a course rep. How do my classmates see what I upload?", a: "Ask them to sign up as students and pick the same school, department, level, semester and session as you. Whatever you upload for those courses shows up for them." },
  { q: "My school isn't on the list.", a: "You can add it in under a minute. It works straight away while an admin verifies it." },
  { q: "Can I use it without data?", a: "Install it on your phone. Materials you've already opened stay readable offline." },
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
            <div className="sa-rise mt-8 grid gap-3 sm:grid-cols-2" style={{ animationDelay: "240ms" }}>
              <Link to="/signup" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-night shadow-glow transition hover:brightness-110">
                <GraduationCap className="h-5 w-5" />Sign up as a student
              </Link>
              <Link to="/rep-signup" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-base font-bold text-night shadow-lift transition hover:bg-slate-100">
                <Users className="h-5 w-5" />Sign up as a course rep
              </Link>
            </div>
            <p className="sa-rise mt-4 text-sm text-slate-300" style={{ animationDelay: "300ms" }}>
              Already have an account? <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link>
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

      {/* COURSE REP: the big call to action */}
      <section id="course-reps" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16">
        <div className="overflow-hidden rounded-3xl bg-accent p-6 text-night shadow-glow sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-night/10 px-3 py-1 text-xs font-semibold"><Users className="h-3.5 w-3.5" />For course reps</span>
              <h2 className="mt-4 font-display text-2xl font-extrabold leading-tight sm:text-4xl">Are you a course rep? Put your whole class on Study Anchor.</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed sm:text-base">
                You upload the courses and materials once. Your classmates sign up as students, pick the same school, department, level, semester and session as you, and see everything you upload.
              </p>
              <Link to="/rep-signup" className="mt-7 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-night px-8 py-5 text-lg font-extrabold text-white shadow-lift transition hover:opacity-90 sm:w-fit">
                Sign up as a course rep <ArrowRight className="h-5 w-5" />
              </Link>
              <p className="mt-3 text-xs">An admin approves every course rep, usually within a short time. You'll be notified.</p>
            </div>
            <ol className="grid gap-3">
              {REP_STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="flex gap-3 rounded-2xl bg-white/70 p-4 dark:bg-night/80 dark:text-white">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-night text-white dark:bg-accent dark:text-night"><Icon className="h-5 w-5" /></span>
                  <span>
                    <span className="block font-display text-sm font-bold">{i + 1}. {title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed opacity-80">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-6 text-xs leading-relaxed">
            <strong>Two kinds of rep:</strong> a <em>course rep</em> uploads and manages materials; a <em>class rep</em> manages the list of courses for the class. Choose which one you are when you apply.
          </p>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <h2 className="font-display text-lg font-bold sm:text-xl">Made for the way you study</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {AUDIENCES.map(({ icon: Icon, title, text, points, to, cta }) => (
            <div key={title} className="lv-card flex flex-col p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-primary"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
              <p className="mt-1 text-xs lv-meta sm:text-sm">{text}</p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                {points.map((pt) => <li key={pt} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{pt}</li>)}
              </ul>
              <Link to={to} className="mt-5 w-full sm:w-fit"><Button variant="accent" className="w-full sm:w-auto">{cta}</Button></Link>
            </div>
          ))}
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

      {/* EVERYTHING INSIDE */}
      <section id="inside" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16">
        <h2 className="font-display text-lg font-bold sm:text-xl">Everything inside Study Anchor</h2>
        <p className="mt-2 max-w-xl text-xs lv-meta sm:text-sm">Once you're in, here's what you can use every day.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INSIDE.map(({ icon: Icon, title, text }) => (
            <div key={title} className="lv-card p-4">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/20 text-primary"><Icon className="h-4 w-4" /></span>
              <h3 className="mt-2.5 font-display text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-xs lv-meta">{text}</p>
            </div>
          ))}
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

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-16">
        <h2 className="font-display text-lg font-bold sm:text-xl">Questions people ask</h2>
        <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                {q}<ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed lv-meta">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-3xl bg-night p-8 text-center text-white sm:p-12">
          <h2 className="font-display text-xl font-extrabold sm:text-3xl">Ready to study smarter?</h2>
          <div className="mx-auto mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
            <Link to="/signup" className="flex min-h-14 items-center justify-center rounded-2xl bg-accent px-6 py-4 font-bold text-night hover:brightness-110">Sign up as a student</Link>
            <Link to="/rep-signup" className="flex min-h-14 items-center justify-center rounded-2xl bg-white px-6 py-4 font-bold text-night hover:bg-slate-100">Sign up as a course rep</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm lv-meta">
          <p>© {new Date().getFullYear()} {APP_CONFIG.name}</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/rep-signup" className="hover:text-primary">Course reps</Link>
            <Link to="/developers" className="hover:text-primary">Developers</Link>
            <Link to="/privacy" className="hover:text-primary">Privacy policy</Link>
            <Link to="/login" className="hover:text-primary">Log in</Link>
          </div>
        </div>
      </footer>
    </>
  );
}