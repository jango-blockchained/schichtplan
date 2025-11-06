import type { CoverageProfile, DailyCoverage } from "@/types/index";
import { api } from "./instance";

export const updateCoverage = async (
  coverageData: DailyCoverage[],
): Promise<DailyCoverage[]> => {
  const response = await api.post<DailyCoverage[]>(
    "/api/v2/coverage/bulk",
    coverageData,
  );
  return response.data as DailyCoverage[];
};

export const getAllCoverage = async (): Promise<DailyCoverage[]> => {
  const response = await api.get<DailyCoverage[]>("/api/v2/coverage/");
  return response.data;
};

export const getAllCoverageProfiles = async (): Promise<
  CoverageProfile[]
> => {
  const response = await api.get<CoverageProfile[]>(
    "/api/v2/coverage-profiles/",
  );
  return response.data;
};

export const getDefaultCoverageProfile = async (): Promise<
  CoverageProfile | null
> => {
  try {
    const response = await api.get<CoverageProfile>(
      "/api/v2/coverage-profiles/default",
    );
    return response.data;
  } catch (error) {
    // It's ok if there's no default profile yet
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
};

export const getCoverageProfile = async (
  profileId: number,
): Promise<CoverageProfile> => {
  const response = await api.get<CoverageProfile>(
    `/api/v2/coverage-profiles/${profileId}`,
  );
  return response.data;
};

export const createCoverageProfile = async (data: {
  name: string;
  description?: string;
  coverageData: DailyCoverage[];
  isDefault?: boolean;
}): Promise<CoverageProfile> => {
  const response = await api.post<CoverageProfile>(
    "/api/v2/coverage-profiles/",
    data,
  );
  return response.data;
};

export const updateCoverageProfile = async (
  profileId: number,
  data: Partial<{
    name: string;
    description: string;
    coverageData: DailyCoverage[];
    isDefault: boolean;
  }>,
): Promise<CoverageProfile> => {
  const response = await api.put<CoverageProfile>(
    `/api/v2/coverage-profiles/${profileId}`,
    data,
  );
  return response.data;
};

export const setDefaultCoverageProfile = async (
  profileId: number,
): Promise<CoverageProfile> => {
  const response = await api.post<CoverageProfile>(
    `/api/v2/coverage-profiles/${profileId}/set-default`,
  );
  return response.data;
};

export const copyCoverageProfile = async (
  profileId: number,
  newName: string,
  newDescription?: string,
): Promise<CoverageProfile> => {
  const response = await api.post<CoverageProfile>(
    `/api/v2/coverage-profiles/${profileId}/copy`,
    {
      name: newName,
      description: newDescription,
    },
  );
  return response.data;
};

export const deleteCoverageProfile = async (
  profileId: number,
): Promise<void> => {
  await api.delete(`/api/v2/coverage-profiles/${profileId}`);
};
