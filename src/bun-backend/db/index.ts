// src/bun-backend/db/index.ts
import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";

let db: Database | null = null;

// Only initialize the persistent DB if not in test environment
if (process.env.NODE_ENV !== 'test') {
    // Define the path to the database directory and file
    const instanceDir = path.resolve(import.meta.dir, "../../instance"); 
    const dbPath = path.join(instanceDir, "bun.db");

    // Ensure the instance directory exists
    if (!fs.existsSync(instanceDir)) {
      console.log(`Creating instance directory: ${instanceDir}`);
      fs.mkdirSync(instanceDir, { recursive: true });
    }

    console.log(`Connecting to persistent database at: ${dbPath}`);

    // Create or open the database connection
    db = new Database(dbPath);

    // Optional: Enable WAL mode for potentially better concurrency
    // db.exec("PRAGMA journal_mode = WAL;");

    console.log("Persistent database connection established.");

    // Handle process exit signals ONLY for the persistent DB
    const closePersistentDb = () => {
        if (db) {
            console.log("Closing persistent database connection.");
            db.close();
        }
    }
    process.on('exit', closePersistentDb);
    process.on('SIGINT', () => { closePersistentDb(); process.exit(0); });
    process.on('SIGTERM', () => { closePersistentDb(); process.exit(0); });

} else {
    console.log("NODE_ENV is 'test', skipping persistent database connection.");
}

// Export the database instance (will be null in test env)
export default db;

// Optional: Add a function to close the connection gracefully if needed
// Note: This specific function might not be needed if tests manage their own DBs
// export function closeDbConnection() { ... } 