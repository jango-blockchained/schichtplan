import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { setupTestDb, teardownTestDb, getTestDb, seedTestData } from "../test/setup";
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
    beforeAll(async () => {
        await setupTestDb();
    });

    afterAll(() => {
        teardownTestDb();
    });

    beforeEach(() => {
        // Example: Log start of test or reset specific non-DB state
        // console.log(`Starting test: ${expect.getState().currentTestName}`);
        // If needed, manipulate seeded data directly for a test:
        // getTestDb().run("UPDATE coverage SET min_employees = 5 WHERE id = 1;");
    });

    afterEach(() => {});

    describe("getAllCoverage", () => {
        it("should retrieve all seeded coverage entries sorted by day and time", async () => {
            const coverageEntries = await getAllCoverage();
            expect(coverageEntries).toBeArray();
            expect(coverageEntries.length).toBeGreaterThanOrEqual(3);
            const entry1 = coverageEntries.find(c => c.id === 1);
            const entry2 = coverageEntries.find(c => c.id === 2);
            const entry3 = coverageEntries.find(c => c.id === 3);
            expect(entry1).toBeDefined();
            expect(entry2).toBeDefined();
            expect(entry3).toBeDefined();
            expect(entry1?.day_index).toBe(1);
            expect(entry1?.start_time).toBe("08:00");
            expect(entry2?.day_index).toBe(1);
            expect(entry2?.start_time).toBe("16:00");
            expect(entry3?.day_index).toBe(2);
        });

        it("should return an empty array if no coverage entries exist", async () => {
            getTestDb().exec("DELETE FROM coverage;");
            const coverageEntries = await getAllCoverage();
            expect(coverageEntries).toBeArrayOfSize(0);
            seedTestData(getTestDb());
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
            getTestDb().run("DELETE FROM coverage WHERE id = 999;");
            await expect(getCoverageById(999)).rejects.toThrow(NotFoundError);
            await expect(getCoverageById(999)).rejects.toThrow("Coverage entry with id 999 not found.");
        });
    });

    describe("createCoverage", () => {
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
            expect(createdEntry.id).toBeGreaterThan(3);
            expect(createdEntry.day_index).toBe(3);
            expect(createdEntry.start_time).toBe("10:00");
            expect(createdEntry.min_employees).toBe(1);
            expect(createdEntry.employee_types).toEqual([EmployeeGroup.TZ, EmployeeGroup.GFB]);
            expect(createdEntry.requires_keyholder).toBe(false);
            expect(createdEntry.created_at).toBeDefined();
            expect(createdEntry.updated_at).toBeDefined();

            const fetchedEntry = await getCoverageById(createdEntry.id);
            expect(fetchedEntry).toEqual(createdEntry);

            await deleteCoverage(createdEntry.id);
        });

        it("should handle nullable fields correctly during creation", async () => {
            const newCoverageData: CreateCoverageInput = {
                day_index: 4,
                start_time: "12:00",
                end_time: "20:00",
                min_employees: 1,
                max_employees: 1,
                employee_types: [EmployeeGroup.VZ],
                allowed_employee_groups: null,
                requires_keyholder: true,
                keyholder_before_minutes: 15,
                keyholder_after_minutes: null,
            };
            const createdEntry = await createCoverage(newCoverageData);
            expect(createdEntry.allowed_employee_groups).toEqual([]);
            expect(createdEntry.requires_keyholder).toBe(true);
            expect(createdEntry.keyholder_before_minutes).toBe(15);
            expect(createdEntry.keyholder_after_minutes).toBeNull();
        });

        it("should throw an error for invalid day_index", async () => {
            const invalidData: CreateCoverageInput = {
                day_index: 7,
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
        type UpdateCoverageInput = Partial<Omit<Coverage, 'id' | 'created_at' | 'updated_at'>>;

        it("should update specified fields of an existing coverage entry", async () => {
            const entryIdToUpdate = 1;
            const updates: UpdateCoverageInput = {
                start_time: "08:30",
                min_employees: 1,
                max_employees: 1,
                requires_keyholder: true,
                employee_types: [EmployeeGroup.VZ],
                allowed_employee_groups: [EmployeeGroup.VZ]
            };

            const originalEntry = await getCoverageById(entryIdToUpdate);
            const updatedEntry = await updateCoverage(entryIdToUpdate, updates);

            expect(updatedEntry).not.toBeNull();
            expect(updatedEntry.id).toBe(entryIdToUpdate);
            expect(updatedEntry.start_time).toBe("08:30");
            expect(updatedEntry.end_time).toBe("16:00");
            expect(updatedEntry.min_employees).toBe(1);
            expect(updatedEntry.max_employees).toBe(1);
            expect(updatedEntry.requires_keyholder).toBe(true);
            expect(updatedEntry.employee_types).toEqual([EmployeeGroup.VZ]);
            expect(updatedEntry.allowed_employee_groups).toEqual([EmployeeGroup.VZ]);
            expect(updatedEntry.updated_at).not.toBe(originalEntry.created_at);

            const fetchedEntry = await getCoverageById(entryIdToUpdate);
            expect(fetchedEntry).toEqual(updatedEntry);
        });

        it("should return the current entry if no data is provided for update", async () => {
            const entryIdToUpdate = 2;
            const initialEntry = await getCoverageById(entryIdToUpdate);
            const updatedEntry = await updateCoverage(entryIdToUpdate, {});

            expect(updatedEntry).toEqual(initialEntry);
            expect(updatedEntry.updated_at).toBe(initialEntry.updated_at);
        });

        it("should throw NotFoundError if trying to update a non-existent entry", async () => {
            const nonExistentId = 999;
            const updates = { min_employees: 5 };
            await expect(updateCoverage(nonExistentId, updates)).rejects.toThrow(NotFoundError);
        });

        it("should handle setting nullable fields to null during update", async () => {
            const entryIdToUpdate = 3;
            const updates: UpdateCoverageInput = {
                allowed_employee_groups: null,
                keyholder_before_minutes: null,
                keyholder_after_minutes: null,
            };
            const updatedEntry = await updateCoverage(entryIdToUpdate, updates);
            expect(updatedEntry.allowed_employee_groups).toEqual([]);
            expect(updatedEntry.keyholder_before_minutes).toBeNull();
            expect(updatedEntry.keyholder_after_minutes).toBeNull();
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

            await expect(getCoverageById(entryIdToDelete)).rejects.toThrow(NotFoundError);
        });

        it("should throw NotFoundError if trying to delete a non-existent entry", async () => {
            const nonExistentId = 999;
            await expect(deleteCoverage(nonExistentId)).rejects.toThrow(NotFoundError);
        });
    });

    describe("bulkUpdateCoverage", () => {
        type BulkCoverageInput = Omit<Coverage, 'id' | 'created_at' | 'updated_at'> & { id?: number };

        it("should replace all coverage entries for the specified days", async () => {
            const day1Replacement: BulkCoverageInput[] = [
                {
                    day_index: 1,
                    start_time: "09:00",
                    end_time: "17:00",
                    min_employees: 1,
                    max_employees: 1,
                    employee_types: [EmployeeGroup.VZ],
                    requires_keyholder: false,
                },
                {
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

            const allCoverage = await getAllCoverage();

            expect(allCoverage.length).toBe(3);

            const day1Result = allCoverage.filter(c => c.day_index === 1);
            const day2Result = allCoverage.filter(c => c.day_index === 2);

            expect(day1Result.length).toBe(2);
            expect(day2Result.length).toBe(1);

            expect(day1Result.find(c => c.start_time === "09:00")?.employee_types).toEqual([EmployeeGroup.VZ]);
            expect(day1Result.find(c => c.start_time === "09:00")?.requires_keyholder).toBe(false);
            expect(day1Result.find(c => c.start_time === "17:00")?.employee_types).toEqual([EmployeeGroup.TZ]);
            expect(day1Result.find(c => c.start_time === "17:00")?.requires_keyholder).toBe(true);

            expect(day2Result[0].id).toBe(3);
            expect(day2Result[0].start_time).toBe("09:00");
        });

        it("should clear coverage for a day if input for that day is empty but day is affected", async () => {
            const existingDay2Entry = await getCoverageById(3);
            const day2OnlyData: BulkCoverageInput[] = [{
                day_index: 2,
                start_time: existingDay2Entry.start_time,
                end_time: existingDay2Entry.end_time,
                min_employees: existingDay2Entry.min_employees,
                max_employees: existingDay2Entry.max_employees,
                employee_types: existingDay2Entry.employee_types,
                requires_keyholder: existingDay2Entry.requires_keyholder,
            }];

            await bulkUpdateCoverage(day2OnlyData);
            let allCoverage = await getAllCoverage();
            expect(allCoverage.length).toBe(3);
            expect(allCoverage.filter(c => c.day_index === 1).length).toBe(2);
            expect(allCoverage.filter(c => c.day_index === 2).length).toBe(1);
        });

        it("should handle an empty input array gracefully", async () => {
            const initialCoverage = await getAllCoverage();
            const result = await bulkUpdateCoverage([]);
            expect(result).toBeArrayOfSize(0);
            const finalCoverage = await getAllCoverage();
            expect(finalCoverage).toEqual(initialCoverage);
        });

        it("should process multiple days correctly in one call", async () => {
            const bulkData: BulkCoverageInput[] = [
                { day_index: 1, start_time: "07:00", end_time: "15:00", min_employees: 1, max_employees: 1, employee_types: [EmployeeGroup.TZ], requires_keyholder: false },
                { day_index: 2, start_time: "10:00", end_time: "18:00", min_employees: 3, max_employees: 3, employee_types: [EmployeeGroup.VZ], requires_keyholder: true },
                { day_index: 2, start_time: "18:00", end_time: "22:00", min_employees: 1, max_employees: 1, employee_types: [EmployeeGroup.GFB], requires_keyholder: false },
            ];
            const result = await bulkUpdateCoverage(bulkData);

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