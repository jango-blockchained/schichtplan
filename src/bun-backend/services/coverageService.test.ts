import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import path from "node:path"; 
import fs from "node:fs";   
// Remove shared setup import
// import { setupTestDb, teardownTestDb, seedTestData } from "../test/setup";
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
import { randomUUID } from "node:crypto"; // Import crypto

// Function to seed only coverage data
const seedCoverageData = (db: Database) => {
    console.log("[coverageService.test] Clearing and re-seeding coverage table...");
    db.exec("DELETE FROM coverage;"); 
    const now = new Date().toISOString();
    let insertedCount = 0;
    try {
         const stmt = db.prepare(`
            INSERT INTO coverage (id, day_index, start_time, end_time, min_employees, max_employees, employee_types, allowed_employee_groups, requires_keyholder, created_at, updated_at) VALUES
            (1, 1, '08:00', '16:00', 2, 3, '[\"VZ\",\"TZ\"]' , '[\"VZ\",\"TZ\",\"GFB\"]' , 0, ?, ?),
            (2, 1, '16:00', '22:00', 1, 2, '[\"VZ\",\"TZ\",\"GFB\"]' , null , 1, ?, ?),
            (3, 2, '09:00', '17:00', 2, 2, '[\"VZ\",\"TZ\"]' , '[\"VZ\",\"TZ\"]' , 1, ?, ?)
         `);
         const result = stmt.run(now, now, now, now, now, now); // Pass timestamps as params
         insertedCount = result.changes;
         console.log(`[coverageService.test] Coverage table seeded. Changes: ${insertedCount}`);
    } catch (err: any) {
        console.error("[coverageService.test] Error seeding coverage into test DB:", err.message);
        throw new Error(`[coverageService.test] Failed to seed coverage test data: ${err.message}`);
    }
    return insertedCount;
};

