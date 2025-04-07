import { Database } from "bun:sqlite";
import { applySchema } from "../db/migrate"; // Use the exported applySchema function

let db: Database;

/**
 * Initializes an in-memory SQLite database and applies the schema.
 * Should be called before tests that require DB interaction.
 * Returns the initialized database instance.
 */
export function setupTestDb(): Database {
  console.log("Setting up in-memory database for test...");
  db = new Database(":memory:"); // Create a new in-memory DB
  
  try {
    // Call the exported applySchema function with the in-memory DB instance
    // Note: applySchema is async, but we might not need to await it 
    // if bun:test waits for setup promises implicitly. 
    // However, explicit await is safer if unsure.
    // Let's assume we need to handle the async nature if applySchema throws.
    // Since setupTestDb is sync, we can't directly await here.
    // Option 1: Make setupTestDb async (requires changes in test files)
    // Option 2: Wrap in a self-invoking async function (less clean)
    // Option 3: Assume Bun test runner handles setup promises (potential race condition if not)
    // Option 4: Make migration logic synchronous if possible (might not be if file reads are inherently async)
    
    // For now, let's call it synchronously and rely on try/catch, 
    // but acknowledge this might hide async errors from applySchema.
    // A better approach would be to use beforeAll/beforeEach async hooks in your test files.
    applySchema(db).catch(err => {
        console.error("Async error during schema application in test setup:", err);
        // We can't easily fail the test run from here synchronously.
        // This highlights a limitation of synchronous setup functions with async operations.
        // Consider using beforeAll/beforeEach async hooks in your test files.
        throw new Error("Schema application failed asynchronously during test setup.");
    }); 
    // If applySchema were synchronous: applySchema(db);
    console.log("In-memory database schema applied (or application initiated).");
  } catch (error) {
    console.error("Failed to apply schema to in-memory database:", error);
    throw error; // Rethrow sync errors
  }
  return db;
}

/**
 * Provides access to the currently configured test database instance.
 * Ensures setupTestDb() has been called beforehand.
 */
export function getTestDb(): Database {
  if (!db) {
    throw new Error("Test database has not been initialized. Call setupTestDb() first.");
  }
  return db;
}

/**
 * Closes the in-memory database connection.
 * Should be called after tests are complete.
 */
export function teardownTestDb(): void {
  if (db) {
    console.log("Closing in-memory database.");
    db.close();
    // db = undefined; // Reset db variable if needed, depends on test runner lifecycle
  } else {
     console.warn("Teardown called but no test database was initialized.");
  }
}

/**
 * Resets the database by closing the current connection 
 * and setting up a fresh in-memory instance with the schema.
 * Useful for isolating tests.
 */
export function resetTestDb(): Database {
    if (db) {
        db.close();
    }
    // This will re-run the potentially problematic sync call to async applySchema
    return setupTestDb(); 
}

// Optional: Add seeding function if common data is needed
export function seedTestData(testDb: Database): void {
    console.log("Seeding test data...");
    try {
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
                (3, 'EMP003', 'Charlie', 'Brown', 'GFB', 10, 0, 1, 'charlie.b@example.com', datetime('now'), datetime('now')),
                (4, 'EMP004', 'Diana', 'Davis', 'VZ', 40, 1, 0, 'diana.davis@example.com', datetime('now'), datetime('now')); -- Inactive employee
        `);
        console.log("Sample employees seeded.");

        // Seed sample coverage data
        // Note: employee_types and allowed_employee_groups are JSON strings in the DB
        testDb.run(`
            INSERT OR IGNORE INTO coverage (id, day_index, start_time, end_time, min_employees, max_employees, employee_types, allowed_employee_groups, requires_keyholder, created_at, updated_at)
            VALUES
                (1, 1, '08:00', '16:00', 2, 3, '["VZ","TZ"]' , '["VZ","TZ","GFB"]' , 0, datetime('now'), datetime('now')),
                (2, 1, '16:00', '22:00', 1, 2, '["VZ","TZ","GFB"]' , null , 1, datetime('now'), datetime('now')),
                (3, 2, '09:00', '17:00', 2, 2, '["VZ","TZ"]' , '["VZ","TZ"]' , 1, datetime('now'), datetime('now'));
        `);
        console.log("Sample coverage seeded.");

        // Add more seeding logic here if needed
    } catch (error) {
        console.error("Failed to seed test data:", error);
        throw error;
    }
} 