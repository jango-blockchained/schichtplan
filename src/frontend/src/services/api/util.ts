import { api } from "./instance";

export interface fixShiftDurationsResponse {
  message: string;
  fixed_count: number;
}

export const fixShiftDurations =
  async (): Promise<fixShiftDurationsResponse> => {
    const response = await api.post<fixShiftDurationsResponse>(
      "/api/v2/tools/fix-shift-durations",
    );
    return response.data;
  };
