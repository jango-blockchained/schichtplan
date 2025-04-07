// src/bun-backend/services/employeesService.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { setupTestDb, teardownTestDb } from "../test/setup";
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
import { EmployeeGroup } from "../db/schema";
import { NotFoundError } from "elysia";

describe("Employees Service", () => {
    let testDb: Database;

    beforeAll(async () => {
        testDb = await setupTestDb();
    });

    afterAll(() => {
        teardownTestDb(testDb);
    });

    describe("getAllEmployees", () => {
        it("should retrieve all seeded employees", async () => {
            const employees = await getAllEmployees({}, testDb); 
            expect(employees).toBeArray();
            expect(employees.length).toBeGreaterThanOrEqual(4); 
            const alice = employees.find(e => e.employee_id === 'EMP001');
            expect(alice).toBeDefined();
            expect(alice?.first_name).toBe('Alice');
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

            await deleteEmployee(createdEmployee.id, testDb);
        });
    });

    describe("updateEmployee", () => {
        it("should update an existing employee", async () => {
            const employeeIdToUpdate = 2;
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
            expect(updatedEmployee!.last_name).toBe("Johnson");
        });

        it("should throw NotFoundError if employee to update does not exist", async () => {
            const updates: UpdateEmployeeInput = {
                first_name: "Irrelevant",
                last_name: "X",
                employee_group: EmployeeGroup.TZ,
                contracted_hours: 10
            };
            await expect(updateEmployee(999999, updates, testDb)).rejects.toThrow(NotFoundError);
        });
    });

    describe("deleteEmployee", () => {
        it("should delete an existing employee", async () => {
            const newEmployeeData: CreateEmployeeInput = {
                employee_id: "EMP_DEL_001",
                first_name: "ToDelete",
                last_name: "Person",
                employee_group: EmployeeGroup.GFB,
                contracted_hours: 5,
                email: "del@test.com"
            };
            const employeeToDelete = await createEmployee(newEmployeeData, testDb);
            const employeeId = employeeToDelete.id;
            
            const result = await deleteEmployee(employeeId, testDb);
            expect(result).toEqual({ success: true });

            const deletedEmployee = await getEmployeeById(employeeId, testDb);
            expect(deletedEmployee).toBeNull();
        });

        it("should throw NotFoundError if employee to delete does not exist", async () => {
            await expect(deleteEmployee(999999, testDb)).rejects.toThrow(NotFoundError);
        });
    });
}); 