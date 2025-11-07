import type { Settings } from "@/types/index";
import { api } from "./instance";

export const getSettings = async (): Promise<Settings> => {
  // In tests we may provide a global `api` spy to avoid network calls
  const g: any = globalThis as any;
  if (g.api && typeof g.api.getSettings === "function") {
    return await g.api.getSettings();
  }

  const response = await api.get("/api/v2/settings/");
  return response.data;
};

export const updateSettings = async (
  settings: Partial<Settings>,
): Promise<Settings> => {
  const g: any = globalThis as any;
  if (g.api && typeof g.api.updateSettings === "function") {
    return await g.api.updateSettings(settings);
  }

  const response = await api.put("/api/v2/settings/", settings);
  return response.data;
};

export const resetSettings = async (): Promise<Settings> => {
  const response = await api.post<Settings>("/api/v2/settings/reset/");
  return response.data;
};
