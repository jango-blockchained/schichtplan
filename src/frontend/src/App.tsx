import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { FloatingSuggestionsPanel } from "./components/ai/FloatingSuggestionsPanel";
import { AIContextProvider } from "./contexts/AIContext";
import { MainLayout } from "./layouts/MainLayout";
import AbsencesPage from "./pages/AbsencesPage";
import AIDashboardPage from "./pages/AIDashboardPage";
import CalendarPage from "./pages/CalendarPage";
import CoveragePage from "./pages/CoveragePage";
import { DesignSystemDemo } from "./pages/DesignSystemDemo";
import { EmployeesPage } from "./pages/EmployeesPage";
import FormularsPage from "./pages/FormularsPage";
import LogsPage from "./pages/LogsPage";
import OverviewPage from "./pages/OverviewPage";
import PDFLayoutCustomizerPage from "./pages/PDFLayoutCustomizerPage";
import { SchedulePage } from "./pages/SchedulePage";
import { ShiftsPage } from "./pages/ShiftsPage";
import UnifiedSettingsPage from "./pages/UnifiedSettingsPage";
import VersionsPage from "./pages/VersionsPage";

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

const App: React.FC = () => {
  return (
    <div>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <AIContextProvider>
              <Routes>
                <Route path="/" element={<MainLayout />}>
                  <Route index element={<SchedulePage />} />
                  <Route path="overview" element={<OverviewPage />} />
                  <Route path="versions" element={<VersionsPage />} />
                  <Route path="absences" element={<AbsencesPage />} />
                  <Route path="shifts" element={<ShiftsPage />} />
                  <Route path="coverage" element={<CoveragePage />} />
                  <Route path="employees" element={<EmployeesPage />} />
                  <Route path="settings" element={<UnifiedSettingsPage />} />
                  <Route path="formulars" element={<FormularsPage />} />
                  <Route path="logs" element={<LogsPage />} />
                  <Route path="pdf-layout" element={<PDFLayoutCustomizerPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="ai" element={<AIDashboardPage />} />
                  <Route path="design-system" element={<DesignSystemDemo />} />
                </Route>
              </Routes>
              <FloatingSuggestionsPanel />
              <Toaster />
            </AIContextProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </div>
  );
};

export default App;
