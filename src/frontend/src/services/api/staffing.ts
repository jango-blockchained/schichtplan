/**
 * Staffing plan API functions
 */

import { api } from "./instance";

export interface DailyStaffingStatistic {
  date: string; // ISO date string
  present: number;
  on_vacation: number;
  absent: number;
  total_absent: number;
  total_active: number;
}

export interface StaffingStatisticsResponse {
  total_active_employees: number;
  daily_stats: DailyStaffingStatistic[];
  date_range: {
    start: string;
    end: string;
  };
}

export interface HeatmapDataPoint {
  date: string;
  value: number;
  present: number;
  on_vacation: number;
  absent: number;
}

export interface StaffingHeatmapResponse {
  data: HeatmapDataPoint[];
  metric: string;
  scale: {
    min: number;
    max: number;
  };
  date_range: {
    start: string;
    end: string;
  };
}

export interface EmployeeInfo {
  id: number;
  name: string;
  employee_id: string;
}

export interface StaffingDetailsResponse {
  date: string;
  present: EmployeeInfo[];
  on_vacation: EmployeeInfo[];
  absent: EmployeeInfo[];
  total_active: number;
}

/**
 * Get daily staffing statistics for a date range
 */
export async function getStaffingStatistics(
  startDate: string,
  endDate: string
): Promise<StaffingStatisticsResponse> {
  const response = await api.get("/staffing-plan/statistics", {
    params: {
      start_date: startDate,
      end_date: endDate,
    },
  });
  return response.data.data;
}

/**
 * Get heatmap data for visualization
 */
export async function getStaffingHeatmap(
  startDate: string,
  endDate: string,
  metric: "total_absent" | "on_vacation" | "present" | "absent" = "total_absent"
): Promise<StaffingHeatmapResponse> {
  const response = await api.get("/staffing-plan/heatmap", {
    params: {
      start_date: startDate,
      end_date: endDate,
      metric,
    },
  });
  return response.data.data;
}

/**
 * Get detailed employee absence breakdown for a specific date
 */
export async function getStaffingDetails(
  date: string
): Promise<StaffingDetailsResponse> {
  const response = await api.get(`/staffing-plan/details/${date}`);
  return response.data.data;
}
