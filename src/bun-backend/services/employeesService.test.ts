// src/bun-backend/services/employeesService.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { setupTestDb, teardownTestDb, resetTestDb, seedTestData, getTestDb } from "../test/setup";
import {
    getAllEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    CreateEmployeeInput,
    UpdateEmployeeInput
} from "./employeesService"; // Adjusted import path
import { EmployeeGroup, Employee } from "../db/schema";

describe("Employees Service", () => {
    let testDb: Database;

    beforeEach(async () => {
        testDb = resetTestDb(); // Resets and seeds data before each test
        // seedTestData is called within resetTestDb -> setupTestDb
    });

    afterEach(() => {
        teardownTestDb();
    });

    describe("getAllEmployees", () => {
        it("should retrieve all active employees by default", async () => {
            const employees = await getAllEmployees(); // Default filter is 'active'
            expect(employees).toBeArray();
            expect(employees.length).toBe(3); // Alice, Bob, Charlie (Diana is inactive)
            expect(employees[0].first_name).toBe("Alice");
            expect(employees[1].first_name).toBe("Bob");
            expect(employees[2].first_name).toBe("Charlie");
            expect(employees.every(e => e.is_active)).toBe(true);
        });

        it("should retrieve all employees when status is 'all'", async () => {
            const employees = await getAllEmployees({ status: 'all' });
            expect(employees.length).toBe(4); // Includes inactive Diana
            expect(employees.some(e => !e.is_active)).toBe(true);
        });

        it("should retrieve only inactive employees when status is 'inactive'", async () => {
            const employees = await getAllEmployees({ status: 'inactive' });
            expect(employees.length).toBe(1);
            expect(employees[0].first_name).toBe("Diana");
            expect(employees[0].is_active).toBe(false);
        });

        it("should filter by employee group", async () => {
            const vzEmployees = await getAllEmployees({ group: EmployeeGroup.VZ, status: 'all' });
            expect(vzEmployees.length).toBe(2); // Alice (active), Diana (inactive)
            expect(vzEmployees.every(e => e.employee_group === EmployeeGroup.VZ)).toBe(true);

            const tzEmployees = await getAllEmployees({ group: EmployeeGroup.TZ, status: 'all' });
            expect(tzEmployees.length).toBe(1); // Bob
            expect(tzEmployees[0].employee_group).toBe(EmployeeGroup.TZ);
        });

        it("should filter by status and group", async () => {
            const activeVZEmployees = await getAllEmployees({ status: 'active', group: EmployeeGroup.VZ });
            expect(activeVZEmployees.length).toBe(1); // Only Alice
            expect(activeVZEmployees[0].first_name).toBe("Alice");
            expect(activeVZEmployees[0].is_active).toBe(true);
            expect(activeVZEmployees[0].employee_group).toBe(EmployeeGroup.VZ);
        });

        it("should return an empty array if no employees match filters", async () => {
            const noMatches = await getAllEmployees({ status: 'inactive', group: EmployeeGroup.TZ });
            expect(noMatches).toBeArrayOfSize(0);
        });
    });

    describe("getEmployeeById", () => {
        it("should retrieve an existing employee by ID", async () => {
            const employee = await getEmployeeById(1); // Alice Smith
            expect(employee).not.toBeNull();
            expect(employee!.id).toBe(1);
            expect(employee!.first_name).toBe("Alice");
            expect(employee!.employee_id).toBe("EMP001");
        });

        it("should return null for a non-existent employee ID", async () => {
            const employee = await getEmployeeById(999);
            expect(employee).toBeNull();
        });
    });

    describe("createEmployee", () => {
        it("should create a new employee with valid data", async () => {
            const newEmployeeData: CreateEmployeeInput = {
                employee_id: "EMP005",
                first_name: "Eve",
                last_name: "Adams",
                employee_group: EmployeeGroup.TZ,
                contracted_hours: 30,
                is_keyholder: true,
                is_active: true,
                email: "eve.a@example.com"
            };

            const createdEmployee = await createEmployee(newEmployeeData);

            expect(createdEmployee).toBeDefined();
            expect(createdEmployee.id).toBeDefined(); // Should have an ID assigned
            expect(createdEmployee.employee_id).toBe("EMP005");
            expect(createdEmployee.first_name).toBe("Eve");
            expect(createdEmployee.last_name).toBe("Adams");
            expect(createdEmployee.employee_group).toBe(EmployeeGroup.TZ);
            expect(createdEmployee.contracted_hours).toBe(30);
            expect(createdEmployee.is_keyholder).toBe(true);
            expect(createdEmployee.is_active).toBe(true);
            expect(createdEmployee.email).toBe("eve.a@example.com");
            expect(createdEmployee.created_at).toBeDefined();
            expect(createdEmployee.updated_at).toBeDefined();

            // Verify it exists in DB
            const fetchedEmployee = await getEmployeeById(createdEmployee.id);
            expect(fetchedEmployee).toEqual(createdEmployee);
        });

        it("should default is_active to true and is_keyholder to false if not provided", async () => {
             const newEmployeeData: CreateEmployeeInput = {
                 employee_id: "EMP006",
                 first_name: "Frank",
                 last_name: "Miller",
                 employee_group: EmployeeGroup.GFB,
                 contracted_hours: 15,
                 // is_active and is_keyholder omitted
             };
            const createdEmployee = await createEmployee(newEmployeeData);
            expect(createdEmployee.is_active).toBe(true);
            expect(createdEmployee.is_keyholder).toBe(false);
        });

        it("should throw an error if employee_id is duplicate", async () => {
            const duplicateData: CreateEmployeeInput = {
                employee_id: "EMP001", // Duplicate ID (Alice)
                first_name: "Duplicate",
                last_name: "User",
                employee_group: EmployeeGroup.TZ,
                contracted_hours: 20,
            };

            await expect(createEmployee(duplicateData)).rejects.toThrow("Employee ID 'EMP001' already exists.");
        });

        it("should throw an error if email is duplicate", async () => {
             const duplicateData: CreateEmployeeInput = {
                 employee_id: "EMP007",
                 first_name: "Duplicate",
                 last_name: "Email",
                 employee_group: EmployeeGroup.VZ,
                 contracted_hours: 40,
                 email: "alice.smith@example.com" // Duplicate email
             };
             await expect(createEmployee(duplicateData)).rejects.toThrow("Email 'alice.smith@example.com' is already in use.");
        });

        it("should throw an error for missing required fields", async () => {
            const incompleteData: Partial<CreateEmployeeInput> = {
                first_name: "Incomplete",
                last_name: "Record",
            };
            // Casting to CreateEmployeeInput to test runtime validation
            await expect(createEmployee(incompleteData as CreateEmployeeInput))
                .rejects.toThrow("Missing required fields for creating employee.");
        });
    });

    describe("updateEmployee", () => {
        it("should update specified fields of an existing employee", async () => {
            const employeeIdToUpdate = 2; // Bob Johnson
            const updates: UpdateEmployeeInput = {
                first_name: "Robert",
                contracted_hours: 25,
                is_keyholder: true,
                email: "robert.j@example.com"
            };

            const updatedEmployee = await updateEmployee(employeeIdToUpdate, updates);

            expect(updatedEmployee).not.toBeNull();
            expect(updatedEmployee!.id).toBe(employeeIdToUpdate);
            expect(updatedEmployee!.first_name).toBe("Robert"); // Updated
            expect(updatedEmployee!.last_name).toBe("Johnson"); // Unchanged
            expect(updatedEmployee!.contracted_hours).toBe(25); // Updated
            expect(updatedEmployee!.is_keyholder).toBe(true); // Updated
            expect(updatedEmployee!.email).toBe("robert.j@example.com"); // Updated
            expect(updatedEmployee!.updated_at).not.toBe(updatedEmployee!.created_at); // Updated timestamp

            // Verify changes in DB
            const fetchedEmployee = await getEmployeeById(employeeIdToUpdate);
            expect(fetchedEmployee).toEqual(updatedEmployee);
        });

        it("should return the current employee if no data is provided for update", async () => {
            const employeeIdToUpdate = 1;
            const initialEmployee = await getEmployeeById(employeeIdToUpdate);
            const updatedEmployee = await updateEmployee(employeeIdToUpdate, {});

            expect(updatedEmployee).toEqual(initialEmployee);
        });

        it("should return null if trying to update a non-existent employee", async () => {
            const nonExistentId = 999;
            const updates: UpdateEmployeeInput = { first_name: "Ghost" };
            const updatedEmployee = await updateEmployee(nonExistentId, updates);

            expect(updatedEmployee).toBeNull();
        });

         it("should handle setting fields to null (e.g., email, phone, birthday)", async () => {
             const employeeIdToUpdate = 3; // Charlie Brown
             const updates: UpdateEmployeeInput = {
                 email: null,
                 phone: null
             };
             const updatedEmployee = await updateEmployee(employeeIdToUpdate, updates);
             expect(updatedEmployee).not.toBeNull();
             expect(updatedEmployee!.email).toBeNull();
             expect(updatedEmployee!.phone).toBeNull();
         });

        // Note: Testing UNIQUE constraint violation on update is trickier without 
        // trying to update employee_id or email to an *already existing* one.
        // The current update function doesn't seem to check for uniqueness conflicts 
        // during the update itself, relying on the initial create validation.
        // A test case could be added if the update logic were enhanced to prevent 
        // updating email/employee_id to conflict with other existing records.

    });

    describe("deleteEmployee", () => {
        it("should delete an existing employee and return true", async () => {
            const employeeIdToDelete = 3; // Charlie Brown
            const result = await deleteEmployee(employeeIdToDelete);
            expect(result).toBe(true);

            // Verify deletion
            const deletedEmployee = await getEmployeeById(employeeIdToDelete);
            expect(deletedEmployee).toBeNull();

            // Verify other employees still exist
            const remainingEmployees = await getAllEmployees({ status: 'all' });
            expect(remainingEmployees.length).toBe(3);
        });

        it("should return false if trying to delete a non-existent employee", async () => {
            const nonExistentId = 999;
            const result = await deleteEmployee(nonExistentId);
            expect(result).toBe(false);
        });
    });
}); 