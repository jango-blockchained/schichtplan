import { differenceInDays, differenceInCalendarWeeks, isValid, parseISO, format, eachDayOfInterval, isWeekend } from 'date-fns';
import type { DateRange } from 'react-day-picker';

// Types
export interface Schedule {
  id: number;
  version: string;
  from_date: string;
  to_date: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  meta?: {
    version?: string;
    created_by?: string;
    notes?: string;
  };
}

export interface VersionCompatibilityResult {
  isCompatible: boolean;
  issues: string[];
  warnings: string[];
  recommendations: string[];
}

export interface ScheduleConflictResult {
  hasConflicts: boolean;
  conflicts: Array<{
    type: 'overlap' | 'gap' | 'invalid_range';
    message: string;
    affectedDates: string[];
    severity: 'high' | 'medium' | 'low';
  }>;
  resolutions: Array<{
    action: string;
    description: string;
    impact: string;
  }>;
}

export interface DateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    totalDays: number;
    weekCount: number;
    workingDays: number;
    weekendDays: number;
  };
}

/**
 * Business logic service for schedule-related operations
 * Contains complex business rules and validation logic
 */
export class ScheduleBusinessLogic {
  
  /**
   * Validates a date range for schedule creation
   */
  static validateDateRange(dateRange: DateRange | undefined): DateValidationResult {
    const result: DateValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      metadata: {
        totalDays: 0,
        weekCount: 0,
        workingDays: 0,
        weekendDays: 0
      }
    };

    // Check if date range is provided
    if (!dateRange?.from || !dateRange?.to) {
      result.errors.push('Date range must have both start and end dates');
      return result;
    }

    const { from, to } = dateRange;

    // Validate date objects
    if (!isValid(from) || !isValid(to)) {
      result.errors.push('Invalid date format provided');
      return result;
    }

    // Check if start date is before end date
    if (from >= to) {
      result.errors.push('Start date must be before end date');
      return result;
    }

    // Calculate metadata
    const totalDays = differenceInDays(to, from) + 1;
    const weekCount = differenceInCalendarWeeks(to, from) + 1;
    
    // Count working days and weekends
    const days = eachDayOfInterval({ start: from, end: to });
    const weekendDays = days.filter(day => isWeekend(day)).length;
    const workingDays = totalDays - weekendDays;

    result.metadata = {
      totalDays,
      weekCount,
      workingDays,
      weekendDays
    };

    // Business rule validations
    if (totalDays < 7) {
      result.errors.push('Schedule must span at least one week');
    }

    if (totalDays > 365) {
      result.errors.push('Schedule cannot span more than one year');
    }

    if (weekCount < 1) {
      result.errors.push('Schedule must include at least one complete week');
    }

    // Warnings for edge cases
    if (totalDays > 180) {
      result.warnings.push('Long schedules may impact performance');
    }

    if (workingDays < 5) {
      result.warnings.push('Very few working days in selected range');
    }

    // Mark as valid if no errors
    result.isValid = result.errors.length === 0;

