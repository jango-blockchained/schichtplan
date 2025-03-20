import axios, { AxiosError } from 'axios';
import type { Settings, Employee, ScheduleError, ScheduleUpdate, DailyCoverage, CoverageTimeSlot } from '@/types/index';
import { CreateEmployeeRequest, UpdateEmployeeRequest } from '../types';
import { Manager, Socket } from 'socket.io-client';

interface APIErrorResponse {
    error?: string;
}

export interface Schedule {
    id: number;
    date: string;
    employee_id: number;
    shift_id: number | null;
    version: number;
    status: string;
    created_at: string;
    updated_at: string;
    break_start?: string | null;
    break_end?: string | null;
    notes?: string | null;
    is_empty?: boolean;
    shift_start?: string | null;
    shift_end?: string | null;
    availability_type?: 'AVL' | 'FIX' | 'PRF' | 'UNV';
    shift_type_id?: string; // EARLY, MIDDLE, LATE
    shift_type_name?: string; // early, middle, late
}

export interface ScheduleResponse {
    schedules: Schedule[];
    versions: number[];
    version_statuses?: Record<number, string>;
    current_version?: number;
    version_meta?: VersionMeta;
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
    withCredentials: true,
    timeout: 30000,
    validateStatus: status => status >= 200 && status < 300
});

