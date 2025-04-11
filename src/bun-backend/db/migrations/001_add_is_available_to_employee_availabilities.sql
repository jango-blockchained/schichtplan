-- Migration: Add is_available column to employee_availabilities table
-- Created at: 2024-03-26

-- Up Migration
ALTER TABLE employee_availabilities ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1;

-- Down Migration
ALTER TABLE employee_availabilities DROP COLUMN is_available; 