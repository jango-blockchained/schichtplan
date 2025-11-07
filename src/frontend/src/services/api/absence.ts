import type { Absence, SpecialDay } from "@/types/index";
import { api } from "./instance";

export interface VacationValidationResult {
  is_valid: boolean;
  working_days: number;
  closed_days: number;
  total_days: number;
  warnings: string[];
  closed_day_list: Record<
    string,
    {
      description: string;
      reason: string;
      type: string;
      custom_hours?: [string, string];
    }
  >;
  message: string;
}

export interface VacationPeriodSummary {
  period_start: string;
  period_end: string;
  total_days: number;
  working_days_count: number;
  closed_days_count: number;
  working_days: string[];
  closed_days: Record<
    string,
    {
      description: string;
      reason: string;
      type: string;
      custom_hours?: [string, string];
    }
  >;
}

export const getAbsences = async (employeeId?: number): Promise<Absence[]> => {
  // If employeeId is provided, use employee-specific endpoint for backward compatibility
  if (employeeId !== undefined) {
    const response = await api.get<Absence[]>(
      `/api/v2/absences/employees/${employeeId}/absences`,
    );
    return response.data;
  }

  // Otherwise, get all absences
  const response = await api.get<Absence[]>(`/api/v2/absences/`);
  return response.data;
};

export const getAbsencesByRange = async (
  startDate: string,
  endDate: string,
  employeeId?: number,
): Promise<Absence[]> => {
  const response = await api.get<Absence[]>(`/api/v2/absences/`, {
    params: {
      start_date: startDate,
      end_date: endDate,
      employee_id: employeeId,
    },
  });
  return response.data;
};

export const getSpecialDays = async (): Promise<Record<string, SpecialDay>> => {
  const response = await api.get<{
    special_days: Record<string, SpecialDay>;
  }>("/api/v2/settings/special-days/");
  return response.data.special_days || {};
};

export const createAbsence = async (
  data: Omit<Absence, "id">,
): Promise<Absence> => {
  const response = await api.post<Absence>("/api/v2/absences/", data);
  return response.data;
};

export const updateAbsence = async (
  id: number,
  data: Partial<Absence>,
): Promise<Absence> => {
  const response = await api.put<Absence>(`/api/v2/absences/${id}`, data);
  return response.data;
};

export const deleteAbsence = async (id: number): Promise<void> => {
  await api.delete(`/api/v2/absences/${id}`);
};

export const validateVacationDates = async (
  startDate: string,
  endDate: string,
): Promise<VacationValidationResult> => {
  const response = await api.post<VacationValidationResult>(
    "/api/v2/absences/validate",
    {
      start_date: startDate,
      end_date: endDate,
    },
  );
  return response.data;
};

export const getVacationPeriodSummary = async (
  startDate: string,
  endDate: string,
): Promise<VacationPeriodSummary> => {
  const response = await api.post<VacationPeriodSummary>(
    "/api/v2/absences/period-summary",
    {
      start_date: startDate,
      end_date: endDate,
    },
  );
  return response.data;
};
