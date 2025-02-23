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
    duration_hours: number;
    requires_break: boolean;
    active_days: number[];  // Array of weekday indices (0 = Monday, 6 = Sunday)
    created_at?: string;
    updated_at?: string;
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
    store_address: string;
    store_contact: string;
    timezone: string;
    language: string;
    date_format: string;
    time_format: string;
    opening_time: string;
    closing_time: string;
    keyholder_before_minutes: number;
    keyholder_after_minutes: number;
    opening_days: { [key: string]: boolean };
    special_hours: { [key: string]: { is_closed: boolean, opening: string, closing: string } };
    min_employees_per_shift: number;
    max_employees_per_shift: number;
    break_duration_minutes: number;
    created_at?: string;
    updated_at?: string;
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

export interface Settings {
    general: {
        store_name: string;
        store_address: string;
        store_contact: string;
        timezone: string;
        language: string;
        date_format: string;
        time_format: string;
        store_opening: string;
        store_closing: string;
        keyholder_before_minutes: number;
        keyholder_after_minutes: number;
        opening_days: { [key: string]: boolean };
        special_hours: { [key: string]: { is_closed: boolean, opening: string, closing: string } };
    };
    scheduling: {
        scheduling_resource_type: string;
        default_shift_duration: number;
        min_break_duration: number;
        max_daily_hours: number;
        max_weekly_hours: number;
        min_rest_between_shifts: number;
        scheduling_period_weeks: number;
        auto_schedule_preferences: boolean;
        min_employees_per_shift: number;
        max_employees_per_shift: number;
    };
    display: {
        theme: string;
        primary_color: string;
        secondary_color: string;
        accent_color: string;
        background_color: string;
        surface_color: string;
        text_color: string;
        dark_theme: {
            primary_color: string;
            secondary_color: string;
            accent_color: string;
            background_color: string;
            surface_color: string;
            text_color: string;
        };
        show_sunday: boolean;
        show_weekdays: boolean;
        start_of_week: number;
        email_notifications: boolean;
        schedule_published: boolean;
        shift_changes: boolean;
        time_off_requests: boolean;
    };
    pdf_layout: {
        page_size: string;
        orientation: string;
        margins: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        };
        table_style: {
            header_bg_color: string;
            border_color: string;
            text_color: string;
            header_text_color: string;
        };
        fonts: {
            family: string;
            size: number;
            header_size: number;
        };
        content: {
            show_employee_id: boolean;
            show_position: boolean;
            show_breaks: boolean;
            show_total_hours: boolean;
        };
    };
    employee_groups: {
        employee_types: Array<{
            id: string;
            name: string;
            min_hours: number;
            max_hours: number;
        }>;
        absence_types: Array<{
            id: string;
            name: string;
            color: string;
        }>;
    };
    actions: {
        demo_data: {
            selected_module: string;
            last_execution: string | null;
        };
    };
}

export interface CoverageTimeSlot {
    startTime: string;
    endTime: string;
    minEmployees: number;
    maxEmployees: number;
    employeeTypes: string[];
}

export interface DailyCoverage {
    dayIndex: number;
    timeSlots: CoverageTimeSlot[];
} 