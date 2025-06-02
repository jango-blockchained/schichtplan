/**
 * Week calculation utilities for the Schichtplan frontend.
 * 
 * This module mirrors the backend week calculation logic in TypeScript,
 * providing utilities for ISO week calculations with month boundary logic.
 */

import { format, getWeek, getYear, addWeeks, startOfWeek, endOfWeek, addDays } from 'date-fns';

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
export function getISOWeekInfo(targetDate: Date): WeekInfo {
  const year = getYear(targetDate);
  const weekNumber = getWeek(targetDate, { weekStartsOn: 1 }); // Monday start
  
  // Calculate start and end dates for the ISO week (Monday to Sunday)
  const startDate = startOfWeek(targetDate, { weekStartsOn: 1 });
  const endDate = endOfWeek(targetDate, { weekStartsOn: 1 });
  
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
export function getWeekFromIdentifier(weekIdentifier: string): WeekInfo {
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
  const week1Monday = startOfWeek(jan4, { weekStartsOn: 1 });
  
  const startDate = addWeeks(week1Monday, weekNumber - 1);
  const endDate = endOfWeek(startDate, { weekStartsOn: 1 });
  
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
export function getNextWeek(weekIdentifier: string): string {
  const weekInfo = getWeekFromIdentifier(weekIdentifier);
  const nextDate = addDays(weekInfo.endDate, 1);
  const nextWeekInfo = getISOWeekInfo(nextDate);
  return createWeekIdentifier(nextWeekInfo.year, nextWeekInfo.weekNumber);
}

/**
 * Get the previous week identifier.
 */
export function getPreviousWeek(weekIdentifier: string): string {
  const weekInfo = getWeekFromIdentifier(weekIdentifier);
  const prevDate = addDays(weekInfo.startDate, -1);
  const prevWeekInfo = getISOWeekInfo(prevDate);
  return createWeekIdentifier(prevWeekInfo.year, prevWeekInfo.weekNumber);
}

/**
 * Get the current week identifier.
 */
export function getCurrentWeekIdentifier(): string {
  const today = new Date();
  const weekInfo = getISOWeekInfo(today);
  return createWeekIdentifier(weekInfo.year, weekInfo.weekNumber);
}

/**
 * Convert a date range to a week identifier.
 */
export function dateRangeToWeekIdentifier(startDate: Date, endDate: Date): string {
  const startWeek = getISOWeekInfo(startDate);
  const endWeek = getISOWeekInfo(endDate);
  
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