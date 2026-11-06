import React from "react";
import {
  LayoutDashboard, Compass, Bookmark, BarChart3, UploadCloud, UserCircle2,
  Upload, FolderKanban, ClipboardCheck, Bot, GraduationCap, MessagesSquare, Sparkles, Library, Target, Trophy,
  FileQuestion, CalendarDays,
} from "lucide-react";

const icon = (Icon) => <Icon className="w-4 h-4" />;

// Shared study features that students AND reps can use.
const explore = { to: "/explore", label: "Explore Feed", short: "Explore", icon: icon(Compass), tab: true };
const assistant = { to: "/assistant", label: "AI Assistant", icon: icon(Bot) };
const rooms = { to: "/rooms", label: "Rooms", icon: icon(MessagesSquare), tab: true };
const studyTools = { to: "/study", label: "Study Tools", short: "Study", icon: icon(Sparkles), tab: true };
const pastQuestions = { to: "/past-questions", label: "Past Questions", short: "Past Qs", icon: icon(FileQuestion) };
const calendar = { to: "/calendar", label: "Calendar", icon: icon(CalendarDays) };
const goals = { to: "/goals", label: "Goals", icon: icon(Target) };
const points = { to: "/points", label: "Leaderboard", icon: icon(Trophy) };
const bookmarks = { to: "/bookmarks", label: "Bookmarks", icon: icon(Bookmark) };
const analytics = { to: "/analytics", label: "Study Analytics", icon: icon(BarChart3) };
// The same feed/search/download-all page students land on, reached from its
// own nav item so a Course or Class Rep can browse materials as a student would.
const studentDashboard = { to: "/rep/dashboard", label: "Student Dashboard", icon: icon(GraduationCap) };
const profile = { to: "/profile", label: "Profile", icon: icon(UserCircle2) };

export const studentNavItems = [
  { to: "/", label: "Dashboard", short: "Home", icon: icon(LayoutDashboard), end: true, tab: true },
  { to: "/library", label: "My Library", icon: icon(Library) },
  explore,
  pastQuestions,
  calendar,
  rooms,
  studyTools,
  goals,
  points,
  assistant,
  { to: "/my-uploads", label: "My Uploads", icon: icon(UploadCloud) },
  bookmarks,
  analytics,
  profile,
];

// Independent learners: no school, so no Explore feed or course analytics —
// a private library, the study tools and rooms.
export const independentNavItems = [
  { to: "/", label: "My Library", short: "Library", icon: icon(Library), end: true, tab: true },
  { to: "/my-uploads", label: "Upload", icon: icon(UploadCloud), tab: true },
  pastQuestions,
  calendar,
  studyTools,
  goals,
  points,
  rooms,
  assistant,
  bookmarks,
  profile,
];

// Course Reps manage materials; Class Reps manage the course list. Both also
// get the student study features (explore, AI assistant, bookmarks, analytics).
// `pendingCount` badges the student-approvals tab.
export function repNavItemsFor(user, pendingCount = 0) {
  if (user?.repType === "class") {
    return [
      { to: "/", label: "Dashboard", short: "Home", icon: icon(LayoutDashboard), end: true, tab: true },
      { to: "/rep/courses", label: "Manage Courses", short: "Courses", icon: icon(FolderKanban), tab: true },
      studentDashboard, explore, pastQuestions, calendar, rooms, studyTools, goals, points, assistant, bookmarks, analytics, profile,
    ];
  }
  return [
    { to: "/", label: "My Uploads", short: "Uploads", icon: icon(LayoutDashboard), end: true, tab: true },
    { to: "/rep/upload", label: "Upload Material", short: "Upload", icon: icon(Upload), tab: true },
    explore,
     studentDashboard,
    { to: "/rep/approvals", label: "Student Approvals", short: "Approvals", icon: icon(ClipboardCheck), badge: pendingCount, tab: true },
    { to: "/rep/courses", label: "My Courses", icon: icon(FolderKanban) },
    pastQuestions, calendar,
    rooms, studyTools, goals, points, assistant, bookmarks, analytics, profile,
  ];
}

export function navItemsFor(user, pendingCount = 0) {
  if (user?.role === "rep") return repNavItemsFor(user, pendingCount);
  if (user?.role === "student") return user.learnerType === "independent" ? independentNavItems : studentNavItems;
  return null;
}
