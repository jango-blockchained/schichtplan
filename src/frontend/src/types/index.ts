export enum EmployeeGroup {
    VL = "VL",
    TZ = "TZ",
    GFB = "GfB",
    TL = "TL"
}

export enum ShiftType {
    EARLY = "Frühschicht",
    MIDDLE = "Mittelschicht",
    LATE = "Spätschicht"
}

export interface TimeSlot {
    day: 'MO' | 'DI' | 'MI' | 'DO' | 'FR' | 'SA';
    hour: number;
    available: boolean;
}

export interface Employee {
    id: number;
    employee_id: string;
    first_name: string;
    last_name: string;
    employee_group: EmployeeGroup;
    contracted_hours: number;
    is_keyholder: boolean;
}

export interface Shift {
    id: number;
    start_time: string;
    end_time: string;
    min_employees: number;
    max_employees: number;
    duration_hours: number;
    requires_break: boolean;
}

export interface Schedule {
    id: number;
    date: string;
    employee: {
        id: number;
        name: string;
    };
    shift: {
        id: number;
        start_time: string;
        end_time: string;
    };
    break_start: string | null;
    break_end: string | null;
}

export interface StoreConfig {
    id: number;
    store_name: string;
    opening_time: string;
    closing_time: string;
    min_employees_per_shift: number;
    max_employees_per_shift: number;
    break_duration_minutes: number;
}

export interface ShiftTemplate {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    is_default: boolean;
    shifts: {
        shift_type: ShiftType;
        start_time: string;
        end_time: string;
        min_employees: number;
        max_employees: number;
        days: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA')[];
    }[];
    created_at: string | null;
    updated_at: string | null;
}

export interface ApiError {
    error: string;
    details?: string;
} 