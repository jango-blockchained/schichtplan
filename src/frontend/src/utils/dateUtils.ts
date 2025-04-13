import { addDays, startOfWeek, endOfWeek, addWeeks, getWeek } from "date-fns";
import { DateRange } from "react-day-picker";

// Define an interface for structured day information
interface DayInfo {
  name: string;
  backendIndex: number; // 0 = Sunday, ..., 6 = Saturday
  displayIndex: number; // 0-6 based on startOfWeek
}

export function getWeekDateRange(
  year: number,
  week: number,
  weekCount: number = 1,
) {
  try {
    // Validate inputs
    if (isNaN(year) || year < 2000 || year > 2100) {
      console.error("Invalid year in getWeekDateRange:", year);
      year = new Date().getFullYear();
    }

    if (isNaN(week) || week < 1 || week > 53) {
      console.error("Invalid week in getWeekDateRange:", week);
      week = getWeek(new Date(), { weekStartsOn: 1 });
    }

    if (isNaN(weekCount) || weekCount < 1 || weekCount > 4) {
      console.error("Invalid weekCount in getWeekDateRange:", weekCount);
      weekCount = 1;
    }

    // Use the more accurate ISO week date calculation
    // Jan 4th is always in the first week of the ISO year
    const jan4 = new Date(year, 0, 4);
    // Go back to Monday of that week
    const firstMonday = startOfWeek(jan4, { weekStartsOn: 1 });

    // Calculate the start date of the target week
    const startDate = addDays(firstMonday, (week - 1) * 7);
    const endDate = addDays(startDate, weekCount * 7 - 1);

    console.log("Week date calculation:", {
      year,
      week,
      weekCount,
      jan4: jan4.toISOString(),
      firstMonday: firstMonday.toISOString(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    return { start: startDate, end: endDate };
  } catch (error) {
    console.error("Error in getWeekDateRange:", error);
    // Fallback to current week
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = addDays(start, weekCount * 7 - 1);
    return { start, end };
  }
}

// Enhanced function that handles year transitions (e.g., week 52 to week 1 of next year)
export function getDateRangeFromWeekAndCount(
  week: number,
  weekCount: number = 1,
): DateRange {
  if (isNaN(week) || week < 1 || week > 53) {
    console.error("Invalid week number in getDateRangeFromWeekAndCount:", week);
    // Fall back to current week
    week = getWeek(new Date(), { weekStartsOn: 1 });
  }

  if (isNaN(weekCount) || weekCount < 1 || weekCount > 4) {
    console.error(
      "Invalid week count in getDateRangeFromWeekAndCount:",
      weekCount,
    );
    // Fall back to 1 week
    weekCount = 1;
  }

  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentWeek = getWeek(currentDate, { weekStartsOn: 1 });

    // Handle year transitions
    const targetYear =
      week < currentWeek && week <= 8 ? currentYear + 1 : currentYear;

    const { start, end } = getWeekDateRange(targetYear, week, weekCount);

    // Validate the generated dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error("Invalid date range generated:", {
        start,
        end,
        week,
        weekCount,
        targetYear,
      });
      throw new Error("Invalid date range generated");
    }

    console.log("Generated date range:", {
      from: start.toISOString(),
      to: end.toISOString(),
      week,
      weekCount,
      targetYear,
    });

    return {
      from: start,
      to: end,
    };
  } catch (error) {
    console.error("Error in getDateRangeFromWeekAndCount:", error);
    // Fallback to current week
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    const endOfRange = addDays(startOfCurrentWeek, weekCount * 7 - 1);

    return {
      from: startOfCurrentWeek,
      to: endOfRange,
    };
  }
}

export function getCurrentWeek(): number {
  return getWeek(new Date(), { weekStartsOn: 1 });
}

export function getDateRangeForWeeks(startWeek: number, weekCount: number) {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const { start, end } = getWeekDateRange(year, startWeek, weekCount);
  return {
    from: start,
    to: end,
  };
}

export function formatDateRange(from: Date, to: Date): string {
  return `KW${getWeek(from, { weekStartsOn: 1 })}${weekCount(from, to) > 1 ? `-${getWeek(to, { weekStartsOn: 1 })}` : ""} ${from.getFullYear()}`;
}

export function weekCount(from: Date, to: Date): number {
  const start = startOfWeek(from, { weekStartsOn: 1 });
  const end = endOfWeek(to, { weekStartsOn: 1 });
  const days = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.ceil(days / 7);
}

