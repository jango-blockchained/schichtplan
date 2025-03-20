// Common types
export type ISODateString = string;
export type TimeString = string; // Format: "HH:MM"

// Enum types
export enum EmployeeGroup {
    ASSOCIATE = "ASSOCIATE",
    ASSISTANT = "ASSISTANT",
    MANAGER = "MANAGER",
    INTERN = "INTERN"
}

export enum ShiftType {
    OPENING = "OPENING",
    CLOSING = "CLOSING",
    STANDARD = "STANDARD",
    SPECIAL = "SPECIAL"
}

export enum ScheduleStatus {
    DRAFT = "DRAFT",
    PUBLISHED = "PUBLISHED",
    ARCHIVED = "ARCHIVED"
}

export enum AvailabilityType {
    AVAILABLE = "AVAILABLE",
    UNAVAILABLE = "UNAVAILABLE",
    PREFERRED = "PREFERRED"
}

// Base model with common fields
export interface BaseModel {
    id: number;
    created_at: ISODateString;
    updated_at: ISODateString;
}

// Employee model
export interface Employee extends BaseModel {
    employee_id: string;
    first_name: string;
    last_name: string;
    employee_group: EmployeeGroup;
    contracted_hours: number;
    is_keyholder: boolean;
    is_active: boolean;
    birthday?: ISODateString;
    email?: string;
    phone?: string;
}

// Shift template model
export interface ShiftTemplate extends BaseModel {
    start_time: TimeString;
    end_time: TimeString;
    duration_hours: number;
    requires_break: boolean;
    shift_type: ShiftType;
    shift_type_id?: string;
    active_days: Record<string, boolean>;
}

// Schedule model
export interface Schedule extends BaseModel {
    employee_id: number;
    shift_id?: number;
    date: ISODateString;
    version: number;
    break_start?: TimeString;
    break_end?: TimeString;
    notes?: string;
    shift_type?: string;
    availability_type?: string;
    status: ScheduleStatus;
}

// Schedule version metadata
export interface ScheduleVersionMeta {
    version: number;
    created_at: ISODateString;
    created_by?: number;
    updated_at?: ISODateString;
    updated_by?: number;
    status: ScheduleStatus;
    date_range_start: ISODateString;
    date_range_end: ISODateString;
    base_version?: number;
    notes?: string;
}

// Employee availability model
export interface EmployeeAvailability extends BaseModel {
    employee_id: number;
    day_of_week: number;
    hour: number;
    is_available: boolean;
    start_date?: ISODateString;
    end_date?: ISODateString;
    is_recurring: boolean;
    availability_type: AvailabilityType;
}

// Absence model
export interface Absence extends BaseModel {
    employee_id: number;
    start_date: ISODateString;
    end_date: ISODateString;
    reason?: string;
    notes?: string;
}

// Coverage model
export interface Coverage extends BaseModel {
    day_index: number; // 0-6 (Sunday-Saturday)
    start_time: TimeString;
    end_time: TimeString;
    min_employees: number;
    max_employees: number;
    employee_types: string[];
    allowed_employee_groups?: string[];
    requires_keyholder: boolean;
    keyholder_before_minutes?: number;
    keyholder_after_minutes?: number;
}

// Settings model
export interface Settings extends BaseModel {
    // General Settings
    store_name: string;
    store_address?: string;
    store_contact?: string;
    timezone: string;
    language: string;
    date_format: string;
    time_format: string;

    // Store Hours
    store_opening: TimeString;
    store_closing: TimeString;

    // PDF Layout Presets
    pdf_layout_presets?: any;

    // Keyholder Time Settings
    keyholder_before_minutes: number;
    keyholder_after_minutes: number;

    // Store Opening Days and Hours
    opening_days: Record<string, boolean>;

    // Special Opening Hours
    special_hours: Record<string, { is_closed: boolean; opening?: TimeString; closing?: TimeString }>;

    // PDF Settings
    page_size: string;
    page_orientation: string;
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
} 