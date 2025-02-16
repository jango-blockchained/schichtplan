// Basic types
export interface TimeSlot {
    start: string;
    end: string;
}

// Employee related types
export interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    employee_type: string;
    target_hours: number;
    max_hours: number;
    email?: string;
    phone?: string;
}

export interface EmployeeType {
    id: string;
    name: string;
    min_hours: number;
    max_hours: number;
}

// Shift related types
export interface ShiftType {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    color: string;
}

export interface Shift {
    id: string;
    date: string;
    employee_id: string;
    shift_type_id: string;
    start_time: string;
    end_time: string;
    break_duration: number;
}

export interface ShiftTemplate {
    id: string;
    name: string;
    shift_type_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    break_duration: number;
}

// Schedule related types
export interface Schedule {
    id: number;
    employee_id: number;
    shift_id: number;
    date: string;
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
    paid: boolean;
}

// Settings types
export interface Settings {
    general: {
        company_name: string;
        store_name: string;
        timezone: string;
        language: string;
        date_format: string;
        time_format: string;
    };
    scheduling: {
        default_shift_duration: number;
        min_break_duration: number;
        max_daily_hours: number;
        max_weekly_hours: number;
        min_rest_between_shifts: number;
        scheduling_period_weeks: number;
        auto_schedule_preferences: boolean;
    };
    shift_types: ShiftType[];
    employee_types: EmployeeType[];
    absence_types: AbsenceType[];
    display: {
        theme: 'light' | 'dark' | 'system';
        primary_color: string;
        secondary_color: string;
        show_weekends: boolean;
        start_of_week: 0 | 1;
    };
} 