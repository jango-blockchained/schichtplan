import db from "."; // Import the opened database connection from index.ts
import fs from "node:fs";
import path from "node:path";

// Path to the initial schema SQL file
const schemaPath = path.join(import.meta.dir, "init-schema.sql");

async function runMigrations() {
  console.log("Starting database migration...");

  try {
    // Read the initial schema SQL file
    console.log(`Reading schema file: ${schemaPath}`);
    const schemaSql = await Bun.file(schemaPath).text();

    // Execute the SQL script
    // Use db.exec() for multiple statements or scripts
    console.log("Executing initial schema SQL...");
    db.exec(schemaSql);

    console.log("Database schema initialized successfully.");

    // --- Future Migration Logic ---
    // Here you could add logic to:
    // 1. Check a 'migrations' table for already applied migrations.
    // 2. List '.sql' files in a 'migrations/' subdirectory.
    // 3. Apply pending migration files sequentially using db.exec().
    // 4. Record applied migrations in the 'migrations' table.
    // Example:
    // const appliedMigrations = db.query("SELECT name FROM migrations;").all().map(row => row.name);
    // const migrationFiles = fs.readdirSync(path.join(import.meta.dir, 'migrations')).filter(f => f.endsWith('.sql')).sort();
    // for (const file of migrationFiles) {
    //   if (!appliedMigrations.includes(file)) {
    //      console.log(`Applying migration: ${file}`);
    //      const migrationSql = await Bun.file(path.join(import.meta.dir, 'migrations', file)).text();
    //      db.exec(migrationSql);
    //      db.query("INSERT INTO migrations (name) VALUES (?);").run(file);
    //   }
    // }
    // console.log("All migrations applied.");

  } catch (error) {
    console.error("Database migration failed:", error);
    process.exit(1); // Exit with error code
  } finally {
    // db.close(); // Close connection if this script is run standalone
    // Since db is imported from index.ts which handles closing, maybe not needed here?
    // Depending on how this script is run, decide if db.close() is appropriate.
  }
}

// Run the migration function
runMigrations(); 