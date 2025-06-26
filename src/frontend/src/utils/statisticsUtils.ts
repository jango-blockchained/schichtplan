import { Employee, Schedule } from "@/types";
import { getDay, isSameDay, parseISO } from "date-fns";

// Helper function to calculate shift duration in hours
export const calculateShiftDuration = (schedule: Schedule): number => {
  if (!schedule.shift_start || !schedule.shift_end) return 0;

  try {
    const [startHours, startMinutes] = schedule.shift_start.split(":").map(Number);
    const [endHours, endMinutes] = schedule.shift_end.split(":").map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    let endTotalMinutes = endHours * 60 + endMinutes;

    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60;
    }

    let breakDuration = 0;
    if (schedule.break_start && schedule.break_end) {
      const [breakStartHours, breakStartMinutes] = schedule.break_start.split(":").map(Number);
      const [breakEndHours, breakEndMinutes] = schedule.break_end.split(":").map(Number);

      const breakStartTotalMinutes = breakStartHours * 60 + breakStartMinutes;
      let breakEndTotalMinutes = breakEndHours * 60 + breakEndMinutes;

      if (breakEndTotalMinutes < breakStartTotalMinutes) {
        breakEndTotalMinutes += 24 * 60;
      }

      breakDuration = breakEndTotalMinutes - breakStartTotalMinutes;
    }

    return (endTotalMinutes - startTotalMinutes - breakDuration) / 60;
  } catch {
    return 0;
  }
};

// Helper function to get shift type based on start time
export const getShiftType = (shiftStart: string): "early" | "mid" | "late" => {
  if (!shiftStart) return "mid";
  const hour = parseInt(shiftStart.split(":")[0]);
  
  if (hour < 10) return "early";
  if (hour >= 18) return "late";
  return "mid";
};

// Helper function to filter valid schedules
export const getValidSchedules = (schedules: Schedule[], version?: number): Schedule[] => {
  const filtered = version !== undefined 
    ? schedules.filter(s => s.version === version)
    : schedules;
    
  return filtered.filter(s => 
    s.shift_id !== null && 
    s.shift_start && 
    s.shift_end && 
    s.date &&
    s.employee_id
  );
};

// Helper function to create employee lookup
export const createEmployeeLookup = (employees: Employee[]): Record<number, Employee> => {
  return employees.reduce((acc, emp) => {
    acc[emp.id] = emp;
    return acc;
  }, {} as Record<number, Employee>);
};

// Helper function to get schedules for a specific date
export const getSchedulesForDate = (schedules: Schedule[], date: Date): Schedule[] => {
  return schedules.filter(s => 
    s.date && isSameDay(parseISO(s.date), date)
  );
};

// Helper function to convert day index (Sunday=0) to Monday=0 format
export const convertDayIndex = (dayIndex: number): number => {
  return dayIndex === 0 ? 6 : dayIndex - 1;
};

// Helper function to check if day is in opening days
export const isDayOpen = (date: Date, openingDays: number[]): boolean => {
  const dayIndex = getDay(date);
  const adjustedDayIndex = convertDayIndex(dayIndex);
  return openingDays.includes(adjustedDayIndex);
};
