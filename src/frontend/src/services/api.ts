import axios, { AxiosError } from 'axios';
import type { Settings, Employee, Schedule, ScheduleResponse, ScheduleUpdate, DailyCoverage, CoverageTimeSlot } from '@/types/index';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
    const response = await api.get('/settings');
    return response.data;
};

export const updateSettings = async (settings: Partial<Settings>): Promise<Settings> => {
    const response = await api.put('/settings', settings);
    return response.data;
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
export interface Shift {
    id: number;
    start_time: string;
    end_time: string;
    min_employees: number;
    max_employees: number;
    duration_hours: number;
    requires_break: boolean;
    active_days: { [key: string]: boolean };
    created_at?: string;
    updated_at?: string;
}

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

export const createShift = async (data: Omit<Shift, 'id' | 'duration_hours' | 'created_at' | 'updated_at'>): Promise<Shift> => {
    const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create shift');
    }

    return response.json();
};

export const updateShift = async ({ id, ...data }: Partial<Shift> & { id: number }): Promise<Shift> => {
    const response = await fetch(`/api/shifts/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update shift');
    }

    return response.json();
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

export const getSchedules = async (startDate: string, endDate: string, version?: number): Promise<ScheduleResponse> => {
    try {
        const params = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
        });
        if (version !== undefined) {
            params.append('version', version.toString());
        }
        const response = await api.get<ScheduleResponse>(`/schedules/?${params}`);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch schedules: ${error.message}`);
        }
        throw error;
    }
};

export const generateSchedule = async (startDate: string, endDate: string): Promise<ScheduleResponse> => {
    try {
        const response = await api.post<ScheduleResponse>('/schedules/generate/', {
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
        const response = await api.post('/schedules/export', {
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

export interface TimeSlot {
    day: number;
    start: string;
    end: string;
}

export interface Availability {
    id?: number;
    employee_id: number;
    start_date: string;
    end_date: string;
    start_time?: string;
    end_time?: string;
    availability_type: 'unavailable' | 'preferred_off' | 'preferred_work' | 'available';
    reason?: string;
    is_recurring: boolean;
    recurrence_day?: number;
}

export interface AvailabilityCheck {
    is_available: boolean;
    reason?: string;
}

// Availability endpoints
export interface EmployeeAvailability {
    id?: number;
    employee_id: number;
    day_of_week: number;
    hour: number;
    is_available: boolean;
    availability_type: string;
    created_at?: string;
    updated_at?: string;
}

export const getEmployeeAvailabilities = async (employeeId: number): Promise<EmployeeAvailability[]> => {
    const response = await api.get<EmployeeAvailability[]>(`/employees/${employeeId}/availabilities`);
    return response.data;
};

export const createAvailability = async (availability: Omit<Availability, 'id'>): Promise<Availability> => {
    const response = await api.post<Availability>('/availability', availability);
    return response.data;
};

export const updateAvailability = async (id: number, availability: Partial<Availability>): Promise<Availability> => {
    const response = await api.put<Availability>(`/availability/${id}`, availability);
    return response.data;
};

export const deleteAvailability = async (id: number): Promise<void> => {
    await api.delete(`/availability/${id}`);
};

export const checkAvailability = async (
    employeeId: number,
    date: string,
    startTime?: string,
    endTime?: string
): Promise<AvailabilityCheck> => {
    const response = await api.post<AvailabilityCheck>('/availability/check', {
        employee_id: employeeId,
        date,
        start_time: startTime,
        end_time: endTime,
    });
    return response.data;
};

export const updateEmployeeAvailability = async (employeeId: number, availabilities: Omit<EmployeeAvailability, 'id' | 'created_at' | 'updated_at'>[]) => {
    const response = await api.put(`/employees/${employeeId}/availabilities`, availabilities);
    return response.data;
};

export const updateSchedule = async (scheduleId: number, update: ScheduleUpdate): Promise<Schedule> => {
    try {
        const response = await api.put<Schedule>(`/schedules/${scheduleId}/`, update);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update schedule: ${error.message}`);
        }
        throw error;
    }
};

// Coverage
export const getAllCoverage = async (): Promise<DailyCoverage[]> => {
    try {
        const response = await api.get<DailyCoverage[]>('/coverage/');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch coverage: ${error.message}`);
        }
        throw error;
    }
};

export const getCoverageByDay = async (dayIndex: number): Promise<DailyCoverage> => {
    try {
        const response = await api.get<DailyCoverage>(`/coverage/${dayIndex}`);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch coverage for day ${dayIndex}: ${error.message}`);
        }
        throw error;
    }
};

export const updateCoverage = async (coverage: DailyCoverage[]): Promise<void> => {
    try {
        // Ensure each coverage object has the required fields
        const formattedCoverage = coverage.map(day => ({
            dayIndex: day.dayIndex,
            timeSlots: day.timeSlots.map(slot => ({
                startTime: slot.startTime,
                endTime: slot.endTime,
                minEmployees: slot.minEmployees,
                maxEmployees: slot.maxEmployees,
                employeeTypes: (slot as CoverageTimeSlot).employeeTypes || []
            }))
        }));

        console.log('Sending coverage data:', formattedCoverage);
        const response = await api.post('/coverage/bulk', formattedCoverage);
        console.log('Coverage update response:', response.data);
    } catch (error) {
        console.error('Error updating coverage:', error);
        if (error instanceof Error) {
            throw new Error(`Failed to update coverage: ${error.message}`);
        }
        throw error;
    }
};

// Demo Data
export const generateDemoData = async (module: string): Promise<void | Settings> => {
    try {
        const response = await api.post('/demo_data/', { module });

        // If generating settings data, update the settings in the store
        if (module === 'settings' || module === 'all') {
            const settings = await getSettings();
            return settings;
        }

        return;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to generate demo data: ${error.message}`);
        }
        throw error;
    }
};