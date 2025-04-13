-- src/bun-backend/db/init-schema.sql

-- Enable foreign key support
PRAGMA foreign_keys = ON;

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    employee_group TEXT NOT NULL CHECK(employee_group IN ('VZ', 'TZ', 'GFB', 'TL')),
    contracted_hours REAL NOT NULL,
    is_keyholder INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true
    can_be_keyholder INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true (Added for test compatibility)
    is_active INTEGER NOT NULL DEFAULT 1,    -- 0 = false, 1 = true
    birthday TEXT,                            -- ISO Date string 'YYYY-MM-DD'
    hire_date TEXT,                             -- ISO Date string 'YYYY-MM-DD' (Added)
    email TEXT UNIQUE,
    phone TEXT,
    address TEXT,                               -- Employee address (Added)
    notes TEXT,                                 -- Employee notes (Added)
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), -- ISO8601 Timestamp
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))  -- ISO8601 Timestamp
);

-- Absence Table
CREATE TABLE IF NOT EXISTS absences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    absence_type_id TEXT NOT NULL, -- Refers to settings.absence_types
    start_date TEXT NOT NULL,      -- ISO Date string 'YYYY-MM-DD'
    end_date TEXT NOT NULL,        -- ISO Date string 'YYYY-MM-DD'
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Employee Availability Table
CREATE TABLE IF NOT EXISTS employee_availabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0=Monday, 6=Sunday (Standard ISO 8601 week day)
    hour INTEGER NOT NULL,        -- 0-23
    availability_type TEXT NOT NULL CHECK(availability_type IN ('AVAILABLE', 'FIXED', 'PREFERRED', 'UNAVAILABLE')) DEFAULT 'AVAILABLE',
    start_date TEXT,              -- ISO Date string 'YYYY-MM-DD'
    end_date TEXT,                -- ISO Date string 'YYYY-MM-DD'
    is_recurring INTEGER NOT NULL DEFAULT 1, -- 0 = false, 1 = true
    is_available INTEGER NOT NULL DEFAULT 1, -- 0 = false, 1 = true
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Shift Templates Table
CREATE TABLE IF NOT EXISTS shift_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL, -- "HH:MM"
    end_time TEXT NOT NULL,   -- "HH:MM"
    duration_hours REAL NOT NULL, -- Consider if this should be calculated on read instead
    requires_break INTEGER NOT NULL DEFAULT 1, -- 0 = false, 1 = true
    -- shift_type is likely derived or redundant, use shift_type_id primarily
    shift_type TEXT NOT NULL CHECK(shift_type IN ('EARLY', 'MIDDLE', 'LATE', 'OFF', 'NON_WORKING')),
    shift_type_id TEXT, -- Refers to settings.shift_types
    active_days TEXT NOT NULL DEFAULT '{}', -- JSON object like {"1": true, "2": true...}
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Schedule Table
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    shift_id INTEGER,           -- Can be NULL for OFF days etc.
    date TEXT NOT NULL,         -- ISO Date string 'YYYY-MM-DD'
    version INTEGER NOT NULL DEFAULT 1,
    break_start TEXT,           -- "HH:MM"
    break_end TEXT,             -- "HH:MM"
    notes TEXT,
    -- shift_type might be redundant if shift_id is present
    shift_type TEXT,
    -- availability_type might be redundant
    availability_type TEXT CHECK(availability_type IS NULL OR availability_type IN ('AVAILABLE', 'FIXED', 'PREFERRED', 'UNAVAILABLE')),
    status TEXT NOT NULL CHECK(status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')) DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shift_templates(id) ON DELETE SET NULL
);

