// Assuming dates are stored as ISO 8601 strings (YYYY-MM-DD) in SQLite
// and timestamps as ISO 8601 strings (YYYY-MM-DDTHH:MM:SS.sssZ)

export interface Absence {
  id: number; // INTEGER PRIMARY KEY
  employee_id: number; // INTEGER, Foreign Key to Employee
  absence_type_id: string; // TEXT, Refers to settings data
  start_date: string; // TEXT (Date)
  end_date: string; // TEXT (Date)
  note?: string | null; // TEXT, nullable
  created_at: string; // TEXT (Timestamp)
  updated_at: string; // TEXT (Timestamp)
}

// We'll add other interfaces here as we translate them...

export enum EmployeeGroup {
  VZ = "VZ",   // Vollzeit
  TZ = "TZ",   // Teilzeit
  GFB = "GFB", // Geringfügig Beschäftigt
  TL = "TL"    // Team Leader
}

export interface Employee {
  id: number; // INTEGER PRIMARY KEY
  employee_id: string; // TEXT UNIQUE NOT NULL
  first_name: string; // TEXT NOT NULL
  last_name: string; // TEXT NOT NULL
  employee_group: EmployeeGroup; // TEXT NOT NULL (matches enum values)
  contracted_hours: number; // REAL NOT NULL
  is_keyholder: boolean; // INTEGER (0 or 1) NOT NULL DEFAULT 0
  is_active: boolean; // INTEGER (0 or 1) NOT NULL DEFAULT 1
  birthday?: string | null; // TEXT (Date YYYY-MM-DD), nullable
  email?: string | null; // TEXT UNIQUE, nullable
  phone?: string | null; // TEXT, nullable
  created_at: string; // TEXT (Timestamp ISO8601) NOT NULL
  updated_at: string; // TEXT (Timestamp ISO8601) NOT NULL
}

// ... other interfaces will follow ...

export enum AvailabilityType {
  AVAILABLE = "AVAILABLE",
  FIXED = "FIXED",
  PREFERRED = "PREFERRED",
  UNAVAILABLE = "UNAVAILABLE",
}

export interface EmployeeAvailability {
  id: number; // INTEGER PRIMARY KEY
  employee_id: number; // INTEGER NOT NULL, Foreign Key to Employee
  day_of_week: number; // INTEGER NOT NULL (0=Monday, 6=Sunday)
  hour: number; // INTEGER NOT NULL (0-23)
  // is_available is deprecated by availability_type, but keep for potential data migration?
  // Or map based on availability_type: is_available = availability_type !== UNAVAILABLE
  availability_type: AvailabilityType; // TEXT NOT NULL (matches enum values) DEFAULT AVAILABLE
  start_date?: string | null; // TEXT (Date YYYY-MM-DD), nullable
  end_date?: string | null; // TEXT (Date YYYY-MM-DD), nullable
  is_recurring: boolean; // INTEGER (0 or 1) NOT NULL DEFAULT 1
  created_at: string; // TEXT (Timestamp ISO8601) NOT NULL
  updated_at: string; // TEXT (Timestamp ISO8601) NOT NULL
}

// ... other interfaces will follow ...

export interface Coverage {
  id: number; // INTEGER PRIMARY KEY
  day_index: number; // INTEGER NOT NULL (0-6, SQLAlchemy model says Sun-Sat, needs confirmation or adjustment to Mon-Sun like Availability?)
  start_time: string; // TEXT NOT NULL ("HH:MM")
  end_time: string; // TEXT NOT NULL ("HH:MM")
  min_employees: number; // INTEGER NOT NULL DEFAULT 1
  max_employees: number; // INTEGER NOT NULL DEFAULT 3
  // JSON columns stored as TEXT, parsed/stringified in application
  employee_types: EmployeeGroup[]; // TEXT (JSON Array of EmployeeGroup values) NOT NULL
  allowed_employee_groups?: EmployeeGroup[] | null; // TEXT (JSON Array of EmployeeGroup values), nullable
  requires_keyholder: boolean; // INTEGER (0/1) NOT NULL DEFAULT 0
  keyholder_before_minutes?: number | null; // INTEGER, nullable
  keyholder_after_minutes?: number | null; // INTEGER, nullable
  created_at: string; // TEXT (Timestamp ISO8601)
  updated_at: string; // TEXT (Timestamp ISO8601)
}

