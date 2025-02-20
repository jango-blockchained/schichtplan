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
    name: string;
    is_keyholder: boolean;
    contracted_hours: number;
}

export interface Shift {
    id: number;
    start_time: string;
    end_time: string;
    min_employees: number;
    max_employees: number;
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
    errors?: ScheduleError[];
    version?: number;
    total_shifts?: number;
    versions?: number[];
}

export interface ScheduleUpdate {
    employee_id?: number;
    shift_id?: number;
    date?: string;
    break_start?: string;
    break_end?: string;
    notes?: string;
}

export interface DateRange {
    from: Date;
    to: Date;
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