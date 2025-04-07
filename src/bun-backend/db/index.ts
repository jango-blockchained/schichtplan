// src/bun-backend/db/index.ts
import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";

// Define the path to the database directory and file
// import.meta.dir is /path/to/project/src/bun-backend/db
// ../../instance resolves to /path/to/project/src/instance
const instanceDir = path.resolve(import.meta.dir, "../../instance"); 
const dbPath = path.join(instanceDir, "bun.db");

// Ensure the instance directory exists
if (!fs.existsSync(instanceDir)) {
  console.log(`Creating instance directory: ${instanceDir}`);
  fs.mkdirSync(instanceDir, { recursive: true });
}

console.log(`Connecting to database at: ${dbPath}`);

// Create or open the database connection
// Bun automatically handles creating the file if it doesn't exist.
const db = new Database(dbPath);

// Optional: Enable WAL mode for potentially better concurrency
// db.exec("PRAGMA journal_mode = WAL;");

console.log("Database connection established.");

// Export the database instance for use in services
export default db;

// Optional: Add a function to close the connection gracefully if needed
export function closeDbConnection() {
  if (db) {
    console.log("Closing database connection.");
    db.close();
  }
}

// Handle process exit signals to close the DB connection
process.on('exit', closeDbConnection);
process.on('SIGINT', () => {
  closeDbConnection();
  process.exit(0);
});
process.on('SIGTERM', () => {
    closeDbConnection();
    process.exit(0);
}); 