export interface RecurringCoverage {
  id: number; // INTEGER PRIMARY KEY
  name: string; // TEXT NOT NULL
  description?: string | null; // TEXT, nullable
  days: number[]; // TEXT (JSON Array of day indices 0-6) NOT NULL
  start_date?: string | null; // TEXT ("YYYY-MM-DD"), nullable
  end_date?: string | null; // TEXT ("YYYY-MM-DD"), nullable
  start_time: string; // TEXT NOT NULL ("HH:MM")
  end_time: string; // TEXT NOT NULL ("HH:MM")
  min_employees: number; // INTEGER NOT NULL DEFAULT 1
  max_employees: number; // INTEGER NOT NULL DEFAULT 3
  // JSON columns stored as TEXT, parsed/stringified in application
  allowed_employee_groups?: EmployeeGroup[] | null; // TEXT (JSON Array of EmployeeGroup values), nullable
  requires_keyholder: boolean; // INTEGER (0/1) NOT NULL DEFAULT 0
  is_active: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  created_at: string; // TEXT (Timestamp ISO8601)
  updated_at: string; // TEXT (Timestamp ISO8601)
}

// ... other interfaces will follow ...

// Retain enum for mapping logic, but shift definition should primarily use settings
export enum ShiftType {
  EARLY = "EARLY",
  MIDDLE = "MIDDLE",
  LATE = "LATE",
  OFF = "OFF", // Note: Might not be a stored shift type, but rather absence/non-assignment
  NON_WORKING = "NON_WORKING", // Also likely not a stored shift, but derived
}

// Interface representing the structure of active_days JSON
export interface ActiveDays {
  [dayIndex: string]: boolean; // "0" through "6" for Sun-Sat or Mon-Sun
}

export interface ShiftPattern {
  id: number; // INTEGER PRIMARY KEY
  name: string; // TEXT NOT NULL UNIQUE
  description?: string | null; // TEXT, nullable
  shifts: number[]; // TEXT (JSON Array of ShiftTemplate IDs) NOT NULL DEFAULT '[]'
  active_days: ActiveDays; // TEXT (JSON Object like ActiveDays interface) NOT NULL
  is_active: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  created_at: string; // TEXT (Timestamp ISO8601)
  updated_at: string; // TEXT (Timestamp ISO8601)
}

export interface ShiftTemplate {
  id: number; // INTEGER PRIMARY KEY
  start_time: string; // TEXT NOT NULL ("HH:MM")
  end_time: string; // TEXT NOT NULL ("HH:MM")
  duration_hours: number; // REAL NOT NULL (Calculated field)
  requires_break: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  shift_type: ShiftType; // TEXT NOT NULL (Enum value, potentially derived)
  shift_type_id?: string | null; // TEXT, nullable (Refers to settings data)
  active_days: ActiveDays; // TEXT (JSON Object like ActiveDays interface) NOT NULL
  created_at: string; // TEXT (Timestamp ISO8601)
  updated_at: string; // TEXT (Timestamp ISO8601)
}

// ... other interfaces will follow ...

export enum ScheduleStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export interface Schedule {
  id: number; // INTEGER PRIMARY KEY
  employee_id: number; // INTEGER NOT NULL, Foreign Key to Employee
  shift_id?: number | null; // INTEGER, Foreign Key to ShiftTemplate, nullable (e.g., for OFF days)
  date: string; // TEXT (Date YYYY-MM-DD) NOT NULL
  version: number; // INTEGER NOT NULL DEFAULT 1
  break_start?: string | null; // TEXT ("HH:MM"), nullable
  break_end?: string | null; // TEXT ("HH:MM"), nullable
  notes?: string | null; // TEXT, nullable
  // shift_type and availability_type seem redundant if shift_id links to ShiftTemplate
  // and we have Absence/Availability tables. Consider removing or making derived.
  shift_type?: string | null; // TEXT, nullable (e.g., 'EARLY', 'LATE', 'OFF')
  availability_type?: AvailabilityType | string | null; // TEXT, nullable (e.g., 'AVAILABLE', 'UNAVAILABLE')
  status: ScheduleStatus; // TEXT NOT NULL DEFAULT DRAFT
  created_at: string; // TEXT (Timestamp ISO8601) NOT NULL
  updated_at: string; // TEXT (Timestamp ISO8601) NOT NULL
}

export interface ScheduleVersionMeta {
  version: number; // INTEGER PRIMARY KEY
  created_at: string; // TEXT (Timestamp ISO8601) NOT NULL
  created_by?: number | null; // INTEGER, nullable (User ID placeholder)
  updated_at?: string | null; // TEXT (Timestamp ISO8601), nullable
  updated_by?: number | null; // INTEGER, nullable (User ID placeholder)
  status: ScheduleStatus; // TEXT NOT NULL DEFAULT DRAFT
  date_range_start: string; // TEXT (Date YYYY-MM-DD) NOT NULL
  date_range_end: string; // TEXT (Date YYYY-MM-DD) NOT NULL
  base_version?: number | null; // INTEGER, nullable
  notes?: string | null; // TEXT, nullable
}

