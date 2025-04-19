import { $ } from "bun";
import path from "node:path";
import type { Database } from "bun:sqlite";
import logger from '../logger';

// Path to the initial schema SQL file
const schemaPath = path.join(import.meta.dir, "init-schema.sql");
const migrationsPath = path.join(import.meta.dir, "migrations");

/**
 * Applies a single migration file to the database
 * @param db - The database instance
 * @param migrationFile - The migration file name
 */
async function applyMigration(db: Database, migrationFile: string) {
  logger.info(`Applying migration: ${migrationFile}`);
  const migrationPath = path.join(migrationsPath, migrationFile);
  const migrationSql = await Bun.file(migrationPath).text();

  // Split the migration SQL into up and down parts
  const upMatch = migrationSql.match(/-- Up Migration\s+([\s\S]*?)(?=-- Down Migration|$)/);
  if (!upMatch) {
    throw new Error(`Invalid migration format in ${migrationFile}`);
  }

  const upSql = upMatch[1].trim();

  try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION;');

    // Execute the up migration
    db.exec(upSql);

    // Record the migration
    db.exec(`
      INSERT INTO applied_migrations (name, applied_at)
      VALUES (?, datetime('now'))
    `, [migrationFile]);

    // Commit transaction
    db.exec('COMMIT;');
    logger.info(`Successfully applied migration: ${migrationFile}`);
  } catch (error: unknown) {
    // Rollback on error
    db.exec('ROLLBACK;');
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to apply migration ${migrationFile}: ${errorMessage}`);
    throw error;
  }
}

/**
 * Applies the initial database schema and any pending migrations to the provided database instance.
 * @param targetDb - The bun:sqlite Database instance to apply the schema to.
 */
export async function applySchema(targetDb: Database) {
  logger.info(`Applying schema from ${schemaPath} to the database...`);

  try {
    // Read the initial schema SQL file
    const schemaSql = await Bun.file(schemaPath).text();
    logger.info("Executing initial schema SQL...");

    // Split SQL into individual statements (basic split, might need refinement for complex cases)
    const sqlStatements = schemaSql
      .split(/;\s*\r?\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute statements within a transaction
    logger.info("Starting schema transaction...");
    try {
      targetDb.transaction(() => {
        for (const [index, statement] of sqlStatements.entries()) {
          logger.info(`Executing statement ${index + 1}/${sqlStatements.length}: ${statement.substring(0, 150)}...`);
          try {
            targetDb.exec(statement);
          } catch (stmtError: unknown) {
            const errorMsg = stmtError instanceof Error ? stmtError.message : String(stmtError);
            logger.error(`Error executing statement ${index + 1}: ${errorMsg}`);
            logger.error(`Failed statement: ${statement}`);
            throw stmtError; // Re-throw to abort transaction
          }
        }
      })(); // Immediately invoke the transaction function
      logger.info("Schema transaction committed successfully.");
    } catch (txError: unknown) {
       const errorMsg = txError instanceof Error ? txError.message : String(txError);
       logger.error(`Schema transaction failed: ${errorMsg}`);
       throw txError; // Re-throw original error
    }

    logger.info("Initial database schema applied successfully.");

    // Create migrations tracking table if it doesn't exist
    targetDb.exec(`
      CREATE TABLE IF NOT EXISTS applied_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    // Get list of applied migrations
    const appliedMigrations = new Set(
      targetDb.query("SELECT name FROM applied_migrations;")
        .all()
        .map((row: any) => row.name)
    );

    // Get list of migration files using Bun Shell
    const migrationFilesOutput = await $`ls ${migrationsPath}`.text();
    const migrationFiles = migrationFilesOutput
      .split('\n') // Split filenames by newline
      .filter(file => file.trim().endsWith('.sql')) // Filter SQL files and trim whitespace
      .sort(); // Ensure migrations are applied in order

    // const migrationFiles = fs.readdirSync(migrationsPath)
    //   .filter(file => file.endsWith('.sql'))
    //   .sort(); // Ensure migrations are applied in order

    // Apply any pending migrations
    for (const migrationFile of migrationFiles) {
       const trimmedFileName = migrationFile.trim(); // Trim whitespace just in case
       if (!appliedMigrations.has(trimmedFileName)) {
        await applyMigration(targetDb, trimmedFileName);
      }
    }

    logger.info("All migrations applied successfully.");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Schema/migration application failed: ${errorMessage}`);
    throw error;
  }
}

// -- Standalone Execution Logic (for package.json script) --
if (import.meta.main) {
    logger.info("Running migrate.ts as a standalone script...");
    // Use an async IIFE to allow top-level await for getDb
    (async () => {
      try {
        const { getDb } = await import("../db"); // Await the import
        const dbInstance = await getDb(); // Await the async getDb call
        // No need to check if dbInstance is null, getDb should throw if failed
        await applySchema(dbInstance);
        logger.info("Standalone migration finished.");
      } catch (err: unknown) {
        let errorMsg = err instanceof Error ? err.message : String(err);
        const rawErrorStr = JSON.stringify(err, Object.getOwnPropertyNames(err));

        if (!errorMsg || errorMsg.trim() === '') {
            errorMsg = "Unknown error object (no message)";
        }

        try {
            await logger.error(`Standalone migration script failed: ${errorMsg}. Raw error: ${rawErrorStr}`);
        } catch (logErr) {
            console.error(`Standalone migration script failed (logger also failed): ${errorMsg}. Raw error: ${rawErrorStr}`);
            console.error("Logging error:", logErr);
        }
        process.exit(1);
      }
    })();
}
