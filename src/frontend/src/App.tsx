import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './layouts/MainLayout';
import { SchedulePage } from './pages/SchedulePage';
import { ShiftsPage } from './pages/ShiftsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import SettingsPage from './pages/SettingsPage';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/providers/ThemeProvider';
import FormularsPage from './pages/FormularsPage';
import LogsPage from './pages/LogsPage';
import CoveragePage from './pages/CoveragePage';
import OptionsPage from './pages/OptionsPage';
import LayoutCustomizerPage from './pages/LayoutCustomizerPage';
import { AxiosError } from 'axios';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: unknown) => {
        if (error instanceof AxiosError && error.response?.data?.error) {
          console.error('Mutation Error:', error.response.data.error);
        } else {
          console.error('Mutation Error:', error instanceof Error ? error.message : 'An unknown error occurred');
        }
      }
    }
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
              <Route path="options" element={<OptionsPage />} />
              <Route path="formulars" element={<FormularsPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="layout" element={<LayoutCustomizerPage />} />
            </Route>
          </Routes>
          <Toaster />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
