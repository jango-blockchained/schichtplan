import { describe, it, expect, beforeEach, afterAll, beforeAll } from "bun:test";
import app from '../index'; // Revert to static import
import { Database } from "bun:sqlite"; // Import Database type
import { setupTestDb, teardownTestDb, seedTestData } from "../test/setup"; // Removed getTestDb
import { Settings } from "../db/schema"; // Import Settings type if needed for assertions
import { NotFoundError } from "elysia";

// Use app.handle for direct testing without needing a live server.

describe("Settings API Routes", () => {
    let testDb: Database; // Suite-specific DB instance

    beforeAll(async () => {
        testDb = await setupTestDb(); // Create and seed DB for this suite
        // Decorate the imported app instance with the testDb
        app.decorate('db', testDb);
    });

    afterAll(() => {
        teardownTestDb(testDb); // Close the suite-specific DB
        // Optional: Undecorate or reset app state if necessary, 
        // but separate test runs should handle this.
    });

    // Add beforeEach to re-seed settings before each test
    beforeEach(() => {
        try {
            seedTestData(testDb); // Pass instance to seeding
        } catch (e) {
            console.error("Error during beforeEach seed in settings.test.ts:", e);
        }
    });

    describe("GET /api/settings", () => {
        it("should return the current settings with status 200", async () => {
            const request = new Request("http://localhost/api/settings");
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
            // Manually delete settings ONLY for this test (beforeEach will restore)
            try {
                testDb.run("DELETE FROM settings WHERE id = 1;"); // Use testDb
            } catch (e) {
                console.error("Error deleting settings for 404 test:", e);
                throw e; // Fail test if setup fails
            }

            const request = new Request("http://localhost/api/settings");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Not Found");
             expect(body.details).toContain("Settings not found");
             
             // Note: beforeEach will re-insert the row before the next test
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

            const request = new Request("http://localhost/api/settings", {
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

            // Verify by re-fetching through API instead
             const verifyRequest = new Request("http://localhost/api/settings");
             const verifyResponse = await app.handle(verifyRequest);
             const verifyBody = await verifyResponse.json();
             expect(verifyResponse.status).toBe(200);
             expect(verifyBody.store_name).toBe("Updated Store Name via API");
             expect(verifyBody.max_daily_hours).toBe(8);
             expect(verifyBody.shift_types?.[0]?.id).toBe('API_SHIFT');
        });

        it("should return 400 for invalid data types", async () => {
            const invalidData = {
                store_name: 12345, // Invalid type
                max_daily_hours: "ten" // Invalid type
            };

            const request = new Request("http://localhost/api/settings", {
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
            const request = new Request("http://localhost/api/settings", {
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
             // Need initial settings to compare against
             const initialResponse = await app.handle(new Request("http://localhost/api/settings"));
             const initialSettings = await initialResponse.json();

             const updateData = {
                 store_name: "Name Change Only",
                 non_existent_field: "should be ignored"
             };
            const request = new Request("http://localhost/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.store_name).toBe("Name Change Only");
            expect(body.non_existent_field).toBeUndefined(); // Field should not be present
            
            // Remove check via service
            // expect(body.max_daily_hours).toBe(initialSettings.max_daily_hours);
             expect(body.max_daily_hours).toBe(initialSettings.max_daily_hours); // Compare against fetched initial settings
        });

        // Add test for updating when settings row doesn't exist (should ideally be 404)
         it("should return 404 if trying to update non-existent settings", async () => {
             // Manually delete settings ONLY for this test (beforeEach will restore)
             try {
                 testDb.run("DELETE FROM settings WHERE id = 1;"); // Use testDb
             } catch (e) {
                 console.error("Error deleting settings for 404 update test:", e);
                 throw e; 
             }
             const updateData = { store_name: "Update attempt" };
             const request = new Request("http://localhost/api/settings", {
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