// ... other interfaces will follow ...

// Helper Interfaces for Settings JSON Columns

export interface OpeningDays {
  [dayIndex: string]: boolean; // "0" (Sun) to "6" (Sat) or "1" (Mon) to "7" (Sun) - clarify convention
}

export interface SpecialHourEntry {
  is_closed: boolean;
  opening: string; // "HH:MM"
  closing: string; // "HH:MM"
}

export interface SpecialHours {
  [date: string]: SpecialHourEntry; // Key: "YYYY-MM-DD"
}

export interface AvailabilityTypeDefinition {
  id: string;
  name: string;
  description: string;
  color: string; // Hex color
  priority: number;
  is_available: boolean;
}

// Assuming the top-level structure is just the array
// export interface AvailabilityTypes {
//   types: AvailabilityTypeDefinition[];
// }

export interface EmployeeTypeDefinition {
  id: string; // e.g., "VZ", "TZ"
  name: string;
  min_hours: number;
  max_hours: number;
  max_daily_hours: number;
  type: string; // likely "employee"
}

export interface ShiftTypeHourConditions {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  minDuration: number;
  maxDuration: number;
}

export interface ShiftTypeDefinition {
  id: string; // e.g., "EARLY", "LATE"
  name: string;
  color: string; // Hex color
  type: string; // likely "shift"
  hourConditions?: ShiftTypeHourConditions;
}

export interface AbsenceTypeDefinition {
  id: string; // e.g., "URL", "ABW"
  name: string;
  color: string; // Hex color
  type: string; // likely "absence"
}

// Define interface for PDF Layout configuration items
export interface PdfLayoutConfig {
  page_size: string; // "A4", "Letter", etc.
  orientation: "portrait" | "landscape";
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  table_header_bg_color: string; // Hex color
  table_border_color: string; // Hex color
  table_text_color: string; // Hex color
  table_header_text_color: string; // Hex color
  font_family: string;
  font_size: number;
  header_font_size: number;
  show_employee_id: boolean;
  show_position: boolean; // Assuming this refers to Employee Group/Type
  show_breaks: boolean;
  show_total_hours: boolean;
  // Add any other fields that might be part of a layout preset
  name?: string; // Optional name if storing presets directly
}

export interface PdfLayoutPresets {
  [presetName: string]: PdfLayoutConfig;
}

export interface ActionsDemoData {
    selected_module: string;
    last_execution: string | null; // ISO Timestamp
}

export interface SchedulingAdvanced {
    // Define known advanced properties or use Record<string, any>
    [key: string]: any;
}


// Main Settings Interface (Represents a single row in the settings table)
export interface Settings {
  id: number; // INTEGER PRIMARY KEY (Likely always 1)

  // General Settings
  store_name: string; // TEXT NOT NULL DEFAULT "TEDi Store"
  store_address?: string | null; // TEXT, nullable
  store_contact?: string | null; // TEXT, nullable
  timezone: string; // TEXT NOT NULL DEFAULT "Europe/Berlin"
  language: string; // TEXT NOT NULL DEFAULT "de"
  date_format: string; // TEXT NOT NULL DEFAULT "DD.MM.YYYY"
  time_format: string; // TEXT NOT NULL DEFAULT "24h"

  // Store Hours
  store_opening: string; // TEXT NOT NULL DEFAULT "09:00" ("HH:MM")
  store_closing: string; // TEXT NOT NULL DEFAULT "20:00" ("HH:MM")
  opening_days: OpeningDays; // TEXT (JSON) NOT NULL
  special_hours: SpecialHours; // TEXT (JSON) NOT NULL DEFAULT '{}'

  // Keyholder Time Settings
  keyholder_before_minutes: number; // INTEGER NOT NULL DEFAULT 15
  keyholder_after_minutes: number; // INTEGER NOT NULL DEFAULT 15
  require_keyholder: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1 (Simplified from hybrid property)

