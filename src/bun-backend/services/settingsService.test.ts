import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { setupTestDb, teardownTestDb, seedTestData } from "../test/setup"; // Import seedTestData
import { getSettings, updateSettings } from "./settingsService";
import type { Settings, ShiftTypeDefinition, AbsenceTypeDefinition } from "../db/schema"; // Import the type and related types if needed
import { NotFoundError } from "elysia";

describe("Settings Service", () => {
    let testDb: Database; // Declare DB instance variable for the suite

    beforeAll(async () => {
        testDb = await setupTestDb(); // Create and seed DB ONCE for this suite
    });

    afterAll(() => {
        teardownTestDb(testDb); // Close the suite-specific DB
    });

    // Add beforeEach to re-seed settings before each test
    beforeEach(() => {
        try {
            seedTestData(testDb); // Reset DB to default state before each test
        } catch (e) {
            console.error("Error during beforeEach seed in settingsService.test.ts:", e);
            throw e; // Fail test if seeding fails
        }
    });

    describe("getSettings", () => {
        it("should retrieve the default settings successfully", async () => {
            const settings = await getSettings(testDb);

            expect(settings).toBeDefined();
            expect(settings).toBeObject();
            expect(settings.id).toBe(1);
            expect(settings.store_name).toBe('TEDi Store'); // Check seeded default
            expect(settings.require_keyholder).toBe(true); 
            expect(settings.opening_days).toBeInstanceOf(Object); 
            // Add more checks for default seeded values if necessary
        });

        it("should throw NotFoundError if settings row doesn't exist", async () => {
            // Manually delete the settings row JUST for this test
            // beforeEach will restore it for the next test
            testDb.exec("DELETE FROM settings WHERE id = 1;");
            
            // Expect the function to throw when using the modified test DB
            await expect(getSettings(testDb)).rejects.toThrow(NotFoundError);
            await expect(getSettings(testDb)).rejects.toThrow("Settings not found (id=1). Database might not be initialized correctly.");

            // REMOVE manual re-insertion - beforeEach will handle reset
            // testDb.run("INSERT OR IGNORE INTO settings (id) VALUES (1);");
        });
    });

    describe("updateSettings", () => {
        it("should update specified settings fields", async () => {
            const updates: Partial<Settings> = {
                store_name: "Updated Test Store",
                min_employees_per_shift: 2,
                require_keyholder: false,
            };
            const updatedSettings = await updateSettings(updates, testDb);

            expect(updatedSettings).toBeDefined();
            expect(updatedSettings.store_name).toBe("Updated Test Store");
            expect(updatedSettings.min_employees_per_shift).toBe(2);
            expect(updatedSettings.require_keyholder).toBe(false);
            expect(updatedSettings.store_opening).toBe("09:00"); // Check unchanged field

            const fetchedSettings = await getSettings(testDb);
            expect(fetchedSettings).toEqual(updatedSettings);
        });
        
        it("should only update provided fields", async () => {
             const updates = { timezone: "UTC" };
             const initialSettings = await getSettings(testDb);
             const updatedSettings = await updateSettings(updates, testDb);
             expect(updatedSettings.timezone).toBe("UTC");
             expect(updatedSettings.store_name).toBe(initialSettings.store_name); // Should remain unchanged
        });

        it("should handle updating JSON fields correctly", async () => {
             const updates: Partial<Settings> = {
                 shift_types: [{ id: 'MORNING', name: 'Morning Shift', color: '#ffff00', type: 'shift' }],
                 absence_types: [{ id: 'VAC', name: 'Vacation', color: '#00ff00', type: 'absence' }],
                 opening_days: { "1": false, "2": true, "3": true, "4": true, "5": true, "6": false, "0": false }
             };
             const updatedSettings = await updateSettings(updates, testDb);
             expect(updatedSettings.shift_types).toBeArrayOfSize(1);
             expect(updatedSettings.shift_types[0].id).toBe('MORNING');
             expect(updatedSettings.absence_types).toBeArrayOfSize(1);
             expect(updatedSettings.absence_types[0].id).toBe('VAC');
             // Check previously existing JSON fields (like opening_days) are still there and updated
             expect(updatedSettings.opening_days).toBeDefined();
             expect(updatedSettings.opening_days['1']).toBe(false); // Check updated value
             expect(updatedSettings.opening_days['2']).toBe(true); 
        });

        it("should handle setting nullable JSON fields to null", async () => {
            const initialSettings = await getSettings(testDb); // Get initial state
            const initialSpecialHours = initialSettings.special_hours; // Store initial value

            // Use 'as any' to bypass strict type check for this specific test case
            // We are intentionally providing null to test runtime handling
            const updates = { 
                special_hours: null, // Try to set non-nullable to null
                pdf_layout_presets: null // Set nullable to null
             } as any; 
             
            const updatedSettings = await updateSettings(updates, testDb);
            
            // Assert that the non-nullable field was NOT changed and retained its initial value
            expect(updatedSettings.special_hours).toEqual(initialSpecialHours); 
            // Assert that the nullable field WAS set to null
            expect(updatedSettings.pdf_layout_presets).toBeNull();
        });
        
        it("should return current settings if no valid update fields are provided", async () => {
             const initialSettings = await getSettings(testDb);
             // Pass invalid/non-setting key
             const updatedSettings = await updateSettings({ nonExistentField: 123 } as any, testDb);
             expect(updatedSettings).toEqual(initialSettings); 
        });

         it("should throw NotFoundError if trying to update non-existent settings", async () => {
             // Delete settings JUST for this test
             testDb.exec("DELETE FROM settings WHERE id = 1;");
             const updates = { store_name: "Doesn't Matter" };
              await expect(updateSettings(updates, testDb)).rejects.toThrow(NotFoundError);
              // REMOVE manual re-insertion - beforeEach will handle reset
              // testDb.run("INSERT OR IGNORE INTO settings (id) VALUES (1);");
         });
    });
}); 