// Helper to get all available calendar weeks for the current year
export function getAvailableCalendarWeeks(
  includeNextYear: boolean = false,
): { value: string; label: string }[] {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentWeek = getWeek(currentDate, { weekStartsOn: 1 });
  const weeks = [];

  // Add weeks from current year
  for (let i = currentWeek; i <= 52; i++) {
    weeks.push({
      value: `${currentYear}-${i}`,
      label: `KW ${i} ${currentYear}`,
    });
  }

  // Add weeks from next year if requested
  if (includeNextYear) {
    for (let i = 1; i <= 8; i++) {
      weeks.push({
        value: `${currentYear + 1}-${i}`,
        label: `KW ${i} ${currentYear + 1}`,
      });
    }
  }

  return weeks;
}

/**
 * Names of the days of the week, aligned with backend indexing (0 = Sunday).
 */
export const BACKEND_DAYS = [
  "Sonntag", // 0
  "Montag", // 1
  "Dienstag", // 2
  "Mittwoch", // 3
  "Donnerstag", // 4
  "Freitag", // 5
  "Samstag", // 6
];

/**
 * Converts a backend day index (0=Sunday) to a frontend display index.
 * @param backendDay - The backend day index (0-6).
 * @param startOfWeek - The start day of the week (0=Sunday, 1=Monday).
 * @returns The display index (0-6).
 */
export const convertBackendDayToDisplay = (
  backendDay: number,
  startOfWeek: number, // 0=Sun, 1=Mon
): number => {
  if (startOfWeek === 1) { // Monday start
    // Shifts Sunday (0) to 6, Monday (1) to 0, etc.
    return (backendDay + 6) % 7;
  } else { // Sunday start
    return backendDay; // No shift needed
  }
};

/**
 * Converts a frontend display index to a backend day index (0=Sunday).
 * @param displayIndex - The display index (0-6).
 * @param startOfWeek - The start day of the week (0=Sunday, 1=Monday).
 * @returns The backend day index (0-6).
 */
export const convertDisplayDayToBackend = (
  displayIndex: number,
  startOfWeek: number, // 0=Sun, 1=Mon
): number => {
  if (startOfWeek === 1) { // Monday start
    // Shifts 0 (representing Monday) to 1, 6 (representing Sunday) to 0
    return (displayIndex + 1) % 7;
  } else { // Sunday start
    return displayIndex; // No shift needed
  }
};

/**
 * Gets the names of the days to display, ordered according to the start of the week
 * and filtered by the opening days.
 *
 * @param openingDays - An object mapping backend day index (as string) to boolean indicating if the store is open.
 * @param startOfWeek - The start day of the week (0 for Sunday, 1 for Monday).
 * @returns An array of day name strings (e.g., ["Montag", "Dienstag", ...]) for active days in the correct display order.
 */
export const getActiveDisplayDays = (
  openingDays: Record<string, boolean>, // Keys are backend day indices (0-6) as strings
  startOfWeek: 0 | 1,
): string[] => {
  console.log("getActiveDisplayDays - called with:", { openingDays, startOfWeek });

  // Get all days with their indices, sorted by display order
  const allDaysInOrder: DayInfo[] = getAllDisplayDays(startOfWeek);
  console.log("getActiveDisplayDays - all days in display order:", allDaysInOrder);

  // Filter based on the openingDays map using the backendIndex
  const activeDays = allDaysInOrder.filter(dayInfo => {
    const isOpen = openingDays[String(dayInfo.backendIndex)] === true;
    return isOpen;
  });
  console.log("getActiveDisplayDays - active days (filtered):", activeDays);

  // Return just the names of the active days
  const activeDayNames = activeDays.map(dayInfo => dayInfo.name);
  console.log("getActiveDisplayDays - active day names:", activeDayNames);

  return activeDayNames;
};

/**
 * Gets information for all 7 days of the week, ordered according to the start of the week.
 *
 * @param startOfWeek - The start day of the week (0 for Sunday, 1 for Monday).
 * @returns An array of DayInfo objects, sorted by display order.
 */
export const getAllDisplayDays = (
    startOfWeek: 0 | 1, // 0=Sun, 1=Mon
): DayInfo[] => {
  console.log(`getAllDisplayDays called with startOfWeek: ${startOfWeek}`);
  const days: DayInfo[] = [];
  for (let backendIndex = 0; backendIndex < 7; backendIndex++) {
    const name = BACKEND_DAYS[backendIndex];
    const displayIndex = convertBackendDayToDisplay(backendIndex, startOfWeek);
    days.push({ name, backendIndex, displayIndex });
  }
  // Sort by displayIndex to ensure correct order
  days.sort((a, b) => a.displayIndex - b.displayIndex);
  console.log("getAllDisplayDays - returning sorted days:", days);
  return days;
};
