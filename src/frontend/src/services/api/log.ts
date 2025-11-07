import { api } from "./instance";

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
  const response = await api.get<LogFile[]>("/api/v2/logs/");
  return response.data;
};

export const getLogContent = async (filename: string): Promise<LogContent> => {
  const response = await api.get<LogContent>(`/api/v2/logs/${filename}`);
  return response.data;
};

export const deleteLog = async (filename: string): Promise<void> => {
  await api.delete(`/api/v2/logs/${filename}`);
};

export const clearAllLogs = async (): Promise<void> => {
  await api.delete("/api/v2/logs/");
};
