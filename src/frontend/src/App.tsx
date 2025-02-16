import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { SnackbarProvider } from 'notistack';
import { theme } from './theme';
import { MainLayout } from './layouts/MainLayout';
import { SchedulePage } from './pages/SchedulePage';
import { ShiftsPage } from './pages/ShiftsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import SettingsPage from './pages/SettingsPage';
import { ShiftTemplatesPage } from './pages/ShiftTemplatesPage';

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
      <ThemeProvider theme={theme}>
        <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
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
          </LocalizationProvider>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