describe("Coverage Service", () => {
    let testDb: Database;
    const dbId = randomUUID(); // Generate unique ID for this suite

    beforeAll(async () => {
        // Use unique identifier for in-memory DB
        testDb = new Database(`:memory:?id=${dbId}`); 
        console.log(`[coverageService.test] Applying schema to DB ${dbId}...`);
        const schemaPath = path.join(import.meta.dir, "../db/init-schema.sql");
        const schemaSql = fs.readFileSync(schemaPath, "utf-8");
        await Promise.resolve(testDb.exec(schemaSql)); 
        console.log(`[coverageService.test] Schema applied to DB ${dbId}.`);
    });

    afterAll(() => {
        if (testDb) testDb.close();
    });
    
    beforeEach(() => {
        try {
            seedCoverageData(testDb);
        } catch (e) {
            console.error("[coverageService.test] Error during beforeEach seed:", e);
            throw e; 
        }
    });

    describe("getAllCoverage", () => {
        it("should retrieve all seeded coverage entries sorted by day and time", async () => {
            const coverageEntries = await getAllCoverage(testDb); 
            expect(coverageEntries).toBeArray();
            expect(coverageEntries.length).toBe(3); 
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
            expect(entry3?.start_time).toBe("09:00"); 
        });

        it("should return an empty array if no coverage entries exist", async () => {
            testDb.exec("DELETE FROM coverage;"); 
            const coverageEntries = await getAllCoverage(testDb); 
            expect(coverageEntries).toBeArrayOfSize(0);
        });
    });

    describe("getCoverageById", () => {
        it("should retrieve an existing coverage entry by ID", async () => {
            const entry = await getCoverageById(1, testDb);
            expect(entry).toBeDefined();
            expect(entry!.id).toBe(1);
            expect(entry.day_index).toBe(1);
            expect(entry.start_time).toBe("08:00");
            expect(entry.employee_types).toEqual([EmployeeGroup.VZ, EmployeeGroup.TZ]);
            expect(entry.allowed_employee_groups).toEqual([EmployeeGroup.VZ, EmployeeGroup.TZ, EmployeeGroup.GFB]);
            expect(entry.requires_keyholder).toBe(false); 
        });

        it("should throw NotFoundError for a non-existent coverage ID", async () => {
            await expect(getCoverageById(999, testDb)).rejects.toThrow(NotFoundError);
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

            const createdEntry = await createCoverage(newCoverageData, testDb);

            expect(createdEntry).toBeDefined();
            expect(createdEntry.id).toBeGreaterThan(3);
            expect(createdEntry.day_index).toBe(3);
            expect(createdEntry.start_time).toBe("10:00");
            expect(createdEntry.min_employees).toBe(1);
            expect(createdEntry.employee_types).toEqual([EmployeeGroup.TZ, EmployeeGroup.GFB]);
            expect(createdEntry.requires_keyholder).toBe(false);
            expect(createdEntry.created_at).toBeDefined();
            expect(createdEntry.updated_at).toBeDefined();

            const fetchedEntry = await getCoverageById(createdEntry.id, testDb);
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
                allowed_employee_groups: null,
                requires_keyholder: true,
                keyholder_before_minutes: 15,
                keyholder_after_minutes: null,
            };
            const createdEntry = await createCoverage(newCoverageData, testDb);
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
            await expect(createCoverage(invalidData, testDb)).rejects.toThrow("Invalid day_index"); 
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

            const updatedEntry = await updateCoverage(entryIdToUpdate, updates, testDb); 

            expect(updatedEntry).not.toBeNull();
            expect(updatedEntry.id).toBe(entryIdToUpdate);
            expect(updatedEntry.start_time).toBe("08:30");
            expect(updatedEntry.end_time).toBe("16:00"); // Unchanged
            expect(updatedEntry.min_employees).toBe(1);
            expect(updatedEntry.max_employees).toBe(1);
            expect(updatedEntry.requires_keyholder).toBe(true); // Updated from seed (0 -> 1)
            expect(updatedEntry.employee_types).toEqual([EmployeeGroup.VZ]);
            expect(updatedEntry.allowed_employee_groups).toEqual([EmployeeGroup.VZ]);

            const fetchedEntry = await getCoverageById(entryIdToUpdate, testDb);
            expect(fetchedEntry).toEqual(updatedEntry);
        });

        it("should return the current entry if no data is provided for update", async () => {
            const entryIdToUpdate = 2;
            const initialEntry = await getCoverageById(entryIdToUpdate, testDb);
            const updatedEntry = await updateCoverage(entryIdToUpdate, {}, testDb);

            expect(updatedEntry).toEqual(initialEntry);
        });

        it("should throw NotFoundError if trying to update a non-existent entry", async () => {
            const updates = { min_employees: 5 };
            await expect(updateCoverage(999, updates, testDb)).rejects.toThrow(NotFoundError);
        });

        it("should handle setting nullable fields to null during update", async () => {
            const entryIdToUpdate = 3;
            const updates: UpdateCoverageInput = {
                allowed_employee_groups: null,
                keyholder_before_minutes: null,
                keyholder_after_minutes: null,
            };
            const updatedEntry = await updateCoverage(entryIdToUpdate, updates, testDb);
            expect(updatedEntry.allowed_employee_groups).toEqual([]); 
            expect(updatedEntry.keyholder_before_minutes).toBeNull();
            expect(updatedEntry.keyholder_after_minutes).toBeNull();
            expect(updatedEntry.requires_keyholder).toBe(true); // Unchanged from seed
        });

        it("should throw an error if updating with invalid day_index", async () => {
            const entryIdToUpdate = 1;
            const updates: UpdateCoverageInput = { day_index: -1 };
            await expect(updateCoverage(entryIdToUpdate, updates, testDb)).rejects.toThrow("Invalid day_index"); 
        });
    });

    describe("deleteCoverage", () => {
        it("should delete an existing coverage entry and return success", async () => {
            const entryIdToDelete = 2;
            const result = await deleteCoverage(entryIdToDelete, testDb);
            expect(result).toEqual({ success: true });
            await expect(getCoverageById(entryIdToDelete, testDb)).rejects.toThrow(NotFoundError);
        });

        it("should throw NotFoundError if trying to delete a non-existent entry", async () => {
            await expect(deleteCoverage(999, testDb)).rejects.toThrow(NotFoundError);
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

            await bulkUpdateCoverage(day1Replacement, testDb); 
            const coverageAfter = await getAllCoverage(testDb); 

            expect(coverageAfter.length).toBe(3);

            const day1Result = coverageAfter.filter(c => c.day_index === 1);
            const day2Result = coverageAfter.filter(c => c.day_index === 2);

            expect(day1Result.length).toBe(2);
            expect(day2Result.length).toBe(1); 

            expect(day1Result.find(c => c.start_time === "09:00")?.employee_types).toEqual([EmployeeGroup.VZ]);
            expect(day1Result.find(c => c.start_time === "09:00")?.requires_keyholder).toBe(false);
            expect(day1Result.find(c => c.start_time === "17:00")?.employee_types).toEqual([EmployeeGroup.TZ]);
            expect(day1Result.find(c => c.start_time === "17:00")?.requires_keyholder).toBe(true);

            expect(day2Result[0].id).toBe(3); 
            expect(day2Result[0].start_time).toBe("09:00"); 
        });

        it("should only affect days present in the input array", async () => {
            const originalCoverage = await getAllCoverage(testDb); 
            expect(originalCoverage.length).toBe(3);
            const originalDay1Count = originalCoverage.filter(c => c.day_index === 1).length;
            const originalDay2Count = originalCoverage.filter(c => c.day_index === 2).length;
            expect(originalDay1Count).toBe(2);
            expect(originalDay2Count).toBe(1);
            
            const day2Data: BulkCoverageInput[] = [
                 { day_index: 2, start_time: "10:00", end_time: "19:00", min_employees: 1, max_employees: 1, employee_types: [EmployeeGroup.GFB], requires_keyholder: false },
            ];

            await bulkUpdateCoverage(day2Data, testDb); 
            let coverageAfter = await getAllCoverage(testDb); 
            
            expect(coverageAfter.length).toBe(3);
            expect(coverageAfter.filter(c => c.day_index === 1).length).toBe(2); // Day 1 unchanged
            expect(coverageAfter.filter(c => c.day_index === 2).length).toBe(1); // Day 2 replaced
            
            const day1Entries = coverageAfter.filter(c => c.day_index === 1);
            const day2Entries = coverageAfter.filter(c => c.day_index === 2);

            expect(day1Entries.find(c => c.id === 1)).toBeDefined(); 
            expect(day1Entries.find(c => c.id === 2)).toBeDefined();
            expect(day2Entries[0].start_time).toBe("10:00");
            expect(day2Entries[0].employee_types).toEqual([EmployeeGroup.GFB]);
        });

        it("should handle an empty input array gracefully", async () => {
            const initialCoverage = await getAllCoverage(testDb); 
            await bulkUpdateCoverage([], testDb); 
            const coverageAfter = await getAllCoverage(testDb); 
            expect(coverageAfter).toEqual(initialCoverage);
            expect(coverageAfter.length).toBe(3); 
        });

        it("should process multiple days correctly in one call", async () => {
            const bulkData: BulkCoverageInput[] = [
                { day_index: 1, start_time: "07:00", end_time: "15:00", min_employees: 1, max_employees: 1, employee_types: [EmployeeGroup.TZ], requires_keyholder: false }, 
                { day_index: 2, start_time: "10:00", end_time: "18:00", min_employees: 3, max_employees: 3, employee_types: [EmployeeGroup.VZ], requires_keyholder: true }, 
                { day_index: 2, start_time: "18:00", end_time: "22:00", min_employees: 1, max_employees: 1, employee_types: [EmployeeGroup.GFB], requires_keyholder: false }, 
            ];
            await bulkUpdateCoverage(bulkData, testDb); 
            const coverageAfter = await getAllCoverage(testDb); 
            
            expect(coverageAfter.length).toBe(3);
            expect(coverageAfter.filter(c => c.day_index === 1).length).toBe(1);
            expect(coverageAfter.filter(c => c.day_index === 2).length).toBe(2);
            expect(coverageAfter.find(c => c.day_index === 1 && c.start_time === "07:00")).toBeDefined();
            expect(coverageAfter.find(c => c.day_index === 2 && c.start_time === "10:00")).toBeDefined();
            expect(coverageAfter.find(c => c.day_index === 2 && c.start_time === "18:00")).toBeDefined();
        });
    });
}); 