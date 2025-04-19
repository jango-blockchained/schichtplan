import { Database } from "bun:sqlite";
import { applySchema } from "./migrate";
import logger from "../logger";

/**
 * Checks if the database has been initialized and applies schema if not
 * @param db The database instance to check
 * @returns Promise<boolean> True if initialization was needed and performed
 */
export async function ensureDatabaseInitialized(db: Database): Promise<boolean> {
    try {
        // Check if the settings table exists as a way to determine if DB is initialized
        // const tablesCheck = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='settings';");
        // const tableExists = tablesCheck.get();

        // if (!tableExists) { // REMOVED: Always apply schema for reinitialization
        logger.info("Applying database schema (reinitialization requested)...");
        await applySchema(db); // Always call applySchema
        logger.info("Database schema application completed successfully.");
        return true;
        // }

        // return false; // REMOVED: Always returns true now
    } catch (error) {
        logger.error(`Error ensuring database initialization: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(`Failed to ensure database initialization: ${error instanceof Error ? error.message : String(error)}`);
    }
}
