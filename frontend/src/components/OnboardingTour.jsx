import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  X, ChevronLeft, ChevronRight, Rocket, LayoutDashboard, Library, UploadCloud, Compass, FileQuestion, Sparkles,
  Camera, Layers, ListChecks, Bot, MessagesSquare, Trophy, Target, CalendarDays, BarChart3, Bookmark,
  UserCircle2, CreditCard, Bell, FolderKanban, ClipboardCheck, Upload, GraduationCap, HelpCircle, Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

// A short animated walk through every section of the app, written for the signed-in
// person's role: school student, independent learner, course rep or class rep.
//  - It opens by itself once, for an account that was just created.
//  - Anyone can open it again from the "?" button in the top bar (showOnboardingTour()).

export const TOUR_EVENT = "sa:show-tour";
export const showOnboardingTour = () => window.dispatchEvent(new Event(TOUR_EVENT));

const seenKey = (u) => `sa-tour-seen:${u._id}`;
const FRESH_MS = 14 * 24 * 3600 * 1000; // only brand-new accounts get it automatically

// Full class names on purpose: Tailwind can't see classes built from pieces.
const TONES = {
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
};

const item = (icon, label, desc, tone) => ({ icon, label, desc, tone });

// ---- slides shared by everyone -------------------------------------------------------
const studySlide = {
  icon: Sparkles, title: "Study smarter with AI", blurb: "Turn your own notes and materials into practice.",
  items: [
    item(Camera, "Snap a Question", "Take a photo of a question and get it explained step by step.", "sky"),
    item(Layers, "Flashcards", "Generate decks from any material and revise them anywhere.", "violet"),
    item(ListChecks, "Mock Exams", "Timed practice exams built from your courses, with marking.", "amber"),
    item(Bot, "AI Assistant", "Ask questions about your materials in plain language.", "emerald"),
  ],
};
const communitySlide = {
  icon: MessagesSquare, title: "Learn together", blurb: "Study is easier with other people.",
  items: [
    item(MessagesSquare, "Rooms", "Join or create discussion rooms and take quizzes together.", "emerald"),
    item(Trophy, "Leaderboard", "Earn points for studying and see how you rank.", "indigo"),
    item(Bell, "Notifications", "Get told about new materials, reminders and replies.", "rose"),
  ],
  footer: "Tip: the green WhatsApp button on every page takes you to the Study Anchor group.",
};
const trackSlide = (withAnalytics) => ({
  icon: Target, title: "Stay on track", blurb: "Small daily habits add up.",
  items: [
    item(Target, "Goals", "Set study goals, run the timer and keep your streak alive.", "rose"),
    item(CalendarDays, "Calendar", "Keep exams, deadlines and study sessions in one place.", "sky"),
    ...(withAnalytics ? [item(BarChart3, "Study Analytics", "See what you've read and where your time goes.", "violet")] : []),
    item(Bookmark, "Bookmarks", "Save materials to come back to.", "amber"),
  ],
});
const accountSlide = (extra) => ({
  icon: UserCircle2, title: "Your account", blurb: "Everything about you lives here.",
  items: [
    item(UserCircle2, "Profile", extra || "Update your details, picture and privacy choices.", "indigo"),
    item(CreditCard, "Plans & billing", "See your plan, and switch auto-renew on or off.", "emerald"),
    item(HelpCircle, "This overview", "Tap the ? at the top any time to see it again.", "amber"),
  ],
  last: true,
});

const welcome = (title, blurb) => ({ icon: Rocket, title, blurb, items: [], hero: true });

