import type { Shift } from "@/types/index";
import { api } from "./instance";

export const getShifts = async (): Promise<Shift[]> => {
  const response = await api.get<Shift[]>("/api/v2/shifts/");
  return response.data;
};

export const createShift = async (
  data: Omit<Shift, "id" | "duration_hours" | "created_at" | "updated_at">,
): Promise<Shift> => {
  const response = await api.post<Shift>("/api/v2/shifts/", data);
  return response.data;
};

export const updateShift = async ({
  id,
  ...data
}: Partial<Shift> & { id: number }): Promise<Shift> => {
  const response = await api.put<Shift>(`/api/v2/shifts/${id}`, data);
  return response.data;
};

export const deleteShift = async (shiftId: number): Promise<void> => {
  await api.delete(`/api/v2/shifts/${shiftId}`);
};

export const createDefaultShifts = async (): Promise<{ count: number }> => {
  const response = await api.post<{ count: number }>(
    "/api/v2/shifts/defaults/",
  );
  return response.data;
};
