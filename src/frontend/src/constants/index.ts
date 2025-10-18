/**
 * Time-related constants for cache and timeouts
 */
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

/**
 * Cache stale times for React Query
 */
export const STALE_TIME = {
  /** 1 minute - for frequently changing data */
  SHORT: 1 * TIME.MINUTE,
  /** 5 minutes - for moderately stable data */
  MEDIUM: 5 * TIME.MINUTE,
  /** 30 minutes - for stable data */
  LONG: 30 * TIME.MINUTE,
  /** 1 hour - for rarely changing data */
  VERY_LONG: 1 * TIME.HOUR,
} as const;

/**
 * Day of week constants (JavaScript convention: 0 = Sunday)
 */
export const WEEKDAY = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;

/**
 * Day names in German (indexed by WEEKDAY constants)
 */
export const DAY_NAMES_DE = {
  [WEEKDAY.SUNDAY]: "Sonntag",
  [WEEKDAY.MONDAY]: "Montag",
  [WEEKDAY.TUESDAY]: "Dienstag",
  [WEEKDAY.WEDNESDAY]: "Mittwoch",
  [WEEKDAY.THURSDAY]: "Donnerstag",
  [WEEKDAY.FRIDAY]: "Freitag",
  [WEEKDAY.SATURDAY]: "Samstag",
} as const;

/**
 * Short day names in German
 */
export const DAY_NAMES_SHORT_DE = {
  [WEEKDAY.SUNDAY]: "So",
  [WEEKDAY.MONDAY]: "Mo",
  [WEEKDAY.TUESDAY]: "Di",
  [WEEKDAY.WEDNESDAY]: "Mi",
  [WEEKDAY.THURSDAY]: "Do",
  [WEEKDAY.FRIDAY]: "Fr",
  [WEEKDAY.SATURDAY]: "Sa",
} as const;

/**
 * Map day name strings to weekday constants
 */
export const DAY_NAME_TO_WEEKDAY: Record<string, number> = {
  sunday: WEEKDAY.SUNDAY,
  monday: WEEKDAY.MONDAY,
  tuesday: WEEKDAY.TUESDAY,
  wednesday: WEEKDAY.WEDNESDAY,
  thursday: WEEKDAY.THURSDAY,
  friday: WEEKDAY.FRIDAY,
  saturday: WEEKDAY.SATURDAY,
  sonntag: WEEKDAY.SUNDAY,
  montag: WEEKDAY.MONDAY,
  dienstag: WEEKDAY.TUESDAY,
  mittwoch: WEEKDAY.WEDNESDAY,
  donnerstag: WEEKDAY.THURSDAY,
  freitag: WEEKDAY.FRIDAY,
  samstag: WEEKDAY.SATURDAY,
} as const;

/**
 * API timeout values
 */
export const API_TIMEOUT = {
  /** 10 seconds - for quick operations */
  SHORT: 10 * TIME.SECOND,
  /** 30 seconds - default timeout */
  DEFAULT: 30 * TIME.SECOND,
  /** 60 seconds - for longer operations */
  LONG: 60 * TIME.SECOND,
  /** 5 minutes - for very long operations (e.g., generation) */
  VERY_LONG: 5 * TIME.MINUTE,
} as const;

/**
 * Debounce delays
 */
export const DEBOUNCE_DELAY = {
  /** 150ms - for typing/input */
  INPUT: 150,
  /** 300ms - for search */
  SEARCH: 300,
  /** 500ms - for resize/scroll */
  RESIZE: 500,
} as const;

/**
 * Version status constants
 */
export const VERSION_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export type VersionStatus =
  (typeof VERSION_STATUS)[keyof typeof VERSION_STATUS];

/**
 * Month boundary modes for week navigation
 */
export const MONTH_BOUNDARY_MODE = {
  KEEP_INTACT: "keep_intact",
  SPLIT_BY_MONTH: "split_by_month",
} as const;

export type MonthBoundaryMode =
  (typeof MONTH_BOUNDARY_MODE)[keyof typeof MONTH_BOUNDARY_MODE];

/**
 * Weekend start options
 */
export const WEEKEND_START = {
  SUNDAY: "SUNDAY",
  MONDAY: "MONDAY",
} as const;

export type WeekendStart = (typeof WEEKEND_START)[keyof typeof WEEKEND_START];

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;

/**
 * Max lengths for inputs
 */
export const MAX_LENGTH = {
  SHORT_TEXT: 50,
  MEDIUM_TEXT: 200,
  LONG_TEXT: 500,
  NOTES: 1000,
} as const;
