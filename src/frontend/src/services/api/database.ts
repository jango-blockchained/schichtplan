import { api } from "./instance";

export const backupDatabase = async (): Promise<Blob> => {
  const response = await api.get("/api/v2/db/backup", {
    responseType: "blob",
  });
  return response.data;
};

export const restoreDatabase = async (file: File): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);
  await api.post("/api/v2/db/restore", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const wipeTables = async (tables: string[]): Promise<void> => {
  await api.post("/api/v2/db/wipe", { tables });
};

export const fetchTables = async (): Promise<string[]> => {
  const response = await api.get<{ tables: string[] }>(
    "/api/v2/settings/tables",
  );
  return response.data.tables;
};
