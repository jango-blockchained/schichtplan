import { Database } from "bun:sqlite";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import fs from 'node:fs';
import path from 'node:path';
import { NotFoundError } from "elysia";
import {
  getAllCoverage,
  getCoverageById,
  createCoverage,
  updateCoverage,
  deleteCoverage,
  bulkUpdateCoverage,
} from "./coverageService";
import type { Coverage } from "../db/schema";
import { EmployeeGroup } from "../db/schema";

// Replicate local type aliases used in the service
type CreateCoverageInput = Omit<Coverage, 'id' | 'created_at' | 'updated_at'>;
type UpdateCoverageInput = Partial<Omit<Coverage, 'id' | 'created_at' | 'updated_at'>>;
// Type for bulk update input matching the service function signature
type BulkCoverageInput = Omit<Coverage, 'id' | 'created_at' | 'updated_at'> & { id?: number };

// Use a unique ID for the database to ensure isolation
const dbId = randomUUID();
let testDb: Database;

// Function to apply schema (Synchronous read)
const applySchema = (db: Database) => {
  const schemaPath = path.join(import.meta.dir, "../db/init-schema.sql");
  console.log(`[coverageService.test] Applying schema from: ${schemaPath}`);
  try {
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    db.exec(schemaSql);
    console.log(`[coverageService.test] Schema applied successfully.`);
  } catch (error) {
    console.error(`[coverageService.test] Error applying schema: ${error}`);
    throw error;
  }
};

// Function to seed coverage data - Adjusted to match schema (min/max employees, no notes)
const seedCoverageData = (db: Database) => {
    console.log("[coverageService.test] Clearing and re-seeding coverage table...");
    db.exec("DELETE FROM coverage;");
    let insertedCount = 0;
    try {
        // Note: Schema uses min/max employees, not required_employees. No notes field.
        const stmt = db.prepare(`
            INSERT INTO coverage (id, day_index, start_time, end_time, min_employees, max_employees, employee_types, allowed_employee_groups, requires_keyholder) VALUES
            (1, 1, '09:00', '17:00', 2, 3, '[]', '[]', 0),
            (2, 1, '17:00', '20:00', 1, 2, '[]', '[]', 0),
            (3, 2, '09:00', '17:00', 2, 2, '[]', '[]', 0),
            (4, 6, '10:00', '18:00', 3, 3, '[]', '[]', 0)
        `);
        const result = stmt.run();
        insertedCount = 4; // We inserted 4 rows
        console.log(`[coverageService.test] Coverage table seeded. Targeted: ${insertedCount}`);
        stmt.finalize();
    } catch (err: any) {
        console.error("[coverageService.test] Error seeding coverage data:", err.message);
        throw new Error(`Failed to seed coverage test data: ${err.message}`);
    }
    // Verify count immediately after seeding
    const countCheck = db.query("SELECT COUNT(*) as count FROM coverage;").get() as { count: number };
    if (countCheck.count !== 4) {
         console.error(`[coverageService.test] SEED VERIFICATION FAILED: Expected 4 rows after seed, found ${countCheck.count}`);
         throw new Error(`[coverageService.test] Seed verification failed: Expected 4 rows, found ${countCheck.count}`);
    }
    console.log(`[coverageService.test] Seed verification successful: Found ${countCheck.count} rows.`);
    return countCheck.count;
};