// ---- per-role walkthroughs ---------------------------------------------------------------
function slidesFor(user) {
  if (!user || user.role === "admin") return [];

  if (user.role === "rep") {
    const isClass = user.repType === "class";
    return [
      welcome("Welcome, course rep!", isClass ? "You keep your class's course list in order. Here's the whole app in a minute." : "You keep your class stocked with materials. Here's the whole app in a minute."),
      isClass
        ? { icon: FolderKanban, title: "Manage your courses", blurb: "Set up the courses your class sees.", items: [
            item(LayoutDashboard, "Dashboard", "Your home base as a class rep.", "sky"),
            item(FolderKanban, "Manage Courses", "Add and edit the courses for your department, level and session.", "violet"),
          ] }
        : { icon: Upload, title: "Upload for your class", blurb: "Everything students see starts with you.", items: [
            item(LayoutDashboard, "My Uploads", "Everything you've uploaded, in one list.", "sky"),
            item(Upload, "Upload Material", "Add notes, slides and past questions to each course.", "violet"),
            item(ClipboardCheck, "Student Approvals", "Approve uploaded slides from the students.", "amber"),
            item(FolderKanban, "My Courses", "Add your courses first before uploading any slides", "emerald"),
          ] },
      { icon: Users, title: "Bring your class in", blurb: "Students see what you upload once they join the same class.", items: [
        item(GraduationCap, "Students sign up as students", "Tell your classmates to create a normal student account.", "sky"),
        item(FolderKanban, "They pick the same class details", "The same school, department, level, semester and session as you.", "violet"),
        item(UploadCloud, "They see what you upload", "Every course and material you add appears on their dashboard.", "emerald"),
      ], footer: "Tip: if they have no courses yet, their dashboard has a button that copies the course rep signup link for them." },
      { icon: GraduationCap, title: "Study like a student", blurb: "You get every student feature too.", items: [
        item(GraduationCap, "Student Dashboard", "See your courses the way your classmates do.", "sky"),
        item(Compass, "Explore Feed", "Browse materials from other departments.", "violet"),
        item(FileQuestion, "Past Questions", "Practise with questions from earlier sessions.", "amber"),
      ] },
      studySlide, communitySlide, trackSlide(true), accountSlide(),
    ];
  }

  if (user.learnerType === "independent") {
    return [
      welcome("Welcome to Study Anchor!", "No school needed. Here's everything you can do, in a minute."),
      { icon: Library, title: "Your private library", blurb: "Your files stay yours.", items: [
        item(Library, "My Library", "Your home page: every file you've added, in folders.", "sky"),
        item(UploadCloud, "Upload", "Add PDFs, Word and PowerPoint files, spreadsheets or photos of notes.", "violet"),
        item(FileQuestion, "Past Questions", "Practise with questions from earlier sessions.", "amber"),
      ] },
      studySlide, communitySlide, trackSlide(false),
      accountSlide("Update your details, or join a school later to see its courses."),
    ];
  }

  return [
    welcome("Welcome to Study Anchor!", "Your courses, materials and study tools in one place. Here's a quick tour."),
    { icon: LayoutDashboard, title: "Your courses & library", blurb: "Start here every day.", items: [
      item(LayoutDashboard, "Dashboard", "Your department's courses, set up by your course rep.", "sky"),
      item(Library, "My Library", "A private place for your own files and notes.", "violet"),
      item(UploadCloud, "My Uploads", "Add a file to your library in a few taps.", "emerald"),
    ] },
    { icon: Compass, title: "Explore & revise", blurb: "Find more to read.", items: [
      item(Compass, "Explore Feed", "Browse materials from other departments.", "violet"),
      item(FileQuestion, "Past Questions", "Practise with questions from earlier sessions.", "amber"),
    ] },
    studySlide, communitySlide, trackSlide(true), accountSlide(),
  ];
}

const STYLES = `
@keyframes sa-tour-item { from { opacity: 0; transform: translateX(calc(var(--sa-dir, 1) * 28px)); } to { opacity: 1; transform: none; } }
@keyframes sa-tour-pop { 0% { opacity: 0; transform: scale(.4) rotate(-12deg); } 70% { transform: scale(1.12) rotate(3deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
@keyframes sa-tour-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes sa-tour-drift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(10px, -8px) scale(1.15); } }
@keyframes sa-tour-text { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.sa-tour-item { animation: sa-tour-item 460ms cubic-bezier(.22,1,.36,1) both; }
.sa-tour-pop { animation: sa-tour-pop 560ms cubic-bezier(.22,1,.36,1) both; }
.sa-tour-float { animation: sa-tour-float 3s ease-in-out 600ms infinite; }
.sa-tour-drift { animation: sa-tour-drift 5s ease-in-out infinite; }
.sa-tour-text { animation: sa-tour-text 380ms ease-out both; }
@media (prefers-reduced-motion: reduce) { .sa-tour-item, .sa-tour-pop, .sa-tour-float, .sa-tour-drift, .sa-tour-text { animation: none !important; } }
`;