// Remove request interceptor for debugging
api.interceptors.request.use(
    (config) => {
        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Simplify response interceptor to remove heavy logging
api.interceptors.response.use(
    (response) => {
        // Check if response has data
        if (response.data === undefined || response.data === null) {
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

        // Check if it's a network error (no response received)
        if (!error.response) {
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
export interface Absence {
    id: number;
    employee_id: number;
    date: string;
    type: string;
    start_time?: string;
    end_time?: string;
}

export const getEmployees = async (): Promise<Employee[]> => {
    try {
        // Get employees
        const employeesResponse = await api.get<Employee[]>('/employees/');
        const employees = employeesResponse.data;

        // Get absences for each employee
        const absencesPromises = employees.map(employee =>
            api.get<Absence[]>(`/employees/${employee.id}/absences`)
                .then(response => response.data)
                .catch(() => [] as Absence[]) // If there's an error fetching absences, return empty array
        );

        const allAbsences = await Promise.all(absencesPromises);

        // Map absences to employees
        return employees.map((employee, index) => {
            const employeeAbsences = allAbsences[index];
            return {
                ...employee,
                has_absence: employeeAbsences.length > 0,
                absences: employeeAbsences
            };
        });
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
    duration_hours: number;
    requires_break: boolean;
    active_days: { [key: string]: boolean };
    created_at?: string;
    updated_at?: string;
    shift_type_id?: string;
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

export const getSchedules = async (
    startDate: string,
    endDate: string,
    version?: number,
    includeEmpty: boolean = false
): Promise<ScheduleResponse> => {
    try {
        const params = new URLSearchParams();
        params.append('start_date', startDate);
        params.append('end_date', endDate);

        if (version !== undefined) {
            params.append('version', version.toString());
        }

        if (includeEmpty) {
            params.append('include_empty', 'true');
        }

        const response = await api.get(`/schedules/?${params.toString()}`);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch schedules: ${error.message}`);
        }
        throw error;
    }
};

export const generateSchedule = async (
    startDate: string,
    endDate: string,
    createEmptySchedules: boolean = false,
    version: number
): Promise<ScheduleResponse> => {
    try {
        const response = await api.post('/schedules/generate/', {
            start_date: startDate,
            end_date: endDate,
            create_empty_schedules: createEmptySchedules,
            version
        });
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to generate schedule: ${error.message}`);
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
    availability_type: 'AVL' | 'FIX' | 'PRF' | 'UNV';
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

interface AvailabilityResponse {
    is_available: boolean;
    availability_type: 'AVAILABLE' | 'FIXED' | 'PREFERRED' | 'UNAVAILABLE';
    reason?: string;
}

export const checkAvailability = async (
    employeeId: number,
    date: string,
    startTime: string,
    endTime: string
): Promise<AvailabilityResponse> => {
    try {
        const response = await api.get<AvailabilityResponse>('/availability/check/', {
            params: {
                employee_id: employeeId,
                date,
                start_time: startTime,
                end_time: endTime
            }
        });
        return {
            is_available: response.data.is_available,
            availability_type: response.data.availability_type || 'UNAVAILABLE',
            reason: response.data.reason
        };
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to check availability: ${error.message}`);
        }
        throw error;
    }
};

export const updateEmployeeAvailability = async (employeeId: number, availabilities: Omit<EmployeeAvailability, 'id' | 'created_at' | 'updated_at'>[]) => {
    try {
        const response = await api.put(`/employees/${employeeId}/availabilities`, availabilities);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update employee availability: ${error.message}`);
        }
        throw error;
    }
};

export const updateSchedule = async (scheduleId: number, update: ScheduleUpdate): Promise<Schedule> => {
    try {
        const url = `/schedules/${scheduleId}/`;
        const response = await api.put(url, update);
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

        const response = await api.post('/coverage/bulk', formattedCoverage);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update coverage: ${error.message}`);
        }
        throw error;
    }
};

// Demo Data
export const generateDemoData = async (): Promise<{ message: string; statistics: any }> => {
    try {
        const response = await api.post('/demo-data/');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to generate demo data: ${error.message}`);
        }
        throw error;
    }
};

export const generateOldDemoData = async (component: string = 'all') => {
    const response = await api.post(`/demo-data/old/?component=${component}`);
    return response.data;
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
export interface AbsenceType {
    id: string;
    name: string;
    color: string;
    type: 'absence';
}

export const getAbsenceTypes = async (): Promise<AbsenceType[]> => {
    try {
        const response = await api.get<Settings>('/settings/');

        // Check if absence_types exist in employee_groups
        if (response.data &&
            response.data.employee_groups &&
            Array.isArray(response.data.employee_groups.absence_types)) {
            return response.data.employee_groups.absence_types;
        }

        // Fallback to empty array with a console warning
        console.warn('No absence types found in settings response');
        return [];
    } catch (error) {
        // Log the error but return a fallback empty array instead of throwing
        console.error('Error fetching absence types:', error);
        return [];
    }
};

export const getAbsences = async (employeeId: number): Promise<Absence[]> => {
    try {
        const response = await api.get<any[]>(`/employees/${employeeId}/absences`);

        // Transform the response to generate individual date entries for each day of absence
        const absences: Absence[] = [];

        response.data.forEach(absenceData => {
            const startDate = new Date(absenceData.start_date);
            const endDate = new Date(absenceData.end_date);

            // For each day between start_date and end_date, create an absence entry
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                absences.push({
                    id: absenceData.id,
                    employee_id: absenceData.employee_id,
                    date: currentDate.toISOString().split('T')[0], // Format: YYYY-MM-DD
                    type: absenceData.absence_type_id,
                    // Include other fields as needed
                });

                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);
            }
        });

        return absences;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch absences: ${error.message}`);
        }
        throw error;
    }
};

export const createAbsence = async (data: Omit<Absence, 'id'>): Promise<Absence> => {
    try {
        const response = await api.post<Absence>(`/employees/${data.employee_id}/absences`, data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to create absence: ${error.message}`);
        }
        throw error;
    }
};

export const deleteAbsence = async (absenceId: number, employeeId: number): Promise<void> => {
    try {
        await api.delete(`/employees/${employeeId}/absences/${absenceId}`);
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
        const response = await api.get('/settings/backup/', { responseType: 'blob' });
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
        await api.post('/settings/restore/', formData, {
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

export const clearLogs = async (): Promise<void> => {
    try {
        await api.post('/api/logs/clear');
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to clear logs: ${error.message}`);
        }
        throw error;
    }
};

export const wipeTables = async (tables: string[]): Promise<void> => {
    try {
        await api.post('/settings/wipe-tables', { tables });
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to wipe tables: ${error.message}`);
        }
        throw error;
    }
};

// Logs
export interface LogFile {
    name: string;
    path: string;
    size: number;
    modified: string;
    preview: string;
}

export interface LogContent {
    name: string;
    content: string;
    size: number;
    modified: string;
}

export const getLogs = async (): Promise<LogFile[]> => {
    try {
        const response = await api.get<{ logs: LogFile[] }>('/api/logs/', {
            params: {
                type: 'all',
                days: 7
            }
        });
        return response.data.logs;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch logs: ${error.message}`);
        }
        throw error;
    }
};

export const getLogContent = async (filename: string): Promise<LogContent> => {
    try {
        const response = await api.get<LogContent>(`/api/logs/${filename}`);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch log content: ${error.message}`);
        }
        throw error;
    }
};

export const deleteLog = async (filename: string): Promise<void> => {
    try {
        await api.delete(`/api/logs/${filename}`);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to delete log: ${error.message}`);
        }
        throw error;
    }
};

export const publishSchedule = async (version: number) => {
    try {
        // We'll use the updateVersionStatus endpoint instead
        const response = await updateVersionStatus(version, { status: 'PUBLISHED' });
        return response;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to publish schedule: ${error.message}`);
        }
        throw error;
    }
};

