import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { usePreventDevTools } from "@/hooks/use-prevent-devtools";
import ProtectedStudentRoute from "@/components/ProtectedStudentRoute";

// Lazy load all pages for code splitting
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const ExamPage = lazy(() => import("./pages/Exam"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const RecruitersManagement = lazy(() => import("./pages/admin/RecruitersManagement"));
const CompanyOutreachManagement = lazy(() => import("./pages/admin/CompanyOutreachManagement"));

const queryClient = new QueryClient();

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
);

const ExamLaunchRoute = () => {
  const [searchParams] = useSearchParams();
  return searchParams.get("standalone") === "1"
    ? <ProtectedStudentRoute><ExamPage /></ProtectedStudentRoute>
    : <Navigate to="/" replace />;
};

const App = () => {
  usePreventDevTools();

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<ProtectedStudentRoute><StudentDashboard /></ProtectedStudentRoute>} />
            <Route path="/exam" element={<ExamLaunchRoute />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/announcements" element={<AdminDashboard />} />
            <Route path="/admin/tools" element={<AdminDashboard />} />
            <Route path="/admin/faqs" element={<AdminDashboard />} />
            <Route path="/admin/resources" element={<AdminDashboard />} />
            <Route path="/admin/exams" element={<AdminDashboard />} />
            <Route path="/admin/slots-availability" element={<AdminDashboard />} />
            <Route path="/admin/evaluators" element={<AdminDashboard />} />
            <Route path="/admin/review" element={<AdminDashboard />} />
            <Route path="/admin/database" element={<AdminDashboard />} />
            <Route path="/admin/reports" element={<AdminDashboard />} />
            <Route path="/admin/activity-points-form" element={<AdminDashboard />} />
            <Route path="/admin/team" element={<AdminDashboard />} />
            <Route path="/admin/chatbot-knowledge" element={<AdminDashboard />} />
            <Route path="/admin/recruiters" element={<RecruitersManagement />} />
            <Route path="/admin/company-outreach" element={<CompanyOutreachManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
