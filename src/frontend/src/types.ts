// Basic types
export interface TimeSlot {
    start: string;
    end: string;
}

// Employee related types
export interface Employee {
    id: number;
    employee_id: string;
    first_name: string;
    last_name: string;
    employee_group: string;
    contracted_hours: number;
    is_keyholder: boolean;
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
    color: string;
}

export interface Shift {
    id: string;
    name: string;
    type_id: string;
    start_time: string;
    end_time: string;
    duration_hours: number;
    requires_break: boolean;
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
    break_start?: string;
    break_end?: string;
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
    store_name: string;
    store_address: string;
    min_employees_per_shift: number;
    max_employees_per_shift: number;
    min_keyholders_per_shift: number;
} 