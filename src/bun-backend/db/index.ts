// src/bun-backend/db/index.ts
import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";
import logger from "../logger"; // Import the logger

const instanceDir = path.resolve(__dirname, '../../instance');
const dbPath = path.join(instanceDir, 'app.db');

// Ensure instance directory exists
if (!fs.existsSync(instanceDir)) {
  logger.info(`Creating instance directory: ${instanceDir}`);
  fs.mkdirSync(instanceDir, { recursive: true });
}

let db: Database | null = null;

// Initialize persistent database connection unless in test environment
if (process.env.NODE_ENV !== 'test') {
  logger.info(`Connecting to persistent database at: ${dbPath}`);
  db = new Database(dbPath, { create: true });
  // Enable WAL mode for better concurrency
  db.exec("PRAGMA journal_mode = WAL;");
  logger.info("Persistent database connection established.");

  // Handle process exit signals ONLY for the persistent DB
  const closePersistentDb = () => {
    if (db) {
      logger.info("Closing persistent database connection.");
      db.close();
    }
  }
} else {
  logger.info("NODE_ENV is 'test', skipping persistent database connection.");
}

// Function to get the singleton DB instance or create a new one for tests
export const getDb = (memory = false): Database => {
  if (memory) {
    // Create and return a new in-memory database
    logger.info("Creating new in-memory database instance.");
    const memoryDb = new Database(":memory:");
    memoryDb.exec("PRAGMA journal_mode = WAL;"); // Apply WAL mode for consistency
    // Optionally apply schema to memory DB? Depends on use case.
    // import { applySchema } from './migrate'; // Would need import
    // applySchema(memoryDb); 
    return memoryDb;
  } else {
    // Return the singleton persistent instance
    if (!db) {
      // This should typically only happen if NODE_ENV === 'test'
      // The function is typed to return Database, not Database | null.
      // Throwing an error is safer than returning an unexpected null.
      logger.error("Attempted to get persistent DB instance when it was null (NODE_ENV='test'?).");
      throw new Error("Persistent database instance is not available. Ensure NODE_ENV is not 'test' or provide an instance.");
    }
    return db;
  }
}; // Closing brace for the function

// Graceful shutdown
process.on('exit', () => {
  if (db) {
    // logger.info("Closing persistent database connection."); // Logging handled in closePersistentDb
    // db.close(); // Closing handled in closePersistentDb
  }
});

// Removed the default export
