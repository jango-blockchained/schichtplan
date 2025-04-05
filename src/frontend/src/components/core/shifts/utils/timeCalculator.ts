import { Settings } from "@/types";
import {
  parse,
  format,
  differenceInMinutes,
  isAfter,
  isBefore,
  addMinutes,
  subMinutes,
} from "date-fns";

// Interfaces
export interface TimeRange {
  start: string;
  end: string;
}

// Basic time utility functions
export const parseTime = (timeStr: string): Date =>
  parse(timeStr, "HH:mm", new Date());
export const formatHour = (date: Date): string => format(date, "HH:mm");

// Convert time string to minutes for calculations
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

// Format minutes back to time string
export const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

// Format hours (with potential decimal) to time string
export const formatHours = (totalHours: number): string => {
  // Round to nearest quarter hour (15 minutes)
  totalHours = Math.round(totalHours * 4) / 4;

  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
};

/**
 * Time Calculator class for shift-related time calculations
 */
export class TimeCalculator {
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  /**
   * Calculate extended time range including keyholder times
   */
  calculateExtendedTimeRange(): TimeRange {
    // Get store opening and closing times
    const storeOpening = parseTime(this.settings.general.store_opening);
    const storeClosing = parseTime(this.settings.general.store_closing);

    // Calculate extended range with keyholder times
    const keyholderBeforeMinutes =
      this.settings.general.keyholder_before_minutes || 30;
    const keyholderAfterMinutes =
      this.settings.general.keyholder_after_minutes || 30;

    const rangeStart = subMinutes(storeOpening, keyholderBeforeMinutes);
    const rangeEnd = addMinutes(storeClosing, keyholderAfterMinutes);

    return {
      start: formatHour(rangeStart),
      end: formatHour(rangeEnd),
    };
  }

  /**
   * Generate timeline labels for a given time range
   */
  calculateTimelineLabels(timeRange: TimeRange): string[] {
    const labels: string[] = [];
    let currentTime = parseTime(timeRange.start);
    const endTime = parseTime(timeRange.end);

    while (
      isBefore(currentTime, endTime) ||
      currentTime.getTime() === endTime.getTime()
    ) {
      labels.push(formatHour(currentTime));
      currentTime = addMinutes(currentTime, 60); // Add 1 hour
    }

    return labels;
  }

  /**
   * Calculate position for a shift within a time range (for visualization)
   */
  calculateShiftPosition(
    shift: {
      id: number;
      start_time: string;
      end_time: string;
    },
    timeRange: TimeRange,
  ): {
    left: number;
    width: number;
    debug: any;
  } {
    const shiftStart = timeToMinutes(shift.start_time);
    const shiftEnd = timeToMinutes(shift.end_time);
    const rangeStart = timeToMinutes(timeRange.start);
    const rangeEnd = timeToMinutes(timeRange.end);
    const rangeWidth = rangeEnd - rangeStart;

    const debugInfo = {
      shiftId: shift.id,
      originalShiftStart: shift.start_time,
      originalShiftEnd: shift.end_time,
      rangeStart: timeRange.start,
      rangeEnd: timeRange.end,
      isShiftBeforeRange: shiftEnd <= rangeStart,
      isShiftAfterRange: shiftStart >= rangeEnd,
      positioningDetails: {
        shiftStartInMinutes: shiftStart,
        shiftEndInMinutes: shiftEnd,
        rangeStartInMinutes: rangeStart,
        rangeEndInMinutes: rangeEnd,
        rangeWidthInMinutes: rangeWidth,
        leftOffsetInMinutes: Math.max(0, shiftStart - rangeStart),
        widthInMinutes:
          Math.min(shiftEnd, rangeEnd) - Math.max(shiftStart, rangeStart),
      },
    };

    // Check if shift is entirely outside the range
    if (shiftEnd <= rangeStart || shiftStart >= rangeEnd) {
      debugInfo.positioningDetails.leftOffsetInMinutes = 0;
      debugInfo.positioningDetails.widthInMinutes = 0;
      return { left: 0, width: 0, debug: debugInfo };
    }

    // Calculate position
    const leftOffset = Math.max(0, shiftStart - rangeStart);
    const left = (leftOffset / rangeWidth) * 100;

    // Calculate width (capped to range)
    const visibleStart = Math.max(shiftStart, rangeStart);
    const visibleEnd = Math.min(shiftEnd, rangeEnd);
    const width = ((visibleEnd - visibleStart) / rangeWidth) * 100;

    return {
      left: Math.max(0, Math.min(left, 100)),
      width: Math.max(0, Math.min(width, 100 - left)),
      debug: debugInfo,
    };
  }
}

/**
 * Calculates the time range for a day based on store hours
 */
export const calculateTimeRange = (
  storeOpening: string,
  storeClosing: string,
): TimeRange => {
  // Parse the store opening and closing times
  const today = new Date();
  const dateFormat = "yyyy-MM-dd";
  const timeFormat = "HH:mm";
  const dateString = format(today, dateFormat);

  const rangeStart = parse(
    `${dateString} ${storeOpening}`,
    `${dateFormat} ${timeFormat}`,
    new Date(),
  );
  const rangeEnd = parse(
    `${dateString} ${storeClosing}`,
    `${dateFormat} ${timeFormat}`,
    new Date(),
  );

  // Handle overnight shifts (closing time is earlier than opening time)
  if (isAfter(rangeStart, rangeEnd)) {
    // Add a day to the end time
    const nextDay = new Date(rangeEnd);
    nextDay.setDate(nextDay.getDate() + 1);
    return {
      start: format(rangeStart, timeFormat),
      end: format(nextDay, timeFormat),
    };
  }

  return {
    start: format(rangeStart, timeFormat),
    end: format(rangeEnd, timeFormat),
  };
};

