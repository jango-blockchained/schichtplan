import fs from "node:fs";
import path from "node:path";
import type { Database } from "bun:sqlite";

// Path to the initial schema SQL file
const schemaPath = path.join(import.meta.dir, "init-schema.sql");
const migrationsPath = path.join(import.meta.dir, "migrations");

/**
 * Applies a single migration file to the database
 * @param db - The database instance
 * @param migrationFile - The migration file name
 */
async function applyMigration(db: Database, migrationFile: string) {
  console.log(`Applying migration: ${migrationFile}`);
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
    console.log(`Successfully applied migration: ${migrationFile}`);
  } catch (error) {
    // Rollback on error
    db.exec('ROLLBACK;');
    console.error(`Failed to apply migration ${migrationFile}:`, error);
    throw error;
  }
}

/**
 * Applies the initial database schema and any pending migrations to the provided database instance.
 * @param targetDb - The bun:sqlite Database instance to apply the schema to.
 */
export async function applySchema(targetDb: Database) {
  console.log(`Applying schema from ${schemaPath} to the database...`);

  try {
    // Read and execute the initial schema SQL file
    const schemaSql = await Bun.file(schemaPath).text();
    console.log("Executing initial schema SQL...");
    targetDb.exec(schemaSql);
    console.log("Initial database schema applied successfully.");

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

    // Get list of migration files
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations are applied in order

    // Apply any pending migrations
    for (const migrationFile of migrationFiles) {
      if (!appliedMigrations.has(migrationFile)) {
        await applyMigration(targetDb, migrationFile);
      }
    }

    console.log("All migrations applied successfully.");
  } catch (error) {
    console.error("Schema/migration application failed:", error);
    throw error;
  }
}

// -- Standalone Execution Logic (for package.json script) --
if (import.meta.main) {
    console.log("Running migrate.ts as a standalone script...");
    import("../db")
      .then(async ({ default: defaultDb }) => {
          await applySchema(defaultDb);
          console.log("Standalone migration finished.");
      })
      .catch((err) => {
          console.error("Standalone migration script failed:", err);
          process.exit(1);
      });
} 