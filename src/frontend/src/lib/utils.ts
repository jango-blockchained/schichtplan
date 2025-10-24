import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Shift type utilities
export function isEarlyShift(shift: { shift_start?: string | null; start_time?: string }): boolean {
  const startTime = shift.shift_start || shift.start_time;
  if (!startTime) return false;
  // Consider early shift if it starts before 10:00
  const hour = parseInt(startTime.split(':')[0]);
  return hour < 10;
}

export function isLateShift(shift: { shift_end?: string | null; end_time?: string }): boolean {
  const endTime = shift.shift_end || shift.end_time;
  if (!endTime) return false;
  // Consider late shift if it ends after 18:00
  const hour = parseInt(endTime.split(':')[0]);
  return hour >= 18;
}
