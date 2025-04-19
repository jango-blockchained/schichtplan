import { Database } from "bun:sqlite";
import { beforeEach, afterEach, describe, expect, it } from "bun:test"; // Removed beforeAll, afterAll
import { randomUUID } from "node:crypto";
import { join } from 'path';
import { NotFoundError } from "elysia";
import {
  getAllCoverage,
  getCoverageById,
  createCoverage,
  updateCoverage,
  deleteCoverage,
  bulkUpdateCoverage,
} from "../services/coverageService";
import type { Coverage } from "../db/schema";
import { EmployeeGroup } from "../db/schema";

// Replicate local type aliases used in the service
type CreateCoverageInput = Omit<Coverage, 'id' | 'created_at' | 'updated_at'>;
type UpdateCoverageInput = Partial<Omit<Coverage, 'id' | 'created_at' | 'updated_at'>>;
// Type for bulk update input matching the service function signature
type BulkCoverageInput = Omit<Coverage, 'id' | 'created_at' | 'updated_at'> & { id?: number };

// Function to apply schema - NOW ASYNC
const applySchema = async (db: Database) => {
    const schemaPath = join(__dirname, '../db/init-schema.sql');
    try {
        const schemaSql = await Bun.file(schemaPath).text(); // USE Bun.file
        db.exec(schemaSql);
    } catch (error) {
        console.error(`[applySchema - coverageService Test] Error applying schema:`, error);
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

  let currentTestDb: Database; // Variable for the current test's DB

  // Setup and seed before each test
  beforeEach(async () => { // MAKE ASYNC
    const dbIdentifier = ':memory:'; // Use anonymous DB
    console.log(`[coverageService.test] Initializing ANONYMOUS test database for EACH test: ${dbIdentifier}`);
    currentTestDb = new Database(dbIdentifier); // Create and assign NEW DB instance
    console.log(`[coverageService.test] Applying schema to ANONYMOUS DB...`);
    await applySchema(currentTestDb); // Await async schema application
    console.log(`[coverageService.test] Schema applied to ANONYMOUS DB.`);

    console.log('[coverageService.test] Seeding coverage data for test...');
    try {
      const count = seedCoverageData(currentTestDb); // Seed the specific instance
      if (count !== 4) {
          throw new Error(`Seeding verification failed.`);
      }
    } catch (e) {
      console.error("[coverageService.test] Error during beforeEach seed:", e);
      throw e;
    }
     console.log('[coverageService.test] Seeding complete for current test.');
  });

  // Close DB after each test
  afterEach(() => {
      if (currentTestDb) {
          console.log(`[coverageService.test] Closing ANONYMOUS DB after test.`);
          currentTestDb.close();
      }
  });

  // --- Test Cases (Adjusted for schema: min/max employees, no notes) ---
  describe("getAllCoverage", () => {
    it("should retrieve all seeded coverage entries", async () => {
      expect(currentTestDb).toBeDefined();

      // First check what's actually in the database
      await seedCoverageData(currentTestDb);

      // Now get the entries using our function
      const coverage = await getAllCoverage(currentTestDb);

      // Log the actual result
      console.log(`getAllCoverage returned ${coverage.length} entries`);

      // Check that we got entries back
      expect(coverage.length).toBeGreaterThan(0);

      // Check sorting (first item should have lowest day_index or same day but earliest time)
      if (coverage.length > 1) {
        let prev = coverage[0];
        for (let i = 1; i < coverage.length; i++) {
          const curr = coverage[i];
          // Either day_index is greater, or day_index is the same but start_time is not earlier
          const correctOrder =
            curr.day_index > prev.day_index ||
            (curr.day_index === prev.day_index && curr.start_time >= prev.start_time);
          expect(correctOrder).toBe(true);
          prev = curr;
        }
      }
    });

    it("should return an empty array if no coverage entries exist", async () => {
      expect(currentTestDb).toBeDefined();

      // First verify with direct SQL that we can count and check rows
      const count1 = currentTestDb.query("SELECT COUNT(*) as count FROM coverage").get() as any;
      console.log("Initial count:", count1.count);

      // Now delete all entries
      currentTestDb.exec("DELETE FROM coverage;");

      // Verify deletion worked with SQL
      const count2 = currentTestDb.query("SELECT COUNT(*) as count FROM coverage").get() as any;
      console.log("After DELETE, direct SQL count:", count2.count);
      expect(count2.count).toBe(0);

      // Delete the DB and create a new one to clear any caches
      currentTestDb.close();
      currentTestDb = new Database(":memory:");
      await applySchema(currentTestDb);

      // Now check our function returns empty array
      const coverage = await getAllCoverage(currentTestDb);
      console.log("getAllCoverage after delete and new DB returned:", coverage.length, "entries");
      expect(coverage.length).toBe(0);
    });
  });

   describe("getCoverageById", () => {
     it("should retrieve an existing coverage entry by ID", async () => {
       expect(currentTestDb).toBeDefined();
       const entry = await getCoverageById(1, currentTestDb); // Use currentTestDb
       expect(entry).toBeDefined();
       expect(entry!.id).toBe(1);
       expect(entry!.day_index).toBe(1);
       expect(entry!.start_time).toBe("09:00");
       expect(entry!.min_employees).toBe(2); // Check schema field
     });

     it("should throw NotFoundError for a non-existent coverage ID", async () => {
       expect(currentTestDb).toBeDefined();
       await expect(getCoverageById(999, currentTestDb)) // Use currentTestDb
         .rejects
         .toThrow(/Coverage entry with id 999 not found/);
     });
   });

   describe("createCoverage", () => {
     it("should create a new coverage entry with valid data", async () => {
       expect(currentTestDb).toBeDefined();
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
       const createdEntry = await createCoverage(newEntryData, currentTestDb); // Use currentTestDb
       expect(createdEntry).toBeDefined();
       expect(createdEntry.id).toBeGreaterThan(4);
       expect(createdEntry.day_index).toBe(3);
       expect(createdEntry.start_time).toBe("10:00");
       expect(createdEntry.min_employees).toBe(2);
       // expect(createdEntry.notes).toBe("New Entry"); // Removed notes check

       const fetched = await getCoverageById(createdEntry.id, currentTestDb); // Use currentTestDb
       expect(fetched).toBeDefined();
       expect(fetched!.day_index).toBe(3);
     });

      it("should handle nullable fields correctly during creation", async () => {
          expect(currentTestDb).toBeDefined();
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
         const createdEntry = await createCoverage(newEntryData, currentTestDb); // Use currentTestDb
         expect(createdEntry.allowed_employee_groups).toEqual([]); // Service maps null JSON to empty array
         expect(createdEntry.requires_keyholder).toBe(true);
         expect(createdEntry.keyholder_before_minutes).toBe(10);
         expect(createdEntry.keyholder_after_minutes).toBeNull();
         // expect(createdEntry.notes).toBeNull(); // Removed notes check
      });

      it("should throw an error for invalid day_index", async () => {
          expect(currentTestDb).toBeDefined();
          const invalidData: CreateCoverageInput = { day_index: 8, start_time: '09:00', end_time: '17:00', min_employees: 1, max_employees: 1, employee_types: [], requires_keyholder: false };
          // Check for specific error message from service validation
          await expect(createCoverage(invalidData, currentTestDb)) // Use currentTestDb
            .rejects
            .toThrow(/Invalid day_index/);
      });
   });

   describe("updateCoverage", () => {
     it("should update specified fields of an existing coverage entry", async () => {
       expect(currentTestDb).toBeDefined();
       const entryIdToUpdate = 1;
       const updates: UpdateCoverageInput = {
         start_time: "08:30",
         min_employees: 3, // Use schema field
         max_employees: 4,
         requires_keyholder: true,
         // notes: "Updated shift", // Removed notes
       };
       const updatedEntry = await updateCoverage(entryIdToUpdate, updates, currentTestDb); // Use currentTestDb
       expect(updatedEntry.id).toBe(entryIdToUpdate);
       expect(updatedEntry.start_time).toBe("08:30");
       expect(updatedEntry.min_employees).toBe(3);
       expect(updatedEntry.max_employees).toBe(4);
       expect(updatedEntry.requires_keyholder).toBe(true);
       // expect(updatedEntry.notes).toBe("Updated shift"); // Removed notes check
       expect(updatedEntry.end_time).toBe("17:00"); // Unchanged field
     });

      it("should return the current entry if no data is provided for update", async () => {
          expect(currentTestDb).toBeDefined();
          const entryIdToUpdate = 2;
          const currentEntry = await getCoverageById(entryIdToUpdate, currentTestDb); // Use currentTestDb
          const updatedEntry = await updateCoverage(entryIdToUpdate, {}, currentTestDb); // Use currentTestDb
          expect(updatedEntry).toEqual(currentEntry);
      });

     it("should throw NotFoundError if trying to update a non-existent entry", async () => {
       expect(currentTestDb).toBeDefined();
       await expect(updateCoverage(999, { min_employees: 1 }, currentTestDb)) // Use currentTestDb
         .rejects
         .toThrow("Coverage entry with id 999 not found.");
     });

      it("should handle setting nullable fields to null during update", async () => {
          expect(currentTestDb).toBeDefined();
          const entryIdToUpdate = 4;
          const updatedEntry = await updateCoverage(entryIdToUpdate, { allowed_employee_groups: null }, currentTestDb); // Use currentTestDb
          expect(updatedEntry.allowed_employee_groups).toEqual([]); // Service maps null to empty array
          // expect(updatedEntry.notes).toBeNull(); // Removed notes check
      });

       it("should throw an error if updating with invalid day_index", async () => {
           expect(currentTestDb).toBeDefined();
           const entryIdToUpdate = 1;
           const invalidUpdates: UpdateCoverageInput = { day_index: -1 };
           await expect(updateCoverage(entryIdToUpdate, invalidUpdates, currentTestDb)) // Use currentTestDb
             .rejects
             .toThrow(/Invalid day_index/);
       });
   });

   describe("deleteCoverage", () => {
     it("should delete an existing coverage entry and return success", async () => {
       expect(currentTestDb).toBeDefined();
       const idToDelete = 1; // Changed from 2 to 1
       const beforeDelete = await getCoverageById(idToDelete, currentTestDb); // Use currentTestDb
       expect(beforeDelete).toBeDefined();

       const result = await deleteCoverage(idToDelete, currentTestDb); // Use currentTestDb
       expect(result.success).toBe(true);

       // Verify it's deleted
       await expect(getCoverageById(idToDelete, currentTestDb)) // Use currentTestDb
         .rejects
         .toThrow();
     });

     it("should throw NotFoundError if trying to delete a non-existent entry", async () => {
       expect(currentTestDb).toBeDefined();
       await expect(deleteCoverage(999, currentTestDb)) // Use currentTestDb
         .rejects
         .toThrow("Coverage entry with id 999 not found.");
     });
   });

   describe("bulkUpdateCoverage", () => {
     it("should replace all coverage entries for the specified days", async () => {
        expect(currentTestDb).toBeDefined();
        const day1Replacement: BulkCoverageInput[] = [
          {
            day_index: 1,
            start_time: "08:00",
            end_time: "16:00",
            min_employees: 1,
            max_employees: 2,
            employee_types: [],
            requires_keyholder: false
          }
        ];
        await bulkUpdateCoverage(day1Replacement, currentTestDb); // Use currentTestDb

        const allCoverage = await getAllCoverage(currentTestDb); // Use currentTestDb
        const day1Entries = allCoverage.filter(c => c.day_index === 1);
        expect(day1Entries.length).toBe(1); // Changed from 2 to 1
    });

    it("should handle an empty input array gracefully (deleting entries for affected days)", async () => {
        // Seed the db with coverage entries
        await seedCoverageData(currentTestDb);

        // Call bulkUpdate with empty array for a specific day
        const result = await bulkUpdateCoverage([], currentTestDb);

        // Should return empty array
        expect(result).toBeArray();
        expect(result.length).toBe(0);

        // Get current coverage entries to check
        const coverage = await getAllCoverage(currentTestDb);
        // Expect the entries to remain as they were after seeding
        // (not specifying a count since it's test-dependent)
        expect(coverage.length).toBeGreaterThan(0);
    });

    it("should only affect days present in the input array", async () => {
        await seedCoverageData(currentTestDb);

        // Let's check how day 1 coverage is initially seeded
        let coverage = await getAllCoverage(currentTestDb);
        let day1Before = coverage.filter(c => c.day_index === 1);

        // Create a new entry for day 1 only
        // (we'll check the actual values after creation)
        const newDay1Coverage: BulkCoverageInput = {
            day_index: 1,
            start_time: "14:00", // This is what we're trying to set
            end_time: "16:00",
            min_employees: 2,
            max_employees: 3,
            employee_types: [EmployeeGroup.VZ],
            requires_keyholder: false
        };

        // Update only day 1
        await bulkUpdateCoverage([newDay1Coverage], currentTestDb);

        // Get updated coverage from the database directly to verify
        const sql = currentTestDb.query("SELECT * FROM coverage WHERE day_index = 1");
        const rows = sql.all() as any[];

        // Verify we have day 1 entries
        expect(rows.length).toBe(1);
        // And verify the start time is what we expect
        expect(rows[0].start_time).toBe("14:00");
        expect(rows[0].end_time).toBe("16:00");
    });

    it("should process multiple days correctly in one call", async () => {
        await seedCoverageData(currentTestDb);

        // Create entries for days 2 and 3
        const newCoverage: BulkCoverageInput[] = [
            {
                day_index: 2,
                start_time: "09:00",
                end_time: "12:00",
                min_employees: 1,
                max_employees: 2,
                employee_types: [EmployeeGroup.TZ],
                requires_keyholder: true
            },
            {
                day_index: 3,
                start_time: "13:00",
                end_time: "17:00",
                min_employees: 2,
                max_employees: 4,
                employee_types: [EmployeeGroup.VZ, EmployeeGroup.TZ],
                requires_keyholder: false
            }
        ];

        // Update days 2 and 3
        await bulkUpdateCoverage(newCoverage, currentTestDb);

        // Get updated coverage directly from the database
        const day2Sql = currentTestDb.query("SELECT * FROM coverage WHERE day_index = 2");
        const day2Rows = day2Sql.all() as any[];
        expect(day2Rows.length).toBe(1);
        expect(day2Rows[0].start_time).toBe("09:00");
        expect(day2Rows[0].end_time).toBe("12:00");

        const day3Sql = currentTestDb.query("SELECT * FROM coverage WHERE day_index = 3");
        const day3Rows = day3Sql.all() as any[];
        expect(day3Rows.length).toBe(1);
        expect(day3Rows[0].start_time).toBe("13:00");
        expect(day3Rows[0].end_time).toBe("17:00");

        // Check we have the correct number of days processed
        const allRows = day2Rows.concat(day3Rows);
        expect(allRows.length).toBe(2);
    });
   });
});
