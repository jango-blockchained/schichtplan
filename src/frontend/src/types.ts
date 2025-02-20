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
export interface Shift {
    id: string;
    start_time: string;
    end_time: string;
    min_employees: number;
    max_employees: number;
    duration_hours: number;
    requires_break: boolean;
    created_at?: string;
    updated_at?: string;
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

export interface Settings {
    general: {
        store_name: string;
        store_address: string;
        store_contact: string;
        timezone: string;
        language: string;
        date_format: string;
        time_format: string;
        store_opening: string;  // Format: "HH:MM"
        store_closing: string;  // Format: "HH:MM"
        opening_days: {
            [key: string]: boolean;  // key: 0-6 (Sunday-Saturday)
        };
        special_hours: {
            [key: string]: {  // key: "YYYY-MM-DD"
                is_closed: boolean;
                opening?: string;  // Format: "HH:MM"
                closing?: string;  // Format: "HH:MM"
            };
        };
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
    display: {
        theme: string;
        primary_color: string;
        secondary_color: string;
        show_weekends: boolean;
        start_of_week: number;
    };
    notifications: {
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
        employee_types: BaseEmployeeType[];
        absence_types: BaseAbsenceType[];
    };
} 