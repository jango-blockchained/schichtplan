export enum EmployeeGroup {
  VZ = "VZ",
  TZ = "TZ",
  GFB = "GfB",
  TL = "TL",
}

export type ShiftType = "EARLY" | "MIDDLE" | "LATE" | "NO_WORK";

export interface TimeSlot {
  day: "MO" | "DI" | "MI" | "DO" | "FR" | "SA";
  hour: number;
  available: boolean;
}

export interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_group: string;
  contracted_hours: number;
  is_keyholder: boolean;
  is_active: boolean;
  birthday: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  updated_at: string | null;
  max_daily_hours: number;
  max_weekly_hours: number;
}

export type CreateEmployeeRequest = Omit<
  Employee,
  | "id"
  | "employee_id"
  | "created_at"
  | "updated_at"
  | "max_daily_hours"
  | "max_weekly_hours"
>;

export type UpdateEmployeeRequest = CreateEmployeeRequest;

export interface Shift {
  id: number;
  start_time: string;
  end_time: string;
  duration_hours: number;
  requires_break: boolean;
  active_days: number[]; // Array of weekday indices (0 = Monday, 6 = Sunday)
  created_at?: string;
  updated_at?: string;
  shift_type_id?: string;
}

export interface Schedule {
  id: number;
  employee_id: number;
  date: string;
  shift_id: number | null;
  shift_start: string | null | undefined;
  shift_end: string | null | undefined;
  is_empty: boolean | undefined;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  break_start?: string | null;
  break_end?: string | null;
  notes?: string | null;
  employee_name?: string;
  availability_type?: AvailabilityTypeStrings;
  shift_type_id?: ShiftType;
  shift_type_name?: string;
}

export interface ScheduleError {
  type: "critical" | "error" | "warning";
  message: string;
  date?: string;
  shift?: string;
}

export interface ScheduleResponse {
  schedules: Schedule[];
  errors?: ScheduleError[];
  version?: number;
  total_shifts?: number;
  filled_shifts_count?: number;
  total_schedules?: number;
  versions?: number[];
  version_statuses?: Record<number, string>;
  current_version?: number;
  version_meta?: any;
  logs?: string[];
  diagnostic_logs?: string[];
}

export interface ScheduleUpdate {
  id?: number;
  employee_id?: number | null;
  shift_id?: number | null;
  date?: string | null;
  break_duration?: number | null;
  notes?: string | null;
  version?: number | null;
  availability_type?: AvailabilityTypeStrings | null;
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
  special_hours: {
    [key: string]: { is_closed: boolean; opening: string; closing: string };
  };
  special_days: {
    [date: string]: {
      date: string;
      description: string;
      is_closed: boolean;
      custom_hours?: {
        opening: string; // HH:MM format
        closing: string; // HH:MM format
      };
    };
  };
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
    days: ("MO" | "TU" | "WE" | "TH" | "FR" | "SA")[];
  }[];
  created_at: string | null;
  updated_at: string | null;
}

export interface ApiError {
  error: string;
  details?: string;
}

