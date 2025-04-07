import fs from "node:fs";
import path from "node:path";
import type { Database } from "bun:sqlite";

// Path to the initial schema SQL file
const schemaPath = path.join(import.meta.dir, "init-schema.sql");

/**
 * Applies the initial database schema to the provided database instance.
 * @param targetDb - The bun:sqlite Database instance to apply the schema to.
 */
export async function applySchema(targetDb: Database) {
  console.log(`Applying schema from ${schemaPath} to the database...`);

  try {
    // Read the initial schema SQL file
    const schemaSql = await Bun.file(schemaPath).text();

    // Execute the SQL script on the provided database instance
    console.log("Executing initial schema SQL...");
    targetDb.exec(schemaSql);

    console.log("Database schema applied successfully.");

    // --- Future Migration Logic Placeholder ---
    // Logic for checking/applying subsequent migration files would go here,
    // operating on the targetDb instance.
    // Example:
    // const checkTableQuery = targetDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';");
    // if (!checkTableQuery.get()) { targetDb.exec('CREATE TABLE migrations (name TEXT PRIMARY KEY);'); }
    // ... rest of migration logic ...

  } catch (error) {
    console.error("Applying schema failed:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

// -- Standalone Execution Logic (for package.json script) --
// This block allows running `bun run src/bun-backend/db/migrate.ts` directly
// It checks if the script is the main module being run.
// The `module` variable might behave differently in Bun vs Node, using `import.meta.main` is safer in Bun.
if (import.meta.main) {
    console.log("Running migrate.ts as a standalone script...");
    // Import the default DB connection ONLY when run as script
    import("../db")
      .then(async ({ default: defaultDb }) => {
          await applySchema(defaultDb);
          console.log("Standalone migration finished.");
          // Decide whether to close the default connection here.
          // If the main app server imports and keeps the DB open, closing here might be bad.
          // defaultDb.close(); 
      })
      .catch((err) => {
          console.error("Standalone migration script failed:", err);
          process.exit(1);
      });
} 