/**
 * Generates time slots for a given time range
 */
export const generateTimeSlots = (
  timeRange: TimeRange,
  intervalMinutes: number = 60,
): string[] => {
  const slots: string[] = [];

  // Parse the time strings to Date objects for calculations
  const today = new Date();
  const dateFormat = "yyyy-MM-dd";
  const timeFormat = "HH:mm";
  const dateString = format(today, dateFormat);

  const startDate = parse(
    `${dateString} ${timeRange.start}`,
    `${dateFormat} ${timeFormat}`,
    new Date(),
  );
  const endDate = parse(
    `${dateString} ${timeRange.end}`,
    `${dateFormat} ${timeFormat}`,
    new Date(),
  );

  // Handle overnight shifts
  if (isAfter(startDate, endDate)) {
    // Add a day to the end time
    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    endDate.setDate(endDate.getDate() + 1);
  }

  let currentTime = new Date(startDate);

  while (
    isBefore(currentTime, endDate) ||
    currentTime.getTime() === endDate.getTime()
  ) {
    slots.push(format(currentTime, timeFormat));
    currentTime = addMinutes(currentTime, intervalMinutes);
  }

  return slots;
};

/**
 * Calculate shift hours based on start, end, and break times
 */
export const calculateShiftHours = (shift: {
  start_time?: string;
  end_time?: string;
  break?: {
    start: string;
    end: string;
    notes?: string;
  };
}): number => {
  if (!shift.start_time || !shift.end_time) return 0;

  let totalHours =
    timeToMinutes(shift.end_time) - timeToMinutes(shift.start_time);

  // Handle shifts crossing midnight
  if (totalHours < 0) {
    totalHours += 24 * 60;
  }

  // Subtract break time if present
  if (shift.break) {
    let breakDuration =
      timeToMinutes(shift.break.end) - timeToMinutes(shift.break.start);
    if (breakDuration < 0) {
      breakDuration += 24 * 60;
    }

    // Handle second break from notes if present (for shifts > 9 hours)
    if (shift.break.notes?.includes("Second break:")) {
      const secondBreakMatch = shift.break.notes.match(
        /Second break: (\d{2}:\d{2})-(\d{2}:\d{2})/,
      );
      if (secondBreakMatch) {
        const [_, secondBreakStart, secondBreakEnd] = secondBreakMatch;
        let secondBreakDuration =
          timeToMinutes(secondBreakEnd) - timeToMinutes(secondBreakStart);
        if (secondBreakDuration < 0) {
          secondBreakDuration += 24 * 60;
        }
        breakDuration += secondBreakDuration;
      }
    }

    totalHours -= breakDuration;
  }

  return totalHours / 60; // Convert minutes to hours
};

/**
 * Calculate daily hours for a shift
 */
export const calculateDailyHours = (shift: {
  start_time?: string;
  end_time?: string;
  break?: {
    start: string;
    end: string;
    notes?: string;
  };
}): string => {
  return formatHours(calculateShiftHours(shift));
};

/**
 * Calculate weekly hours for multiple shifts
 */
export const calculateWeeklyHours = (
  shifts: Array<{
    start_time?: string;
    end_time?: string;
    break?: {
      start: string;
      end: string;
      notes?: string;
    };
  }>,
): string => {
  const totalHours = shifts.reduce(
    (acc, shift) => acc + calculateShiftHours(shift),
    0,
  );
  return formatHours(totalHours);
};

/**
 * Calculate monthly hours based on weekly shifts
 */
export const calculateMonthlyHours = (
  shifts: Array<{
    start_time?: string;
    end_time?: string;
    break?: {
      start: string;
      end: string;
      notes?: string;
    };
  }>,
): string => {
  // Calculate weekly hours and multiply by average weeks per month (4.33)
  const weeklyHours = shifts.reduce(
    (acc, shift) => acc + calculateShiftHours(shift),
    0,
  );
  const monthlyHours = weeklyHours * 4.33;
  return formatHours(monthlyHours);
};

/**
 * Determine shift type based on start time
 */
export const determineShiftType = (
  startTime: string | undefined,
): "EARLY" | "MIDDLE" | "LATE" => {
  if (!startTime) return "MIDDLE";

  const hour = parseInt(startTime.split(":")[0]);
  if (hour < 10) return "EARLY";
  if (hour >= 14) return "LATE";
  return "MIDDLE";
};

/**
 * Validate breaks based on shift duration
 */
export const validateBreaks = (shift: {
  start_time?: string;
  end_time?: string;
  break?: {
    start: string;
    end: string;
    notes?: string;
  };
}): {
  hasBreakViolation: boolean;
  hasLongBreakViolation: boolean;
  hasHoursViolation: boolean;
} => {
  const shiftHours = calculateShiftHours(shift);
  const shiftMinutes = shiftHours * 60;

  const hasBreakViolation = shiftMinutes > 360 && !shift.break; // 6 hours = 360 minutes
  const hasLongBreakViolation =
    shiftMinutes > 540 && !shift.break?.notes?.includes("Second break:"); // 9 hours = 540 minutes
  const hasHoursViolation = shiftHours > 10; // Max 10 hours per shift

  return {
    hasBreakViolation,
    hasLongBreakViolation,
    hasHoursViolation,
  };
};