-- Schedule Version Metadata Table
CREATE TABLE IF NOT EXISTS schedule_version_meta (
    version INTEGER PRIMARY KEY, -- Version number itself is the PK
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_by INTEGER,       -- User ID (optional)
    updated_at TEXT,
    updated_by INTEGER,       -- User ID (optional)
    status TEXT NOT NULL CHECK(status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')) DEFAULT 'DRAFT',
    date_range_start TEXT NOT NULL, -- ISO Date string 'YYYY-MM-DD'
    date_range_end TEXT NOT NULL,   -- ISO Date string 'YYYY-MM-DD'
    base_version INTEGER,
    notes TEXT
);

-- Settings Table (Singleton - should only contain one row, e.g., id=1)
-- Many columns are JSON stored as TEXT
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK(id = 1), -- Enforce singleton row

    -- General Settings
    store_name TEXT NOT NULL DEFAULT 'TEDi Store',
    store_address TEXT,
    store_contact TEXT,
    timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
    language TEXT NOT NULL DEFAULT 'de',
    date_format TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
    time_format TEXT NOT NULL DEFAULT '24h',

    -- Store Hours
    store_opening TEXT NOT NULL DEFAULT '09:00',
    store_closing TEXT NOT NULL DEFAULT '20:00',
    opening_days TEXT NOT NULL DEFAULT '{"0": true, "1": true, "2": true, "3": true, "4": true, "5": false, "6": false}', -- JSON: Default Mon-Fri open
    special_hours TEXT NOT NULL DEFAULT '{}', -- JSON

    -- Keyholder Settings
    keyholder_before_minutes INTEGER NOT NULL DEFAULT 15,
    keyholder_after_minutes INTEGER NOT NULL DEFAULT 15,
    require_keyholder INTEGER NOT NULL DEFAULT 1, -- 0 = false, 1 = true

    -- Scheduling Settings
    scheduling_resource_type TEXT NOT NULL DEFAULT 'coverage' CHECK(scheduling_resource_type IN ('coverage', 'shifts')),
    default_shift_duration REAL NOT NULL DEFAULT 8.0,
    min_break_duration INTEGER NOT NULL DEFAULT 30,
    max_daily_hours REAL NOT NULL DEFAULT 10.0,
    max_weekly_hours REAL NOT NULL DEFAULT 40.0,
    min_rest_between_shifts REAL NOT NULL DEFAULT 11.0,
    scheduling_period_weeks INTEGER NOT NULL DEFAULT 4,
    auto_schedule_preferences INTEGER NOT NULL DEFAULT 1,
    min_employees_per_shift INTEGER NOT NULL DEFAULT 1,
    max_employees_per_shift INTEGER NOT NULL DEFAULT 3,
    allow_dynamic_shift_adjustment INTEGER NOT NULL DEFAULT 1,
    scheduling_advanced TEXT DEFAULT '{}', -- JSON

    -- Display and Notification Settings
    theme TEXT NOT NULL DEFAULT 'light',
    primary_color TEXT NOT NULL DEFAULT '#1976D2',
    secondary_color TEXT NOT NULL DEFAULT '#424242',
    accent_color TEXT NOT NULL DEFAULT '#FF4081',
    background_color TEXT NOT NULL DEFAULT '#FFFFFF',
    surface_color TEXT NOT NULL DEFAULT '#F5F5F5',
    text_color TEXT NOT NULL DEFAULT '#212121',
    dark_theme_primary_color TEXT NOT NULL DEFAULT '#90CAF9',
    dark_theme_secondary_color TEXT NOT NULL DEFAULT '#757575',
    dark_theme_accent_color TEXT NOT NULL DEFAULT '#FF80AB',
    dark_theme_background_color TEXT NOT NULL DEFAULT '#121212',
    dark_theme_surface_color TEXT NOT NULL DEFAULT '#1E1E1E',
    dark_theme_text_color TEXT NOT NULL DEFAULT '#FFFFFF',
    show_sunday INTEGER NOT NULL DEFAULT 0,
    show_weekdays INTEGER NOT NULL DEFAULT 0,
    start_of_week INTEGER NOT NULL DEFAULT 1,
    email_notifications INTEGER NOT NULL DEFAULT 1,
    schedule_published_notify INTEGER NOT NULL DEFAULT 1,
    shift_changes_notify INTEGER NOT NULL DEFAULT 1,
    time_off_requests_notify INTEGER NOT NULL DEFAULT 1,

    -- PDF Layout Settings
    page_size TEXT NOT NULL DEFAULT 'A4',
    orientation TEXT NOT NULL DEFAULT 'portrait' CHECK(orientation IN ('portrait', 'landscape')),
    margin_top REAL NOT NULL DEFAULT 20.0,
    margin_right REAL NOT NULL DEFAULT 20.0,
    margin_bottom REAL NOT NULL DEFAULT 20.0,
    margin_left REAL NOT NULL DEFAULT 20.0,
    table_header_bg_color TEXT NOT NULL DEFAULT '#f3f4f6',
    table_border_color TEXT NOT NULL DEFAULT '#e5e7eb',
    table_text_color TEXT NOT NULL DEFAULT '#111827',
    table_header_text_color TEXT NOT NULL DEFAULT '#111827',
    font_family TEXT NOT NULL DEFAULT 'Helvetica',
    font_size REAL NOT NULL DEFAULT 10.0,
    header_font_size REAL NOT NULL DEFAULT 12.0,
    show_employee_id INTEGER NOT NULL DEFAULT 1,
    show_position INTEGER NOT NULL DEFAULT 1,
    show_breaks INTEGER NOT NULL DEFAULT 1,
    show_total_hours INTEGER NOT NULL DEFAULT 1,
    pdf_layout_presets TEXT, -- JSON

    -- Definition Data (JSON stored as TEXT)
    availability_types TEXT, -- JSON Array
    employee_types TEXT NOT NULL DEFAULT '[]', -- JSON Array
    shift_types TEXT, -- JSON Array
    absence_types TEXT NOT NULL DEFAULT '[]', -- JSON Array

    -- Other
    actions_demo_data TEXT, -- JSON

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Insert default settings row if it doesn't exist
INSERT OR IGNORE INTO settings (id) VALUES (1);

-- Update the newly inserted or existing default settings row with default JSON types based on @Types
UPDATE settings
SET
    availability_types = '[
        {"id": "AVAILABLE", "name": "AVAILABLE", "description": "Mitarbeiter ist verfügbar", "color": "#4CAF50", "priority": 1, "is_available": true},
        {"id": "UNAVAILABLE", "name": "UNAVAILABLE", "description": "Mitarbeiter ist nicht verfügbar", "color": "#F44336", "priority": 10, "is_available": false},
        {"id": "FIXED", "name": "FIXED", "description": "Mitarbeiter hat feste Arbeitszeiten", "color": "#FF9800", "priority": 8, "is_available": true},
        {"id": "PREFERRED", "name": "PREFERRED", "description": "Mitarbeiter bevorzugt diese Zeit", "color": "#2196F3", "priority": 5, "is_available": true}
    ]',
    employee_types = '[
        {"id": "TL", "name": "Teamleiter", "min_hours": 38, "max_hours": 40, "max_daily_hours": 10, "type": "employee"},
        {"id": "VZ", "name": "Vollzeit", "min_hours": 35, "max_hours": 40, "max_daily_hours": 10, "type": "employee"},
        {"id": "TZ", "name": "Teilzeit", "min_hours": 15, "max_hours": 30, "max_daily_hours": 8, "type": "employee"},
        {"id": "GFB", "name": "Geringfügig", "min_hours": 0, "max_hours": 12, "max_daily_hours": 6, "type": "employee"}
    ]',
    shift_types = '[
        {"id": "EARLY", "name": "EARLY", "color": "#FFC107", "type": "shift"},
        {"id": "MIDDLE", "name": "MIDDLE", "color": "#03A9F4", "type": "shift"},
        {"id": "LATE", "name": "LATE", "color": "#673AB7", "type": "shift"}
    ]',
    absence_types = '[
        {"id": "URL", "name": "Urlaub", "color": "#FF9800", "type": "absence"},
        {"id": "ABW", "name": "Abwesend", "color": "#E91E63", "type": "absence"},
        {"id": "EXT", "name": "Extern", "color": "#9E9E9E", "type": "absence"}
    ]'