export const archiveSchedule = async (version: number) => {
    try {
        // We'll use the updateVersionStatus endpoint instead
        const response = await updateVersionStatus(version, { status: 'ARCHIVED' });
        return response;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to archive schedule: ${error.message}`);
        }
        throw error;
    }
};

// Version Management
export interface VersionMeta {
    version: number;
    created_at: string;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
    status: string;
    date_range: {
        start: string;
        end: string;
    };
    base_version: number | null;
    notes: string | null;
}

export interface VersionResponse {
    versions: VersionMeta[];
}

export const getAllVersions = async (startDate?: string, endDate?: string): Promise<VersionResponse> => {
    try {
        const params: Record<string, string> = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;

        const response = await api.get<VersionResponse>('/schedules/versions', {
            params
        });
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch versions: ${error.message}`);
        }
        throw error;
    }
};

export interface CreateVersionRequest {
    start_date: string;
    end_date: string;
    base_version?: number;
    notes?: string;
}

export interface CreateVersionResponse {
    message: string;
    version: number;
    status: string;
    version_meta: VersionMeta;
}

export const createNewVersion = async (data: CreateVersionRequest): Promise<CreateVersionResponse> => {
    try {
        const response = await api.post('/versions/', data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to create new version: ${error.message}`);
        }
        throw error;
    }
};

export interface UpdateVersionStatusRequest {
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export interface UpdateVersionStatusResponse {
    message: string;
    version: number;
    status: string;
}

export const updateVersionStatus = async (version: number, data: UpdateVersionStatusRequest): Promise<UpdateVersionStatusResponse> => {
    try {
        const response = await api.put<UpdateVersionStatusResponse>(`/schedules/version/${version}/status`, data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update version status: ${error.message}`);
        }
        throw error;
    }
};

// Add new version control functions below:

export interface DuplicateVersionRequest {
    start_date: string;
    end_date: string;
    source_version: number;
    notes?: string;
}

export interface DuplicateVersionResponse {
    message: string;
    version: number;
    status: string;
    version_meta?: any;
}

export const duplicateVersion = async (data: DuplicateVersionRequest): Promise<DuplicateVersionResponse> => {
    try {
        const response = await api.post<DuplicateVersionResponse>('/schedules/version/duplicate', data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to duplicate version: ${error.message}`);
        }
        throw error;
    }
};

export interface VersionDetailsResponse {
    version: number;
    status: string;
    created_at: string;
    updated_at?: string;
    date_range: {
        start: string;
        end: string;
    };
    base_version?: number;
    notes?: string;
    schedule_count: number;
    employees_count: number;
    days_count: number;
}

export const getVersionDetails = async (version: number): Promise<VersionDetailsResponse> => {
    try {
        const response = await api.get<VersionDetailsResponse>(`/schedules/version/${version}/details`);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get version details: ${error.message}`);
        }
        throw error;
    }
};

export interface CompareVersionsResponse {
    base_version: number;
    compare_version: number;
    differences: {
        added: number;
        removed: number;
        changed: number;
        unchanged: number;
        details: Array<{
            employee_id: number;
            date: string;
            base_shift_id?: number;
            compare_shift_id?: number;
            type: 'added' | 'removed' | 'changed' | 'unchanged';
        }>;
    };
}

export const compareVersions = async (baseVersion: number, compareVersion: number): Promise<CompareVersionsResponse> => {
    try {
        const response = await api.get<CompareVersionsResponse>(
            `/schedules/versions/compare?base_version=${baseVersion}&compare_version=${compareVersion}`
        );
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to compare versions: ${error.message}`);
        }
        throw error;
    }
};

export interface UpdateVersionNotesRequest {
    notes: string;
}

export interface UpdateVersionNotesResponse {
    version: number;
    notes: string;
    message: string;
}

export const updateVersionNotes = async (version: number, data: UpdateVersionNotesRequest): Promise<UpdateVersionNotesResponse> => {
    try {
        const response = await api.put<UpdateVersionNotesResponse>(`/schedules/version/${version}/notes`, data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update version notes: ${error.message}`);
        }
        throw error;
    }
};

export const fixShiftDurations = async (): Promise<{ message: string; fixed_count: number }> => {
    try {
        const response = await api.post<{ message: string; fixed_count: number }>('/shifts/fix-durations');
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fix shift durations: ${error.message}`);
        }
        throw error;
    }
};

export interface DeleteVersionResponse {
    message: string;
    deleted_schedules_count: number;
}

export const deleteVersion = async (version: number): Promise<DeleteVersionResponse> => {
    try {
        const response = await api.delete<DeleteVersionResponse>(`/schedules/version/${version}`);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to delete version: ${error.message}`);
        }
        throw error;
    }
};

export interface CreateScheduleRequest {
    employee_id: number;
    date: string;
    shift_id: number;
    version: number;
    break_start?: string;
    break_end?: string;
    notes?: string;
    availability_type?: 'AVL' | 'FIX' | 'PRF' | 'UNV';
}

