import { Schedule } from '@/types';

// Time formatting utilities
export const formatTime = (time: string | null): string => {
    return time || '00:00';
};

export const parseTime = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
};

export const formatMinutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Shift type determination
export type ShiftType = 'EARLY' | 'MIDDLE' | 'LATE';

export const determineShiftType = (schedule: Schedule): ShiftType => {
    if (schedule.shift_type_id) {
        return schedule.shift_type_id as ShiftType;
    }

    const startTime = schedule.shift_start;
    if (!startTime) return 'MIDDLE';

    const hour = parseInt(startTime.split(':')[0]);
    if (hour < 10) return 'EARLY';
    if (hour >= 14) return 'LATE';
    return 'MIDDLE';
};

// Break calculations
export const calculateBreakDuration = (schedule: Schedule): number => {
    if (!schedule.break_start || !schedule.break_end) return 0;

    const breakStart = parseTime(schedule.break_start);
    const breakEnd = parseTime(schedule.break_end);
    return breakEnd - breakStart;
};

export const calculateShiftDuration = (schedule: Schedule): number => {
    if (!schedule.shift_start || !schedule.shift_end) return 0;

    const shiftStart = parseTime(schedule.shift_start);
    const shiftEnd = parseTime(schedule.shift_end);
    const breakDuration = calculateBreakDuration(schedule);

    return shiftEnd - shiftStart - breakDuration;
};

// Color utilities
export const getShiftTypeColor = (schedule: Schedule, settings: any): string => {
    // First try to get color from shift_type_id
    if (schedule.shift_type_id && settings?.shift_types) {
        const shiftType = settings.shift_types.find(
            (type: any) => type.id === schedule.shift_type_id
        );
        if (shiftType?.color) return shiftType.color;
    }

    // Fallback colors based on shift type
    const type = determineShiftType(schedule);
    switch (type) {
        case 'EARLY': return '#3b82f6';  // blue
        case 'MIDDLE': return '#22c55e'; // green
        case 'LATE': return '#f59e0b';   // amber
        default: return '#64748b';       // slate
    }
};

// Validation utilities
export const validateBreaks = (schedule: Schedule): {
    hasBreakViolation: boolean;
    hasLongBreakViolation: boolean;
} => {
    const shiftDuration = calculateShiftDuration(schedule);
    const hasBreakViolation = shiftDuration > 360 && !schedule.break_start; // 6 hours = 360 minutes
    const hasLongBreakViolation = shiftDuration > 540 && !schedule.break_end; // 9 hours = 540 minutes

    return {
        hasBreakViolation,
        hasLongBreakViolation
    };
}; 