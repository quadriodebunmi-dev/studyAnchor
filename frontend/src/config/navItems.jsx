import React from "react";
import {
  LayoutDashboard, Compass, Bookmark, BarChart3, UploadCloud, UserCircle2,
  Upload, FolderKanban, ClipboardCheck, Bot, GraduationCap,
} from "lucide-react";

const icon = (Icon) => <Icon className="w-4 h-4" />;

// Shared study features that students AND reps can use.
const explore = { to: "/explore", label: "Explore Feed", icon: icon(Compass) };
const assistant = { to: "/assistant", label: "AI Assistant", icon: icon(Bot) };
const bookmarks = { to: "/bookmarks", label: "Bookmarks", icon: icon(Bookmark) };
const analytics = { to: "/analytics", label: "Study Analytics", icon: icon(BarChart3) };
// The same feed/search/download-all page students land on, reached from its
// own nav item so a Course or Class Rep can browse materials as a student would.
const studentDashboard = { to: "/rep/dashboard", label: "Student Dashboard", icon: icon(GraduationCap) };
const profile = { to: "/profile", label: "Profile", icon: icon(UserCircle2) };

export const studentNavItems = [
  { to: "/", label: "Dashboard", icon: icon(LayoutDashboard), end: true },
  explore,
  assistant,
  { to: "/my-uploads", label: "My Uploads", icon: icon(UploadCloud) },
  bookmarks,
  analytics,
  profile,
];

// Course Reps manage materials; Class Reps manage the course list. Both also
// get the student study features (explore, AI assistant, bookmarks, analytics).
// `pendingCount` badges the student-approvals tab.
export function repNavItemsFor(user, pendingCount = 0) {
  if (user?.repType === "class") {
    return [
      { to: "/", label: "Dashboard", icon: icon(LayoutDashboard), end: true },
      { to: "/rep/courses", label: "Manage Courses", icon: icon(FolderKanban) },
      studentDashboard, explore, assistant, bookmarks, analytics, profile,
    ];
  }
  return [
    { to: "/", label: "My Uploads", icon: icon(LayoutDashboard), end: true },
    { to: "/rep/upload", label: "Upload Material", icon: icon(Upload) },
    explore,
     studentDashboard,
    { to: "/rep/approvals", label: "Student Approvals", icon: icon(ClipboardCheck), badge: pendingCount },
    { to: "/rep/courses", label: "My Courses", icon: icon(FolderKanban) },
    assistant, bookmarks, analytics, profile,
  ];
}

export function navItemsFor(user, pendingCount = 0) {
  if (user?.role === "rep") return repNavItemsFor(user, pendingCount);
  if (user?.role === "student") return studentNavItems;
  return null;
}
