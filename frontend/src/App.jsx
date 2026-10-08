import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/Toast.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { FullPageLoader } from "./components/Loader.jsx";

import LoginPage from "./pages/auth/LoginPage.jsx";
import SignupPage from "./pages/auth/SignupPage.jsx";
import RepSignupPage from "./pages/auth/RepSignupPage.jsx";
import RepPendingPage from "./pages/auth/RepPendingPage.jsx";
import GoogleContinuePage from "./pages/auth/GoogleContinuePage.jsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.jsx";

import StudentDashboard from "./pages/student/StudentDashboard.jsx";
import ExploreFeedPage from "./pages/student/ExploreFeedPage.jsx";
import BookmarksPage from "./pages/student/BookmarksPage.jsx";
import ProfilePage from "./pages/student/ProfilePage.jsx";
import CoursePage from "./pages/student/CoursePage.jsx";
import MaterialDetailPage from "./pages/student/MaterialDetailPage.jsx";
import QuizPage from "./pages/student/QuizPage.jsx";
import StudyAnalyticsPage from "./pages/student/StudyAnalyticsPage.jsx";
import MyUploadsPage from "./pages/student/MyUploadsPage.jsx";

import RepDashboard from "./pages/rep/RepDashboard.jsx";
import RepUploadPage from "./pages/rep/RepUploadPage.jsx";
import RepCoursesPage from "./pages/rep/RepCoursesPage.jsx";
import RepApprovalsPage from "./pages/rep/RepApprovalsPage.jsx";

import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminApprovalsPage from "./pages/admin/AdminApprovalsPage.jsx";
import AdminUsersPage from "./pages/admin/AdminUsersPage.jsx";
import AdminMaterialsPage from "./pages/admin/AdminMaterialsPage.jsx";
import AdminCoursesPage from "./pages/admin/AdminCoursesPage.jsx";
import AdminReportsPage from "./pages/admin/AdminReportsPage.jsx";
import AdminLogPage from "./pages/admin/AdminLogPage.jsx";
import AdminSchoolsPage from "./pages/admin/AdminSchoolsPage.jsx";
import AdminPendingMaterialsPage from "./pages/admin/AdminPendingMaterialsPage.jsx";

import LandingPage from "./pages/public/LandingPage.jsx";
import DevelopersPage from "./pages/public/DevelopersPage.jsx";
import PrivacyPolicyPage from "./pages/public/PrivacyPolicyPage.jsx";
import AssistantPage from "./pages/shared/AssistantPage.jsx";

import NotFoundPage from "./pages/NotFoundPage.jsx";

function RoleHome() {
  const { user } = useAuth();
  if (user.role === "student") return <StudentDashboard />;
  if (user.role === "rep") return <RepDashboard />;
  if (user.role === "admin") return <AdminDashboard />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;

  return (
    <ToastProvider>
      <Routes>
        {/* Public / auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/rep-signup" element={<RepSignupPage />} />
        <Route path="/rep-pending" element={<RepPendingPage />} />
        <Route path="/google-continue" element={<GoogleContinuePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Public marketing pages — no session needed */}
        <Route path="/developers" element={<DevelopersPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />

        {/* Logged-in users land on their role dashboard; visitors see the landing page */}
        <Route path="/" element={user ? <ProtectedRoute><RoleHome /></ProtectedRoute> : <LandingPage />} />

        {/* Student routes */}
        <Route path="/explore" element={<ProtectedRoute roles={["student", "rep"]}><ExploreFeedPage /></ProtectedRoute>} />
        <Route path="/bookmarks" element={<ProtectedRoute roles={["student", "rep"]}><BookmarksPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute roles={["student", "rep"]}><ProfilePage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute roles={["student", "rep"]}><StudyAnalyticsPage /></ProtectedRoute>} />
        <Route path="/my-uploads" element={<ProtectedRoute roles={["student"]}><MyUploadsPage /></ProtectedRoute>} />
        <Route path="/course/:id" element={<ProtectedRoute roles={["student", "rep"]}><CoursePage /></ProtectedRoute>} />
        <Route path="/material/:id" element={<ProtectedRoute roles={["student", "rep"]}><MaterialDetailPage /></ProtectedRoute>} />
        <Route path="/quiz/:id" element={<ProtectedRoute roles={["student", "rep"]}><QuizPage /></ProtectedRoute>} />

        {/* Shared by students and reps */}
        <Route path="/assistant" element={<ProtectedRoute roles={["student", "rep"]}><AssistantPage /></ProtectedRoute>} />

        {/* Course Rep routes */}
        <Route path="/rep/dashboard" element={<ProtectedRoute roles={["rep"]}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/rep/upload" element={<ProtectedRoute roles={["rep"]}><RepUploadPage /></ProtectedRoute>} />
        <Route path="/rep/courses" element={<ProtectedRoute roles={["rep"]}><RepCoursesPage /></ProtectedRoute>} />
        <Route path="/rep/approvals" element={<ProtectedRoute roles={["rep"]}><RepApprovalsPage /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin/approvals" element={<ProtectedRoute roles={["admin"]}><AdminApprovalsPage /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/admin/materials" element={<ProtectedRoute roles={["admin"]}><AdminMaterialsPage /></ProtectedRoute>} />
        <Route path="/admin/pending-materials" element={<ProtectedRoute roles={["admin"]}><AdminPendingMaterialsPage /></ProtectedRoute>} />
        <Route path="/admin/courses" element={<ProtectedRoute roles={["admin"]}><AdminCoursesPage /></ProtectedRoute>} />
        <Route path="/admin/schools" element={<ProtectedRoute roles={["admin"]}><AdminSchoolsPage /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute roles={["admin"]}><AdminReportsPage /></ProtectedRoute>} />
        <Route path="/admin/log" element={<ProtectedRoute roles={["admin"]}><AdminLogPage /></ProtectedRoute>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ToastProvider>
  );
}
