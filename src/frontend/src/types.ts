// Basic types
export interface TimeSlot {
    day: 'MO' | 'DI' | 'MI' | 'DO' | 'FR' | 'SA';
    hour: number;
    available: boolean;
}

// Employee related types
export interface Employee {
    id: number;
    name: string;
    is_keyholder: boolean;
    contracted_hours: number;
}

export interface EmployeeType {
    id: string;
    name: string;
    min_hours: number;
    max_hours: number;
}

// Shift related types
export interface Shift {
    id: number;
    start_time: string;
    end_time: string;
    min_employees: number;
    max_employees: number;
    duration_hours: number;
    requires_break: boolean;
    active_days: { [key: string]: boolean };
    created_at?: string;
    updated_at?: string;
}

// Schedule related types
export interface DateRange {
    from: Date | undefined;
    to: Date | undefined;
}

export interface Schedule {
    id: number;
    employee_id: number;
    employee_name: string;
    shift_id: number;
    shift_start: string;
    shift_end: string;
    date: string;
    version: number;
    break_start?: string;
    break_end?: string;
    notes?: string;
}

export interface ScheduleError {
    type: 'critical' | 'error' | 'warning';
    message: string;
    date?: string;
    shift?: string;
}

export interface ScheduleResponse {
    schedules: Schedule[];
    versions: number[];
    errors?: ScheduleError[];
    total_shifts: number;
    warnings: string[];
}

export interface ScheduleUpdate {
    employee_id?: number;
    shift_id?: number;
    date?: string;
    break_start?: string;
    break_end?: string;
    notes?: string;
}

// Store configuration types
export interface StoreConfig {
    name: string;
    address: string;
    opening_hours: TimeSlot[];
    break_rules: {
        min_duration: number;
        max_duration: number;
        threshold_hours: number;
    };
}

// Absence types
export interface AbsenceType {
    id: string;
    name: string;
    color: string;
}

// Settings types
export interface BaseGroup {
    id: string;
    name: string;
}

export interface BaseEmployeeType extends BaseGroup {
    min_hours: number;
    max_hours: number;
}

export interface BaseAbsenceType extends BaseGroup {
    color: string;
}

export interface WeeklySchedule {
    employee_id: number;
    name: string;
    position: string;
    contracted_hours: number;
    shifts: Array<{
        day: number;
        start?: string;
        end?: string;
        break?: {
            start: string;
            end: string;
            notes?: string;
        };
    }>;
}

export interface DailyCoverage {
    id?: number;
    dayIndex: number;
    timeSlots: CoverageTimeSlot[];
}

export interface CoverageTimeSlot {
    id?: number;
    startTime: string;
    endTime: string;
    minEmployees: number;
    maxEmployees: number;
} 