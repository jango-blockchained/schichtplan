import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { SchedulePage } from './pages/SchedulePage';
import { ShiftsPage } from './pages/ShiftsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import SettingsPage from './pages/SettingsPage';
import FormularsPage from './pages/FormularsPage';
import LogsPage from './pages/LogsPage';
import CoveragePage from './pages/CoveragePage';
import OptionsPage from './pages/OptionsPage';
import LayoutCustomizerPage from './pages/LayoutCustomizerPage';

const AppRoutes: React.FC = () => {
    return (
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
    );
};

export default AppRoutes; 