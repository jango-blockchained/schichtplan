import { Schedule } from "@/types";

/**
 * Formats a time string for display
 */
export const formatTime = (time: string): string => {
  return time || "00:00";
};

/**
 * Converts a time string (HH:MM) to minutes
 */
export const parseTime = (timeString: string): number => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

/**
 * Converts minutes to a formatted time string (HH:MM)
 */
export const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

/**
 * Determines shift type based on start time
 */
export function determineShiftType(
  startTime: string,
): "EARLY" | "MIDDLE" | "LATE" {
  if (!startTime) return "MIDDLE";
  const startHour = parseInt(startTime.split(":")[0]);
  if (startHour < 10) return "EARLY";
  if (startHour >= 14) return "LATE";
  return "MIDDLE";
}

/**
 * Gets color for a shift based on its type
 */
export function getShiftTypeColor(schedule: Schedule, settings: any): string {
  // First try to get color from shift_type_id
  if (schedule.shift_type_id && settings?.shift_types) {
    const shiftType = settings.shift_types.find(
      (type: any) => type.id === schedule.shift_type_id,
    );
    if (shiftType?.color) return shiftType.color;
  }

  // Fallback to determining type from start time
  const determinedType = determineShiftType(schedule.shift_start || "");
  const shiftType = settings?.shift_types?.find(
    (type: any) => type.id === determinedType,
  );
  return shiftType?.color || "#64748b";
}

/**
 * Gets name for a shift based on its type
 */
export function getShiftTypeName(schedule: Schedule): string {
  // First try to get name from shift_type_name
  if (schedule.shift_type_name) return schedule.shift_type_name;

  // Fallback to determining type from start time
  return determineShiftType(schedule.shift_start || "");
}
