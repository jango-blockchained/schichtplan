import { describe, it, expect, beforeEach, afterAll, beforeAll, mock } from "bun:test";
import { Elysia, t } from "elysia";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { Settings, EmployeeGroup, OpeningDays, ShiftTypeDefinition } from "../db/schema"; 
import { fetch } from "bun";
import { settingsRoutes } from "../routes/settings"; // Use static import again

// --- Database Setup ---
const setupAndSeedDb = (db: Database) => {
    // Apply schema if not already done (e.g., if DB is closed and reopened)
    // This check might be too simple; consider a more robust version check if needed
    try {
        db.query("SELECT id FROM settings LIMIT 1;").get();
        // Schema likely exists if query doesn't throw
    } catch {
        console.log("Applying schema to test DB...");
        const schemaPath = path.join(import.meta.dir, "../db/init-schema.sql");
        const schemaSql = fs.readFileSync(schemaPath, "utf-8");
        db.exec(schemaSql);
    }
    
    // Clear existing data and re-seed initial settings
    console.log("Clearing and re-seeding settings table...");
    db.exec("DELETE FROM settings;"); // Clear first
    
    const defaultOpeningDays: OpeningDays = {
        "0": false, "1": true, "2": true, "3": true, "4": true, "5": true, "6": false
    };
    const defaultShiftTypes: ShiftTypeDefinition[] = [
        { id: "EARLY", name: "Early Shift", color: "#aabbcc", type: "shift" },
        { id: "LATE", name: "Late Shift", color: "#ddeeff", type: "shift" }
    ];
    const now = new Date().toISOString();

    try {
        const stmt = db.prepare(`
            INSERT INTO settings (
                id, store_name, timezone, language, date_format, time_format,
                store_opening, store_closing, opening_days, require_keyholder,
                max_daily_hours, employee_types, shift_types, absence_types, 
                created_at, updated_at
            ) VALUES (
                1, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, 
                ?, ?, ?, ?, 
                ?, ?
            )
        `);
        stmt.run(
            "Test Store", "Europe/Berlin", "en", "YYYY-MM-DD", "HH:mm", 
            "09:00", "20:00", JSON.stringify(defaultOpeningDays), 1, 
            10.0, JSON.stringify([]), JSON.stringify(defaultShiftTypes), JSON.stringify([]), 
            now, now
        );
        console.log("Settings table seeded.");
    } catch (err: any) {
        console.error("Error seeding settings into test DB:", err.message);
        throw new Error(`Failed to seed test database: ${err.message}`);
    }
};

// Create DB instance ONCE
const testDb = new Database(":memory:");

// Mock the database module BEFORE routes are imported
mock.module("../db", () => {
    setupAndSeedDb(testDb);
    // Fix: Return ONLY the named export used by the routes
    return {
        getDb: () => testDb,
        // Remove: default: { getDb: () => testDb } // Remove default export from mock
    };
});

let app: Elysia;
const TEST_PORT = 5557; // Define Port
const SERVER_URL = `http://localhost:${TEST_PORT}`; // Define URL as const

