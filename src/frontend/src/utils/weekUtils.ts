/**
 * Week calculation utilities for the Schichtplan frontend.
 * 
 * This module mirrors the backend week calculation logic in TypeScript,
 * providing utilities for ISO week calculations with month boundary logic.
 */

import { getSettings } from '@/services/api';
import { QueryClient } from '@tanstack/react-query';
import { addDays, addWeeks, endOfWeek, format, getWeek, getYear, startOfWeek } from 'date-fns';
import { getWeekStartsOn } from './weekStart';

export enum WeekendStart {
  SUNDAY = 0,
  MONDAY = 1
}

export enum MonthBoundaryMode {
  KEEP_INTACT = 'keep_intact',
  SPLIT_ON_MONTH = 'split_on_month'
}

export interface WeekInfo {
  year: number;
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  spansMonths: boolean;
  months: string[];
}

export interface WeekRange {
  startWeek: WeekInfo;
  endWeek: WeekInfo;
  totalWeeks: number;
  identifier: string;
}/**
 * Get ISO week information for a given date.
 */
export function getISOWeekInfo(targetDate: Date, opts?: { weekStartsOn?: 0 | 1 }): WeekInfo {
  const weekStartsOn = opts?.weekStartsOn ?? 1; // default Monday if not supplied
  const year = getYear(targetDate);
  const weekNumber = getWeek(targetDate, { weekStartsOn });
  
  // Calculate start and end dates for the week
  const startDate = startOfWeek(targetDate, { weekStartsOn });
  const endDate = endOfWeek(targetDate, { weekStartsOn });
  
  // Check if week spans multiple months
  const spansMonths = startDate.getMonth() !== endDate.getMonth();
  
  // Get month names
  const months = [format(startDate, 'MMMM')];
  if (spansMonths) {
    months.push(format(endDate, 'MMMM'));
  }
  
  return {
    year,
    weekNumber,
    startDate,
    endDate,
    spansMonths,
    months
  };
}

/**
 * Create a week identifier string from year and week number.
 */
export function createWeekIdentifier(year: number, weekNumber: number): string {
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Parse a week identifier and return week information.
 */
export function getWeekFromIdentifier(weekIdentifier: string, opts?: { weekStartsOn?: 0 | 1 }): WeekInfo {
  const parts = weekIdentifier.split('-W');
  if (parts.length !== 2) {
    throw new Error(`Invalid week identifier format: ${weekIdentifier}`);
  }
  
  const year = parseInt(parts[0], 10);
  const weekNumber = parseInt(parts[1], 10);
  
  if (isNaN(year) || isNaN(weekNumber) || weekNumber < 1 || weekNumber > 53) {
    throw new Error(`Invalid week identifier format: ${weekIdentifier}`);
  }
  
  // Calculate the start date of the target week
  // Find January 4th of the year (always in week 1)
  const jan4 = new Date(year, 0, 4);
  const weekStartsOn = opts?.weekStartsOn ?? 1;
  const week1Start = startOfWeek(jan4, { weekStartsOn });
  
  const startDate = addWeeks(week1Start, weekNumber - 1);
  const endDate = endOfWeek(startDate, { weekStartsOn });
  
  const spansMonths = startDate.getMonth() !== endDate.getMonth();
  const months = [format(startDate, 'MMMM')];
  if (spansMonths) {
    months.push(format(endDate, 'MMMM'));
  }
  
  return {
    year,
    weekNumber,
    startDate,
    endDate,
    spansMonths,
    months
  };
}/**
 * Get the next week identifier.
 */
export function getNextWeek(weekIdentifier: string, opts?: { weekStartsOn?: 0 | 1 }): string {
  const weekInfo = getWeekFromIdentifier(weekIdentifier, opts);
  const nextDate = addDays(weekInfo.endDate, 1);
  const nextWeekInfo = getISOWeekInfo(nextDate, opts);
  return createWeekIdentifier(nextWeekInfo.year, nextWeekInfo.weekNumber);
}

/**
 * Get the previous week identifier.
 */
export function getPreviousWeek(weekIdentifier: string, opts?: { weekStartsOn?: 0 | 1 }): string {
  const weekInfo = getWeekFromIdentifier(weekIdentifier, opts);
  const prevDate = addDays(weekInfo.startDate, -1);
  const prevWeekInfo = getISOWeekInfo(prevDate, opts);
  return createWeekIdentifier(prevWeekInfo.year, prevWeekInfo.weekNumber);
}

/**
 * Get the current week identifier.
 */
export function getCurrentWeekIdentifier(opts?: { weekStartsOn?: 0 | 1 }): string {
  const today = new Date();
  const weekInfo = getISOWeekInfo(today, opts);
  return createWeekIdentifier(weekInfo.year, weekInfo.weekNumber);
}

/**
 * Convert a date range to a week identifier.
 */
export function dateRangeToWeekIdentifier(startDate: Date, endDate: Date, opts?: { weekStartsOn?: 0 | 1 }): string {
  const startWeek = getISOWeekInfo(startDate, opts);
  const endWeek = getISOWeekInfo(endDate, opts);
  
  // If it's a single week
  if (startWeek.year === endWeek.year && startWeek.weekNumber === endWeek.weekNumber) {
    return createWeekIdentifier(startWeek.year, startWeek.weekNumber);
  }
  
  // If it's a range within the same year
  if (startWeek.year === endWeek.year) {
    return `${startWeek.year}-W${startWeek.weekNumber.toString().padStart(2, '0')}-W${endWeek.weekNumber.toString().padStart(2, '0')}`;
  }
  
  // Cross-year range
  const startId = createWeekIdentifier(startWeek.year, startWeek.weekNumber);
  const endId = createWeekIdentifier(endWeek.year, endWeek.weekNumber);
  return `${startId}-${endId}`;
}

/**
 * Convenience helpers that leverage cached settings via a provided QueryClient (optional) or fetch directly.
 * These avoid prop-drilling weekStartsOn. Use sparingly in non-react contexts.
 */
export async function getDynamicWeekStartsOn(queryClient?: QueryClient): Promise<0 | 1> {
  try {
    if (queryClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cached = queryClient.getQueryData<any>(["settings"]);
      if (cached) return getWeekStartsOn(cached);
    }
    const settings = await getSettings();
    return getWeekStartsOn(settings);
  } catch {
    return 1;
  }
}