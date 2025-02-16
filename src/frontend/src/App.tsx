import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { MainLayout } from './layouts/MainLayout';
import { SchedulePage } from './pages/SchedulePage';
import ShiftsPage from './pages/ShiftsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import SettingsPage from './pages/SettingsPage';
import ShiftTemplatesPage from './pages/ShiftTemplatesPage';

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
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<SchedulePage />} />
              <Route path="shifts" element={<ShiftsPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="shift-templates" element={<ShiftTemplatesPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SnackbarProvider>
    </QueryClientProvider>
  );
};

export default App;
