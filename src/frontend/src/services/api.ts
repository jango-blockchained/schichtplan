import type {
    Absence,
    AiImportResponse,
    ApplicableShift,
    AvailabilityTypeStrings,
    DailyCoverage,
    Employee,
    EmployeeAvailabilityStatus,
    ScheduleError,
    ScheduleUpdate,
    Settings
} from "@/types/index";
import axios, { AxiosError } from "axios";
import { CreateEmployeeRequest, UpdateEmployeeRequest } from "../types";
import { getWeekFromIdentifier } from '../utils/weekUtils';

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
  duration_hours?: number;
  requires_break?: boolean;
  availability_type?: AvailabilityTypeStrings;
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
  diagnostic_logs?: string[];
  session_id?: string;
}

export interface AiGenerationResponse {
  status: string;
  message: string;
  generated_assignments_count: number;
  session_id: string;
  diagnostic_log: string;
  version: number;
  start_date: string;
  end_date: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true,
  timeout: 30000,
  validateStatus: (status) => status >= 200 && status < 300,
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log("Making request to:", config.url);
    return config;
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  },
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    // Log successful responses for debugging
    console.log("Response received from:", response.config?.url, {
      status: response.status,
      headers: response.headers,
      data: response.data,
    });

    // Check if response has data
    if (response.data === undefined || response.data === null) {
      console.warn("Empty response received from:", response.config?.url);
      // Return empty object for GET requests, undefined for others
      return {
        ...response,
        data: response.config?.method?.toLowerCase() === "get" ? {} : undefined,
      };
    }
    return response;
  },
  (error: AxiosError<APIErrorResponse>) => {
    // Get the most specific error message available
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Ein unerwarteter Fehler ist aufgetreten";

    // Log the full error details for debugging
    const errorDetails = {
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
      headers: error.response?.headers,
    };

    console.error("API Error Details:", JSON.stringify(errorDetails, null, 2));

    // Check if it's a network error (no response received)
    if (!error.response) {
      console.error(
        "Network error details:",
        JSON.stringify(
          {
            request: error.request,
            config: error.config,
          },
          null,
          2,
        ),
      );
      throw new Error(
        "Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.",
      );
    }

    // Customize error message based on status and response data
    if (error.response.status === 404) {
      throw new Error("Die angeforderten Daten wurden nicht gefunden.");
    } else if (error.response.status === 500) {
      throw new Error(errorMessage);
    } else if (error.response.status === 308) {
      throw new Error(
        "Redirect error: The API endpoint requires a trailing slash.",
      );
    } else {
      throw new Error(errorMessage);
    }
  },
);

// Settings
export const getSettings = async (): Promise<Settings> => {
  const response = await api.get("/api/v2/settings/");
  return response.data;
};

export const updateSettings = async (
  settings: Partial<Settings>,
): Promise<Settings> => {
  const response = await api.put("/api/v2/settings/", settings);
  return response.data;
};

export const resetSettings = async (): Promise<Settings> => {
  try {
    const response = await api.post<Settings>("/api/v2/settings/reset/");
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
    const response = await api.get<Employee[]>("/api/v2/employees/");
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch employees: ${error.message}`);
    }
    throw error;
  }
};

export const createEmployee = async (
  data: CreateEmployeeRequest,
): Promise<Employee> => {
  try {
    const response = await api.post<Employee>("/api/v2/employees/", data);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create employee: ${error.message}`);
    }
    throw error;
  }
};

export const updateEmployee = async (
  id: number,
  data: UpdateEmployeeRequest,
): Promise<Employee> => {
  try {
    const response = await api.put<Employee>(`/api/v2/employees/${id}`, data);
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
    await api.delete(`/api/v2/employees/${id}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete employee: ${error.message}`);
    }
    throw error;
  }
};

