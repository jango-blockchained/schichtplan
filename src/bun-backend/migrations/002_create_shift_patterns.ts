// src/bun-backend/migrations/002_create_shift_patterns.ts
import db from "../db"; // Adjust path as needed

console.log("Starting migration: 002_create_shift_patterns...");

const createTableSQL = `
CREATE TABLE IF NOT EXISTS shift_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    shift_template_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

const createUpdatedAtTriggerSQL = `
CREATE TRIGGER IF NOT EXISTS trigger_shift_patterns_updated_at
AFTER UPDATE ON shift_patterns
FOR EACH ROW
BEGIN
    UPDATE shift_patterns SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
`;

try {
    db.transaction(() => {
        console.log("Executing CREATE TABLE shift_patterns...");
        db.run(createTableSQL);
        console.log("Table 'shift_patterns' created or already exists.");

        console.log("Executing CREATE TRIGGER trigger_shift_patterns_updated_at...");
        db.run(createUpdatedAtTriggerSQL);
        console.log("Trigger 'trigger_shift_patterns_updated_at' created or already exists.");
    })();

    console.log("Migration 002_create_shift_patterns completed successfully.");

} catch (error: any) {
    console.error("Migration 002_create_shift_patterns failed:", error.message);
    // Consider exiting with an error code
    // process.exit(1);
} 