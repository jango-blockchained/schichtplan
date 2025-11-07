import { getWeekFromIdentifier } from "../../utils/weekUtils";
import { api } from "./instance";

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

export interface WeekSegmentsResponse {
  weekIdentifier: string;
  isSplit: boolean;
  segments: Array<{
    segment_id: string;
    segment_number: number;
    total_segments: number;
    start_date: string;
    end_date: string;
    month: string;
    year: number;
    is_first_segment: boolean;
    is_last_segment: boolean;
  }>;
}

export const getCurrentWeekInfo = async (): Promise<WeekInfo> => {
  const response = await api.get<WeekInfo>("/api/weeks/current");
  return response.data;
};

export const getWeekInfo = async (
  weekIdentifier: string,
): Promise<WeekInfo> => {
  const response = await api.get<WeekInfo>(`/api/weeks/${weekIdentifier}`);
  return response.data;
};

export const getNextWeek = async (
  weekIdentifier: string,
): Promise<WeekInfo> => {
  const response = await api.get<WeekInfo>(
    `/api/weeks/${weekIdentifier}/next`,
  );
  return response.data;
};

export const getPreviousWeek = async (
  weekIdentifier: string,
): Promise<WeekInfo> => {
  const response = await api.get<WeekInfo>(
    `/api/weeks/${weekIdentifier}/previous`,
  );
  return response.data;
};

export const getWeekSegments = async (
  weekIdentifier: string,
): Promise<WeekSegmentsResponse> => {
  const response = await api.get<WeekSegmentsResponse>(
    `/api/weeks/${weekIdentifier}/segments`,
  );
  return response.data;
};

export const createWeekVersion = async (
  data: CreateWeekVersionRequest,
): Promise<CreateWeekVersionResponse> => {
  // Use the existing utility to get week info
  const weekInfo = getWeekFromIdentifier(data.week_identifier);

  // Format dates as YYYY-MM-DD
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const requestData = {
    start_date: formatDate(weekInfo.startDate),
    end_date: formatDate(weekInfo.endDate),
    base_version: data.base_version,
    notes: data.notes,
    create_empty_schedules: data.create_empty_schedules ?? true,
  };

  const response = await api.post("/api/v2/schedules/version", requestData);

  // Transform backend response to match frontend interface
  const backendResponse = response.data;
  return {
    version: backendResponse.version,
    created_at:
      backendResponse.version_meta?.created_at || new Date().toISOString(),
    status: backendResponse.status_code || backendResponse.status,
    date_range_start: formatDate(weekInfo.startDate),
    date_range_end: formatDate(weekInfo.endDate),
    week_identifier: data.week_identifier,
    is_week_based: true,
    notes: data.notes,
  };
};

export const getWeekVersions = async (
  weekIdentifier: string,
): Promise<CreateWeekVersionResponse[]> => {
  const response = await api.get<CreateWeekVersionResponse[]>(
    `/api/weeks/${weekIdentifier}/versions`,
  );
  return response.data;
};
