import axios, { AxiosError } from 'axios';
import type { Settings, Employee, Shift, Schedule } from '../types';

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

// Settings
export const getSettings = async (): Promise<Settings> => {
    try {
        const response = await api.get<Settings>('/settings');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch settings: ${error.message}`);
        }
        throw error;
    }
};

export const updateSettings = async (data: Partial<Settings>): Promise<Settings> => {
    try {
        const response = await api.put<Settings>('/settings', data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update settings: ${error.message}`);
        }
        throw error;
    }
};

export const resetSettings = async (): Promise<Settings> => {
    try {
        const response = await api.post<Settings>('/settings/reset');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to reset settings: ${error.message}`);
        }
        throw error;
    }
};

// Employees
export const getEmployees = async (): Promise<Employee[]> => {
    try {
        const response = await api.get<Employee[]>('/employees/');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch employees: ${error.message}`);
        }
        throw error;
    }
};

export const createEmployee = async (data: Omit<Employee, 'id' | 'employee_id'>): Promise<Employee> => {
    try {
        const response = await api.post<Employee>('/employees/', data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to create employee: ${error.message}`);
        }
        throw error;
    }
};

export const updateEmployee = async (id: number, data: Partial<Employee>): Promise<Employee> => {
    try {
        const response = await api.put<Employee>(`/employees/${id}`, data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update employee: ${error.message}`);
        }
        throw error;
    }
};

export const deleteEmployee = async (id: number): Promise<void> => {
    try {
        await api.delete(`/employees/${id}`);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to delete employee: ${error.message}`);
        }
        throw error;
    }
};

// Shifts
export const getShifts = async (): Promise<Shift[]> => {
    try {
        const response = await api.get<Shift[]>('/shifts/');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch shifts: ${error.message}`);
        }
        throw error;
    }
};

export const createShift = async (shift: Omit<Shift, 'id' | 'duration_hours' | 'requires_break'>): Promise<Shift> => {
    try {
        const response = await api.post<Shift>('/shifts/', shift);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to create shift: ${error.message}`);
        }
        throw error;
    }
};

export const updateShift = async (id: number, shift: Partial<Shift>): Promise<Shift> => {
    try {
        const response = await api.put<Shift>(`/shifts/${id}`, shift);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update shift: ${error.message}`);
        }
        throw error;
    }
};

export const deleteShift = async (id: number): Promise<void> => {
    try {
        await api.delete(`/shifts/${id}`);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to delete shift: ${error.message}`);
        }
        throw error;
    }
};

export const createDefaultShifts = async (): Promise<{ count: number }> => {
    try {
        const response = await api.post<{ count: number }>('/shifts/defaults/');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to create default shifts: ${error.message}`);
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
        start_time: string;
        end_time: string;
    };
    break_start: string | null;
    break_end: string | null;
    notes: string | null;
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

export const generateSchedule = async (startDate: string, endDate: string): Promise<{ message: string; total_shifts: number }> => {
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
        throw error;
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