// New function for Employee Availability Status by Date
export const getEmployeeAvailabilityByDate = async (
  date: string,
): Promise<EmployeeAvailabilityStatus[]> => {
  try {
    const response = await api.get<EmployeeAvailabilityStatus[]>(
      "/api/v2/availability/by_date",
      {
        params: { date },
      },
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to fetch employee availability status for date ${date}: ${error.message}`,
      );
    }
    throw error;
  }
};

// New function for Applicable Shifts for Employee
export const getApplicableShiftsForEmployee = async (
  date: string,
  employeeId: number,
): Promise<ApplicableShift[]> => {
  try {
    const response = await api.get<ApplicableShift[]>(
      "/api/v2/availability/shifts_for_employee",
      {
        params: { date, employee_id: employeeId }, // Ensure param name matches backend (employee_id)
      },
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to fetch applicable shifts for employee ${employeeId} on ${date}: ${error.message}`,
      );
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
    const response = await api.get<Shift[]>("/api/v2/shifts/");
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch shifts: ${error.message}`);
    }
    throw error;
  }
};

export const createShift = async (
  data: Omit<Shift, "id" | "duration_hours" | "created_at" | "updated_at">,
): Promise<Shift> => {
  try {
    const response = await api.post<Shift>("/api/v2/shifts/", data);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create shift: ${error.message}`);
    }
    throw error;
  }
};

export const updateShift = async ({
  id,
  ...data
}: Partial<Shift> & { id: number }): Promise<Shift> => {
  try {
    const response = await api.put<Shift>(`/api/v2/shifts/${id}`, data);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update shift: ${error.message}`);
    }
    throw error;
  }
};

export const deleteShift = async (shiftId: number): Promise<void> => {
  try {
    await api.delete(`/api/v2/shifts/${shiftId}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete shift: ${error.message}`);
    }
    throw error;
  }
};

export const createDefaultShifts = async (): Promise<{ count: number }> => {
  try {
    const response = await api.post<{ count: number }>("/api/v2/shifts/defaults/");
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
  includeEmpty: boolean = false,
): Promise<ScheduleResponse> => {
  try {
    const response = await api.get<ScheduleResponse>("/api/v2/schedules/", {
      params: {
        start_date: startDate,
        end_date: endDate,
        version: version,
        include_empty: includeEmpty,
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

export const generateAiSchedule = async (
  startDate: string,
  endDate: string,
  version: number,
  // Add any AI-specific parameters here if needed in the future
): Promise<AiGenerationResponse> => {
  try {
    const response = await api.post<AiGenerationResponse>(
      "/api/v2/schedule/generate-ai",
      { start_date: startDate, end_date: endDate, version_id: version }
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate AI schedule: ${error.message}`);
    }
    throw error;
  }
};

export const generateSchedule = async (
  startDate: string,
  endDate: string,
  createEmptySchedules: boolean = false,
  version: number,
  enableDiagnostics: boolean = false,
): Promise<ScheduleResponse> => {
  try {
    const response = await api.post<ScheduleResponse>(
      "/api/v2/schedules/generate/",
      {
        start_date: startDate,
        end_date: endDate,
        create_empty_schedules: createEmptySchedules,
        version: version,
        enable_diagnostics: enableDiagnostics,
      },
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate schedule: ${error.message}`);
    }
    throw error;
  }
};

export const getScheduleDiagnostics = async (sessionId: string): Promise<{
  status: string;
  session_id: string;
  diagnostic_logs: Array<{
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    timestamp: string;
  }>;
  log_count: number;
}> => {
  try {
    const response = await api.get(`/api/v2/schedules/diagnostics/${sessionId}`);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch diagnostics: ${error.message}`);
    }
    throw error;
  }
};

export const importAiScheduleResponse = async (formData: FormData): Promise<AiImportResponse> => {
  try {
    const response = await api.post<AiImportResponse>(
      "/api/v2/schedule/import-ai-response",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to import AI schedule response: ${error.message}`);
    }
    throw error;
  }
};

export const exportSchedule = async (
  startDate: string,
  endDate: string,
  layoutConfig?: any,
  format?: 'standard' | 'mep' | 'mep-html',
  filiale?: string,
): Promise<Blob> => {
  try {
    const payload: any = { 
      start_date: startDate, 
      end_date: endDate, 
      layout_config: layoutConfig 
    };

    // Add MEP-specific parameters if MEP format is requested
    if (format) {
      payload.format = format;
    }
    if (filiale) {
      payload.filiale = filiale;
    }

    const response = await api.post(
      "/api/v2/schedules/export",
      payload,
      {
        responseType: "blob",
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to export schedule: ${error.message}`);
    }
    throw error;
  }
};

