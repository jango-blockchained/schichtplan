// src/bun-backend/migrations/001_create_recurring_coverage.ts
import { getDb } from "../db"; // Adjust path if your db connection is elsewhere

console.log("Starting migration: 001_create_recurring_coverage...");

// Initialize the database instance
const db = getDb();

const createTableSQL = `
CREATE TABLE IF NOT EXISTS recurring_coverage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_template_id INTEGER NOT NULL,
    employee_id INTEGER NULL,
    recurrence_rule TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    notes TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_template_id) REFERENCES shift_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);`;

const createShiftTemplateIndexSQL = `
CREATE INDEX IF NOT EXISTS idx_recurring_coverage_shift_template_id ON recurring_coverage(shift_template_id);
`;

const createEmployeeIndexSQL = `
CREATE INDEX IF NOT EXISTS idx_recurring_coverage_employee_id ON recurring_coverage(employee_id);
`;

const createStartDateIndexSQL = `
CREATE INDEX IF NOT EXISTS idx_recurring_coverage_start_date ON recurring_coverage(start_date);
`;

const createUpdatedAtTriggerSQL = `
CREATE TRIGGER IF NOT EXISTS trigger_recurring_coverage_updated_at
AFTER UPDATE ON recurring_coverage
FOR EACH ROW
BEGIN
    UPDATE recurring_coverage SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
`;

try {
    // Use a transaction to ensure all steps succeed or fail together
    db.transaction(() => {
        console.log("Executing CREATE TABLE recurring_coverage...");
        db.run(createTableSQL);
        console.log("Table 'recurring_coverage' created or already exists.");

        console.log("Executing CREATE INDEX idx_recurring_coverage_shift_template_id...");
        db.run(createShiftTemplateIndexSQL);
        console.log("Index 'idx_recurring_coverage_shift_template_id' created or already exists.");

        console.log("Executing CREATE INDEX idx_recurring_coverage_employee_id...");
        db.run(createEmployeeIndexSQL);
        console.log("Index 'idx_recurring_coverage_employee_id' created or already exists.");

        console.log("Executing CREATE INDEX idx_recurring_coverage_start_date...");
        db.run(createStartDateIndexSQL);
        console.log("Index 'idx_recurring_coverage_start_date' created or already exists.");

        console.log("Executing CREATE TRIGGER trigger_recurring_coverage_updated_at...");
        // Triggers might need db.exec depending on exact syntax/implementation details, but run usually works
        db.run(createUpdatedAtTriggerSQL);
        console.log("Trigger 'trigger_recurring_coverage_updated_at' created or already exists.");

    })(); // Immediately invoke the transaction

    console.log("Migration 001_create_recurring_coverage completed successfully.");

} catch (error: any) {
    console.error("Migration 001_create_recurring_coverage failed:", error.message);
    // Depending on the setup, might want to exit with an error code
    // process.exit(1);
}

// Note: This script assumes the referenced tables 'shift_templates' and 'employees' already exist.
// You might need to adjust FK constraints or script order if not. 