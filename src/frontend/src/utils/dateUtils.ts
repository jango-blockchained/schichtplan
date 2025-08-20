import { getWeekStartsOn } from '@/utils/weekStart';
import type { Settings } from '@/types';
import { addDays, endOfWeek, getWeek, startOfWeek } from "date-fns";
import { DateRange } from "react-day-picker";

type SettingsLike = Pick<Settings, 'week_navigation'> | undefined;

// Lightweight accessor to cached settings (react-query) if available without direct import cycle
function getCachedSettings(): SettingsLike | undefined {
  // Narrow globalThis with an index signature for optional query client attachment
  interface GlobalWithRQ extends Global {
    __REACT_QUERY_CLIENT__?: { getQueryData: (key: unknown[]) => unknown };
  }
  const w = globalThis as GlobalWithRQ;
  // If a global queryClient reference has been attached (optional pattern), try to read
  try {
    if (w.__REACT_QUERY_CLIENT__) {
      return w.__REACT_QUERY_CLIENT__.getQueryData(['settings']);
    }
  } catch {
    /* ignore */
  }
  return undefined;
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

    const weekStartsOn = getWeekStartsOn(getCachedSettings());

    if (isNaN(week) || week < 1 || week > 53) {
      console.error("Invalid week in getWeekDateRange:", week);
      week = getWeek(new Date(), { weekStartsOn });
    }

    if (isNaN(weekCount) || weekCount < 1 || weekCount > 4) {
      console.error("Invalid weekCount in getWeekDateRange:", weekCount);
      weekCount = 1;
    }

    // Use ISO week date calculation with explicit Monday start
    const firstDayOfYear = new Date(year, 0, 1);
    const firstDayOfYearDay = firstDayOfYear.getDay(); // 0=Sunday

    // Compute first week start respecting weekStartsOn (0 Sunday / 1 Monday)
    let offset = 0;
    if (weekStartsOn === 1) {
      // find first Monday
      const day = firstDayOfYearDay === 0 ? 7 : firstDayOfYearDay; // 1..7 with 7=Sunday
      offset = day <= 1 ? 0 : 8 - day;
    } else {
      // Sunday start: already week boundary
      offset = 0;
    }
    const firstWeekStart = new Date(year, 0, 1 + offset);

    // Calculate the start date of the target week
    // First week (1) starts with the first Monday, so week 2 would be +7 days, etc.
    const startDate = new Date(firstWeekStart);
    startDate.setDate(firstWeekStart.getDate() + (week - 1) * 7);

    // End date is 6 days after start date for 1 week (Monday to Sunday)
    // Or more for multiple weeks
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + weekCount * 7 - 1);

    return { start: startDate, end: endDate };
  } catch (error) {
    console.error("Error in getWeekDateRange:", error);
    const weekStartsOn = getWeekStartsOn(getCachedSettings());
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn });
    const end = addDays(start, weekCount * 7 - 1);
    return { start, end };
  }
}

// Enhanced function that handles year transitions (e.g., week 52 to week 1 of next year)
export function getDateRangeFromWeekAndCount(
  week: number,
  weekCount: number = 1,
): DateRange {
  const weekStartsOn = getWeekStartsOn(getCachedSettings());

  if (isNaN(week) || week < 1 || week > 53) {
    console.error("Invalid week number in getDateRangeFromWeekAndCount:", week);
    week = getWeek(new Date(), { weekStartsOn });
  }

  if (isNaN(weekCount) || weekCount < 1 || weekCount > 4) {
    console.error("Invalid week count in getDateRangeFromWeekAndCount:", weekCount);
    weekCount = 1;
  }

  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentWeek = getWeek(currentDate, { weekStartsOn });
    // Handle year transitions
    const targetYear =
      week < currentWeek && week <= 8 ? currentYear + 1 : currentYear;
    const { start, end } = getWeekDateRange(targetYear, week, weekCount);

    // Validate the generated dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date range generated");
    }

    return {
      from: start,
      to: end,
    };
  } catch (error) {
    console.error("Error in getDateRangeFromWeekAndCount:", error);
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn });
    const endOfRange = addDays(start, weekCount * 7 - 1);
    return {
      from: start,
      to: endOfRange,
    };
  }
}

export function getCurrentWeek(): number {
  return getWeek(new Date(), { weekStartsOn: getWeekStartsOn(getCachedSettings()) });
}

export function getDateRangeForWeeks(startWeek: number, weekCount: number) {
  const { start, end } = getWeekDateRange(new Date().getFullYear(), startWeek, weekCount);
  return { from: start, to: end };
}

export function formatDateRange(from: Date, to: Date): string {
  const ws = getWeekStartsOn(getCachedSettings());
  return `KW${getWeek(from, { weekStartsOn: ws })}${weekCount(from, to) > 1 ? `-${getWeek(to, { weekStartsOn: ws })}` : ""} ${from.getFullYear()}`;
}

export function weekCount(from: Date, to: Date): number {
  const ws = getWeekStartsOn(getCachedSettings());
  const start = startOfWeek(from, { weekStartsOn: ws });
  const end = endOfWeek(to, { weekStartsOn: ws });
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.ceil(days / 7);
}

// Helper to get all available calendar weeks for the current year
export function getAvailableCalendarWeeks(
  includeNextYear: boolean = false,
): { value: string; label: string }[] {
  const ws = getWeekStartsOn(getCachedSettings());
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentWeek = getWeek(currentDate, { weekStartsOn: ws });
  const weeks: { value: string; label: string }[] = [];
  // Add weeks from current year
  for (let i = currentWeek; i <= 52; i++) {
    weeks.push({ value: `${currentYear}-${i}`, label: `KW ${i}/${currentYear}` });
  }
  // Add weeks from next year if requested
  if (includeNextYear) {
    const nextYear = currentYear + 1;
    for (let i = 1; i <= 8; i++) {
      weeks.push({ value: `${nextYear}-${i}`, label: `KW ${i}/${nextYear}` });
    }
  }
  return weeks;
}