export const updateBreakNotes = async (
  employeeId: number,
  date: string,
  notes: string,
): Promise<ScheduleData> => {
  try {
    const response = await api.put<ScheduleData>(
      `/api/v2/employees/${employeeId}/schedules/notes`,
      { date, notes }
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to update break notes for employee ${employeeId} on ${date}: ${error.message}`
      );
    }
    throw error;
  }
};

export const updateShiftDay = async (
  employeeId: number,
  fromDate: string,
  toDate: string,
): Promise<void> => {
  try {
    await api.put(`/api/v2/employees/${employeeId}/schedules/shift-day`, {
      from_date: fromDate,
      to_date: toDate,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to update shift day for employee ${employeeId} from ${fromDate} to ${toDate}: ${error.message}`
      );
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
  availability_type: "AVAILABLE" | "FIXED" | "PREFERRED" | "UNAVAILABLE";
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

export const getEmployeeAvailabilities = async (
  employeeId: number,
): Promise<EmployeeAvailability[]> => {
  try {
    const response = await api.get<EmployeeAvailability[]>(
      `/api/v2/employees/${employeeId}/availability`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to fetch employee availabilities for employee ${employeeId}: ${error.message}`,
      );
    }
    throw error;
  }
};

export const createAvailability = async (
  availability: Omit<Availability, "id">,
): Promise<Availability> => {
  try {
    const response = await api.post<Availability>(
      `/api/v2/employees/${availability.employee_id}/availability`,
      availability,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create availability: ${error.message}`);
    }
    throw error;
  }
};

export const updateAvailability = async (
  id: number,
  availability: Partial<Availability>,
): Promise<Availability> => {
  try {
    const response = await api.put<Availability>(
      `/api/v2/availabilities/${id}`,
      availability,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to update availability with ID ${id}: ${error.message}`,
      );
    }
    throw error;
  }
};

export const deleteAvailability = async (id: number): Promise<void> => {
  try {
    await api.delete(`/api/v2/availabilities/${id}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to delete availability with ID ${id}: ${error.message}`,
      );
    }
    throw error;
  }
};

export const checkAvailability = async (
  employeeId: number,
  date: string,
  startTime?: string,
  endTime?: string,
): Promise<AvailabilityCheck> => {
  try {
    const response = await api.get<AvailabilityCheck>(
      `/api/v2/employees/${employeeId}/availability/check`,
      {
        params: {
          date,
          start_time: startTime,
          end_time: endTime,
        },
      },
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to check availability for employee ${employeeId} on ${date}: ${error.message}`,
      );
    }
    throw error;
  }
};

export const updateEmployeeAvailability = async (
  employeeId: number,
  availabilities: Omit<
    EmployeeAvailability,
    "id" | "created_at" | "updated_at"
  >[],
) => {
  try {
    const response = await api.put<
      EmployeeAvailability[]
    >(`/api/v2/employees/${employeeId}/availability`, availabilities);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to update employee availabilities for employee ${employeeId}: ${error.message}`,
      );
    }
    throw error;
  }
};

// Absences
// TODO: Update backend API and this frontend function to support fetching absences by date range.
export const getAbsences = async (employeeId?: number): Promise<Absence[]> => {
  try {
    // Check if employeeId is provided
    if (employeeId === undefined) {
      console.warn("getAbsences called without employeeId. Backend currently only supports fetching absences for a specific employee.");
      // Return an empty array or throw an error if fetching all absences is not supported
      return []; // Or throw new Error("Fetching all absences is not supported.");
    }

    // Use the employee-specific endpoint
    const response = await api.get<Absence>(`/api/v2/absences/employees/${employeeId}/absences`);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to fetch absences for employee ${employeeId}: ${error.message}`,
      );
    }
    throw error;
  }
};

export const createAbsence = async (
  data: Omit<Absence, "id">,
): Promise<Absence> => {
  try {
    const response = await api.post<Absence>("/api/v2/absences/", data);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create absence: ${error.message}`);
    }
    throw error;
  }
};

export const deleteAbsence = async (
  id: number,
  employeeId: number,
): Promise<void> => {
  try {
    await api.delete(`/api/v2/absences/${id}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to delete absence with ID ${id}: ${error.message}`,
      );
    }
    throw error;
  }
};

// Database backup and restore
export const backupDatabase = async (): Promise<Blob> => {
  try {
    const response = await api.get("/api/v2/db/backup", {
      responseType: "blob",
    });
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
    formData.append("file", file);
    await api.post("/api/v2/db/restore", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to restore database: ${error.message}`);
    }
    throw error;
  }
};

