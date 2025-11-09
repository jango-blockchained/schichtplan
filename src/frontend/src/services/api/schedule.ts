import type {
    AiImportResponse,
    Schedule,
    ScheduleResponse,
    ScheduleUpdate,
} from "@/types/index";
import type { PDFLayoutConfig } from "@/types/pdf";
import { api } from "./instance";

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

export const getSchedules = async (
  startDate: string,
  endDate: string,
  version?: number,
  includeEmpty: boolean = false,
): Promise<ScheduleResponse> => {
  const response = await api.get<ScheduleResponse>("/api/v2/schedules/", {
    params: {
      start_date: startDate,
      end_date: endDate,
      version: version,
      include_empty: includeEmpty,
    },
  });
  return response.data;
};

// Named export alias for compatibility in pages that import it explicitly
export { getSchedules as fetchSchedules };

export const generateAiSchedule = async (
  startDate: string,
  endDate: string,
  version: number,
): Promise<AiGenerationResponse> => {
  const response = await api.post<AiGenerationResponse>(
    "/api/v2/schedule/generate-ai",
    { start_date: startDate, end_date: endDate, version_id: version },
  );
  return response.data;
};

export const generateSchedule = async (
  startDate: string,
  endDate: string,
  createEmptySchedules: boolean = false,
  version: number,
  enableDiagnostics: boolean = false,
  options?: {
    keepExistingAssignments?: boolean;
    usePhase1FixedAssignments?: boolean;
    usePhase2PreferredAvailability?: boolean;
    usePhase3StandardGeneration?: boolean;
    phaseMode?:
      | "fixed_assignments"
      | "preferred_availability"
      | "standard_generation"
      | "finalize";
  },
): Promise<ScheduleResponse> => {
  const response = await api.post<ScheduleResponse>(
    "/api/v2/schedules/generate/",
    {
      start_date: startDate,
      end_date: endDate,
      create_empty_schedules: createEmptySchedules,
      version: version,
      enable_diagnostics: enableDiagnostics,
      generation_options: options || {},
    },
  );
  return response.data;
};

export const getScheduleDiagnostics = async (
  sessionId: string,
): Promise<{
  status: string;
  session_id: string;
  diagnostic_logs: Array<{
    type: "info" | "warning" | "error" | "success";
    message: string;
    timestamp: string;
  }>;
  log_count: number;
}> => {
  const response = await api.get(
    `/api/v2/schedules/diagnostics/${sessionId}`,
  );
  return response.data;
};

export const importAiScheduleResponse = async (
  formData: FormData,
): Promise<AiImportResponse> => {
  const response = await api.post<AiImportResponse>(
    "/api/v2/schedule/import-ai-response",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data;
};

export const exportSchedule = async (
  startDate: string,
  endDate: string,
  layoutConfig?: PDFLayoutConfig,
  format?: "standard" | "mep" | "mep-html",
  filiale?: string,
): Promise<Blob> => {
  const payload: {
    start_date: string;
    end_date: string;
    layout_config?: PDFLayoutConfig;
    format?: "standard" | "mep" | "mep-html";
    filiale?: string;
  } = {
    start_date: startDate,
    end_date: endDate,
    layout_config: layoutConfig,
  };

  // Add MEP-specific parameters if MEP format is requested
  if (format) {
    payload.format = format;
  }
  if (filiale) {
    payload.filiale = filiale;
  }

  const response = await api.post("/api/v2/schedules/export", payload, {
    responseType: "blob",
  });
  return response.data;
};

export const updateBreakNotes = async (
  employeeId: number,
  date: string,
  notes: string,
): Promise<ScheduleData> => {
  const response = await api.put<ScheduleData>(
    `/api/v2/employees/${employeeId}/schedules/notes`,
    { date, notes },
  );
  return response.data;
};

export const updateShiftDay = async (
  employeeId: number,
  fromDate: string,
  toDate: string,
): Promise<void> => {
  await api.put(`/api/v2/employees/${employeeId}/schedules/shift-day`, {
    from_date: fromDate,
    to_date: toDate,
  });
};

export const createSchedule = async (data: {
  employee_id: number;
  date: string;
  shift_id: number | null;
  version: number;
  break_duration?: number;
  notes?: string;
  availability_type?: "AVAILABLE" | "FIXED" | "PREFERRED" | "UNAVAILABLE";
}): Promise<Schedule> => {
  const response = await api.post<Schedule>("/api/v2/schedules/", data);
  return response.data;
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
  const response = await api.post("/api/v2/schedules/fix-display", {
    start_date: startDate,
    end_date: endDate,
    version: version,
  });
  return response.data;
};

export const updateSchedule = async (
  id: number,
  data: Partial<ScheduleUpdate>,
): Promise<Schedule> => {
  const response = await api.put<Schedule>(`/api/v2/schedules/${id}`, data);
  return response.data;
};

export const generateDemoData = async (
  module: string,
  num_employees: number,
): Promise<void> => {
  await api.post("/api/v2/demo-data", { module, num_employees });
};

export const generateOptimizedDemoData = async (
  num_employees: number,
): Promise<void> => {
  await api.post("/api/v2/demo-data/optimized", { num_employees });
};

export interface PairedKeyholderShift {
  schedule_id?: number;
  date: string;
  shift_type: "opening" | "closing";
  shift_start: string | null;
  shift_end: string | null;
  employee_id?: number;
  employee_name?: string;
  missing?: boolean;
}

export const getPairedKeyholderShift = async (data: {
  date: string;
  version: number;
  shift_start: string;
  shift_end: string;
}): Promise<PairedKeyholderShift | null> => {
  try {
    const response = await api.post<{
      status: string;
      paired_shift: PairedKeyholderShift | null;
      message?: string;
    }>("/api/v2/schedules/keyholder/paired-shift", data);
    
    if (response.data.status === "success") {
      return response.data.paired_shift;
    }
    return null;
  } catch (error) {
    console.error("Error fetching paired keyholder shift:", error);
    return null;
  }
};
