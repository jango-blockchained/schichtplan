import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { setupTestDb, teardownTestDb, resetTestDb, seedTestData, getTestDb } from "../test/setup"; // Adjust path as needed
import { getSettings, updateSettings } from "./settingsService";
import { Settings } from "../db/schema"; // Import the type
import { NotFoundError } from "elysia";

describe("Settings Service", () => {
    let testDb: Database;

    // Setup initial DB before all tests in this suite
    // Note: bun:test doesn't have explicit beforeAll, 
    // so we manage DB setup/teardown per describe block or use beforeEach/afterEach carefully.
    // Let's setup once and reset before each test for isolation.
    beforeEach(async () => {
         // Using reset to ensure a clean state for each test
         testDb = resetTestDb(); 
         // Seed necessary default data (like the settings row itself)
         seedTestData(testDb); 
         // Ensure applySchema promise resolves if needed - Bun test runner might handle top-level awaits?
         // If applySchema in setup is truly async and needs awaiting, restructure test setup needed.
    });

    // Teardown after all tests in this suite
    afterEach(() => {
        teardownTestDb();
    });

    describe("getSettings", () => {
        it("should retrieve the default settings successfully", async () => {
            const settings = await getSettings(); // Calls service using default db import
            
            expect(settings).toBeDefined();
            expect(settings).toBeObject();
            expect(settings.id).toBe(1); // Assuming default settings ID is 1
            expect(settings.store_name).toBe('Test Store'); // Check a default value seeded by seedTestData
            expect(settings.require_keyholder).toBe(true); // Check boolean conversion
            expect(settings.opening_days).toBeInstanceOf(Object); // Check JSON parsing
            expect(settings.opening_days['1']).toBe(true); // Check specific parsed JSON value
        });

        it("should throw NotFoundError if settings row doesn't exist", async () => {
            // Ensure the settings row is deleted for this specific test
             getTestDb().run("DELETE FROM settings WHERE id = 1;");
            
            await expect(getSettings()).rejects.toThrow(NotFoundError);
             await expect(getSettings()).rejects.toThrow("Settings not found (id=1). Database might not be initialized correctly.");
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

            const updatedSettings = await updateSettings(updates);

            expect(updatedSettings).toBeDefined();
            expect(updatedSettings.id).toBe(1);
            expect(updatedSettings.store_name).toBe("Updated Test Store");
            expect(updatedSettings.max_daily_hours).toBe(9);
            expect(updatedSettings.require_keyholder).toBe(false);
            expect(updatedSettings.opening_days['0']).toBe(true);
             expect(updatedSettings.opening_days['1']).toBe(false); // Verify JSON update
            // Check a field that wasn't updated remains the same
            expect(updatedSettings.timezone).toBe('Europe/Berlin'); 
        });

         it("should only update provided fields", async () => {
             const initialSettings = await getSettings();
             const updates: Partial<Omit<Settings, 'id' | 'created_at' | 'updated_at'>> = {
                 store_opening: "08:00",
             };
             const updatedSettings = await updateSettings(updates);

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
             const updatedSettings = await updateSettings(updates);

            expect(updatedSettings.shift_types).toBeArrayOfSize(1);
            expect(updatedSettings.shift_types[0].id).toBe('MORNING');
            expect(updatedSettings.absence_types).toBeArrayOfSize(1);
             expect(updatedSettings.absence_types[0].id).toBe('VAC');
             // Check previously existing JSON fields (like opening_days) are still there
             expect(updatedSettings.opening_days).toBeDefined();
             expect(updatedSettings.opening_days['1']).toBe(true);
        });

        it("should handle setting nullable JSON fields to null", async () => {
             const updates = {
                 special_hours: null, // Test setting a nullable JSON field to null
             };
             const updatedSettings = await updateSettings(updates);

             expect(updatedSettings.special_hours).toBeNull();
        });

        it("should return current settings if no valid update fields are provided", async () => {
            const initialSettings = await getSettings();
            const updates = { nonExistentField: 123 }; // Field not in Settings
            // Cast to any to bypass TypeScript type checking for the test
            const updatedSettings = await updateSettings(updates as any); 

            expect(updatedSettings).toEqual(initialSettings);
        });

         it("should throw NotFoundError if trying to update non-existent settings", async () => {
            // Ensure the settings row is deleted
             getTestDb().run("DELETE FROM settings WHERE id = 1;");

            const updates = { store_name: "Doesn't Matter" };
             await expect(updateSettings(updates)).rejects.toThrow(NotFoundError);
             // Service function checks existence first using getSettings
             await expect(updateSettings(updates)).rejects.toThrow("Settings not found (id=1). Database might not be initialized correctly.");
         });
    });
}); 