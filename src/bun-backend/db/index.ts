// src/bun-backend/db/index.ts
import { Database } from "bun:sqlite";
import path from "node:path";
// Removed direct fs import
// import fs from "node:fs";
import fsPromises from "node:fs/promises"; // Import promises API
import logger from "../logger"; // Import the logger

const instanceDir = path.resolve(__dirname, '../../instance');
const dbPath = path.join(instanceDir, 'bun.db');

let db: Database | null = null;
let dbInitializationPromise: Promise<void> | null = null;

// Function to initialize the persistent database
async function initializePersistentDb(): Promise<void> {
  // Avoid re-initialization if already done or in progress
  if (db || dbInitializationPromise) {
      return dbInitializationPromise ? await dbInitializationPromise : Promise.resolve();
  }

  // Start initialization
  dbInitializationPromise = (async () => {
    // Ensure instance directory exists asynchronously
    try {
      await fsPromises.access(instanceDir);
    } catch (error: unknown) { // Explicitly type error as unknown
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info(`Creating instance directory: ${instanceDir}`);
        try {
          await fsPromises.mkdir(instanceDir, { recursive: true });
        } catch (mkdirError: unknown) {
          const errorToLog = mkdirError instanceof Error ? mkdirError.message : String(mkdirError);
          logger.error(`Failed to create instance directory ${instanceDir}: ${errorToLog}`);
          dbInitializationPromise = null; // Reset promise on failure
          throw new Error("Failed to create database instance directory.");
        }
      } else {
        const errorToLog = error instanceof Error ? error.message : String(error);
        logger.error(`Error accessing instance directory ${instanceDir}: ${errorToLog}`);
        dbInitializationPromise = null; // Reset promise on failure
        throw new Error("Failed to access database instance directory.");
      }
    }

    // Initialize persistent database connection
    if (process.env.NODE_ENV !== 'test') {
      logger.info(`Connecting to persistent database at: ${dbPath}`);
      try {
          db = new Database(dbPath, { create: true });
          db.exec("PRAGMA journal_mode = WAL;");
          logger.info("Persistent database connection established.");

          // Handle process exit signals ONLY for the persistent DB
          const closePersistentDb = () => {
            if (db) {
              logger.info("Closing persistent database connection.");
              db.close();
              db = null; // Clear the reference
            }
          }
          process.on('SIGINT', closePersistentDb);
          process.on('SIGTERM', closePersistentDb);
          process.on('exit', closePersistentDb);
      } catch (dbError: unknown) {
          const errorToLog = dbError instanceof Error ? dbError.message : String(dbError);
          logger.error(`Failed to connect to database at ${dbPath}: ${errorToLog}`);
          db = null; // Ensure db is null on error
          dbInitializationPromise = null; // Reset promise on failure
          throw new Error("Database connection failed.");
      }
    } else {
      logger.info("NODE_ENV is 'test', skipping persistent database connection initialization.");
      // In test mode, persistent DB shouldn't be auto-initialized
      // If needed, it should be created manually or via a test setup function.
      db = null;
    }
  })();

  try {
    await dbInitializationPromise;
  } catch (initError) {
    // Reset promise if initialization failed, allowing retry maybe?
    dbInitializationPromise = null;
    throw initError; // Re-throw initialization error
  }
}

// Self-invoking async function removed - initialization is now on demand
// (async () => { ... })();

// Function to get the singleton DB instance or create a new one for tests
const getDb = async (memory = false): Promise<Database> => { // Make async
  if (memory) {
    // Create and return a new in-memory database
    logger.info("Creating new in-memory database instance.");
    const memoryDb = new Database(":memory:");
    memoryDb.exec("PRAGMA journal_mode = WAL;");
    return memoryDb;
  } else {
    // Ensure persistent DB is initialized
    if (!db) {
      await initializePersistentDb(); // Wait for initialization
    }

    // After awaiting, db should be initialized (or an error thrown)
    if (!db) {
         // This case should ideally not be reached if initializePersistentDb throws correctly
         logger.error("Persistent DB initialization failed or did not set the db instance.");
         throw new Error("Persistent database instance is not available after initialization attempt.");
    }
    return db;
  }
};

// Export initialization function if needed externally (optional)
export { initializePersistentDb };

// Export getDb
export { getDb };
export default getDb;
