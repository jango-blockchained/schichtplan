import type { Settings } from "@/types";

export type ShiftCategory = "EARLY" | "MIDDLE" | "LATE";

export function categorizeShift(
  startTime?: string | null,
  endTime?: string | null,
  settings?: Pick<Settings, "general"> | undefined,
): ShiftCategory {
  if (!startTime || !endTime) return "MIDDLE";

  const opening = settings?.general?.store_opening || "09:00";
  const closing = settings?.general?.store_closing || "20:00";

  if (startTime === opening) return "EARLY";
  if (endTime === closing) return "LATE";
  return "MIDDLE";
}
