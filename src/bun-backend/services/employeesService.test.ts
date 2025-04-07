// src/bun-backend/services/employeesService.test.ts
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { setupTestDb, teardownTestDb, getTestDb, seedTestData } from "../test/setup";
import {
    getAllEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    CreateEmployeeInput,
    UpdateEmployeeInput
} from "./employeesService";
import { Employee, EmployeeGroup } from "../db/schema";
import { NotFoundError } from "elysia";

describe("Employees Service", () => {
    let testDb: Database;
    let testEmployees: Employee[];

    beforeAll(async () => {
        await setupTestDb();
        testDb = getTestDb();
        testEmployees = await seedTestData(testDb);
    });

    afterAll(() => {
        teardownTestDb();
    });

    beforeEach(() => {
        // No specific setup needed here anymore, seeding is in beforeAll
    });

    afterEach(() => {
        // No specific cleanup needed here anymore, teardown is in afterAll
    });

    describe("getAllEmployees", () => {
        it("should retrieve all employees", async () => {
            const employees = await getAllEmployees(testDb);
            expect(employees).toBeArray();
            expect(employees.length).toBe(testEmployees.length);
            testEmployees.forEach(seeded => {
                expect(employees).toContainEqual(expect.objectContaining({ id: seeded.id, first_name: seeded.first_name }));
            });
        });
    });

    describe("getEmployeeById", () => {
        it("should retrieve an employee by ID", async () => {
            const employeeToFind = testEmployees[0];
            const employee = await getEmployeeById(employeeToFind.id, testDb);
            expect(employee).toBeDefined();
            expect(employee?.id).toBe(employeeToFind.id);
            expect(employee?.first_name).toBe(employeeToFind.first_name);
        });

        it("should return undefined if employee not found", async () => {
            const employee = await getEmployeeById(999999, testDb); // Non-existent ID
            expect(employee).toBeUndefined();
        });
    });

    describe("createEmployee", () => {
        it("should create a new employee", async () => {
            const newEmployeeData: CreateEmployeeInput = {
                employee_id: "EMPNEW001",
                first_name: "New",
                last_name: "Employee",
                email: "new.employee@test.com",
                phone: "1234567890",
                color: "#aabbcc",
                is_active: true,
                is_keyholder: false,
                hourly_rate: 15.50,
            };
            const createdEmployee = await createEmployee(newEmployeeData, testDb);
            expect(createdEmployee).toBeDefined();
            expect(createdEmployee.id).toBeNumber();
            expect(createdEmployee.first_name).toBe(newEmployeeData.first_name);

            // Verify in DB
            const fetchedEmployee = await getEmployeeById(createdEmployee.id, testDb);
            expect(fetchedEmployee).toBeDefined();
            expect(fetchedEmployee?.email).toBe(newEmployeeData.email);
        });
    });

    describe("updateEmployee", () => {
        it("should update an existing employee", async () => {
            const employeeToUpdate = testEmployees[1];
            const updates = {
                first_name: "UpdatedFirstName",
                email: "updated.email@test.com",
                is_active: false,
            };
            const updatedEmployee = await updateEmployee(employeeToUpdate.id, updates, testDb);

            expect(updatedEmployee).toBeDefined();
            expect(updatedEmployee.id).toBe(employeeToUpdate.id);
            expect(updatedEmployee.first_name).toBe(updates.first_name);
            expect(updatedEmployee.email).toBe(updates.email);
            expect(updatedEmployee.is_active).toBe(false);

            // Verify in DB
            const fetchedEmployee = await getEmployeeById(employeeToUpdate.id, testDb);
            expect(fetchedEmployee?.first_name).toBe(updates.first_name);
            expect(fetchedEmployee?.is_active).toBe(0); // SQLite uses 0/1 for booleans
        });

        it("should throw NotFoundError if employee to update does not exist", async () => {
            const updates = { first_name: "Irrelevant" };
            await expect(updateEmployee(999999, updates, testDb)).rejects.toThrow(NotFoundError);
            await expect(updateEmployee(999999, updates, testDb)).rejects.toThrow("Employee not found (id=999999).");
        });
    });

    describe("deleteEmployee", () => {
        it("should delete an existing employee", async () => {
            // Create a dedicated employee to delete to avoid interfering with other tests
            const newEmployeeData = { first_name: "ToDelete", last_name: "Person", email: "delete@me.com" };
            const employeeToDelete = await createEmployee(newEmployeeData, testDb);
            const employeeId = employeeToDelete.id;

            const result = await deleteEmployee(employeeId, testDb);
            expect(result).toBeDefined();
            expect(result.changes).toBe(1); // Verify one row was affected

            // Verify deletion
            const deletedEmployee = await getEmployeeById(employeeId, testDb);
            expect(deletedEmployee).toBeUndefined();
        });

        it("should throw NotFoundError if employee to delete does not exist", async () => {
            await expect(deleteEmployee(999999, testDb)).rejects.toThrow(NotFoundError);
            await expect(deleteEmployee(999999, testDb)).rejects.toThrow("Employee not found (id=999999).");
        });
    });
}); 