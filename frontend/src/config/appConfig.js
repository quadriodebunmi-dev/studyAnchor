export const APP_CONFIG = {
  name: "Study Anchor",
  shortName: "SA",
  tagline: "Your course materials, organized.",
  // Shown on the public Developers and Privacy pages. Set VITE_SUPPORT_EMAIL
  // to show a contact address; edit `developers` to change who is credited.
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || "",
  developers: [{ name: "Quadri Odebunmi", role: "Founder & developer" , photo: "https://i.postimg.cc/pTGFmshb/IMG-20260309-WA0016.jpg",   // file in public/team/
  email: "quadriportfolio@gmail.com",
  whatsapp: "2348077128030",
  github: "quadriodebunmidev",
  linkedin: "quadri",}],
  role: "Full-stack developer",

  supportEmail: "quadriportfolio@gmail.com",
supportWhatsapp: "2348077128030",

};

export const DEPARTMENTS = ["Computer Science", "Mathematics", "Accounting", "Mass Communication"];
export const LEVELS = [100, 200, 300, 400,500,600];
export const SEMESTERS = ["First Semester", "Second Semester"];

// Academic sessions are generated as a rolling window (e.g. "2025/2026") so
// the dropdown never goes stale — no need to hardcode a new year every time.
export function getAcademicSessions(count = 6) {
  const now = new Date();
  // Nigerian academic sessions typically start around September.
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const y = startYear + 1 - i; // include the upcoming session first
    sessions.push(`${y}/${y + 1}`);
  }
  return sessions;
}

export const SESSIONS = getAcademicSessions();