// --- Test Suite Setup ---
describe("Settings API Routes", () => {

    beforeAll(async () => {
        // Remove dynamic import: const { settingsRoutes } = await import("../routes/settings");

        // Setup the test Elysia app
        app = new Elysia()
            .use(settingsRoutes); // Use statically imported routes

        // Start the server and wait for it to be ready
        await app.listen(TEST_PORT);
        // SERVER_URL assignment moved outside
        console.log(`Settings Test Server started on port ${TEST_PORT}, URL: ${SERVER_URL}`);
    });

    afterAll(async () => { // Make afterAll async for await app.stop()
        if (app && app.server) {
            await app.stop(); // Use await app.stop() for proper shutdown
            console.log("Settings Test Server stopped");
        }
        if (testDb) {
            testDb.close(); // Close DB after server stops
        }
    });
    
    // Reset DB state before each test using the *same* DB instance
    beforeEach(() => {
       setupAndSeedDb(testDb); 
    });

    // --- Tests --- 

    describe("GET /api/settings", () => {
        it("should return the current settings with status 200", async () => {
            const response = await fetch(`${SERVER_URL}/api/settings`);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeObject();
            expect(body.id).toBe(1);
            expect(body.store_name).toBe("Test Store"); // Check against seeded value
            expect(body.require_keyholder).toBe(true); // Check seeded value (1 -> true)
            expect(body.opening_days).toEqual({"0":false,"1":true,"2":true,"3":true,"4":true,"5":true,"6":false}); 
        });

        it("should return 404 if settings row is missing", async () => {
            // Manually delete the row for THIS test
            testDb.exec("DELETE FROM settings WHERE id = 1;");
            
            const response = await fetch(`${SERVER_URL}/api/settings`);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Settings not found");
        });
    });

    describe("PUT /api/settings", () => {
        it("should update settings with valid data and return 200", async () => {
            const updateData = {
                store_name: "Updated Store Name via API",
                max_daily_hours: 8,
                require_keyholder: false,
                opening_days: { "1": false, "2": true, "3": true, "4": true, "5": true, "6": false, "0": false },
                shift_types: [{ id: 'API_SHIFT', name: 'API Shift', color: '#aabbcc', type: 'shift' }],
            };

            const response = await fetch(`${SERVER_URL}/api/settings`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });
            const body = await response.json();
            
            // Log the response body if the status is not 200
            if (response.status !== 200) {
                console.log("PUT Update Error Body:", JSON.stringify(body)); 
            }

            // Revert expectation to 200 OK for successful PUT
            expect(response.status).toBe(200); 
            expect(body).toBeObject();
            expect(body.id).toBe(1);
            expect(body.store_name).toBe("Updated Store Name via API");
            expect(body.max_daily_hours).toBe(8);
            expect(body.require_keyholder).toBe(false);
            expect(body.opening_days['1']).toBe(false);
            expect(body.shift_types).toBeArrayOfSize(1);
            expect(body.shift_types[0].id).toBe('API_SHIFT');

            // Verify by re-fetching through API
             console.log("Fetching URL (Verify PUT):", `${SERVER_URL}/api/settings`); // Log URL before fetch
             const verifyResponse = await fetch(`${SERVER_URL}/api/settings`);
             const verifyBody = await verifyResponse.json();
             expect(verifyResponse.status).toBe(200);
             expect(verifyBody.store_name).toBe("Updated Store Name via API");
             expect(verifyBody.max_daily_hours).toBe(8);
             expect(verifyBody.shift_types?.[0]?.id).toBe('API_SHIFT');
        });

        it("should return 422 for invalid data types", async () => {
            const invalidData = {
                store_name: 12345, // Invalid type
                max_daily_hours: "ten" // Invalid type
            };

            console.log("Fetching URL (Invalid Types):", `${SERVER_URL}/api/settings`); // Log URL before fetch
            const response = await fetch(`${SERVER_URL}/api/settings`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invalidData),
            });
            const body = await response.json();

            expect(response.status).toBe(422);
            expect(body).toBeObject(); // Check validation error is an object
        });

        it("should return 422 for invalid JSON structure in fields", async () => {
             const invalidJsonData = {
                 opening_days: { "1": "yes", "invalid-day": true } // Invalid value type, invalid key
             };
            console.log("Fetching URL (Invalid JSON):", `${SERVER_URL}/api/settings`); // Log URL before fetch
            const response = await fetch(`${SERVER_URL}/api/settings`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invalidJsonData),
            });
            const body = await response.json();

            expect(response.status).toBe(422);
            expect(body).toBeObject(); // Check validation error is an object
        });

         it("should ignore fields not defined in the schema", async () => {
             // Fetch initial state first
             const initialResponse = await fetch(`${SERVER_URL}/api/settings`);
             const initialSettings = await initialResponse.json();
             expect(initialResponse.status).toBe(200); // Ensure initial fetch worked

             const updateData = {
                 store_name: "Name Change Only",
                 non_existent_field: "should be ignored"
             };
            console.log("Fetching URL (Ignore Fields):", `${SERVER_URL}/api/settings`); // Log URL before fetch
            const response = await fetch(`${SERVER_URL}/api/settings`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.store_name).toBe("Name Change Only");
            expect(body).not.toHaveProperty('non_existent_field'); // Field should not be present
            expect(body.max_daily_hours).toBe(initialSettings.max_daily_hours); // Compare against fetched initial settings
        });

        // Add test for updating when settings row doesn't exist (should ideally be 404)
         it("should return 404 if trying to update non-existent settings", async () => {
             // Manually delete the row for THIS test
             testDb.exec("DELETE FROM settings WHERE id = 1;");
             
             const updateData = { store_name: "Update attempt" };
             console.log("Fetching URL (Update Non-Existent):", `${SERVER_URL}/api/settings`); // Log URL before fetch
             const response = await fetch(`${SERVER_URL}/api/settings`, {
                 method: "PUT",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify(updateData),
             });
             const body = await response.json();
            
             // Expect 404 because the service layer should check existence before updating
             expect(response.status).toBe(404);
             expect(body.error).toContain("Settings not found");
         });
    });
}); 