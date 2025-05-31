-- Migration: Add AI Schedule Integration Tables
-- Description: Adds tables needed for AI-powered schedule optimization

-- Employee Preferences Table
CREATE TABLE IF NOT EXISTS employee_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    preference_type TEXT NOT NULL CHECK (preference_type IN ('day', 'time')),
    -- For day preferences
    day_of_week INTEGER, -- 0=Sunday, 6=Saturday
    -- For time preferences  
    start_time TEXT, -- HH:MM format
    end_time TEXT,   -- HH:MM format
    -- Preference level: 1=strongly dislike, 2=dislike, 3=neutral, 4=like, 5=strongly like
    preference_level INTEGER NOT NULL CHECK (preference_level BETWEEN 1 AND 5),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    -- Ensure we don't have duplicate preferences
    UNIQUE(employee_id, preference_type, day_of_week),
    UNIQUE(employee_id, preference_type, start_time, end_time)
);

-- Employee Qualifications Table (for skill matching)
CREATE TABLE IF NOT EXISTS employee_qualifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    qualification_id TEXT NOT NULL, -- References qualification types in settings
    acquired_date TEXT, -- Date qualification was acquired
    expiry_date TEXT,   -- Optional expiry date
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(employee_id, qualification_id)
);

-- Schedule Performance Metrics Table (for historical tracking)
CREATE TABLE IF NOT EXISTS schedule_performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    metric_date TEXT NOT NULL, -- YYYY-MM-DD
    punctuality_score REAL DEFAULT 1.0, -- 0-1 scale
    reliability_score REAL DEFAULT 1.0, -- 0-1 scale  
    quality_score REAL DEFAULT 1.0,     -- 0-1 scale
    attendance_rate REAL DEFAULT 1.0,   -- 0-1 scale
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(employee_id, metric_date)
);

-- AI Scoring Logs Table (for debugging and ML training)
CREATE TABLE IF NOT EXISTS ai_scoring_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id TEXT NOT NULL, -- UUID for the generation session
    employee_id INTEGER NOT NULL,
    shift_start TEXT NOT NULL, -- Timestamp
    shift_end TEXT NOT NULL,   -- Timestamp
    total_score REAL NOT NULL,
    
    -- Component scores
    availability_score REAL,
    preference_score REAL,
    fairness_score REAL,
    history_score REAL,
    workload_score REAL,
    keyholder_score REAL,
    skills_score REAL,
    fatigue_score REAL,
    
    -- Context data (JSON)
    scoring_context TEXT, -- JSON with full context
    ml_features TEXT,     -- JSON with extracted ML features
    
    was_assigned INTEGER NOT NULL DEFAULT 0, -- Whether this candidate was actually assigned
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Schedule Generation Logs Table
CREATE TABLE IF NOT EXISTS schedule_generation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id TEXT NOT NULL UNIQUE, -- UUID
    version INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL, -- SUCCESS, PARTIAL, FAILED
    
    -- Statistics
    total_slots INTEGER,
    filled_slots INTEGER,
    unfilled_slots INTEGER,
    total_assignments INTEGER,
    total_warnings INTEGER,
    
    -- Configuration used (JSON)
    scheduler_config TEXT,
    ai_config TEXT,
    
    -- Timing
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_seconds REAL,
    
    -- Results and logs (JSON)
    warnings TEXT,     -- JSON array of warnings
    error_message TEXT,
    
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    
    FOREIGN KEY (version) REFERENCES schedule_version_meta(version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_preferences_employee ON employee_preferences(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_qualifications_employee ON employee_qualifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_schedule_performance_employee_date ON schedule_performance_metrics(employee_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_ai_scoring_logs_generation ON ai_scoring_logs(generation_id);
CREATE INDEX IF NOT EXISTS idx_ai_scoring_logs_employee ON ai_scoring_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_schedule_generation_logs_version ON schedule_generation_logs(version);

-- Add triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_employee_preferences_timestamp 
AFTER UPDATE ON employee_preferences
BEGIN
    UPDATE employee_preferences SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_employee_qualifications_timestamp 
AFTER UPDATE ON employee_qualifications
BEGIN
    UPDATE employee_qualifications SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_schedule_performance_metrics_timestamp 
AFTER UPDATE ON schedule_performance_metrics
BEGIN
    UPDATE schedule_performance_metrics SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') 
    WHERE id = NEW.id;
END;