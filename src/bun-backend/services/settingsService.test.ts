import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { setupTestDb, teardownTestDb, getTestDb, seedTestData } from "../test/setup"; // Adjust path as needed
import { getSettings, updateSettings } from "./settingsService";
import { Settings, SpecialHours } from "../db/schema"; // Import the type and related types if needed
import { NotFoundError } from "elysia";

describe("Settings Service", () => {
    let testDb: Database;

    // Setup DB once for the entire suite
    beforeAll(async () => {
        await setupTestDb(); 
        testDb = getTestDb(); // Get the initialized instance
    });

    // Teardown DB once after the entire suite
    afterAll(() => {
        teardownTestDb();
    });

    // beforeEach/afterEach can be used for test-specific state resets if needed
    beforeEach(() => {
         // Ensure settings row exists before tests that might need it
         // Use testDb instance directly
         testDb.run("INSERT OR IGNORE INTO settings (id, store_name) VALUES (1, 'Test Store');"); 
    });

    afterEach(() => {});

    describe("getSettings", () => {
        it("should retrieve the default settings successfully", async () => {
            const settings = await getSettings(testDb); // Pass the test DB instance to the service function
            
            expect(settings).toBeDefined();
            expect(settings).toBeObject();
            expect(settings.id).toBe(1); // Assuming default settings ID is 1
            expect(settings.store_name).toBe('Test Store'); // Check a default value seeded by seedTestData
            expect(settings.require_keyholder).toBe(true); // Check boolean conversion
            expect(settings.opening_days).toBeInstanceOf(Object); // Check JSON parsing
            expect(settings.opening_days['1']).toBe(true); // Check specific parsed JSON value
        });

        it("should throw NotFoundError if settings row doesn't exist", async () => {
            testDb.run("DELETE FROM settings WHERE id = 1;");
            // Pass testDb instance
            await expect(getSettings(testDb)).rejects.toThrow(NotFoundError);
            await expect(getSettings(testDb)).rejects.toThrow("Settings not found (id=1).");
            
            // Re-insert for subsequent tests (beforeEach will also run)
             testDb.run("INSERT OR IGNORE INTO settings (id, store_name) VALUES (1, 'Test Store');");
        });
    });

    describe("updateSettings", () => {
        it("should update specified settings fields", async () => {
            const updates: Partial<Omit<Settings, 'id' | 'created_at' | 'updated_at'>> = {
                store_name: "Updated Test Store",
                max_daily_hours: 9, 
                require_keyholder: false,
                opening_days: { '0': true, '1': false }, // Update JSON field
            };
            // Pass testDb instance
            const updatedSettings = await updateSettings(updates, testDb);

            expect(updatedSettings).toBeDefined();
            expect(updatedSettings.id).toBe(1);
            expect(updatedSettings.store_name).toBe("Updated Test Store");
            expect(updatedSettings.max_daily_hours).toBe(9);
            expect(updatedSettings.require_keyholder).toBe(false);
            expect(updatedSettings.opening_days['0']).toBe(true);
             expect(updatedSettings.opening_days['1']).toBe(false); // Verify JSON update
            // Check a field that wasn't updated remains the same
            expect(updatedSettings.timezone).toBe('Europe/Berlin'); 
            
            // Verify in DB using the service function (passing testDb again)
            const dbSettings = await getSettings(testDb);
            expect(dbSettings.store_name).toBe("Updated Test Store");
        });

         it("should only update provided fields", async () => {
             const initialSettings = await getSettings(testDb);
             const updates: Partial<Omit<Settings, 'id' | 'created_at' | 'updated_at'>> = {
                 store_opening: "08:00",
             };
             const updatedSettings = await updateSettings(updates, testDb);

             expect(updatedSettings.store_opening).toBe("08:00");
             // Check other fields remain unchanged from initial state
             expect(updatedSettings.store_name).toBe(initialSettings.store_name);
             expect(updatedSettings.max_daily_hours).toBe(initialSettings.max_daily_hours);
             expect(updatedSettings.require_keyholder).toBe(initialSettings.require_keyholder);
             expect(updatedSettings.opening_days).toEqual(initialSettings.opening_days);
         });

        it("should handle updating JSON fields correctly", async () => {
            const updates = {
                 shift_types: [{ id: 'MORNING', name: 'Morning', color: '#ffff00', type: 'shift' }],
                 absence_types: [{ id: 'VAC', name: 'Vacation', color: '#0000ff', type: 'absence' }]
            };
             const updatedSettings = await updateSettings(updates, testDb);

            expect(updatedSettings.shift_types).toBeArrayOfSize(1);
            expect(updatedSettings.shift_types[0].id).toBe('MORNING');
            expect(updatedSettings.absence_types).toBeArrayOfSize(1);
             expect(updatedSettings.absence_types[0].id).toBe('VAC');
             // Check previously existing JSON fields (like opening_days) are still there
             expect(updatedSettings.opening_days).toBeDefined();
             expect(updatedSettings.opening_days['1']).toBe(true);
        });

        it("should handle setting nullable JSON fields to null", async () => {
             const updates = { special_hours: null };
             const updatedSettings = await updateSettings(updates as any, testDb);
             expect(updatedSettings.special_hours).toBeNull();
        });

        it("should return current settings if no valid update fields are provided", async () => {
            const initialSettings = await getSettings(testDb);
            const updates = { nonExistentField: 123 }; // Field not in Settings
            // Cast to any to bypass TypeScript type checking for the test
            const updatedSettings = await updateSettings(updates as any, testDb); 

            expect(updatedSettings).toEqual(initialSettings);
        });

         it("should throw NotFoundError if trying to update non-existent settings", async () => {
             testDb.run("DELETE FROM settings WHERE id = 1;");
             const updates = { store_name: "Doesn't Matter" };
              // Pass testDb instance
              await expect(updateSettings(updates, testDb)).rejects.toThrow(NotFoundError);
              await expect(updateSettings(updates, testDb)).rejects.toThrow("Settings not found (id=1).");
              
             // Re-insert for subsequent tests
              testDb.run("INSERT OR IGNORE INTO settings (id, store_name) VALUES (1, 'Test Store');");
          });
    });
}); 