    return result;
  }

  /**
   * Checks version compatibility between schedules
   */
  static checkVersionCompatibility(
    currentSchedule: Schedule,
    targetSchedule: Schedule
  ): VersionCompatibilityResult {
    const result: VersionCompatibilityResult = {
      isCompatible: true,
      issues: [],
      warnings: [],
      recommendations: []
    };

    // Check date overlaps
    const currentFrom = parseISO(currentSchedule.from_date);
    const currentTo = parseISO(currentSchedule.to_date);
    const targetFrom = parseISO(targetSchedule.from_date);
    const targetTo = parseISO(targetSchedule.to_date);

    // Check for date range overlaps
    if (
      (targetFrom >= currentFrom && targetFrom <= currentTo) ||
      (targetTo >= currentFrom && targetTo <= currentTo) ||
      (targetFrom <= currentFrom && targetTo >= currentTo)
    ) {
      result.isCompatible = false;
      result.issues.push('Date ranges overlap with existing schedule');
    }

    // Check version numbering
    if (currentSchedule.version === targetSchedule.version) {
      result.issues.push('Version numbers must be unique');
      result.isCompatible = false;
    }

    // Check for temporal ordering
    if (targetFrom < currentFrom) {
      result.warnings.push('Creating schedule for past dates');
    }

    // Check gap between schedules
    const gapDays = differenceInDays(targetFrom, currentTo);
    if (gapDays > 7) {
      result.warnings.push(`${gapDays} day gap between schedules`);
    } else if (gapDays < 0) {
      result.warnings.push('Schedules have overlapping periods');
    }

    // Recommendations
    if (result.isCompatible) {
      result.recommendations.push('Schedules are compatible for creation');
    } else {
      result.recommendations.push('Consider adjusting date ranges or version numbers');
    }

    return result;
  }

  /**
   * Analyzes schedule conflicts and provides resolution suggestions
   */
  static analyzeScheduleConflicts(schedules: Schedule[]): ScheduleConflictResult {
    const result: ScheduleConflictResult = {
      hasConflicts: false,
      conflicts: [],
      resolutions: []
    };

    // Sort schedules by start date
    const sortedSchedules = [...schedules].sort((a, b) => 
      parseISO(a.from_date).getTime() - parseISO(b.from_date).getTime()
    );

    // Check for overlaps between consecutive schedules
    for (let i = 0; i < sortedSchedules.length - 1; i++) {
      const current = sortedSchedules[i];
      const next = sortedSchedules[i + 1];

      const currentEnd = parseISO(current.to_date);
      const nextStart = parseISO(next.from_date);

      // Check for overlap
      if (currentEnd >= nextStart) {
        result.hasConflicts = true;
        result.conflicts.push({
          type: 'overlap',
          message: `Schedule ${current.version} overlaps with ${next.version}`,
          affectedDates: [current.to_date, next.from_date],
          severity: 'high'
        });

        result.resolutions.push({
          action: 'Adjust dates',
          description: `Move ${next.version} start date to ${format(new Date(currentEnd.getTime() + 86400000), 'yyyy-MM-dd')}`,
          impact: 'Will create gap or extend current schedule'
        });
      }

      // Check for large gaps
      const gapDays = differenceInDays(nextStart, currentEnd);
      if (gapDays > 7) {
        result.conflicts.push({
          type: 'gap',
          message: `${gapDays} day gap between ${current.version} and ${next.version}`,
          affectedDates: [current.to_date, next.from_date],
          severity: 'medium'
        });

        result.resolutions.push({
          action: 'Fill gap',
          description: 'Create intermediate schedule or extend existing one',
          impact: 'Will ensure continuous coverage'
        });
      }
    }

    // Check for invalid date ranges
    schedules.forEach(schedule => {
      const from = parseISO(schedule.from_date);
      const to = parseISO(schedule.to_date);

      if (!isValid(from) || !isValid(to)) {
        result.hasConflicts = true;
        result.conflicts.push({
          type: 'invalid_range',
          message: `Invalid date range in schedule ${schedule.version}`,
          affectedDates: [schedule.from_date, schedule.to_date],
          severity: 'high'
        });

        result.resolutions.push({
          action: 'Fix dates',
          description: 'Correct invalid date format',
          impact: 'Schedule will become usable'
        });
      }

      if (from >= to) {
        result.hasConflicts = true;
        result.conflicts.push({
          type: 'invalid_range',
          message: `Start date is not before end date in schedule ${schedule.version}`,
          affectedDates: [schedule.from_date, schedule.to_date],
          severity: 'high'
        });

        result.resolutions.push({
          action: 'Swap or adjust dates',
          description: 'Ensure start date is before end date',
          impact: 'Schedule will have correct temporal order'
        });
      }
    });

    return result;
  }

  /**
   * Data transformation utilities for different export formats
   */
  static transformScheduleData(schedule: Schedule, format: 'standard' | 'mep' | 'compact') {
    const baseData = {
      id: schedule.id,
      version: schedule.version,
      fromDate: schedule.from_date,
      toDate: schedule.to_date,
      isActive: schedule.is_active
    };

    switch (format) {
      case 'mep':
        return {
          ...baseData,
          // MEP-specific formatting
          filiale: schedule.meta?.created_by || 'Unknown',
          erstellungsdatum: format(parseISO(schedule.created_at), 'dd.MM.yyyy'),
          zeitraum: `${format(parseISO(schedule.from_date), 'dd.MM.yyyy')} - ${format(parseISO(schedule.to_date), 'dd.MM.yyyy')}`,
          version_info: schedule.meta?.version || '1.0'
        };

      case 'compact':
        return {
          id: schedule.id,
          v: schedule.version,
          dates: `${schedule.from_date}_${schedule.to_date}`,
          active: schedule.is_active ? 1 : 0
        };

      case 'standard':
      default:
        return {
          ...baseData,
          createdAt: schedule.created_at,
          updatedAt: schedule.updated_at,
          metadata: schedule.meta || {}
        };
    }
  }

  /**
   * Calculates schedule statistics and metrics
   */
  static calculateScheduleMetrics(schedule: Schedule) {
    const fromDate = parseISO(schedule.from_date);
    const toDate = parseISO(schedule.to_date);
    
    const totalDays = differenceInDays(toDate, fromDate) + 1;
    const weekCount = differenceInCalendarWeeks(toDate, fromDate) + 1;
    
    const days = eachDayOfInterval({ start: fromDate, end: toDate });
    const weekendDays = days.filter(day => isWeekend(day)).length;
    const workingDays = totalDays - weekendDays;

    return {
      totalDays,
      weekCount,
      workingDays,
      weekendDays,
      averageWorkingDaysPerWeek: Math.round((workingDays / weekCount) * 10) / 10,
      weekendPercentage: Math.round((weekendDays / totalDays) * 100),
      isLongTerm: totalDays > 90,
      isShortTerm: totalDays < 14
    };
  }

  /**
   * Generates suggestions for optimal schedule creation
   */
  static generateScheduleSuggestions(dateRange: DateRange | undefined, existingSchedules: Schedule[] = []) {
    const suggestions: Array<{
      type: 'optimization' | 'warning' | 'recommendation';
      message: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    if (!dateRange?.from || !dateRange?.to) {
      return suggestions;
    }

    const validation = this.validateDateRange(dateRange);
    
    // Add validation-based suggestions
    validation.warnings.forEach(warning => {
      suggestions.push({
        type: 'warning',
        message: warning,
        priority: 'medium'
      });
    });

    // Optimization suggestions
    if (validation.metadata.weekCount > 0) {
      if (validation.metadata.weekCount % 4 === 0) {
        suggestions.push({
          type: 'optimization',
          message: 'Date range aligns well with monthly cycles',
          priority: 'low'
        });
      }

      if (validation.metadata.workingDays >= validation.metadata.weekendDays * 2) {
        suggestions.push({
          type: 'optimization',
          message: 'Good ratio of working days to weekends',
          priority: 'low'
        });
      }
    }

    // Context-based suggestions with existing schedules
    if (existingSchedules.length > 0) {
      const conflicts = this.analyzeScheduleConflicts([
        ...existingSchedules,
        {
          id: 0,
          version: 'temp',
          from_date: format(dateRange.from, 'yyyy-MM-dd'),
          to_date: format(dateRange.to, 'yyyy-MM-dd'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: false
        }
      ]);

      if (conflicts.hasConflicts) {
        suggestions.push({
          type: 'warning',
          message: 'Potential conflicts with existing schedules',
          priority: 'high'
        });
      }
    }

    return suggestions;
  }
}

export default ScheduleBusinessLogic;
