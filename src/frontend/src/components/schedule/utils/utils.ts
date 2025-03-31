import { Schedule } from '@/types';
import {
    timeToMinutes,
    formatMinutesToTime,
    formatHours,
    calculateShiftHours,
    determineShiftType,
    validateBreaks
} from '@/components/core/shifts/utils';

// Re-export utility functions from core/shifts/utils
export {
    timeToMinutes,
    formatMinutesToTime,
    formatHours,
    calculateShiftHours,
    determineShiftType,
    validateBreaks
};

// Schedule-specific utility functions

/**
 * Calculate break duration for a schedule
 */
export const calculateBreakDuration = (schedule: Schedule): number => {
    if (!schedule.break_start || !schedule.break_end) return 0;

    const breakStart = timeToMinutes(schedule.break_start);
    const breakEnd = timeToMinutes(schedule.break_end);
    return breakEnd - breakStart;
};

/**
 * Calculate shift duration for a schedule
 */
export const calculateScheduleDuration = (schedule: Schedule): number => {
    if (!schedule.shift_start || !schedule.shift_end) return 0;

    const shiftStart = timeToMinutes(schedule.shift_start);
    const shiftEnd = timeToMinutes(schedule.shift_end);
    const breakDuration = calculateBreakDuration(schedule);

    let duration = shiftEnd - shiftStart - breakDuration;
    if (duration < 0) duration += 24 * 60; // Handle overnight shifts
    
    return duration;
};

/**
 * Format time with fallback
 */
export const formatTime = (time: string | null): string => {
    return time || '00:00';
};

/**
 * Get shift type color based on settings
 */
export const getShiftTypeColor = (schedule: Schedule, settings: any): string => {
    // First try to get color from shift_type_id
    if (schedule.shift_type_id && settings?.shift_types) {
        const shiftType = settings.shift_types.find(
            (type: any) => type.id === schedule.shift_type_id
        );
        if (shiftType?.color) return shiftType.color;
    }

    // Fallback colors based on shift type
    const type = schedule.shift_type_id || determineShiftType(schedule.shift_start || undefined);
    switch (type) {
        case 'EARLY': return '#3b82f6';  // blue
        case 'MIDDLE': return '#22c55e'; // green
        case 'LATE': return '#f59e0b';   // amber
        default: return '#64748b';       // slate
    }
};