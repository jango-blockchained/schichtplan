-- Initial database setup for Schichtplan
-- This script is executed when PostgreSQL container starts

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema
CREATE SCHEMA IF NOT EXISTS schichtplan;

-- Set default schema search path
ALTER DATABASE schichtplan SET search_path TO schichtplan, public;

-- Grant permissions
GRANT USAGE ON SCHEMA schichtplan TO schichtplan_user;
GRANT CREATE ON SCHEMA schichtplan TO schichtplan_user;
GRANT ALL PRIVILEGES ON SCHEMA schichtplan TO schichtplan_user;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255),
    operation VARCHAR(10),
    old_data JSONB,
    new_data JSONB,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);

-- Grant permissions for audit table
GRANT ALL PRIVILEGES ON audit_logs TO schichtplan_user;
GRANT USAGE, SELECT ON SEQUENCE audit_logs_id_seq TO schichtplan_user;

COMMIT;
