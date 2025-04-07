import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import app from '../index'; // Import the running app instance for testing handlers
import { setupTestDb, teardownTestDb, getTestDb, seedTestData } from "../test/setup";
import { getSettings as getServiceSettings } from "../services/settingsService"; // For comparison

// Use app.handle for direct testing without needing a live server.

describe("Settings API Routes", () => {

    // Setup DB once for the entire suite
    beforeAll(async () => {
        await setupTestDb();
    });

    // Teardown DB once after the entire suite
    afterAll(() => {
        teardownTestDb();
    });

    // beforeEach/afterEach can be used for test-specific state resets if needed
    beforeEach(() => {
        // Ensure settings row exists before tests that might need it
        getTestDb().run("INSERT OR IGNORE INTO settings (id, store_name) VALUES (?, ?);", [1, 'Test Store']); 
    });

    afterEach(() => {});

    describe("GET /settings", () => {
        it("should return the current settings with status 200", async () => {
            const request = new Request("http://localhost/settings");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeObject();
            expect(body.id).toBe(1);
            expect(body.store_name).toBe("Test Store"); // Check seeded/restored value
            expect(body.require_keyholder).toBe(true);
            expect(body.opening_days).toBeObject();
            expect(body.opening_days['1']).toBe(true); // Check parsed JSON
        });

        it("should return 404 if settings row is missing", async () => {
            // Simulate missing settings row for this test
            getTestDb().run("DELETE FROM settings WHERE id = 1;");

            const request = new Request("http://localhost/settings");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Not Found");
             expect(body.details).toContain("Settings not found");
             
             // Note: beforeEach will re-insert the row before the next test
        });
    });

    describe("PUT /settings", () => {
        it("should update settings with valid data and return updated settings with status 200", async () => {
            const updateData = {
                store_name: "Updated Store Name via API",
                max_daily_hours: 8,
                require_keyholder: false,
                opening_days: { "1": false, "2": true, "3": true, "4": true, "5": true, "6": false, "0": false },
                shift_types: [{ id: 'API_SHIFT', name: 'API Shift', color: '#aabbcc', type: 'shift' }],
            };

            const request = new Request("http://localhost/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });

            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeObject();
            expect(body.id).toBe(1);
            expect(body.store_name).toBe("Updated Store Name via API");
            expect(body.max_daily_hours).toBe(8);
            expect(body.require_keyholder).toBe(false);
            expect(body.opening_days['1']).toBe(false);
            expect(body.shift_types).toBeArrayOfSize(1);
            expect(body.shift_types[0].id).toBe('API_SHIFT');

            // Verify in DB via service function
            const dbSettings = await getServiceSettings();
            expect(dbSettings.store_name).toBe("Updated Store Name via API");
            expect(dbSettings.max_daily_hours).toBe(8);
            expect(dbSettings.shift_types?.[0]?.id).toBe('API_SHIFT');
        });

        it("should return 400 for invalid data types", async () => {
            const invalidData = {
                store_name: 12345, // Invalid type
                max_daily_hours: "ten" // Invalid type
            };

            const request = new Request("http://localhost/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invalidData),
            });

            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
             // Check details - structure might depend on Elysia version/setup
             expect(body.details).toBeDefined();
            // Example check: expect(body.details).toContain('Expected string, received number');
        });

        it("should return 400 for invalid JSON structure in fields", async () => {
             const invalidJsonData = {
                 opening_days: { "1": "yes", "invalid-day": true } // Invalid value type, invalid key
             };
            const request = new Request("http://localhost/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invalidJsonData),
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
             expect(body.details).toBeDefined();
             // Example check: expect(body.details).toContain('Expected boolean');
        });

         it("should ignore fields not defined in the schema", async () => {
             const initialSettings = await getServiceSettings();
             const updateData = {
                 store_name: "Name Change Only",
                 non_existent_field: "should be ignored"
             };
            const request = new Request("http://localhost/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.store_name).toBe("Name Change Only");
            expect(body.non_existent_field).toBeUndefined(); // Field should not be present
            
            // Check other fields unchanged
            expect(body.max_daily_hours).toBe(initialSettings.max_daily_hours);
        });

        // Add test for updating when settings row doesn't exist (should ideally be 404)
         it("should return 404 if trying to update non-existent settings", async () => {
             // Ensure row is deleted for this test
             getTestDb().run("DELETE FROM settings WHERE id = 1;");
             const updateData = { store_name: "Update attempt" };
             const request = new Request("http://localhost/settings", {
                 method: "PUT",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify(updateData),
             });
             const response = await app.handle(request);
             const body = await response.json();
            
             expect(response.status).toBe(404);
             expect(body.error).toContain("Not Found");
              expect(body.details).toContain("Settings not found");
              
             // Note: beforeEach will re-insert the row before the next test
         });
    });
}); 