export const wipeTables = async (tables: string[]): Promise<void> => {
  try {
    await api.post("/api/v2/db/wipe", { tables });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to wipe tables: ${error.message}`);
    }
    throw error;
  }
};

// Corrected endpoint based on backend routes
export const fetchTables = async (): Promise<string[]> => {
  const response = await api.get<{ tables: string[] }>("/api/v2/settings/tables");
  return response.data.tables;
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
    const response = await api.get<LogFile[]>("/api/v2/logs/");
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get logs: ${error.message}`);
    }
    throw error;
  }
};

export const getLogContent = async (filename: string): Promise<LogContent> => {
  try {
    const response = await api.get<LogContent>(`/api/v2/logs/${filename}`);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to get log content for ${filename}: ${error.message}`,
      );
    }
    throw error;
  }
};

export const deleteLog = async (filename: string): Promise<void> => {
  try {
    await api.delete(`/api/v2/logs/${filename}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete log ${filename}: ${error.message}`);
    }
    throw error;
  }
};

export const clearAllLogs = async (): Promise<void> => {
  try {
    await api.delete("/api/v2/logs/");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to clear all logs: ${error.message}`);
    }
    throw error;
  }
};

export const publishSchedule = async (version: number) => {
  try {
    const response = await api.post("/api/v2/schedules/publish", { version });
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to publish schedule version ${version}: ${error.message}`);
    }
    throw error;
  }
};

export const archiveSchedule = async (version: number) => {
  try {
    const response = await api.post("/api/v2/schedules/archive", { version });
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to archive schedule version ${version}: ${error.message}`);
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

export const getAllVersions = async (
  startDate?: string,
  endDate?: string,
): Promise<VersionResponse> => {
  try {
    const response = await api.get<VersionResponse>("/api/v2/schedules/versions", {
      params: { startDate, endDate },
    });
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get all versions: ${error.message}`);
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

export const createNewVersion = async (
  data: CreateVersionRequest,
): Promise<CreateVersionResponse> => {
  try {
    const response = await api.post<CreateVersionResponse>("/api/v2/schedules/version", data);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create new version: ${error.message}`);
    }
    throw error;
  }
};

export interface UpdateVersionStatusRequest {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export interface UpdateVersionStatusResponse {
  message: string;
  version: number;
  status: string;
}

export const updateVersionStatus = async (
  version: number,
  data: UpdateVersionStatusRequest,
): Promise<UpdateVersionStatusResponse> => {
  try {
    const response = await api.put<UpdateVersionStatusResponse>(
      `/api/v2/schedules/versions/${version}/status`,
      data,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to update status for version ${version}: ${error.message}`,
      );
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

export const duplicateVersion = async (
  data: DuplicateVersionRequest,
): Promise<DuplicateVersionResponse> => {
  try {
    const response = await api.post<DuplicateVersionResponse>(
      "/api/v2/schedules/versions/duplicate",
      data,
    );
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

export const getVersionDetails = async (
  version: number,
): Promise<VersionDetailsResponse> => {
  try {
    const response = await api.get<VersionDetailsResponse>(
      `/api/v2/schedules/versions/${version}/details`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to get details for version ${version}: ${error.message}`,
      );
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
      type: "added" | "removed" | "changed" | "unchanged";
    }>;
  };
}

export const compareVersions = async (
  baseVersion: number,
  compareVersion: number,
): Promise<CompareVersionsResponse> => {
  try {
    const response = await api.get<CompareVersionsResponse>(
      `/api/v2/schedules/versions/${baseVersion}/compare/${compareVersion}`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to compare versions ${baseVersion} and ${compareVersion}: ${error.message}`,
      );
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

export const updateVersionNotes = async (
  version: number,
  data: UpdateVersionNotesRequest,
): Promise<UpdateVersionNotesResponse> => {
  try {
    const response = await api.put<UpdateVersionNotesResponse>(
      `/api/v2/schedules/versions/${version}/notes`,
      data,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to update notes for version ${version}: ${error.message}`,
      );
    }
    throw error;
  }
};