export const createSchedule = async (data: CreateScheduleRequest): Promise<Schedule> => {
    try {
        const response = await api.post('/schedules/', data);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to create schedule: ${error.message}`);
        }
        throw error;
    }
};

export const testGenerateEmployees = async () => {
    const response = await api.post('/demo-data/test/employees/');
    return response.data;
};

export const testGenerateAvailability = async () => {
    const response = await api.post('/demo-data/test/availability/');
    return response.data;
};

export const testGenerateAbsences = async () => {
    const response = await api.post('/demo-data/test/absences/');
    return response.data;
};

export const testGenerateCoverage = async () => {
    const response = await api.post('/demo-data/test/coverage/');
    return response.data;
};

export const testGenerateShiftTemplates = async () => {
    const response = await api.post('/demo-data/test/shift-templates/');
    return response.data;
};

interface BulkAvailabilityCheck {
    employee_id: number;
    shifts: {
        shift_id: number;
        date: string;
        start_time: string;
        end_time: string;
    }[];
}

interface BulkAvailabilityResponse {
    [key: string]: {
        is_available: boolean;
        availability_type: 'AVAILABLE' | 'FIXED' | 'PREFERRED' | 'UNAVAILABLE';
        reason?: string;
    };
}

export const checkBulkAvailability = async (data: BulkAvailabilityCheck): Promise<BulkAvailabilityResponse> => {
    try {
        const response = await api.post('/availability/bulk_check/', data);
        return response.data;
    } catch (error) {
        // Return empty dataset on failure rather than throwing
        if (error instanceof Error) {
            // Create a fallback response with all shifts marked as available
            const fallbackResponse: BulkAvailabilityResponse = {};

            // If data and shifts are available, create a fallback response
            if (data && data.shifts && Array.isArray(data.shifts)) {
                data.shifts.forEach(shift => {
                    const key = `${shift.shift_id}_${shift.date}`;
                    fallbackResponse[key] = {
                        is_available: true,
                        availability_type: 'AVAILABLE',
                        reason: 'Fallback availability due to API error'
                    };
                });
            }

            // Log error message but don't throw
            console.error(`Availability check error: ${error.message}`);

            // Return fallback data
            return fallbackResponse;
        }

        // For unknown errors, return empty object
        return {};
    }
};

// WebSocket event types
export interface WebSocketEvent {
    event_type: string;
    data: unknown;
}

// WebSocket connection
let socket: any = null;

export const initializeWebSocket = () => {
    if (!socket) {
        const manager = new Manager(API_BASE_URL, {
            autoConnect: true,
            transports: ['websocket']
        });
        socket = manager.socket('/');

        if (socket) {
            socket.on('connect', () => {
                // Remove console log
            });

            socket.on('disconnect', () => {
                // Remove console log
            });

            socket.on('error', (error: Error) => {
                console.error('WebSocket error:', error);
            });
        }
    }
    return socket;
};

export const subscribeToEvents = (eventTypes: string[], callback: (eventType: string, data: unknown) => void) => {
    const socket = initializeWebSocket();

    if (socket) {
        eventTypes.forEach(eventType => {
            socket.emit('subscribe', { event_type: eventType });
            socket.on(eventType, (data: unknown) => callback(eventType, data));
        });
    }
};

export const unsubscribeFromEvents = (eventTypes: string[]) => {
    if (socket) {
        eventTypes.forEach(eventType => {
            socket.emit('unsubscribe', { event_type: eventType });
            socket.off(eventType);
        });
    }
};

// Batch operations
export const createBatchSchedules = async (schedules: CreateScheduleRequest[]): Promise<Schedule[]> => {
    try {
        const response = await api.post<{ schedules: Schedule[] }>('/schedules/batch', {
            schedules
        });
        return response.data.schedules;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to create batch schedules: ${error.message}`);
        }
        throw error;
    }
};

export const updateBatchAvailabilities = async (updates: {
    employee_id: number;
    availabilities: Omit<EmployeeAvailability, 'id' | 'created_at' | 'updated_at'>[];
}[]): Promise<EmployeeAvailability[]> => {
    try {
        const response = await api.put<{ availabilities: EmployeeAvailability[] }>('/availability/batch', {
            updates
        });
        return response.data.availabilities;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to update batch availabilities: ${error.message}`);
        }
        throw error;
    }
};

interface BatchAbsenceOperation {
    type: 'create' | 'update' | 'delete';
    data: Partial<Absence> & { id?: number };
}

export const manageBatchAbsences = async (operations: BatchAbsenceOperation[]): Promise<{
    created: Absence[];
    updated: Absence[];
    deleted: number[];
}> => {
    try {
        const response = await api.post('/absences/batch', { operations });
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to manage batch absences: ${error.message}`);
        }
        throw error;
    }
};