describe("Coverage Service", () => {

  beforeAll(() => { // Sync setup
    const dbIdentifier = `:memory:?id=${dbId}`;
    console.log(`[coverageService.test] Initializing test database: ${dbIdentifier}`);
    testDb = new Database(dbIdentifier);
    console.log(`[coverageService.test] Applying schema to DB ${dbId}...`);
    applySchema(testDb);
    console.log(`[coverageService.test] Schema applied to DB ${dbId}.`);
  });

  afterAll(() => {
    if (testDb) {
      console.log(`[coverageService.test] Closing DB ${dbId}`);
      testDb.close();
    }
  });

  beforeEach(() => { // Sync seeding
    console.log('[coverageService.test] Seeding coverage data for test...');
    try {
      const count = seedCoverageData(testDb);
      if (count !== 4) {
          throw new Error(`Seeding verification failed.`);
      }
    } catch (e) {
      console.error("[coverageService.test] Error during beforeEach seed:", e);
      throw e;
    }
  });

  // --- Test Cases (Adjusted for schema: min/max employees, no notes) ---
  describe("getAllCoverage", () => {
    it("should retrieve all seeded coverage entries sorted by day and time", async () => {
      const coverage = await getAllCoverage(testDb);
      expect(coverage.length).toBe(4);
      expect(coverage[0].id).toBe(1);
      expect(coverage[1].id).toBe(2);
      expect(coverage[2].id).toBe(3);
      expect(coverage[3].id).toBe(4);
    });

    it("should return an empty array if no coverage entries exist", async () => {
      testDb.exec("DELETE FROM coverage;");
      const coverage = await getAllCoverage(testDb);
      expect(coverage.length).toBe(0);
    });
  });

   describe("getCoverageById", () => {
     it("should retrieve an existing coverage entry by ID", async () => {
       const entry = await getCoverageById(1, testDb);
       expect(entry).toBeDefined();
       expect(entry!.id).toBe(1);
       expect(entry!.day_index).toBe(1);
       expect(entry!.start_time).toBe("09:00");
       expect(entry!.min_employees).toBe(2); // Check schema field
     });

     it("should throw NotFoundError for a non-existent coverage ID", async () => {
       // Check for the specific error message from the service
       await expect(getCoverageById(999, testDb))
         .rejects
         .toThrow(/Coverage entry with id 999 not found/);
     });
   });

   describe("createCoverage", () => {
     it("should create a new coverage entry with valid data", async () => {
       const newEntryData: CreateCoverageInput = {
         day_index: 3,
         start_time: "10:00",
         end_time: "18:00",
         min_employees: 2, // Use schema field
         max_employees: 3,
         employee_types: [], // Provide default empty arrays for JSON fields
         allowed_employee_groups: [],
         requires_keyholder: false,
         // notes: "New Entry", // Removed notes
       };
       const createdEntry = await createCoverage(newEntryData, testDb);
       expect(createdEntry).toBeDefined();
       expect(createdEntry.id).toBeGreaterThan(4);
       expect(createdEntry.day_index).toBe(3);
       expect(createdEntry.start_time).toBe("10:00");
       expect(createdEntry.min_employees).toBe(2);
       // expect(createdEntry.notes).toBe("New Entry"); // Removed notes check

       const fetched = await getCoverageById(createdEntry.id, testDb);
       expect(fetched).toBeDefined();
       expect(fetched!.day_index).toBe(3);
     });

      it("should handle nullable fields correctly during creation", async () => {
        const newEntryData: CreateCoverageInput = {
            day_index: 4,
            start_time: "12:00",
            end_time: "14:00",
            min_employees: 1,
            max_employees: 1,
            employee_types: [],
            allowed_employee_groups: null, // Test setting nullable JSON to null
            requires_keyholder: true,
            keyholder_before_minutes: 10,
            keyholder_after_minutes: null
            // notes: null // Removed notes
        };
         const createdEntry = await createCoverage(newEntryData, testDb);
         expect(createdEntry.allowed_employee_groups).toEqual([]); // Service maps null JSON to empty array
         expect(createdEntry.requires_keyholder).toBe(true);
         expect(createdEntry.keyholder_before_minutes).toBe(10);
         expect(createdEntry.keyholder_after_minutes).toBeNull();
         // expect(createdEntry.notes).toBeNull(); // Removed notes check
      });

      it("should throw an error for invalid day_index", async () => {
          const invalidData: CreateCoverageInput = { day_index: 8, start_time: '09:00', end_time: '17:00', min_employees: 1, max_employees: 1, employee_types: [], requires_keyholder: false };
          // Check for specific error message from service validation
          await expect(createCoverage(invalidData, testDb))
            .rejects
            .toThrow(/Invalid day_index/);
      });
   });

   describe("updateCoverage", () => {
     it("should update specified fields of an existing coverage entry", async () => {
       const entryIdToUpdate = 1;
       const updates: UpdateCoverageInput = {
         start_time: "08:30",
         min_employees: 3, // Use schema field
         max_employees: 4,
         requires_keyholder: true,
         // notes: "Updated shift", // Removed notes
       };
       const updatedEntry = await updateCoverage(entryIdToUpdate, updates, testDb);
       expect(updatedEntry.id).toBe(entryIdToUpdate);
       expect(updatedEntry.start_time).toBe("08:30");
       expect(updatedEntry.min_employees).toBe(3);
       expect(updatedEntry.max_employees).toBe(4);
       expect(updatedEntry.requires_keyholder).toBe(true);
       // expect(updatedEntry.notes).toBe("Updated shift"); // Removed notes check
       expect(updatedEntry.end_time).toBe("17:00"); // Unchanged field
     });

      it("should return the current entry if no data is provided for update", async () => {
          const entryIdToUpdate = 2;
          const currentEntry = await getCoverageById(entryIdToUpdate, testDb);
          const updatedEntry = await updateCoverage(entryIdToUpdate, {}, testDb);
          expect(updatedEntry).toEqual(currentEntry);
      });

     it("should throw NotFoundError if trying to update a non-existent entry", async () => {
       await expect(updateCoverage(999, { min_employees: 1 }, testDb))
         .rejects
         .toThrow(/Coverage entry with ID 999 not found/);
     });

      it("should handle setting nullable fields to null during update", async () => {
          const entryIdToUpdate = 4;
          const updatedEntry = await updateCoverage(entryIdToUpdate, { allowed_employee_groups: null }, testDb);
          expect(updatedEntry.allowed_employee_groups).toEqual([]); // Service maps null to empty array
          // expect(updatedEntry.notes).toBeNull(); // Removed notes check
      });

       it("should throw an error if updating with invalid day_index", async () => {
           const entryIdToUpdate = 1;
           const invalidUpdates: UpdateCoverageInput = { day_index: -1 };
           await expect(updateCoverage(entryIdToUpdate, invalidUpdates, testDb))
             .rejects
             .toThrow(/Invalid day_index/);
       });
   });

   describe("deleteCoverage", () => {
     it("should delete an existing coverage entry and return success", async () => {
       const entryIdToDelete = 2;
       let entry = await getCoverageById(entryIdToDelete, testDb);
       expect(entry).toBeDefined();

       const result = await deleteCoverage(entryIdToDelete, testDb);
       expect(result.success).toBe(true);

       await expect(getCoverageById(entryIdToDelete, testDb)).rejects.toThrow(NotFoundError);

       const coverage = await getAllCoverage(testDb);
       expect(coverage.length).toBe(3);
     });

     it("should throw NotFoundError if trying to delete a non-existent entry", async () => {
       await expect(deleteCoverage(999, testDb)).rejects.toThrow(NotFoundError);
     });
   });

    describe("bulkUpdateCoverage", () => {
     it("should replace all coverage entries for the specified days", async () => {
       // Test data matching schema (min/max, no notes)
       const day1Replacement: BulkCoverageInput[] = [
         { day_index: 1, start_time: "08:00", end_time: "12:00", min_employees: 1, max_employees: 1, employee_types: [], requires_keyholder: false },
         { day_index: 1, start_time: "12:00", end_time: "16:00", min_employees: 2, max_employees: 2, employee_types: [], requires_keyholder: false },
       ];

       // Pass only the array and rely on default DB instance from service
       await bulkUpdateCoverage(day1Replacement, testDb);

       const allCoverage = await getAllCoverage(testDb);
       const day1Entries = allCoverage.filter(c => c.day_index === 1);
       expect(day1Entries.length).toBe(2);
       expect(day1Entries[0].start_time).toBe("08:00");
       expect(day1Entries[1].start_time).toBe("12:00");

       const otherDayEntries = allCoverage.filter(c => c.day_index !== 1);
       expect(otherDayEntries.length).toBe(2);
     });

     it("should only affect days present in the input array", async () => {
        const dayToUpdate = 2;
        const newEntry: BulkCoverageInput = { day_index: dayToUpdate, start_time: '11:00', end_time: '15:00', min_employees: 1, max_employees: 1, employee_types: [], requires_keyholder: false };
        await bulkUpdateCoverage([newEntry], testDb); // Pass as array

        const allCoverage = await getAllCoverage(testDb);
        const day2Entries = allCoverage.filter(c => c.day_index === dayToUpdate);
        expect(day2Entries.length).toBe(1);
        expect(day2Entries[0].start_time).toBe('11:00');

        expect(allCoverage.find(c => c.id === 1)).toBeDefined();
        expect(allCoverage.find(c => c.id === 2)).toBeDefined();
        expect(allCoverage.find(c => c.id === 4)).toBeDefined();
        expect(allCoverage.length).toBe(4);
     });

     it("should handle an empty input array gracefully (deleting entries for affected days)", async () => {
        // Need to know which days are affected by the empty array.
        // The function deletes based on days present in the input.
        // An empty input array means no days are affected, so nothing should be deleted.
        const initialCoverage = await getAllCoverage(testDb);
        await bulkUpdateCoverage([], testDb);
        const finalCoverage = await getAllCoverage(testDb);
        expect(finalCoverage.length).toBe(initialCoverage.length);
        expect(finalCoverage).toEqual(initialCoverage);
     });

     it("should process multiple days correctly in one call", async () => {
         const bulkData: BulkCoverageInput[] = [
             { day_index: 1, start_time: '07:00', end_time: '15:00', min_employees: 2, max_employees: 2, employee_types: [], requires_keyholder: false }, // Replaces Day 1 entries
             { day_index: 3, start_time: '09:00', end_time: '13:00', min_employees: 1, max_employees: 1, employee_types: [], requires_keyholder: false }, // Adds Day 3 entry
             { day_index: 3, start_time: '13:00', end_time: '17:00', min_employees: 1, max_employees: 1, employee_types: [], requires_keyholder: false }  // Adds Day 3 entry
         ];

         await bulkUpdateCoverage(bulkData, testDb);

         const allCoverage = await getAllCoverage(testDb);
         const day1Entries = allCoverage.filter(c => c.day_index === 1);
         const day3Entries = allCoverage.filter(c => c.day_index === 3);

         expect(day1Entries.length).toBe(1);
         expect(day1Entries[0].start_time).toBe('07:00');
         expect(day3Entries.length).toBe(2);
         expect(day3Entries[0].start_time).toBe('09:00');
         expect(day3Entries[1].start_time).toBe('13:00');

         // Check original Day 2 and Day 6 entries are still there (as day_index 2 and 6 were not in bulkData)
         expect(allCoverage.find(c => c.day_index === 2)).toBeDefined();
         expect(allCoverage.find(c => c.day_index === 6)).toBeDefined();
         expect(allCoverage.length).toBe(1 + 2 + 1 + 1); // 1(new day1) + 2(new day3) + 1(orig day2) + 1(orig day6) = 5
     });

    });

}); // End describe("Coverage Service") 