export interface Settings {
  id: number;
  general: {
    store_name: string;
    store_address: string | null;
    store_phone: string | null;
    store_email: string | null;
    timezone: string;
    language: string;
    date_format: string;
    time_format: string;
    store_opening: string;
    store_closing: string;
    keyholder_before_minutes: number;
    keyholder_after_minutes: number;
    opening_days: { [key: string]: boolean };
    special_hours: {
      [key: string]: { is_closed: boolean; opening: string; closing: string };
    };
    special_days: {
      [date: string]: {
        date: string;
        description: string;
        is_closed: boolean;
        custom_hours?: {
          opening: string; // HH:MM format
          closing: string; // HH:MM format
        };
      };
    };
  };
  scheduling: {
    scheduling_resource_type: "shifts" | "coverage";
    default_shift_duration: number;
    min_break_duration: number;
    max_daily_hours: number;
    max_weekly_hours: number;
    min_rest_between_shifts: number;
    scheduling_period_weeks: number;
    auto_schedule_preferences: boolean;
    enable_diagnostics?: boolean;
    generation_requirements: {
      enforce_minimum_coverage: boolean;
      enforce_contracted_hours: boolean;
      enforce_keyholder_coverage: boolean;
      enforce_rest_periods: boolean;
      enforce_early_late_rules: boolean;
      enforce_employee_group_rules: boolean;
      enforce_break_rules: boolean;
      enforce_max_hours: boolean;
      enforce_consecutive_days: boolean;
      enforce_weekend_distribution: boolean;
      enforce_shift_distribution: boolean;
      enforce_availability: boolean;
      enforce_qualifications: boolean;
      enforce_opening_hours: boolean;
    };
    scheduling_algorithm?: "standard" | "optimized";
    max_generation_attempts?: number;
    // Ensure all backend fields are present and documented here for full round-trip support
  };
  display: {
    theme: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_color: string;
    surface_color: string;
    text_color: string;
    dark_theme?: {
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
    calendar_start_day?: "sunday" | "monday";
    calendar_default_view?: "month" | "week" | "day";
    email_notifications: boolean;
    schedule_published: boolean;
    shift_changes: boolean;
    time_off_requests?: boolean;
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
      abbr?: string;
      min_hours?: number;
      max_hours?: number;
      type: "employee_type";
    }>;
    shift_types: Array<{
      id: string;
      name: string;
      color: string;
      type: "shift_type";
      autoAssignOnly?: boolean;
    }>;
    absence_types: Array<{
      id: string;
      name: string;
      color: string;
      type: "absence_type";
    }>;
  };
  availability_types: {
    types: Array<{
      id: string;
      name: string;
      description?: string;
      color: string;
      priority?: number;
      is_available: boolean;
    }>;
  };
  actions: {
    demo_data?: {
      selected_module?: string;
      last_execution?: string | null;
    };
  };
  ai_scheduling?: {
    enabled?: boolean;
    api_key?: string | null;
  };
}

export interface CoverageTimeSlot {
  startTime: string;
  endTime: string;
  minEmployees: number;
  maxEmployees: number;
  employeeTypes: string[];
  requiresKeyholder: boolean;
  keyholderBeforeMinutes: number;
  keyholderAfterMinutes: number;
}

export interface DailyCoverage {
  dayIndex: number;
  timeSlots: CoverageTimeSlot[];
}

export interface PDFLayoutConfig {
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
}

export interface StoreConfigProps extends StoreConfig {
  min_employees_per_shift: number;
  max_employees_per_shift: number;
  employee_types: Array<{
    id: string;
    name: string;
    abbr?: string;
    min_hours: number;
    max_hours: number;
    type: "employee_type";
  }>;
}

export interface EmployeeType {
  id: string;
  name: string;
  min_hours: number;
  max_hours: number;
  type: "employee_type";
}

export interface AbsenceType {
  id: string;
  name: string;
  color: string;
  type: "absence_type";
}

export type GroupType = EmployeeType | AbsenceType;

export interface WeeklyShift {
  day: number;
  start_time: string;
  end_time: string;
  employee_id?: number;
  break?: {
    start: string;
    end: string;
    notes?: string;
  };
  start?: string;
  end?: string;
  shift_type_id?: string;
}

export interface WeeklySchedule {
  employee_id: number;
  name: string;
  position: string;
  contracted_hours: number;
  shifts: WeeklyShift[];
}

// New Types
export interface EmployeeAvailabilityStatus {
  employee_id: number;
  employee_name: string;
  status: string; // e.g., "Available", "Absence: Vacation", "Shift: Early (07:00-15:00)"
  details?: any; // Could be Absence object or Schedule object for more info
}

// String literals for AvailabilityType, matching backend Enum values
export type AvailabilityTypeStrings =
  | "AVAILABLE"
  | "FIXED"
  | "PREFERRED"
  | "UNAVAILABLE";

export interface ApplicableShift {
  shift_id: number;
  name: string;
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  availability_type: AvailabilityTypeStrings;
  is_available: boolean; // Whether the employee is fully available for this shift
  availability_hours?: Array<{ hour: number; availability_type: string }>; // Details about each hour's availability
  is_currently_assigned?: boolean; // Whether this shift is already assigned to this employee
  is_assigned_to_other?: boolean; // Whether this shift is assigned to another employee
}

export interface AiImportResponse {
  status: string; // e.g., "success", "warning", "error"
  message: string; // A human-readable message
  imported_count?: number; // Number of assignments successfully imported
  session_id?: string; // Optional session ID for diagnostics
  diagnostic_log?: string; // Optional path or identifier for the diagnostic log
}

export interface BaseCoverage {
  // ... existing code ...
}

export interface DeleteVersionResponse {
  message: string;
  deleted_schedules_count: number;
}

export interface Absence {
  id: number;
  employee_id: number;
  absence_type_id: string;
  start_date: string;
  end_date: string;
  note?: string;
}
