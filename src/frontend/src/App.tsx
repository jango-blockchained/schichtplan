import { Toaster } from "@/components/ui/toaster";
import { AIDialogProvider } from "@/contexts/AIDialogContext";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import React, { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AIContextProvider } from "./contexts/AIContext";
import { MainLayout } from "./layouts/MainLayout";
import AbsencesPage from "./pages/AbsencesPage";
import AIDashboardPage from "./pages/AIDashboardPage";
import CoveragePage from "./pages/CoveragePage";
import { DesignSystemDemo } from "./pages/DesignSystemDemo";
import { EmployeesPage } from "./pages/EmployeesPage";
import FormularsPage from "./pages/FormularsPage";
import GanttViewPage from "./pages/GanttViewPage";
import LogsPage from "./pages/LogsPage";
import OverviewPage from "./pages/OverviewPage";
import PDFLayoutCustomizerPage from "./pages/PDFLayoutCustomizerPage";
import { SchedulePage } from "./pages/SchedulePage";
import { ShiftsPage } from "./pages/ShiftsPage";
import UnifiedSettingsPage from "./pages/UnifiedSettingsPage";
import VacationPlanningPage from "./pages/VacationPlanningPage";
import VersionsPage from "./pages/VersionsPage";
import { SetupWizard } from "./pages/SetupWizard";
import { LoginPage } from "./pages/LoginPage";
import { checkSetupStatus, type SetupStatus } from "./services/setupService";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: unknown) => {
        if (error instanceof AxiosError && error.response?.data?.error) {
          console.error("Mutation Error:", error.response.data.error);
        } else {
          console.error(
            "Mutation Error:",
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
          );
        }
      },
    },
  },
});

// Component to check setup status and redirect
const SetupGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if in E2E test mode
    const isE2ETestMode = localStorage.getItem('E2E_TEST_MODE') === 'true';
    
    if (isE2ETestMode) {
      // Skip setup check in E2E test mode
      setSetupStatus({ needs_setup: false, is_configured: true });
      setLoading(false);
      return;
    }
    
    checkSetupStatus()
      .then(status => {
        setSetupStatus(status);
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to check setup status:', error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If setup is needed, redirect to setup wizard
  if (setupStatus?.needs_setup) {
    return <Navigate to="/setup" replace />;
  }

  // Check if user is authenticated (has token) or in E2E test mode
  const hasToken = !!localStorage.getItem('auth_token');
  const isE2ETestMode = localStorage.getItem('E2E_TEST_MODE') === 'true';
  
  if (!hasToken && !isE2ETestMode) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log to console in development
        console.error("Application Error:", error, errorInfo);
        // TODO: Send to error reporting service in production
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <AIContextProvider>
              <AIDialogProvider>
                <Routes>
                  {/* Public routes */}
                  <Route path="/setup" element={<SetupWizard />} />
                  <Route path="/login" element={<LoginPage />} />
                  
                  {/* Protected routes */}
                  <Route path="/" element={
                    <SetupGuard>
                      <MainLayout />
                    </SetupGuard>
                  }>
                    <Route index element={<SchedulePage />} />
                    <Route path="overview" element={<OverviewPage />} />
                    <Route path="versions" element={<VersionsPage />} />
                    <Route path="absences" element={<AbsencesPage />} />
                    <Route path="vacation" element={<VacationPlanningPage />} />
                    <Route path="shifts" element={<ShiftsPage />} />
                    <Route path="coverage" element={<CoveragePage />} />
                    <Route path="employees" element={<EmployeesPage />} />
                    <Route path="settings" element={<UnifiedSettingsPage />} />
                    <Route path="formulars" element={<FormularsPage />} />
                    <Route path="logs" element={<LogsPage />} />
                    <Route
                      path="pdf-layout"
                      element={<PDFLayoutCustomizerPage />}
                    />
                    <Route path="ai" element={<AIDashboardPage />} />
                    <Route path="gantt" element={<GanttViewPage />} />
                    <Route path="design-system" element={<DesignSystemDemo />} />
                  </Route>
                </Routes>
                <Toaster />
              </AIDialogProvider>
            </AIContextProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
