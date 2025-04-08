// src/bun-backend/services/employeesService.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import path from "node:path"; 
import fs from "node:fs";   
// Remove shared setup imports
// import { setupTestDb, teardownTestDb, seedTestData } from "../test/setup"; 
import {
    getAllEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    UpdateEmployeeInput,
    CreateEmployeeInput,
    EmployeeFilters
} from "./employeesService";
import { Employee, EmployeeGroup } from "../db/schema"; // Ensure Employee is imported if used in tests
import { NotFoundError } from "elysia";
import { randomUUID } from "node:crypto"; // Import crypto

// Function to seed only employee data
const seedEmployeeData = (db: Database) => {
    console.log(`[employeesService.test] Clearing and re-seeding employees table...`);
    db.exec("DELETE FROM employees;");
    const now = new Date().toISOString();
    let insertedCount = 0;
    try {
        const stmt = db.prepare(`
            INSERT INTO employees (id, employee_id, first_name, last_name, employee_group, contracted_hours, is_active, is_keyholder, created_at, updated_at) VALUES
            (1, 'EMP001', 'Alice', 'Alpha', ?, 40, 1, 1, ?, ?),
            (2, 'EMP002', 'Bob', 'Beta', ?, 30, 1, 0, ?, ?),
            (3, 'EMP003', 'Charlie', 'Gamma', ?, 20, 1, 0, ?, ?),
            (4, 'EMP004', 'Diana', 'Delta', ?, 40, 0, 1, ?, ?)
        `);
        const result = stmt.run(EmployeeGroup.VZ, now, now,
                 EmployeeGroup.TZ, now, now,
                 EmployeeGroup.GFB, now, now,
                 EmployeeGroup.VZ, now, now);
        insertedCount = result.changes;
        console.log(`[employeesService.test] Employees table seeded. Changes: ${insertedCount}`);
    } catch (err: any) {
        console.error("[employeesService.test] Error seeding employees into test DB:", err.message);
        throw new Error(`[employeesService.test] Failed to seed employee test data: ${err.message}`);
    }
    return insertedCount;
};

describe("Employees Service", () => {
    let testDb: Database;
    const dbId = randomUUID(); // Generate unique ID for this suite

    beforeAll(async () => {
        // Use unique identifier for in-memory DB
        testDb = new Database(`:memory:?id=${dbId}`); 
        console.log(`[employeesService.test] Applying schema to DB ${dbId}...`);
        const schemaPath = path.join(import.meta.dir, "../db/init-schema.sql");
        const schemaSql = fs.readFileSync(schemaPath, "utf-8");
        await Promise.resolve(testDb.exec(schemaSql)); 
        console.log(`[employeesService.test] Schema applied to DB ${dbId}.`);
    });

    afterAll(() => {
        if (testDb) testDb.close();
    });

    beforeEach(() => {
        try {
            seedEmployeeData(testDb); 
        } catch (e) {
            console.error("[employeesService.test] Error during beforeEach seed:", e);
            throw e; 
        }
    });

    describe("getAllEmployees", () => {
        it("should retrieve all seeded employees by default", async () => { 
            // The service function might filter by active by default, let's test that
            const employees = await getAllEmployees({}, testDb); 
            expect(employees).toBeArray();
            // Check based on seed data (3 active, 1 inactive)
            expect(employees.length).toBe(3); // Default might be active only
            expect(employees.every(e => e.is_active)).toBe(true);
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
            expect(employees.length).toBe(3);
            expect(employees.every(e => e.is_active)).toBe(true);
        });
        it("should filter by status=inactive", async () => {
            const employees = await getAllEmployees({ status: 'inactive' }, testDb);
            expect(employees.length).toBe(1);
            expect(employees[0].first_name).toBe('Diana');
        });
        it("should filter by group=VZ", async () => {
            const employees = await getAllEmployees({ group: EmployeeGroup.VZ, status: 'all' }, testDb);
            expect(employees.length).toBe(2); 
            expect(employees.every(e => e.employee_group === EmployeeGroup.VZ)).toBe(true);
        });
    });

    describe("getEmployeeById", () => {
        it("should retrieve an employee by ID", async () => {
            const employeeToFind = { id: 1, first_name: 'Alice' };
            const employee = await getEmployeeById(employeeToFind.id, testDb);
            expect(employee).toBeDefined();
            expect(employee!.id).toBe(employeeToFind.id);
            expect(employee!.first_name).toBe(employeeToFind.first_name);
        });

        it("should return null if employee not found", async () => {
            const employee = await getEmployeeById(999999, testDb);
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
                employee_id: "EMP_NEW_001",
                first_name: "New",
                last_name: "Employee",
                employee_group: EmployeeGroup.TZ,
                contracted_hours: 15,
                email: "new.emp@test.com",
                is_keyholder: false, 
                is_active: true
            };
            const createdEmployee = await createEmployee(newEmployeeData, testDb);
            expect(createdEmployee).toBeDefined();
            expect(createdEmployee.id).toBeGreaterThan(4); 
            expect(createdEmployee.first_name).toBe("New");

            const fetchedEmployee = await getEmployeeById(createdEmployee.id, testDb);
            expect(fetchedEmployee).toBeDefined();
            expect(fetchedEmployee!.employee_id).toBe("EMP_NEW_001");
        });
        it("should throw error for duplicate employee_id", async () => {
             const duplicateData: CreateEmployeeInput = {
                 employee_id: "EMP001", // Exists
                 first_name: "Duplicate",
                 last_name: "ID",
                 employee_group: EmployeeGroup.GFB,
                 contracted_hours: 10
             };
              await expect(createEmployee(duplicateData, testDb)).rejects.toThrow(/already exists/);
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
            expect(updatedEmployee!.last_name).toBe("Beta"); 
        });

        it("should throw NotFoundError if employee to update does not exist", async () => {
            const updates: UpdateEmployeeInput = {
                first_name: "Irrelevant",
            };
            await expect(updateEmployee(999999, updates, testDb)).rejects.toThrow(NotFoundError);
        });
    });

    describe("deleteEmployee", () => {
        it("should delete an existing employee", async () => {
            const employeeIdToDelete = 3; // Charlie
            
            const result = await deleteEmployee(employeeIdToDelete, testDb);
            expect(result).toEqual({ success: true });

            const deletedEmployee = await getEmployeeById(employeeIdToDelete, testDb);
            expect(deletedEmployee).toBeNull();
        });

        it("should throw NotFoundError if employee to delete does not exist", async () => {
            await expect(deleteEmployee(999999, testDb)).rejects.toThrow(NotFoundError);
        });
    });
}); 