export interface fixShiftDurationsResponse {
  message: string;
  fixed_count: number;
}

export const fixShiftDurations = async (): Promise<fixShiftDurationsResponse> => {
  try {
    const response = await api.post<fixShiftDurationsResponse>(
      "/api/v2/tools/fix-shift-durations",
    );
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

export const deleteVersion = async (
  version: number,
): Promise<DeleteVersionResponse> => {
  try {
    const response = await api.delete<DeleteVersionResponse>(
      `/api/v2/schedules/versions/${version}`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete version ${version}: ${error.message}`);
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
  availability_type?: "AVAILABLE" | "FIXED" | "PREFERRED" | "UNAVAILABLE";
}

export const createSchedule = async (data: {
  employee_id: number;
  date: string;
  shift_id: number | null;
  version: number;
  break_duration?: number;
  notes?: string;
  availability_type?: "AVAILABLE" | "FIXED" | "PREFERRED" | "UNAVAILABLE";
}): Promise<Schedule> => {
  try {
    const response = await api.post<Schedule>("/api/v2/schedules/", data);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create schedule: ${error.message}`);
    }
    throw error;
  }
};

export const fixScheduleDisplay = async (
  startDate: string,
  endDate: string,
  version: number,
): Promise<{
  message: string;
  days_fixed: string[];
  empty_schedules_count: number;
  total_schedules: number;
}> => {
  try {
    const response = await api.post(
      "/api/v2/schedules/fix-display",
      { start_date: startDate, end_date: endDate, version: version }
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fix schedule display: ${error.message}`);
    }
    throw error;
  }
};

export const updateSchedule = async (
  id: number,
  data: Partial<ScheduleUpdate>,
): Promise<Schedule> => {
  try {
    // Assuming a PUT endpoint like /api/v2/schedules/{id} exists on the backend
    const response = await api.put<Schedule>(`/api/v2/schedules/${id}`, data);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update schedule ${id}: ${error.message}`);
    }
    throw error;
  }
};

export const generateDemoData = async (
  module: string,
  num_employees: number,
): Promise<void> => {
  try {
    // Assuming a POST endpoint like /api/v2/tools/generate-demo-data
    await api.post("/api/v2/tools/generate-demo-data", { module, num_employees });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to generate demo data for module ${module}: ${error.message}`,
      );
    }
    throw error;
  }
};

export const generateOptimizedDemoData = async (
  num_employees: number,
): Promise<void> => {
  try {
    await api.post("/api/v2/demo-data/optimized", { num_employees });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to generate optimized demo data: ${error.message}`,
      );
    }
    throw error;
  }
};

export const updateCoverage = async (
  coverageData: DailyCoverage[],
): Promise<DailyCoverage[]> => {
  try {
    // Use the bulk update endpoint which accepts POST
    const response = await api.post<DailyCoverage[]>("/api/v2/coverage/bulk", coverageData);
    return response.data as DailyCoverage[];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update coverage: ${error.message}`);
    }
    throw error;
  }
};

export const getAllCoverage = async (): Promise<DailyCoverage[]> => {
  try {
    // Assuming a GET endpoint like /api/v2/coverage/
    const response = await api.get<DailyCoverage[]>("/api/v2/coverage/");
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get all coverage data: ${error.message}`);
    }
    throw error;
  }
};

// Week Version Management API Functions
export interface WeekInfo {
  week_identifier: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  has_version?: boolean;
}

export interface CreateWeekVersionRequest {
  week_identifier: string;
  base_version?: number;
  notes?: string;
  create_empty_schedules?: boolean;
}

export interface CreateWeekVersionResponse {
  version: number;
  created_at: string;
  status: string;
  date_range_start: string;
  date_range_end: string;
  week_identifier: string;
  is_week_based: boolean;
  notes?: string;
}

export const getCurrentWeekInfo = async (): Promise<WeekInfo> => {
  try {
    const response = await api.get<WeekInfo>("/api/weeks/current");
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get current week info: ${error.message}`);
    }
    throw error;
  }
};

export const getWeekInfo = async (weekIdentifier: string): Promise<WeekInfo> => {
  try {
    const response = await api.get<WeekInfo>(`/api/weeks/${weekIdentifier}`);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get week info for ${weekIdentifier}: ${error.message}`);
    }
    throw error;
  }
};

