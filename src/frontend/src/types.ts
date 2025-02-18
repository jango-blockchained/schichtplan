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
    min_employees: number;
    max_employees: number;
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
export type BaseShiftType = {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    color: string;
};

export type BaseEmployeeType = {
    id: string;
    name: string;
    min_hours: number;
    max_hours: number;
};

export type BaseAbsenceType = {
    id: string;
    name: string;
    color: string;
    paid: boolean;
};

export interface Settings {
    // General Settings
    store_name: string;
    store_address: string;
    store_contact: string;
    timezone: string;
    language: string;
    date_format: string;
    time_format: string;

    // Scheduling Settings
    default_shift_duration: number;
    min_break_duration: number;
    max_daily_hours: number;
    max_weekly_hours: number;
    min_rest_between_shifts: number;
    scheduling_period_weeks: number;
    auto_schedule_preferences: boolean;

    // Display Settings
    theme: string;
    primary_color: string;
    secondary_color: string;
    show_weekends: boolean;
    start_of_week: number;

    // Notification Settings
    email_notifications: boolean;
    schedule_published_notify: boolean;
    shift_changes_notify: boolean;
    time_off_requests_notify: boolean;

    // PDF Layout Settings
    page_size: string;
    orientation: string;
    margin_top: number;
    margin_right: number;
    margin_bottom: number;
    margin_left: number;
    table_header_bg_color: string;
    table_border_color: string;
    table_text_color: string;
    table_header_text_color: string;
    font_family: string;
    font_size: number;
    header_font_size: number;
    show_employee_id: boolean;
    show_position: boolean;
    show_breaks: boolean;
    show_total_hours: boolean;

    // Employee Group Settings
    shift_types: BaseShiftType[];
    employee_types: BaseEmployeeType[];
    absence_types: BaseAbsenceType[];
} 