export default function OnboardingTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const slides = useMemo(() => slidesFor(user), [user?._id, user?.role, user?.learnerType, user?.repType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Right after sign-up: open once, for an account that has never seen it.
  useEffect(() => {
    if (!user || user.role === "admin") return;
    try {
      if (localStorage.getItem(seenKey(user))) return;
      const age = Date.now() - new Date(user.createdAt).getTime();
      if (Number.isFinite(age) && age < FRESH_MS) { setStep(0); setDir(1); setOpen(true); }
    } catch { /* storage blocked: skip the automatic tour, the ? button still works */ }
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Show the overview again" button.
  useEffect(() => {
    const on = () => { setStep(0); setDir(1); setOpen(true); };
    window.addEventListener(TOUR_EVENT, on);
    return () => window.removeEventListener(TOUR_EVENT, on);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try { if (user) localStorage.setItem(seenKey(user), "1"); } catch { /* ignore */ }
  }, [user]);

  const go = useCallback((to) => {
    const next = Math.min(Math.max(to, 0), slides.length - 1);
    setDir(next >= step ? 1 : -1);
    setStep(next);
  }, [step, slides.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(step + 1);
      else if (e.key === "ArrowLeft") go(step - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, go, step]);

  if (!open || slides.length === 0) return null;
  const slide = slides[Math.min(step, slides.length - 1)];
  const Icon = slide.icon;
  const isLast = step === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-night/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={close}>
      <style>{STYLES}</style>
      <div
        role="dialog" aria-modal="true" aria-label="App overview" onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        className="flex max-h-[92vh] w-full animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-lift dark:border-slate-800 dark:bg-slate-900 sm:max-w-md sm:animate-rise-in sm:rounded-3xl"
      >
        {/* Progress */}
        <div className="h-1 w-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${((step + 1) / slides.length) * 100}%` }} />
        </div>

        {/* Animated header: key={step} restarts the animations on every slide. */}
        <div key={`hero-${step}`} className={`relative shrink-0 overflow-hidden bg-primary text-primary-fg ${slide.hero ? "px-6 py-9" : "px-6 py-6"}`}>
          <span aria-hidden="true" className="sa-tour-drift absolute -left-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
          <span aria-hidden="true" className="sa-tour-drift absolute -bottom-8 right-6 h-20 w-20 rounded-full bg-white/10" style={{ animationDelay: "1.4s" }} />
          <span aria-hidden="true" className="sa-tour-drift absolute right-16 top-3 h-3 w-3 rounded-full bg-accent" style={{ animationDelay: "0.7s" }} />
          <button onClick={close} aria-label="Close overview" className="absolute right-3 top-3 rounded-full p-1.5 text-primary-fg/80 hover:bg-white/15">
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-center gap-4">
            <span className="sa-tour-pop shrink-0">
              <span className="sa-tour-float grid h-16 w-16 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <Icon className="h-8 w-8" />
              </span>
            </span>
            <div className="min-w-0" style={{ "--sa-dir": dir }}>
              <p className="sa-tour-text text-[11px] font-semibold uppercase tracking-wide text-primary-fg/70" style={{ animationDelay: "80ms" }}>
                {step + 1} of {slides.length}
              </p>
              <h2 className="sa-tour-text font-display text-xl font-bold leading-tight" style={{ animationDelay: "140ms" }}>{slide.title}</h2>
            </div>
          </div>
          <p className="sa-tour-text relative mt-3 text-sm text-primary-fg/85" style={{ animationDelay: "220ms" }}>{slide.blurb}</p>
        </div>

        {/* Sections on this slide, sliding in one after another */}
        <div key={`body-${step}`} className="min-h-[7rem] flex-1 overflow-y-auto px-4 py-4" style={{ "--sa-dir": dir }}>
          {slide.items.length === 0 ? (
            <p className="sa-tour-text px-2 py-2 text-sm lv-meta" style={{ animationDelay: "300ms" }}>
              Tap Next to see where everything is. You can skip at any time, and bring this back with the <HelpCircle className="inline h-3.5 w-3.5 align-[-2px]" /> button at the top.
            </p>
          ) : (
            <ul className="space-y-2">
              {slide.items.map((it, i) => {
                const ItemIcon = it.icon;
                return (
                  <li key={it.label} className="sa-tour-item flex items-start gap-3 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800" style={{ animationDelay: `${260 + i * 120}ms` }}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${TONES[it.tone]}`}><ItemIcon className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-night dark:text-slate-100">{it.label}</span>
                      <span className="block text-xs leading-snug lv-meta">{it.desc}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {slide.footer && <p className="sa-tour-text mt-3 rounded-xl bg-accent/15 px-3 py-2 text-xs" style={{ animationDelay: `${260 + slide.items.length * 120}ms` }}>{slide.footer}</p>}
        </div>

        {/* Controls */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Overview steps">
            {slides.map((_, i) => (
              <button
                key={i} role="tab" aria-selected={i === step} aria-label={`Go to step ${i + 1}`} onClick={() => go(i)}
                className={`h-2 rounded-full transition-all ${i === step ? "w-5 bg-primary" : "w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => go(step - 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-night hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                <ChevronLeft className="h-4 w-4" />Back
              </button>
            )}
            {!isLast && step === 0 && (
              <button onClick={close} className="min-h-9 rounded-lg px-3 text-sm font-medium lv-meta hover:bg-slate-100 dark:hover:bg-slate-800">Skip</button>
            )}
            <button
              onClick={() => (isLast ? close() : go(step + 1))}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-dark"
            >
              {isLast ? "Get started" : "Next"}{!isLast && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
