#!/bin/bash

# Add missing columns to schedule_version_meta table
# These columns are required for the week-based versioning feature

echo "Adding missing columns to schedule_version_meta table..."

# Database path
DB_PATH="/home/jango/Git/maike2/schichtplan/src/instance/app.db"

# Add the missing columns
sqlite3 "$DB_PATH" << 'EOF'
-- Add week_identifier column
ALTER TABLE schedule_version_meta ADD COLUMN week_identifier TEXT;

-- Add month_boundary_mode column with default value
ALTER TABLE schedule_version_meta ADD COLUMN month_boundary_mode TEXT NOT NULL DEFAULT 'keep_intact';

-- Add is_week_based column with default value
ALTER TABLE schedule_version_meta ADD COLUMN is_week_based INTEGER NOT NULL DEFAULT 0;

-- Create index on week_identifier
CREATE INDEX idx_schedule_version_meta_week_identifier ON schedule_version_meta(week_identifier);

-- Verify the changes
.schema schedule_version_meta
EOF

echo "Migration completed!"
