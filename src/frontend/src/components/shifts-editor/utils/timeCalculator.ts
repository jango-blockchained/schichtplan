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
import { TimeRange } from "../types";

// Utility Functions
export const parseTime = (time: string): Date =>
  parse(time, "HH:mm", new Date());
export const formatHour = (date: Date): string => format(date, "HH:mm");

export class TimeCalculator {
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

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
      start: format(rangeStart, "HH:mm"),
      end: format(rangeEnd, "HH:mm"),
    };
  }

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
