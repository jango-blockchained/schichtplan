// src/bun-backend/migrations/002_create_shift_patterns.ts
import type { Database } from 'bun:sqlite';
import logger from '../logger'; // Import the logger
// import db from "../db"; // Remove unused default import

export async function up(db: Database): Promise<void> {
    logger.info("Starting migration: 002_create_shift_patterns...");

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
            logger.info("Executing CREATE TABLE shift_patterns...");
            db.run(createTableSQL);
            logger.info("Table 'shift_patterns' created or already exists.");

            logger.info("Executing CREATE TRIGGER trigger_shift_patterns_updated_at...");
            db.run(createUpdatedAtTriggerSQL);
            logger.info("Trigger 'trigger_shift_patterns_updated_at' created or already exists.");
        })();

        logger.info("Migration 002_create_shift_patterns completed successfully.");

    } catch (error: any) {
        db.exec('ROLLBACK;');
        logger.error("Migration 002_create_shift_patterns failed:", error.message);
        throw error;
    }
}

// ... existing code ... 