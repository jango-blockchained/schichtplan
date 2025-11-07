import type {
  ApplicableShift,
  Employee,
  EmployeeAvailabilityStatus,
} from "@/types/index";
import {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
} from "../../types";
import { api } from "./instance";

export interface AbsenceInfo {
  absence_type_id: string;
  absence_type_name: string;
  absence_type_color: string;
  start_date: string;
  end_date: string;
  note?: string;
}

export interface EmployeeAvailabilityForDate {
  employee_id: number;
  employee_name: string;
  date: string;
  is_available: boolean;
  reason?: string;
  absence_info?: AbsenceInfo;
}

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

export const getEmployees = async (): Promise<Employee[]> => {
  const response = await api.get<Employee[]>("/api/v2/employees/");
  return response.data;
};

export const createEmployee = async (
  data: CreateEmployeeRequest,
): Promise<Employee> => {
  const response = await api.post<Employee>("/api/v2/employees/", data);
  return response.data;
};

export const updateEmployee = async (
  id: number,
  data: UpdateEmployeeRequest,
): Promise<Employee> => {
  const response = await api.put<Employee>(`/api/v2/employees/${id}`, data);
  return response.data;
};

export const deleteEmployee = async (id: number): Promise<void> => {
  await api.delete(`/api/v2/employees/${id}`);
};

export const getEmployeeAvailabilityByDate = async (
  date: string,
): Promise<EmployeeAvailabilityStatus[]> => {
  const response = await api.get<EmployeeAvailabilityStatus[]>(
    "/api/v2/availability/by_date",
    {
      params: { date },
    },
  );
  return response.data;
};

export const getEmployeeAvailabilityByDateRange = async (
  startDate: string,
  endDate: string,
): Promise<Record<string, EmployeeAvailabilityStatus[]>> => {
  const response = await api.get<
    Record<string, EmployeeAvailabilityStatus[]>
  >("/api/v2/availability/date_range", {
    params: { start_date: startDate, end_date: endDate },
  });
  return response.data;
};

export const getApplicableShiftsForEmployee = async (
  date: string,
  employeeId: number,
): Promise<ApplicableShift[]> => {
  const response = await api.get<ApplicableShift[]>(
    "/api/v2/availability/shifts_for_employee",
    {
      params: { date, employee_id: employeeId },
    },
  );
  return response.data;
};

export const getEmployeeAvailabilities = async (
  employeeId: number,
): Promise<EmployeeAvailability[]> => {
  const response = await api.get<EmployeeAvailability[]>(
    `/api/v2/employees/${employeeId}/availability`,
  );
  return response.data;
};

export const createAvailability = async (
  availability: Omit<Availability, "id">,
): Promise<Availability> => {
  const response = await api.post<Availability>(
    `/api/v2/employees/${availability.employee_id}/availability`,
    availability,
  );
  return response.data;
};

export const updateAvailability = async (
  id: number,
  availability: Partial<Availability>,
): Promise<Availability> => {
  const response = await api.put<Availability>(
    `/api/v2/availabilities/${id}`,
    availability,
  );
  return response.data;
};

export const deleteAvailability = async (id: number): Promise<void> => {
  await api.delete(`/api/v2/availabilities/${id}`);
};

export const checkAvailability = async (
  employeeId: number,
  date: string,
  startTime?: string,
  endTime?: string,
): Promise<AvailabilityCheck> => {
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
};

export const updateEmployeeAvailability = async (
  employeeId: number,
  availabilities: Omit<
    EmployeeAvailability,
    "id" | "created_at" | "updated_at"
  >[],
) => {
  const response = await api.put<EmployeeAvailability[]>(
    `/api/v2/employees/${employeeId}/availability`,
    availabilities,
  );
  return response.data;
};

export const checkEmployeeAvailabilityForDate = async (
  employeeId: number,
  date: string,
): Promise<EmployeeAvailabilityForDate> => {
  const response = await api.get<EmployeeAvailabilityForDate>(
    `/api/v2/employees/${employeeId}/availability/date`,
    {
      params: { date },
    },
  );
  return response.data;
};
