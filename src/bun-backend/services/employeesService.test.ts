// src/bun-backend/services/employeesService.test.ts
import { Database } from "bun:sqlite";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import fs from 'node:fs'; // Keep fs for reading schema sync
import path from 'node:path';
// Import functions directly from the service
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee } from "./employeesService";
// Import types defined within the service file
import type { EmployeeFilters, CreateEmployeeInput, UpdateEmployeeInput } from "./employeesService";
// Import types/enums from the schema file
import type { Employee } from "../db/schema"; // Keep this for the core Employee type
import { EmployeeGroup } from "../db/schema"; // Keep this for the Enum

// Use a unique ID for the database to ensure isolation
const dbId = randomUUID();
let testDb: Database;

// Function to apply schema (Synchronous read)
const applySchema = (db: Database) => {
  const schemaPath = path.join(import.meta.dir, "../db/init-schema.sql");
  console.log(`[employeesService.test] Applying schema from: ${schemaPath}`);
  try {
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    db.exec(schemaSql);
    console.log(`[employeesService.test] Schema applied successfully.`);
  } catch (error) {
    console.error(`[employeesService.test] Error applying schema: ${error}`);
    throw error; // Re-throw to fail the setup if schema fails
  }
};

// Original Function to seed only employee data
const seedEmployeeData = (db: Database) => {
    console.log(`[employeesService.test] Clearing and re-seeding employees table...`);
    db.exec("DELETE FROM employees;"); // Clear table first
    const now = new Date().toISOString();
    let insertedCount = 0;
    try {
        // Use prepare for efficiency and clarity
        const stmt = db.prepare(`
            INSERT INTO employees (id, employee_id, first_name, last_name, employee_group, contracted_hours, is_active, can_be_keyholder, created_at, updated_at) VALUES
            (1, 'EMP001', 'Alice', 'Alpha', ?, 40, 1, 1, ?, ?),
            (2, 'EMP002', 'Bob', 'Beta', ?, 30, 1, 0, ?, ?),
            (3, 'EMP003', 'Charlie', 'Gamma', ?, 20, 1, 0, ?, ?),
            (4, 'EMP004', 'Diana', 'Delta', ?, 40, 0, 1, ?, ?)
        `);
        // Pass parameters in order
        const result = stmt.run(
            EmployeeGroup.VZ, now, now,    // Alice
            EmployeeGroup.TZ, now, now,    // Bob
            EmployeeGroup.GFB, now, now,   // Charlie
            EmployeeGroup.VZ, now, now     // Diana
        );
        // Note: bun:sqlite's stmt.run might report changes differently for multi-value inserts.
        // We verify the actual count below instead of relying solely on result.changes.
        insertedCount = 4; // We explicitly inserted 4 rows.
        console.log(`[employeesService.test] Employees table seeded. Targeted: ${insertedCount}`);
        stmt.finalize(); // Finalize the statement
    } catch (err: any) {
        console.error("[employeesService.test] Error seeding employees into test DB:", err.message);
        throw new Error(`[employeesService.test] Failed to seed employee test data: ${err.message}`);
    }
    // Verify count immediately after seeding
    const countCheck = db.query("SELECT COUNT(*) as count FROM employees;").get() as { count: number };
    if (countCheck.count !== 4) {
         console.error(`[employeesService.test] SEED VERIFICATION FAILED: Expected 4 rows after seed, found ${countCheck.count}`);
         // Optionally query and log the actual rows found for debugging
         const rowsFound = db.query("SELECT id, employee_id, first_name FROM employees;").all();
         console.error("[employeesService.test] Rows found:", JSON.stringify(rowsFound));
         throw new Error(`[employeesService.test] Seed verification failed: Expected 4 rows, found ${countCheck.count}`);
    }
    console.log(`[employeesService.test] Seed verification successful: Found ${countCheck.count} rows.`);
    return countCheck.count; // Return actual verified count
};


