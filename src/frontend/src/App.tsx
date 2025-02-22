import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './layouts/MainLayout';
import { SchedulePage } from './pages/SchedulePage';
import ShiftsPage from './pages/ShiftsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import SettingsPage from './pages/SettingsPage';
import { Toaster } from '@/components/ui/toaster';
import PDFSettings from '@/pages/PDFSettings';
import { ThemeProvider } from '@/providers/ThemeProvider';
import FormularsPage from './pages/FormularsPage';
import LogsPage from './pages/LogsPage';
import CoveragePage from './pages/CoveragePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<SchedulePage />} />
              <Route path="shifts" element={<ShiftsPage />} />
              <Route path="coverage" element={<CoveragePage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="formulars" element={<FormularsPage />} />
              <Route path="logs" element={<LogsPage />} />
            </Route>
            <Route path="/pdf-settings" element={<PDFSettings />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