  // Scheduling Settings
  scheduling_resource_type: "coverage" | "shifts"; // TEXT NOT NULL DEFAULT "coverage"
  default_shift_duration: number; // REAL NOT NULL DEFAULT 8.0
  min_break_duration: number; // INTEGER NOT NULL DEFAULT 30 (minutes)
  max_daily_hours: number; // REAL NOT NULL DEFAULT 10.0
  max_weekly_hours: number; // REAL NOT NULL DEFAULT 40.0
  min_rest_between_shifts: number; // REAL NOT NULL DEFAULT 11.0 (hours)
  scheduling_period_weeks: number; // INTEGER NOT NULL DEFAULT 4
  auto_schedule_preferences: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  min_employees_per_shift: number; // INTEGER NOT NULL DEFAULT 1
  max_employees_per_shift: number; // INTEGER NOT NULL DEFAULT 3
  allow_dynamic_shift_adjustment: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  scheduling_advanced: SchedulingAdvanced; // TEXT (JSON) nullable DEFAULT '{}'


  // Display and Notification Settings
  theme: string; // TEXT NOT NULL DEFAULT "light"
  primary_color: string; // TEXT NOT NULL DEFAULT "#1976D2" (Hex)
  secondary_color: string; // TEXT NOT NULL DEFAULT "#424242" (Hex)
  accent_color: string; // TEXT NOT NULL DEFAULT "#FF4081" (Hex)
  background_color: string; // TEXT NOT NULL DEFAULT "#FFFFFF" (Hex)
  surface_color: string; // TEXT NOT NULL DEFAULT "#F5F5F5" (Hex)
  text_color: string; // TEXT NOT NULL DEFAULT "#212121" (Hex)
  dark_theme_primary_color: string; // TEXT NOT NULL DEFAULT "#90CAF9" (Hex)
  dark_theme_secondary_color: string; // TEXT NOT NULL DEFAULT "#757575" (Hex)
  dark_theme_accent_color: string; // TEXT NOT NULL DEFAULT "#FF80AB" (Hex)
  dark_theme_background_color: string; // TEXT NOT NULL DEFAULT "#121212" (Hex)
  dark_theme_surface_color: string; // TEXT NOT NULL DEFAULT "#1E1E1E" (Hex)
  dark_theme_text_color: string; // TEXT NOT NULL DEFAULT "#FFFFFF" (Hex)
  show_sunday: boolean; // INTEGER (0/1) NOT NULL DEFAULT 0
  show_weekdays: boolean; // INTEGER (0/1) NOT NULL DEFAULT 0
  start_of_week: number; // INTEGER NOT NULL DEFAULT 1 (0=Sun, 1=Mon)
  email_notifications: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  schedule_published_notify: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  shift_changes_notify: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  time_off_requests_notify: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1

  // PDF Layout Settings (Uses PdfLayoutConfig interface directly for the *current* settings)
  page_size: string; // TEXT NOT NULL DEFAULT "A4"
  orientation: "portrait" | "landscape"; // TEXT NOT NULL DEFAULT "portrait"
  margin_top: number; // REAL NOT NULL DEFAULT 20.0
  margin_right: number; // REAL NOT NULL DEFAULT 20.0
  margin_bottom: number; // REAL NOT NULL DEFAULT 20.0
  margin_left: number; // REAL NOT NULL DEFAULT 20.0
  table_header_bg_color: string; // TEXT NOT NULL DEFAULT "#f3f4f6" (Hex)
  table_border_color: string; // TEXT NOT NULL DEFAULT "#e5e7eb" (Hex)
  table_text_color: string; // TEXT NOT NULL DEFAULT "#111827" (Hex)
  table_header_text_color: string; // TEXT NOT NULL DEFAULT "#111827" (Hex)
  font_family: string; // TEXT NOT NULL DEFAULT "Helvetica"
  font_size: number; // REAL NOT NULL DEFAULT 10.0
  header_font_size: number; // REAL NOT NULL DEFAULT 12.0
  show_employee_id: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  show_position: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  show_breaks: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  show_total_hours: boolean; // INTEGER (0/1) NOT NULL DEFAULT 1
  pdf_layout_presets?: PdfLayoutPresets | null; // TEXT (JSON), nullable

  // Definition Data (Stored as JSON Text)
  availability_types: AvailabilityTypeDefinition[]; // TEXT (JSON Array) nullable
  employee_types: EmployeeTypeDefinition[]; // TEXT (JSON Array) NOT NULL
  shift_types: ShiftTypeDefinition[]; // TEXT (JSON Array) nullable (Simplified from hybrid)
  absence_types: AbsenceTypeDefinition[]; // TEXT (JSON Array) NOT NULL

  // Other
  actions_demo_data?: ActionsDemoData | null; // TEXT (JSON) nullable (Simplified from hybrid)

  // Timestamps
  created_at: string; // TEXT (Timestamp ISO8601)
  updated_at: string; // TEXT (Timestamp ISO8601)
}


// ... other interfaces will follow ... 