describe("Employees Service", () => {

  beforeAll(() => { // No async needed for sync schema load
    // Use unique identifier for in-memory DB
    const dbIdentifier = `:memory:?id=${dbId}`;
    console.log(`[employeesService.test] Initializing test database: ${dbIdentifier}`);
    testDb = new Database(dbIdentifier);
    console.log(`[employeesService.test] Applying schema to DB ${dbId}...`);
    applySchema(testDb); // Apply schema using the sync helper
    console.log(`[employeesService.test] Schema applied to DB ${dbId}.`);
  });

  afterAll(() => {
    if (testDb) {
      console.log(`[employeesService.test] Closing DB ${dbId}`);
      testDb.close();
    }
  });

  // Seed data before each test to ensure isolation
  beforeEach(() => {
    console.log('[employeesService.test] Seeding employee data for test...');
    try {
      const count = seedEmployeeData(testDb); // seedEmployeeData now includes verification
      // Basic check, detailed check is now within seedEmployeeData
      if (count !== 4) {
        // This should technically be unreachable if seedEmployeeData throws on verification failure
        throw new Error(`Seeding verification failed.`);
      }
    } catch (e) {
      console.error("[employeesService.test] Error during beforeEach seed:", e);
      throw e; // Fail test if seeding fails
    }
  });

  // --- Tests based on original seed data (Alice, Bob, Charlie, Diana) ---
  describe("getAllEmployees", () => {
      it("should retrieve all seeded employees by default", async () => {
          // Add small delay ONLY for this test case as it was the first to fail mysteriously previously
          // await new Promise(resolve => setTimeout(resolve, 10)); // Keep commented unless needed
          const employees = await getAllEmployees({}, testDb);
          expect(employees.length).toBe(4); // Expect 4 from seed
          const alice = employees.find(e => e.employee_id === 'EMP001');
          expect(alice).toBeDefined();
          expect(alice?.first_name).toBe('Alice');
      });
      it("should filter by status=all", async () => {
          const employees = await getAllEmployees({ status: 'all' }, testDb);
          expect(employees.length).toBe(4);
      });
      it("should filter by status=active", async () => {
          const employees = await getAllEmployees({ status: 'active' }, testDb);
          expect(employees.length).toBe(3); // Alice, Bob, Charlie
      });
      it("should filter by status=inactive", async () => {
          const employees = await getAllEmployees({ status: 'inactive' }, testDb);
          expect(employees.length).toBe(1); // Diana
          expect(employees[0].first_name).toBe('Diana');
      });
      it("should filter by group=VZ", async () => {
          const employees = await getAllEmployees({ group: EmployeeGroup.VZ }, testDb);
          expect(employees.length).toBe(2); // Alice, Diana
      });
       it("should filter by group=TZ", async () => {
          const employees = await getAllEmployees({ group: EmployeeGroup.TZ }, testDb);
          expect(employees.length).toBe(1); // Bob
      });
       it("should filter by group=GFB", async () => {
          const employees = await getAllEmployees({ group: EmployeeGroup.GFB }, testDb);
          expect(employees.length).toBe(1); // Charlie
      });
        it("should filter by status=active and group=VZ", async () => {
            const employees = await getAllEmployees({ status: 'active', group: EmployeeGroup.VZ }, testDb);
            expect(employees.length).toBe(1); // Alice
            expect(employees[0].first_name).toBe('Alice');
        });
      it("should return an empty array for non-matching filters", async () => {
          const employees = await getAllEmployees({ group: EmployeeGroup.TZ, status: 'inactive' }, testDb);
          expect(employees.length).toBe(0);
      });
  });

  describe("getEmployeeById", () => {
      it("should retrieve an employee by ID", async () => {
          const employeeToFind = { id: 1, first_name: 'Alice' }; // Original seed data
          const employee = await getEmployeeById(employeeToFind.id, testDb);
          expect(employee).toBeDefined();
          expect(employee!.first_name).toBe(employeeToFind.first_name);
          expect(employee!.employee_group).toBe(EmployeeGroup.VZ);
      });
      it("should return null if employee not found", async () => {
          const employee = await getEmployeeById(999, testDb);
          expect(employee).toBeNull();
      });
        it("should return null for an invalid negative ID", async () => {
            const employee = await getEmployeeById(-1, testDb);
            expect(employee).toBeNull();
        });
  });

  describe("createEmployee", () => {
    it("should create a new employee", async () => {
      const newEmployeeData: CreateEmployeeInput = {
        employee_id: "EMP005",
        first_name: "Eve",
        last_name: "Epsilon",
        employee_group: EmployeeGroup.TZ,
        contracted_hours: 25,
        is_active: true,
        can_be_keyholder: false,
        email: "eve@test.com",
        phone: "12345",
        address: "Some Address",
        birth_date: "1995-05-05",
        hire_date: new Date().toISOString().split('T')[0],
        notes: "New hire"
      };
      const createdEmployee = await createEmployee(newEmployeeData, testDb);
      expect(createdEmployee).toBeDefined();
      // Assuming auto-increment starts after highest seeded ID (4)
      expect(createdEmployee.id).toBe(5);
      expect(createdEmployee.employee_id).toBe("EMP005");
      expect(createdEmployee.first_name).toBe("Eve");
      expect(createdEmployee.is_active).toBe(true);

      // Verify it exists in DB
      const fetched = await getEmployeeById(createdEmployee.id, testDb);
      expect(fetched).toBeDefined();
      expect(fetched?.first_name).toBe("Eve");
    });

    it("should throw error for duplicate employee_id", async () => {
       const duplicateEmployeeData: CreateEmployeeInput = {
        employee_id: "EMP001", // Duplicate ID (Alice)
        first_name: "Duplicate",
        last_name: "Test",
        employee_group: EmployeeGroup.VZ,
        contracted_hours: 40,
        is_active: true,
        can_be_keyholder: false,
        hire_date: new Date().toISOString().split('T')[0],
      };
       // Check for SQLite unique constraint error message
       await expect(createEmployee(duplicateEmployeeData, testDb))
         .rejects
         .toThrow(/UNIQUE constraint failed: employees.employee_id/);
    });
  });

  describe("updateEmployee", () => {
      it("should update an existing employee", async () => {
          const employeeIdToUpdate = 2; // Bob
          const updates: UpdateEmployeeInput = {
              first_name: "UpdatedBob",
              email: "updated.bob@test.com",
              is_active: false,
              contracted_hours: 25
          };
          const updatedEmployee = await updateEmployee(employeeIdToUpdate, updates, testDb);
          expect(updatedEmployee).toBeDefined();
          expect(updatedEmployee!.id).toBe(employeeIdToUpdate);
          expect(updatedEmployee!.first_name).toBe("UpdatedBob");
          expect(updatedEmployee!.is_active).toBe(false);
          expect(updatedEmployee!.contracted_hours).toBe(25);
          expect(updatedEmployee!.last_name).toBe("Beta"); // Check unchanged field
      });

       it("should throw NotFoundError if employee to update does not exist", async () => {
           const updates: UpdateEmployeeInput = { first_name: "Ghost" };
           // Expect the specific error message from the service
           await expect(updateEmployee(999, updates, testDb))
             .rejects
             .toThrow(/Employee with ID 999 not found/);
       });
  });

    describe("deleteEmployee", () => {
        it("should delete an existing employee", async () => {
            const employeeIdToDelete = 3; // Charlie

            // Verify exists before delete
            let employee = await getEmployeeById(employeeIdToDelete, testDb);
            expect(employee).toBeDefined();

            const result = await deleteEmployee(employeeIdToDelete, testDb);
            // Corrected: Check only for success, as the return type is { success: boolean; }
            expect(result.success).toBe(true);

            // Verify deleted
            employee = await getEmployeeById(employeeIdToDelete, testDb);
            expect(employee).toBeNull();

            // Check count decreased
            const employees = await getAllEmployees({}, testDb);
            expect(employees.length).toBe(3);
        });

        it("should throw NotFoundError if employee to delete does not exist", async () => {
             // Expect the specific error message from the service
            await expect(deleteEmployee(999, testDb))
              .rejects
              .toThrow(/Employee with ID 999 not found/);
        });
    });

}); // End describe("Employees Service") 