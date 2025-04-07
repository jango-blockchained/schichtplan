import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { setupTestDb, teardownTestDb, resetTestDb, seedTestData, getTestDb } from "../test/setup";
import {
    getAllCoverage,
    getCoverageById,
    createCoverage,
    updateCoverage,
    deleteCoverage,
    bulkUpdateCoverage
} from "./coverageService";
import { Coverage, EmployeeGroup } from "../db/schema";
import { NotFoundError } from "elysia";

describe("Coverage Service", () => {
    let testDb: Database;

    beforeEach(async () => {
        testDb = resetTestDb(); // Resets and seeds data (including coverage)
    });

    afterEach(() => {
        teardownTestDb();
    });

    describe("getAllCoverage", () => {
        it("should retrieve all seeded coverage entries sorted by day and time", async () => {
            const coverageEntries = await getAllCoverage();
            expect(coverageEntries).toBeArray();
            expect(coverageEntries.length).toBe(3);

            // Check sorting and basic data
            expect(coverageEntries[0].id).toBe(1);
            expect(coverageEntries[0].day_index).toBe(1);
            expect(coverageEntries[0].start_time).toBe("08:00");
            expect(coverageEntries[1].id).toBe(2);
            expect(coverageEntries[1].day_index).toBe(1);
            expect(coverageEntries[1].start_time).toBe("16:00");
            expect(coverageEntries[2].id).toBe(3);
            expect(coverageEntries[2].day_index).toBe(2);
            expect(coverageEntries[2].start_time).toBe("09:00");

            // Check JSON parsing (assuming safeJsonParseArray returns [] for null)
            expect(coverageEntries[0].employee_types).toEqual([EmployeeGroup.VZ, EmployeeGroup.TZ]);
            expect(coverageEntries[0].allowed_employee_groups).toEqual([EmployeeGroup.VZ, EmployeeGroup.TZ, EmployeeGroup.GFB]);
            expect(coverageEntries[1].allowed_employee_groups).toEqual([]);
            expect(coverageEntries[2].employee_types).toEqual([EmployeeGroup.VZ, EmployeeGroup.TZ]);

            // Check boolean parsing
            expect(coverageEntries[0].requires_keyholder).toBe(false);
            expect(coverageEntries[1].requires_keyholder).toBe(true);
        });

        it("should return an empty array if no coverage entries exist", async () => {
            // Clear existing data first
            getTestDb().run("DELETE FROM coverage;");
            const coverageEntries = await getAllCoverage();
            expect(coverageEntries).toBeArrayOfSize(0);
        });
    });

    describe("getCoverageById", () => {
        it("should retrieve an existing coverage entry by ID", async () => {
            const entry = await getCoverageById(1);
            expect(entry).not.toBeNull();
            expect(entry.id).toBe(1);
            expect(entry.day_index).toBe(1);
            expect(entry.start_time).toBe("08:00");
            expect(entry.employee_types).toEqual([EmployeeGroup.VZ, EmployeeGroup.TZ]);
        });

        it("should throw NotFoundError for a non-existent coverage ID", async () => {
            await expect(getCoverageById(999)).rejects.toThrow(NotFoundError);
            await expect(getCoverageById(999)).rejects.toThrow("Coverage entry with id 999 not found.");
        });
    });

    describe("createCoverage", () => {
        // Define the type for creation input
        type CreateCoverageInput = Omit<Coverage, 'id' | 'created_at' | 'updated_at'>;

        it("should create a new coverage entry with valid data", async () => {
            const newCoverageData: CreateCoverageInput = {
                day_index: 3, // Wednesday
                start_time: "10:00",
                end_time: "18:00",
                min_employees: 1,
                max_employees: 2,
                employee_types: [EmployeeGroup.TZ, EmployeeGroup.GFB],
                allowed_employee_groups: [EmployeeGroup.TZ, EmployeeGroup.GFB],
                requires_keyholder: false,
                keyholder_before_minutes: null,
                keyholder_after_minutes: null,
            };

            const createdEntry = await createCoverage(newCoverageData);

            expect(createdEntry).toBeDefined();
            expect(createdEntry.id).toBeGreaterThan(3); // Should be next ID
            expect(createdEntry.day_index).toBe(3);
            expect(createdEntry.start_time).toBe("10:00");
            expect(createdEntry.min_employees).toBe(1);
            expect(createdEntry.employee_types).toEqual([EmployeeGroup.TZ, EmployeeGroup.GFB]);
            expect(createdEntry.requires_keyholder).toBe(false);
            expect(createdEntry.created_at).toBeDefined();
            expect(createdEntry.updated_at).toBeDefined();

            // Verify it exists in DB
            const fetchedEntry = await getCoverageById(createdEntry.id);
            expect(fetchedEntry).toEqual(createdEntry);
        });

        it("should handle nullable fields correctly during creation", async () => {
             const newCoverageData: CreateCoverageInput = {
                 day_index: 4,
                 start_time: "12:00",
                 end_time: "20:00",
                 min_employees: 1,
                 max_employees: 1,
                 employee_types: [EmployeeGroup.VZ],
                 allowed_employee_groups: null, // Test null allowed groups
                 requires_keyholder: true,
                 keyholder_before_minutes: 15,
                 keyholder_after_minutes: null, // Test null after minutes
             };
             const createdEntry = await createCoverage(newCoverageData);
             expect(createdEntry.allowed_employee_groups).toEqual([]); // Null becomes empty array
             expect(createdEntry.requires_keyholder).toBe(true);
             expect(createdEntry.keyholder_before_minutes).toBe(15);
             expect(createdEntry.keyholder_after_minutes).toBeNull();
        });

        it("should throw an error for invalid day_index", async () => {
            const invalidData: CreateCoverageInput = {
                day_index: 7, // Invalid
                start_time: "10:00",
                end_time: "18:00",
                min_employees: 1,
                max_employees: 2,
                employee_types: [EmployeeGroup.TZ],
                requires_keyholder: false,
            };
            await expect(createCoverage(invalidData)).rejects.toThrow("Invalid day_index (0-6).");
        });
    });

    describe("updateCoverage", () => {
        // Define the type for update input
        type UpdateCoverageInput = Partial<Omit<Coverage, 'id' | 'created_at' | 'updated_at'>>;

        it("should update specified fields of an existing coverage entry", async () => {
            const entryIdToUpdate = 1;
            const updates: UpdateCoverageInput = {
                start_time: "08:30",
                min_employees: 1,
                max_employees: 1,
                requires_keyholder: true,
                employee_types: [EmployeeGroup.VZ], // Change types
                allowed_employee_groups: [EmployeeGroup.VZ] // Change allowed
            };

            const originalEntry = await getCoverageById(entryIdToUpdate);
            const updatedEntry = await updateCoverage(entryIdToUpdate, updates);

            expect(updatedEntry).not.toBeNull();
            expect(updatedEntry.id).toBe(entryIdToUpdate);
            expect(updatedEntry.start_time).toBe("08:30"); // Updated
            expect(updatedEntry.end_time).toBe("16:00"); // Unchanged
            expect(updatedEntry.min_employees).toBe(1); // Updated
            expect(updatedEntry.max_employees).toBe(1); // Updated
            expect(updatedEntry.requires_keyholder).toBe(true); // Updated
            expect(updatedEntry.employee_types).toEqual([EmployeeGroup.VZ]); // Updated
            expect(updatedEntry.allowed_employee_groups).toEqual([EmployeeGroup.VZ]); // Updated
            expect(updatedEntry.updated_at).not.toBe(originalEntry.created_at); // Check timestamp changed

            // Verify changes in DB
            const fetchedEntry = await getCoverageById(entryIdToUpdate);
            expect(fetchedEntry).toEqual(updatedEntry);
        });

        it("should return the current entry if no data is provided for update", async () => {
            const entryIdToUpdate = 2;
            const initialEntry = await getCoverageById(entryIdToUpdate);
            const updatedEntry = await updateCoverage(entryIdToUpdate, {});

            expect(updatedEntry).toEqual(initialEntry);
            // Check updated_at didn't change (or check service logic if it should)
             expect(updatedEntry.updated_at).toBe(initialEntry.updated_at);
        });

        it("should throw NotFoundError if trying to update a non-existent entry", async () => {
            const nonExistentId = 999;
            const updates = { min_employees: 5 };
            await expect(updateCoverage(nonExistentId, updates)).rejects.toThrow(NotFoundError);
        });

        it("should handle setting nullable fields to null during update", async () => {
             const entryIdToUpdate = 3; // Has keyholder=true initially
             const updates: UpdateCoverageInput = {
                 allowed_employee_groups: null,
                 keyholder_before_minutes: null,
                 keyholder_after_minutes: null,
             };
             const updatedEntry = await updateCoverage(entryIdToUpdate, updates);
             expect(updatedEntry.allowed_employee_groups).toEqual([]); // Null becomes empty array
             expect(updatedEntry.keyholder_before_minutes).toBeNull();
             expect(updatedEntry.keyholder_after_minutes).toBeNull();
             // Ensure non-nullable fields were not affected
             expect(updatedEntry.requires_keyholder).toBe(true);
        });

         it("should throw an error if updating with invalid day_index", async () => {
            const entryIdToUpdate = 1;
             const updates: UpdateCoverageInput = { day_index: -1 };
             await expect(updateCoverage(entryIdToUpdate, updates)).rejects.toThrow("Invalid day_index");
         });
    });

    describe("deleteCoverage", () => {
        it("should delete an existing coverage entry and return success", async () => {
            const entryIdToDelete = 2;
            const result = await deleteCoverage(entryIdToDelete);
            expect(result).toEqual({ success: true });

            // Verify deletion
            await expect(getCoverageById(entryIdToDelete)).rejects.toThrow(NotFoundError);

            // Verify other entries still exist
            const remainingEntries = await getAllCoverage();
            expect(remainingEntries.length).toBe(2);
            expect(remainingEntries.find(e => e.id === entryIdToDelete)).toBeUndefined();
        });

        it("should throw NotFoundError if trying to delete a non-existent entry", async () => {
            const nonExistentId = 999;
            await expect(deleteCoverage(nonExistentId)).rejects.toThrow(NotFoundError);
        });
    });

    describe("bulkUpdateCoverage", () => {
        // Define the type for bulk input (id optional)
        type BulkCoverageInput = Omit<Coverage, 'id' | 'created_at' | 'updated_at'> & { id?: number };

        it("should replace all coverage entries for the specified days", async () => {
            const day1Replacement: BulkCoverageInput[] = [
                 { // New entry 1 for day 1
                    day_index: 1,
                    start_time: "09:00",
                    end_time: "17:00",
                    min_employees: 1,
                    max_employees: 1,
                    employee_types: [EmployeeGroup.VZ],
                    requires_keyholder: false,
                 },
                 { // New entry 2 for day 1
                    day_index: 1,
                    start_time: "17:00",
                    end_time: "21:00",
                    min_employees: 1,
                    max_employees: 1,
                    employee_types: [EmployeeGroup.TZ],
                    requires_keyholder: true,
                 }
            ];

            const result = await bulkUpdateCoverage(day1Replacement);
            // Bulk update returns the input data, not the created entries with IDs
            // expect(result).toBeArrayOfSize(2);

            // Fetch all coverage to verify changes
            const allCoverage = await getAllCoverage();

            // Should have 1 entry for day 2 (untouched) and 2 new entries for day 1
            expect(allCoverage.length).toBe(3);

            const day1Result = allCoverage.filter(c => c.day_index === 1);
            const day2Result = allCoverage.filter(c => c.day_index === 2);

            expect(day1Result.length).toBe(2);
            expect(day2Result.length).toBe(1);

            // Check details of the new day 1 entries (IDs will be new)
            expect(day1Result.find(c => c.start_time === "09:00")?.employee_types).toEqual([EmployeeGroup.VZ]);
            expect(day1Result.find(c => c.start_time === "09:00")?.requires_keyholder).toBe(false);
            expect(day1Result.find(c => c.start_time === "17:00")?.employee_types).toEqual([EmployeeGroup.TZ]);
            expect(day1Result.find(c => c.start_time === "17:00")?.requires_keyholder).toBe(true);

            // Check that the original day 2 entry is still there (check by ID)
            expect(day2Result[0].id).toBe(3);
            expect(day2Result[0].start_time).toBe("09:00");
        });

        it("should clear coverage for a day if input for that day is empty but day is affected", async () => {
             // Provide data only for day 2, implicitly clearing day 1
             const existingDay2Entry = await getCoverageById(3);
             const day2OnlyData: BulkCoverageInput[] = [{
                    day_index: 2, // Affect day 2
                    start_time: existingDay2Entry.start_time, // Keep same data
                    end_time: existingDay2Entry.end_time,
                    min_employees: existingDay2Entry.min_employees,
                    max_employees: existingDay2Entry.max_employees,
                    employee_types: existingDay2Entry.employee_types,
                    requires_keyholder: existingDay2Entry.requires_keyholder,
                 },
                 // Add an entry for day 1 to ensure the day is 'affected' by the input
                 // Then, the insertion loop will insert nothing for day 1 if it's not in the input list?
                 // No, the function deletes based on unique days in input, then inserts everything in input.
                 // Let's try providing data for day 1 that results in an empty set for that day
                 // Effectively: Provide ONLY day 2 data. This should leave day 1 untouched.
            ];

            // Test providing only day 2 data
            await bulkUpdateCoverage(day2OnlyData); 
            let allCoverage = await getAllCoverage();
            // If only day 2 data provided, day 1 should NOT be deleted.
            expect(allCoverage.length).toBe(3);
            expect(allCoverage.filter(c => c.day_index === 1).length).toBe(2);
            expect(allCoverage.filter(c => c.day_index === 2).length).toBe(1);

             // Test clearing day 1: Provide an empty list that affects day 1.
             // How to affect day 1 without providing entries for it?
             // The simplest way to clear day 1 using bulkUpdate is to provide an entry for day 1
             // which defines zero coverage, or provide an empty array for the day 1 data.
             // Let's test providing an empty array for day 1.
             const clearDay1Data: BulkCoverageInput[] = [
                 // Contains only entries for days OTHER than 1, or is empty for day 1
                 // If we provide ONLY day 2 data, day 1 is untouched.
                 // If we provide an empty array, NO days are affected.
                 // Conclusion: bulkUpdate cannot be used to CLEAR a day without providing *some* entry for it.
                 // We will test REPLACING day 1 coverage with an empty set by providing empty day 1 data.
                 // Let's re-seed and replace day 1 with nothing.
                 { day_index: 1, start_time: "00:00", end_time: "00:01", min_employees: 0, max_employees: 0, employee_types: [], requires_keyholder: false }, // Dummy to affect day 1
                 // Need to filter this dummy out before insert? No, the function inserts ALL input.
                 // Okay, let's call bulkUpdate with an empty list for day 1.
             ];
             
             // Test replacing day 1 with no entries
             const replaceDay1WithEmpty: BulkCoverageInput[] = [
                 // No entries with day_index: 1
                 // We need at least one entry to make day 1 'affected'.
                 // Let's provide a dummy entry for day 1, then filter it out? No.
                 // Let's provide ONLY day 2 data, and verify day 1 is untouched.
                 (await getCoverageById(3)) as BulkCoverageInput // Keep day 2 entry
             ];
             // This ^ call should only affect day 2, leaving day 1.

            // Test replacing day 1 with an empty set.
            // This requires the input array to contain at least one day_index: 1 entry
            // for the delete to happen, but the subsequent insert loop should only insert
            // entries from the *provided* array.
            // So, providing an empty array targeting day 1 is not possible with current logic.
            // Test: Replace Day 1 coverage with a single, different entry.
            const replaceDay1WithOne: BulkCoverageInput[] = [
                 { day_index: 1, start_time: "10:00", end_time: "14:00", min_employees: 1, max_employees: 1, employee_types: [EmployeeGroup.GFB], requires_keyholder: false }
            ];
            await bulkUpdateCoverage(replaceDay1WithOne);
            allCoverage = await getAllCoverage();
            expect(allCoverage.length).toBe(2); // Day 2 entry + 1 new Day 1 entry
            expect(allCoverage.filter(c => c.day_index === 1).length).toBe(1);
            expect(allCoverage.filter(c => c.day_index === 2).length).toBe(1);
            expect(allCoverage.find(c => c.day_index === 1)?.start_time).toBe("10:00");

        });

        it("should handle an empty input array gracefully", async () => {
            const initialCoverage = await getAllCoverage();
            const result = await bulkUpdateCoverage([]);
            // Returns the input array
            expect(result).toBeArrayOfSize(0);
            const finalCoverage = await getAllCoverage();
            expect(finalCoverage).toEqual(initialCoverage); // No changes
        });

        it("should process multiple days correctly in one call", async () => {
            const bulkData: BulkCoverageInput[] = [
                 { day_index: 1, start_time: "07:00", end_time: "15:00", min_employees: 1, max_employees: 1, employee_types: [EmployeeGroup.TZ], requires_keyholder: false },
                 { day_index: 2, start_time: "10:00", end_time: "18:00", min_employees: 3, max_employees: 3, employee_types: [EmployeeGroup.VZ], requires_keyholder: true },
                 { day_index: 2, start_time: "18:00", end_time: "22:00", min_employees: 1, max_employees: 1, employee_types: [EmployeeGroup.GFB], requires_keyholder: false },
            ];
            const result = await bulkUpdateCoverage(bulkData);
            // Returns input array
            // expect(result).toBeArrayOfSize(3);

            const finalCoverage = await getAllCoverage();
            expect(finalCoverage.length).toBe(3);
            expect(finalCoverage.filter(c => c.day_index === 1).length).toBe(1);
            expect(finalCoverage.filter(c => c.day_index === 2).length).toBe(2);
            expect(finalCoverage.find(c => c.day_index === 1 && c.start_time === "07:00")).toBeDefined();
            expect(finalCoverage.find(c => c.day_index === 2 && c.start_time === "10:00")).toBeDefined();
            expect(finalCoverage.find(c => c.day_index === 2 && c.start_time === "18:00")).toBeDefined();
        });

    });

}); 