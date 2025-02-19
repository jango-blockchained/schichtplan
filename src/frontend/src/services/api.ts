import axios, { AxiosError } from 'axios';
import { Employee, Shift, Schedule, StoreConfig, ShiftTemplate, Settings } from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true
});

// Add response interceptor to handle common errors
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        console.error('API Error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });

        // Customize error message based on status
        if (error.response?.status === 404) {
            throw new Error('Die angeforderten Daten wurden nicht gefunden.');
        } else if (error.response?.status === 500) {
            throw new Error('Ein Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        } else if (!error.response) {
            throw new Error('Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.');
        }

        throw error;
    }
);

// Store Configuration
export const getStoreConfig = async () => {
    try {
        const response = await api.get<StoreConfig>('/store/config');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Laden der Filialeinstellungen: ${error.message}`);
        }
        throw error;
    }
};

export const updateStoreConfig = async (config: Partial<StoreConfig>) => {
    try {
        const response = await api.put<StoreConfig>('/store/config', config);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Aktualisieren der Filialeinstellungen: ${error.message}`);
        }
        throw error;
    }
};

export const resetStoreConfig = async () => {
    try {
        const response = await api.post<StoreConfig>('/store/config/reset');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Zurücksetzen der Filialeinstellungen: ${error.message}`);
        }
        throw error;
    }
};

// Employees
export const getEmployees = async (): Promise<Employee[]> => {
    const response = await fetch(`${API_BASE_URL}/employees/`);
    if (!response.ok) {
        throw new Error('Fehler beim Laden der Mitarbeiter');
    }
    return response.json();
};

export const createEmployee = async (data: Omit<Employee, 'id' | 'employee_id'>): Promise<Employee> => {
    const response = await fetch(`${API_BASE_URL}/employees/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Fehler beim Erstellen des Mitarbeiters');
    }
    return response.json();
};

export const updateEmployee = async (id: number, data: Partial<Employee>): Promise<Employee> => {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Fehler beim Aktualisieren des Mitarbeiters');
    }
    return response.json();
};

export const deleteEmployee = async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Fehler beim Löschen des Mitarbeiters');
    }
};

// Shifts
export const getShifts = async () => {
    try {
        const response = await api.get<Shift[]>('/shifts/');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Laden der Schichten: ${error.message}`);
        }
        throw error;
    }
};

export const createShift = async (shift: Omit<Shift, 'id' | 'duration_hours' | 'requires_break'>) => {
    try {
        const response = await api.post<Shift>('/shifts/', shift);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Erstellen der Schicht: ${error.message}`);
        }
        throw error;
    }
};

export const updateShift = async (id: number, shift: Partial<Shift>) => {
    try {
        const response = await api.put<Shift>(`/shifts/${id}/`, shift);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Aktualisieren der Schicht: ${error.message}`);
        }
        throw error;
    }
};

export const deleteShift = async (id: number) => {
    try {
        await api.delete(`/shifts/${id}/`);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Löschen der Schicht: ${error.message}`);
        }
        throw error;
    }
};

export const createDefaultShifts = async () => {
    try {
        const response = await api.post<{ count: number }>('/shifts/defaults/');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Erstellen der Standardschichten: ${error.message}`);
        }
        throw error;
    }
};

// Schedules
export interface ScheduleData {
    id: number;
    date: string;
    employee: {
        id: number;
        name: string;
    };
    shift: {
        id: number;
        type: string;
        start_time: string;
        end_time: string;
    };
    break_start: string | null;
    break_end: string | null;
    notes: string | null;
}

export interface WeeklySchedule {
    employee_id: number;
    name: string;
    position: string;
    contracted_hours: string;
    shifts: Array<{
        day: number;
        start?: string;
        end?: string;
        break?: {
            start: string;
            end: string;
            notes?: string;
        };
    }>;
}

export const getSchedules = async (startDate: string, endDate: string): Promise<ScheduleData[]> => {
    try {
        const response = await api.get<ScheduleData[]>('/schedules/', {
            params: {
                start_date: startDate,
                end_date: endDate,
            },
        });
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch schedules: ${error.message}`);
        }
        throw error;
    }
};

export const generateSchedule = async (startDate: string, endDate: string) => {
    try {
        const response = await api.post<{ message: string; total_shifts: number }>('/schedules/generate/', {
            start_date: startDate,
            end_date: endDate,
        });
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Schedule generation failed: ${error.message}`);
        }
    }
};

export const exportSchedule = async (startDate: string, endDate: string, layoutConfig?: any): Promise<Blob> => {
    try {
        const response = await api.post('/schedules/export/', {
            start_date: startDate,
            end_date: endDate,
            layout_config: layoutConfig
        }, {
            responseType: 'blob'
        });
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to export schedule: ${error.message}`);
        }
        throw error;
    }
};

export const updateBreakNotes = async (employeeId: number, date: string, notes: string): Promise<ScheduleData> => {
    try {
        const response = await api.put<{ message: string; schedule: ScheduleData }>('/schedules/update-break-notes/', {
            employee_id: employeeId,
            date,
            notes
        });
        return response.data.schedule;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update break notes: ${error.message}`);
        }
        throw error;
    }
};

// Shift Templates
export const getShiftTemplates = async () => {
    try {
        const response = await api.get<ShiftTemplate[]>('/shift-templates/');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Laden der Schichtvorlagen: ${error.message}`);
        }
        throw error;
    }
};

export const getShiftTemplate = async (id: number) => {
    try {
        const response = await api.get<ShiftTemplate>(`/shift-templates/${id}/`);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Laden der Schichtvorlage: ${error.message}`);
        }
        throw error;
    }
};

export const createShiftTemplate = async (template: Omit<ShiftTemplate, 'id'>) => {
    try {
        const response = await api.post<ShiftTemplate>('/shift-templates/', template);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Erstellen der Schichtvorlage: ${error.message}`);
        }
        throw error;
    }
};

export const updateShiftTemplate = async (id: number, template: Partial<ShiftTemplate>) => {
    try {
        const response = await api.put<ShiftTemplate>(`/shift-templates/${id}/`, template);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Aktualisieren der Schichtvorlage: ${error.message}`);
        }
        throw error;
    }
};

export const deleteShiftTemplate = async (id: number) => {
    try {
        await api.delete(`/shift-templates/${id}/`);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Löschen der Schichtvorlage: ${error.message}`);
        }
        throw error;
    }
};

export const applyShiftTemplate = async (id: number) => {
    try {
        const response = await api.post<{ message: string; shifts_created: number }>(`/shift-templates/${id}/apply/`);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Fehler beim Anwenden der Schichtvorlage: ${error.message}`);
        }
        throw error;
    }
};

// Settings
export const getSettings = async (): Promise<Settings> => {
    const response = await api.get('/settings');
    return response.data;
};

export const updateSettings = async (data: Partial<Settings>): Promise<Settings> => {
    const response = await api.put('/settings', data);
    return response.data;
};

export const resetSettings = async (): Promise<Settings> => {
    const response = await api.post('/settings/reset');
    return response.data;
};

export const getCategorySettings = async (category: string): Promise<any> => {
    const response = await api.get(`/settings/${category}`);
    return response.data;
};

export const updateCategorySettings = async (category: string, data: any): Promise<any> => {
    const response = await api.put(`/settings/${category}`, data);
    return response.data;
};

export const updateShiftDay = async (employeeId: number, fromDate: string, toDate: string): Promise<void> => {
    try {
        await api.put('/schedules/update-day/', {
            employee_id: employeeId,
            from_date: fromDate,
            to_date: toDate,
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update shift: ${error.message}`);
        }
        throw error;
    }
}; 