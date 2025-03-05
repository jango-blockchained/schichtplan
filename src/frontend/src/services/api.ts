import axios, { AxiosError } from 'axios';
import type { Settings, Employee, Schedule, ScheduleError, ScheduleUpdate, DailyCoverage, CoverageTimeSlot } from '@/types/index';
import { CreateEmployeeRequest, UpdateEmployeeRequest } from '../types';

interface APIErrorResponse {
    error?: string;
}

export interface ScheduleResponse {
    schedules: Schedule[];
    versions: number[];
    errors?: ScheduleError[];
    version?: number;
    total_shifts?: number;
    filled_shifts_count?: number;
    total_schedules?: number;
    filtered_schedules?: number;
    logs?: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    withCredentials: false,
    timeout: 10000,
    validateStatus: status => status >= 200 && status < 300
});

// Add request interceptor for debugging
api.interceptors.request.use(
    (config) => {
        console.log('Making request to:', config.url);
        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
    (response) => {
        // Log successful responses for debugging
        console.log('Response received from:', response.config?.url, {
            status: response.status,
            headers: response.headers,
            data: response.data
        });

        // Check if response has data
        if (response.data === undefined || response.data === null) {
            console.warn('Empty response received from:', response.config?.url);
            // Return empty object for GET requests, undefined for others
            return {
                ...response,
                data: response.config?.method?.toLowerCase() === 'get' ? {} : undefined
            };
        }
        return response;
    },
    (error: AxiosError<APIErrorResponse>) => {
        // Get the most specific error message available
        const errorMessage = error.response?.data?.error
            || error.message
            || 'Ein unerwarteter Fehler ist aufgetreten';

        // Log the full error details for debugging
        const errorDetails = {
            message: errorMessage,
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url,
            method: error.config?.method,
            headers: error.response?.headers
        };

        console.error('API Error Details:', JSON.stringify(errorDetails, null, 2));

        // Check if it's a network error (no response received)
        if (!error.response) {
            console.error('Network error details:', JSON.stringify({
                request: error.request,
                config: error.config
            }, null, 2));
            throw new Error('Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.');
        }

        // Customize error message based on status and response data
        if (error.response.status === 404) {
            throw new Error('Die angeforderten Daten wurden nicht gefunden.');
        } else if (error.response.status === 500) {
            throw new Error(errorMessage);
        } else if (error.response.status === 308) {
            throw new Error('Redirect error: The API endpoint requires a trailing slash.');
        } else {
            throw new Error(errorMessage);
        }
    }
);

// Settings
export const getSettings = async (): Promise<Settings> => {
    const response = await api.get('/settings/');
    return response.data;
};

export const updateSettings = async (settings: Partial<Settings>): Promise<Settings> => {
    const response = await api.put('/settings/', settings);
    return response.data;
};

export const resetSettings = async (): Promise<Settings> => {
    try {
        const response = await api.post<Settings>('/settings/reset/');
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

export const createEmployee = async (data: CreateEmployeeRequest): Promise<Employee> => {
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

export const updateEmployee = async (id: number, data: UpdateEmployeeRequest): Promise<Employee> => {
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
    try {
        const response = await api.post<Shift>('/shifts/', data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to create shift: ${error.message}`);
        }
        throw error;
    }
};

export const updateShift = async ({ id, ...data }: Partial<Shift> & { id: number }): Promise<Shift> => {
    try {
        const response = await api.put<Shift>(`/shifts/${id}/`, data);
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

export const getSchedules = async (startDate: string, endDate: string, version?: number, includeEmpty: boolean = false): Promise<ScheduleResponse> => {
    try {
        const params = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
            include_empty: includeEmpty.toString()
        });
        if (version !== undefined) {
            params.append('version', version.toString());
        }
        const response = await api.get<ScheduleResponse>(`/schedules/?${params}`);
        return response.data;
    } catch (error) {
        if (error instanceof AxiosError) {
            const errorMessage = error.response?.data?.error || error.message;
            throw new Error(`Failed to fetch schedules: ${errorMessage}`);
        }
        throw new Error(`Failed to fetch schedules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

export const generateSchedule = async (
    startDate: string,
    endDate: string,
    createEmptySchedules: boolean = false
): Promise<ScheduleResponse> => {
    try {
        const response = await api.post<ScheduleResponse>('/schedules/generate/', {
            start_date: startDate,
            end_date: endDate,
            create_empty_schedules: createEmptySchedules,
        });

        // If we have logs in the response, log them to console for debugging
        if (response.data.logs) {
            console.log('Schedule generation logs:', response.data.logs);
        }

        return response.data;
    } catch (error) {
        if (error instanceof AxiosError && error.response?.data?.logs) {
            console.error('Schedule generation logs:', error.response.data.logs);
        }
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
    availability_type: 'AVL' | 'FIX' | 'PRM' | 'UNV';
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

// Store Config
export interface StoreConfig {
    settings: Settings;
    version: string;
}

export const getStoreConfig = async (): Promise<StoreConfig> => {
    try {
        const response = await api.get<StoreConfig>('/store/config');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch store config: ${error.message}`);
        }
        throw error;
    }
};

export const updateStoreConfig = async (config: Partial<StoreConfig>): Promise<StoreConfig> => {
    try {
        const response = await api.put<StoreConfig>('/store/config', config);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update store config: ${error.message}`);
        }
        throw error;
    }
};

export async function resetStoreConfig(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE_URL}/store/config/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to reset store config: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error resetting store config:', error);
        throw error;
    }
}

// Absences
export interface Absence {
    id: number;
    employee_id: number;
    absence_type_id: string;
    start_date: string;
    end_date: string;
    note?: string;
}

export const getAbsences = async (employeeId: number): Promise<Absence[]> => {
    try {
        const response = await api.get<Absence[]>(`/employees/${employeeId}/absences/`);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch absences: ${error.message}`);
        }
        throw error;
    }
};

export const createAbsence = async (data: Omit<Absence, 'id'>): Promise<Absence> => {
    try {
        const response = await api.post<Absence>('/absences/', data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to create absence: ${error.message}`);
        }
        throw error;
    }
};

export const deleteAbsence = async (id: number): Promise<void> => {
    try {
        await api.delete(`/absences/${id}`);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to delete absence: ${error.message}`);
        }
        throw error;
    }
};

// Database backup and restore
export const backupDatabase = async (): Promise<Blob> => {
    try {
        const response = await api.get('/settings/backup', { responseType: 'blob' });
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to backup database: ${error.message}`);
        }
        throw error;
    }
};

export const restoreDatabase = async (file: File): Promise<void> => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        await api.post('/settings/restore', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to restore database: ${error.message}`);
        }
        throw error;
    }
};