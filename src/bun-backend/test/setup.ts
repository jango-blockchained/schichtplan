import { Database } from "bun:sqlite";
import path from "node:path";
import { applySchema } from "../db/migrate";
import { EmployeeGroup } from "../db/schema";

let dbInstance: Database | null = null;

/**
 * Initializes an in-memory SQLite database and applies the schema.
 * Should be called before tests that require DB interaction.
 * Returns the initialized database instance.
 */
export async function setupTestDb(): Promise<void> {
  if (dbInstance) {
    console.log("Test database already initialized.");
    return; // Already set up
  }
  console.log("Setting up in-memory database for test suite...");
  const tempDb = new Database(":memory:"); // Create new instance
  console.log(`Applying schema from ${path.join(import.meta.dir, "../db/init-schema.sql")} to the database...`);
  try {
    await applySchema(tempDb);
    console.log("In-memory database schema applied successfully.");
    // Assign to singleton *after* schema applied successfully
    dbInstance = tempDb;
    // Seed initial data once after schema application
    seedTestData(dbInstance); 
  } catch (err) {
    console.error("Error applying schema or seeding during setupTestDb:", err);
    // Ensure partial instance is closed if error occurred
    if (tempDb && !dbInstance) { // If tempDb was created but not assigned
      tempDb.close();
    }
    throw new Error(`Failed to apply schema or seed during test setup: ${err}`);
  }
}

/**
 * Provides access to the currently configured test database instance.
 * Ensures setupTestDb() has been called beforehand.
 */
export function getTestDb(): Database {
  if (!dbInstance) {
    // This error indicates a serious problem in test setup flow
    throw new Error("Test database is not initialized. Ensure async beforeAll completed.");
  }
  return dbInstance;
}

/**
 * Closes the in-memory database connection.
 * Should be called after tests are complete.
 */
export function teardownTestDb(): void {
  if (dbInstance) {
    console.log("Closing in-memory database instance.");
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Resets the database by closing the current connection 
 * and setting up a fresh in-memory instance with the schema.
 * Useful for isolating tests.
 */
// export async function resetTestDb(): Promise<Database> {
//     if (dbInstance) {
//         teardownTestDb(); // Close existing connection
//     }
//     // Setup a new DB instance and apply schema
//     await setupTestDb(); 
//     // Seeding is now done inside setupTestDb
//     return getTestDb(); // Return the newly created instance
// }

// Seeding function (remains synchronous)
export function seedTestData(testDb: Database): void {
  // Only seed if DB exists
  if (!testDb) {
    console.warn("Attempted to seed data but test DB is null.");
    return;
  }
  console.log("Seeding test data...");
  try {
    // Wrap seeds in a transaction for efficiency
    testDb.transaction(() => {
      // Seed default settings
      testDb.run(`
        INSERT OR IGNORE INTO settings (id, store_name, timezone, language, date_format, time_format, store_opening, store_closing, keyholder_before_minutes, keyholder_after_minutes, require_keyholder, scheduling_resource_type, default_shift_duration, min_break_duration, max_daily_hours, max_weekly_hours, min_rest_between_shifts, scheduling_period_weeks, auto_schedule_preferences, min_employees_per_shift, max_employees_per_shift, allow_dynamic_shift_adjustment, theme, primary_color, secondary_color, accent_color, background_color, surface_color, text_color, dark_theme_primary_color, dark_theme_secondary_color, dark_theme_accent_color, dark_theme_background_color, dark_theme_surface_color, dark_theme_text_color, show_sunday, show_weekdays, start_of_week, email_notifications, schedule_published_notify, shift_changes_notify, time_off_requests_notify, page_size, orientation, margin_top, margin_right, margin_bottom, margin_left, table_header_bg_color, table_border_color, table_text_color, table_header_text_color, font_family, font_size, header_font_size, show_employee_id, show_position, show_breaks, show_total_hours, opening_days, special_hours, scheduling_advanced, pdf_layout_presets, availability_types, employee_types, shift_types, absence_types, actions_demo_data, created_at, updated_at)
        VALUES (1, 'Test Store', 'Europe/Berlin', 'de', 'DD.MM.YYYY', 'HH:mm', '09:00', '21:00', 30, 30, 1, 'coverage', 8, 30, 10, 48, 11, 1, 1, 1, 3, 1, 'light', '#000000', '#ffffff', '#ff0000', '#ffffff', '#f8f8f8', '#000000', '#ffffff', '#000000', '#00ff00', '#000000', '#1e1e1e', '#ffffff', 1, 1, 1, 1, 1, 1, 1, 'A4', 'portrait', 10, 10, 10, 10, '#eeeeee', '#cccccc', '#000000', '#000000', 'Arial', 10, 12, 1, 1, 1, 1, '{"1": true, "2": true, "3": true, "4": true, "5": true, "6": true, "0": false}', '{}', '{}', null, '[]', '[]', '[]', '[]', null, datetime('now'), datetime('now'));
      `);
      console.log("Default settings seeded.");

      // Seed sample employees
      testDb.run(`
        INSERT OR IGNORE INTO employees (id, employee_id, first_name, last_name, employee_group, contracted_hours, is_keyholder, is_active, email, created_at, updated_at)
        VALUES
          (1, 'EMP001', 'Alice', 'Smith', 'VZ', 40, 1, 1, 'alice.smith@example.com', datetime('now'), datetime('now')),
          (2, 'EMP002', 'Bob', 'Johnson', 'TZ', 20, 0, 1, 'bob.j@example.com', datetime('now'), datetime('now')),
          (3, 'EMP003', 'Charlie', 'Brown', 'GFB', 10, 0, 1, 'charlie.b@example.com', datetime('now'), datetime('now')), -- Changed from MINI
          (4, 'EMP004', 'Diana', 'Davis', 'VZ', 40, 1, 0, 'diana.davis@example.com', datetime('now'), datetime('now')); -- Inactive employee
      `);
      console.log("Sample employees seeded.");

      // Seed sample coverage data
      testDb.run(`
        INSERT OR IGNORE INTO coverage (id, day_index, start_time, end_time, min_employees, max_employees, employee_types, allowed_employee_groups, requires_keyholder, created_at, updated_at)
        VALUES
          (1, 1, '08:00', '16:00', 2, 3, '["VZ","TZ"]' , '["VZ","TZ","GFB"]' , 0, datetime('now'), datetime('now')),
          (2, 1, '16:00', '22:00', 1, 2, '["VZ","TZ","GFB"]' , null , 1, datetime('now'), datetime('now')),
          (3, 2, '09:00', '17:00', 2, 2, '["VZ","TZ"]' , '["VZ","TZ"]' , 1, datetime('now'), datetime('now'));
      `);
      console.log("Sample coverage seeded.");
    })(); // End transaction
  } catch (error) {
    console.error("Failed to seed test data:", error);
    throw error;
  }
} 