export const getNextWeek = async (weekIdentifier: string): Promise<WeekInfo> => {
  try {
    const response = await api.get<WeekInfo>(`/api/weeks/${weekIdentifier}/next`);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get next week after ${weekIdentifier}: ${error.message}`);
    }
    throw error;
  }
};

export const getPreviousWeek = async (weekIdentifier: string): Promise<WeekInfo> => {
  try {
    const response = await api.get<WeekInfo>(`/api/weeks/${weekIdentifier}/previous`);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get previous week before ${weekIdentifier}: ${error.message}`);
    }
    throw error;
  }
};

export const createWeekVersion = async (
  data: CreateWeekVersionRequest,
): Promise<CreateWeekVersionResponse> => {
  try {
    // Use the existing utility to get week info
    const weekInfo = getWeekFromIdentifier(data.week_identifier);
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const requestData = {
      start_date: formatDate(weekInfo.startDate),
      end_date: formatDate(weekInfo.endDate),
      base_version: data.base_version,
      notes: data.notes,
      create_empty_schedules: data.create_empty_schedules ?? true
    };
    
    const response = await api.post("/api/v2/schedules/version", requestData);
    
    // Transform backend response to match frontend interface
    const backendResponse = response.data;
    return {
      version: backendResponse.version,
      created_at: backendResponse.version_meta?.created_at || new Date().toISOString(),
      status: backendResponse.status_code || backendResponse.status,
      date_range_start: formatDate(weekInfo.startDate),
      date_range_end: formatDate(weekInfo.endDate),
      week_identifier: data.week_identifier,
      is_week_based: true,
      notes: data.notes
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create week version for ${data.week_identifier}: ${error.message}`);
    }
    throw error;
  }
};

export const getWeekVersions = async (weekIdentifier: string): Promise<CreateWeekVersionResponse[]> => {
  try {
    const response = await api.get<CreateWeekVersionResponse[]>(`/api/weeks/${weekIdentifier}/versions`);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get versions for week ${weekIdentifier}: ${error.message}`);
    }
    throw error;
  }
};

export const previewAiData = async (
  startDate: string,
  endDate: string,
): Promise<{
  status: string;
  data_pack: {
    employees: Array<{
      id: number;
      name: string;
      role: string;
      is_keyholder: boolean;
      max_weekly_hours: number;
    }>;
    shifts: Array<{
      id: number;
      start_time: string;
      end_time: string;
      active_days: number[];
      requires_keyholder?: boolean;
    }>;
    coverage_rules: Array<{
      day_index: number;
      time_period: string;
      min_employees: number;
      max_employees: number;
      requires_keyholder: boolean;
    }>;
    schedule_period: {
      start_date: string;
      end_date: string;
      target_weekdays: number[];
    };
    availability: Array<{
      employee_id: number;
      day_index: number;
      fixed_time_range?: string;
      preferred_time_range?: string;
      available_time_range?: string;
    }>;
    absences: Array<{
      employee_id: number;
      start_date: string;
      end_date: string;
      reason: string;
    }>;
  };
  metadata: {
    start_date: string;
    end_date: string;
    optimization_applied: boolean;
    data_structure_version: string;
    total_sections: number;
    estimated_size_reduction: string;
  };
}> => {
  try {
    const response = await api.post(
      "/api/v2/schedule/preview-ai-data",
      { start_date: startDate, end_date: endDate }
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to preview AI data: ${error.message}`);
    }
    throw error;
  }
};

// New function to check employee availability for a specific date
export interface EmployeeAvailabilityForDate {
  employee_id: number;
  employee_name: string;
  date: string;
  is_available: boolean;
  reason?: string;
}

export const checkEmployeeAvailabilityForDate = async (
  employeeId: number,
  date: string,
): Promise<EmployeeAvailabilityForDate> => {
  try {
    const response = await api.get<EmployeeAvailabilityForDate>(
      `/api/v2/availability/employee/${employeeId}/available/${date}`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to check availability for employee ${employeeId} on ${date}: ${error.message}`,
      );
    }
    throw error;
  }
};
