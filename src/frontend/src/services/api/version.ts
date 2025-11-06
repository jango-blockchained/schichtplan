import { api } from "./instance";

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
  week_identifier?: string | null;
  month_boundary_mode?: string;
  is_week_based?: boolean;
}

export interface VersionResponse {
  versions: VersionMeta[];
}

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

export interface UpdateVersionStatusRequest {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export interface UpdateVersionStatusResponse {
  message: string;
  version: number;
  status: string;
}

export interface DuplicateVersionRequest {
  start_date: string;
  end_date: string;
  source_version: number;
  week_version?: string;
  notes?: string;
}

export interface DuplicateVersionResponse {
  message: string;
  version: number;
  status: string;
  version_meta?: VersionMeta;
}

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

export interface UpdateVersionNotesRequest {
  notes: string;
}

export interface UpdateVersionNotesResponse {
  version: number;
  notes: string;
  message: string;
}

export interface DeleteVersionResponse {
  message: string;
  deleted_schedules_count: number;
}

export const publishSchedule = async (version: number) => {
  const response = await api.post("/api/v2/schedules/publish", { version });
  return response.data;
};

export const archiveSchedule = async (version: number) => {
  const response = await api.post("/api/v2/schedules/archive", { version });
  return response.data;
};

export const getAllVersions = async (
  startDate?: string,
  endDate?: string,
): Promise<VersionResponse> => {
  const response = await api.get<VersionResponse>(
    "/api/v2/schedules/versions",
    {
      params: { start_date: startDate, end_date: endDate },
    },
  );
  return response.data;
};

export const createNewVersion = async (
  data: CreateVersionRequest,
): Promise<CreateVersionResponse> => {
  const response = await api.post<CreateVersionResponse>(
    "/api/v2/schedules/version",
    data,
  );
  return response.data;
};

export const updateVersionStatus = async (
  version: number,
  data: UpdateVersionStatusRequest,
): Promise<UpdateVersionStatusResponse> => {
  const response = await api.put<UpdateVersionStatusResponse>(
    `/api/v2/schedules/version/${version}/status`,
    data,
  );
  return response.data;
};

export const duplicateVersion = async (
  data: DuplicateVersionRequest,
): Promise<DuplicateVersionResponse> => {
  const response = await api.post<DuplicateVersionResponse>(
    "/api/v2/schedules/version/duplicate",
    data,
  );
  return response.data;
};

export const getVersionDetails = async (
  version: number,
): Promise<VersionDetailsResponse> => {
  const response = await api.get<VersionDetailsResponse>(
    `/api/v2/schedules/version/${version}/details`,
  );
  return response.data;
};

/**
 * Compare two schedule versions.
 * @throws {Error} This function is not yet implemented in the backend.
 */
export const compareVersions = async (
  baseVersion: number,
  compareVersion: number,
): Promise<CompareVersionsResponse> => {
  throw new Error(
    `compareVersions is not yet implemented in the backend. Cannot compare versions ${baseVersion} and ${compareVersion}.`,
  );
};

/**
 * Update notes for a schedule version.
 * @throws {Error} This function is not yet implemented in the backend.
 */
export const updateVersionNotes = async (
  version: number,
  data: UpdateVersionNotesRequest,
): Promise<UpdateVersionNotesResponse> => {
  throw new Error(
    `updateVersionNotes is not yet implemented in the backend. Cannot update notes for version ${version}.`,
  );
};

export const deleteVersion = async (
  version: number,
): Promise<DeleteVersionResponse> => {
  const response = await api.delete<DeleteVersionResponse>(
    `/api/v2/schedules/version/${version}`,
  );
  return response.data;
};
