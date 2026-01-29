import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { usePreventDevTools } from "@/hooks/use-prevent-devtools";

// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Announcements = lazy(() => import("./pages/Announcements"));
const FAQs = lazy(() => import("./pages/FAQs"));
const Documents = lazy(() => import("./pages/Documents"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
);

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
            <Route path="/" element={<Index />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/faqs" element={<FAQs />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/forms" element={<AdminDashboard />} />
            <Route path="/admin/announcements" element={<AdminDashboard />} />
            <Route path="/admin/faqs" element={<AdminDashboard />} />
            <Route path="/admin/documents" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
