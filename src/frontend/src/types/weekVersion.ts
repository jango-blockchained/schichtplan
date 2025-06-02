/**
 * TypeScript type definitions for week-based versioning system.
 * 
 * This module defines all types related to week-based schedule versioning,
 * navigation state, and version management.
 */

import { DateRange } from 'react-day-picker';

// Re-export week utilities types for convenience
export type { WeekInfo, WeekRange } from '../utils/weekUtils';
export { WeekendStart, MonthBoundaryMode } from '../utils/weekUtils';

// Version identifier types
export type LegacyVersionIdentifier = number;
export type WeekVersionIdentifier = string; // e.g., "2024-W15" or "2024-W15-W17"
export type VersionIdentifier = LegacyVersionIdentifier | WeekVersionIdentifier;

// Parsed version information
export interface ParsedVersionInfo {
  type: 'legacy' | 'single_week' | 'week_range' | 'cross_year_range';
  isWeekBased: boolean;
  version?: number; // For legacy versions
  year?: number;
  week?: number;
  weekIdentifier?: string;
  startWeek?: number;
  endWeek?: number;
  startYear?: number;
  endYear?: number;
}// Version metadata
export interface WeekVersionMeta {
  version: VersionIdentifier;
  weekIdentifier?: string;
  dateRange: {
    start: string;
    end: string;
  };
  isWeekBased: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt?: string;
  notes?: string;
  monthBoundaryMode?: MonthBoundaryMode;
}

// Navigation state
export interface WeekNavigationState {
  currentWeek: string;
  currentVersion?: VersionIdentifier;
  dateRange: DateRange;
  weekendStart: WeekendStart;
  monthBoundaryMode: MonthBoundaryMode;
  isLoading: boolean;
  hasVersions: boolean;
}

// Quick navigation options
export interface QuickNavigationOption {
  label: string;
  weekIdentifier: string;
  dateRange: DateRange;
  type: 'current' | 'month_start' | 'month_end' | 'quarter_start' | 'custom';
}

// Week navigation hooks return type
export interface WeekNavigationHookReturn {
  navigationState: WeekNavigationState;
  navigateToWeek: (weekIdentifier: string) => Promise<void>;
  navigateNext: () => Promise<void>;
  navigatePrevious: () => Promise<void>;
  navigateToDate: (date: Date) => Promise<void>;
  quickNavigationOptions: QuickNavigationOption[];
  createVersionForWeek: (weekIdentifier: string) => Promise<void>;
  updateSettings: (settings: Partial<Pick<WeekNavigationState, 'weekendStart' | 'monthBoundaryMode'>>) => void;
}