WHERE id = 1;

-- Coverage Table (Renaming back from coverage_requirements)
CREATE TABLE IF NOT EXISTS coverage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_index INTEGER NOT NULL, -- 0-6, assuming Mon-Sun convention needed
    start_time TEXT NOT NULL, -- "HH:MM"
    end_time TEXT NOT NULL,   -- "HH:MM"
    min_employees INTEGER NOT NULL DEFAULT 1,
    max_employees INTEGER NOT NULL DEFAULT 3,
    employee_types TEXT NOT NULL DEFAULT '[]', -- JSON Array of EmployeeGroup values
    allowed_employee_groups TEXT,             -- JSON Array of EmployeeGroup values
    requires_keyholder INTEGER NOT NULL DEFAULT 0,
    keyholder_before_minutes INTEGER,
    keyholder_after_minutes INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Recurring Coverage Table
CREATE TABLE IF NOT EXISTS recurring_coverage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    days TEXT NOT NULL, -- JSON Array of day indices [0-6]
    start_date TEXT,    -- "YYYY-MM-DD"
    end_date TEXT,      -- "YYYY-MM-DD"
    start_time TEXT NOT NULL, -- "HH:MM"
    end_time TEXT NOT NULL,   -- "HH:MM"
    min_employees INTEGER NOT NULL DEFAULT 1,
    max_employees INTEGER NOT NULL DEFAULT 3,
    allowed_employee_groups TEXT, -- JSON Array of EmployeeGroup values
    requires_keyholder INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);


-- Shift Patterns Table
CREATE TABLE IF NOT EXISTS shift_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    shifts TEXT NOT NULL DEFAULT '[]', -- JSON Array of shift template IDs
    active_days TEXT NOT NULL DEFAULT '{}', -- JSON object like {"1": true, ...}
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_employee_availabilities_employee_day ON employee_availabilities (employee_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedules_employee_date ON schedules (employee_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_version ON schedules (version);
CREATE INDEX IF NOT EXISTS idx_absences_employee_dates ON absences (employee_id, start_date, end_date); 