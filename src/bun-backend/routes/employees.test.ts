import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import app from '../index'; // Import the Elysia app instance
import { setupTestDb, teardownTestDb, getTestDb, seedTestData } from "../test/setup";
import { Employee, EmployeeGroup } from "../db/schema";
import { getAllEmployees as getAllEmployeesSvc, getEmployeeById as getEmployeeByIdSvc, createEmployee, deleteEmployee } from "../services/employeesService"; // For verification and cleanup

describe("Employees API Routes", () => {

    // Setup DB once for the entire suite
    beforeAll(async () => {
        await setupTestDb();
    });

    // Teardown DB once after the entire suite
    afterAll(() => {
        teardownTestDb();
    });

    // beforeEach/afterEach can be used for test-specific state resets if needed
    beforeEach(() => {
        // Example: Ensure default employees are active/inactive as expected by tests
        getTestDb().run("UPDATE employees SET is_active = 1 WHERE id IN (1, 2, 3);");
        getTestDb().run("UPDATE employees SET is_active = 0 WHERE id = 4;");
        // Re-insert Charlie if deleted by a previous test
        getTestDb().run("INSERT OR IGNORE INTO employees (id, employee_id, first_name, last_name, employee_group, contracted_hours, is_keyholder, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?);", 
            [3, 'EMP003', 'Charlie', 'Brown', 'GFB', 10, 0, 1]);

    });

    afterEach(() => {
         // Clean up any employees potentially created during tests (e.g., with specific IDs)
         getTestDb().run("DELETE FROM employees WHERE employee_id LIKE 'EMP_TEST_%';");
    });

    describe("GET /employees", () => {
        it("should return active employees by default with status 200", async () => {
            const request = new Request("http://localhost/employees");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeArray();
            expect(body.length).toBe(3); // Alice, Bob, Charlie seeded as active
            expect(body.every((e: Employee) => e.is_active)).toBe(true);
        });

        it("should filter employees by status (all)", async () => {
            const request = new Request("http://localhost/employees?status=all");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.length).toBe(4); // Includes inactive Diana
        });

        it("should filter employees by status (inactive)", async () => {
            const request = new Request("http://localhost/employees?status=inactive");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.length).toBe(1);
            expect(body[0].first_name).toBe("Diana");
            expect(body[0].is_active).toBe(false);
        });

        it("should filter employees by group", async () => {
            const request = new Request(`http://localhost/employees?group=${EmployeeGroup.VZ}&status=all`);
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.length).toBe(2); // Alice (active), Diana (inactive)
            expect(body.every((e: Employee) => e.employee_group === EmployeeGroup.VZ)).toBe(true);
        });

        it("should filter employees by status and group", async () => {
             const request = new Request(`http://localhost/employees?group=${EmployeeGroup.VZ}&status=active`);
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.length).toBe(1); // Only Alice
            expect(body[0].first_name).toBe("Alice");
        });

         it("should return 400 for invalid status filter", async () => {
            const request = new Request("http://localhost/employees?status=pending");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
        });

         it("should return 400 for invalid group filter", async () => {
            const request = new Request("http://localhost/employees?group=INVALID_GROUP");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
        });
    });

    describe("POST /employees", () => {
        it("should create a new employee with valid data and return 201", async () => {
            const newEmployeeData = {
                employee_id: "EMP999",
                first_name: "Test",
                last_name: "User",
                employee_group: EmployeeGroup.TZ,
                contracted_hours: 25,
                is_keyholder: true,
                email: "test.user@example.com"
                // is_active defaults to true
            };
            const request = new Request("http://localhost/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newEmployeeData)
            });

            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(body).toBeObject();
            expect(body.id).toBeDefined();
            expect(body.employee_id).toBe("EMP999");
            expect(body.first_name).toBe("Test");
            expect(body.employee_group).toBe(EmployeeGroup.TZ);
            expect(body.is_keyholder).toBe(true);
            expect(body.is_active).toBe(true); // Check default

            // Verify in DB
            const dbEmployee = await getEmployeeByIdSvc(body.id);
            expect(dbEmployee).not.toBeNull();
            expect(dbEmployee?.employee_id).toBe("EMP999");
        });

        it("should return 400 for missing required fields", async () => {
            const incompleteData = {
                first_name: "Incomplete",
                // last_name, employee_id, etc. missing
            };
            const request = new Request("http://localhost/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(incompleteData)
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
        });

         it("should return 400 for invalid data types", async () => {
            const invalidData = {
                employee_id: "EMP888",
                first_name: "Valid",
                last_name: "User",
                employee_group: EmployeeGroup.TZ,
                contracted_hours: "twenty", // Invalid type
            };
            const request = new Request("http://localhost/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invalidData)
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
        });

         it("should return 500 (or specific code) for duplicate employee_id", async () => {
             const duplicateData = {
                 employee_id: "EMP001", // Exists (Alice)
                 first_name: "Duplicate",
                 last_name: "ID",
                 employee_group: EmployeeGroup.GFB,
                 contracted_hours: 10
             };
            const request = new Request("http://localhost/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(duplicateData)
            });
            const response = await app.handle(request);
            const body = await response.json();

            // Expecting an error from the service layer constraint
            expect(response.status).toBe(500); // Or 409 Conflict if handled specifically
            expect(body.error).toBeDefined();
            expect(body.details).toContain("already exists");
        });

        // Add similar test for duplicate email if constraint exists and is handled
    });

    describe("GET /employees/:id", () => {
        it("should return an employee by ID with status 200", async () => {
            const employeeId = 1; // Alice
            const request = new Request(`http://localhost/employees/${employeeId}`);
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeObject();
            expect(body.id).toBe(employeeId);
            expect(body.first_name).toBe("Alice");
            expect(body.employee_id).toBe("EMP001");
        });

        it("should return 404 for non-existent employee ID", async () => {
            const request = new Request("http://localhost/employees/999");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Not Found");
        });

         it("should return 400 for invalid ID format", async () => {
            const request = new Request("http://localhost/employees/invalid-id");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
            expect(body.details).toContain("Expected number"); // Check specific validation message
        });
    });

    describe("PUT /employees/:id", () => {
        it("should update an existing employee with valid data and return 200", async () => {
            const employeeId = 2; // Bob
            const updateData = {
                first_name: "Robert",
                contracted_hours: 22,
                is_keyholder: true,
            };
            const request = new Request(`http://localhost/employees/${employeeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData)
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeObject();
            expect(body.id).toBe(employeeId);
            expect(body.first_name).toBe("Robert");
            expect(body.contracted_hours).toBe(22);
            expect(body.is_keyholder).toBe(true);
            expect(body.last_name).toBe("Johnson"); // Unchanged field

            // Verify in DB
            const dbEmployee = await getEmployeeByIdSvc(employeeId);
            expect(dbEmployee?.first_name).toBe("Robert");
            expect(dbEmployee?.contracted_hours).toBe(22);
        });

        it("should return 400 for invalid data types in update", async () => {
            const employeeId = 2;
            const invalidUpdate = { contracted_hours: "invalid" };
            const request = new Request(`http://localhost/employees/${employeeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invalidUpdate)
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
        });

        it("should return 404 when trying to update a non-existent employee", async () => {
            const updateData = { first_name: "Ghost" };
            const request = new Request("http://localhost/employees/999", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData)
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Not Found");
        });

        // Add test for duplicate email/employee_id on update if applicable
    });

    describe("DELETE /employees/:id", () => {
        it("should delete an existing employee and return 204", async () => {
            // Use a seeded employee ID known to exist (Charlie will be ensured by beforeEach)
            const employeeIdToDelete = 3; 
            const request = new Request(`http://localhost/employees/${employeeIdToDelete}`, {
                method: "DELETE"
            });
            const response = await app.handle(request);

            expect(response.status).toBe(204); 

            // Verify deletion in DB
            const dbEmployee = await getEmployeeByIdSvc(employeeIdToDelete);
            expect(dbEmployee).toBeNull();
           
            // No need to re-insert here, beforeEach will handle it before the next test
        });

        it("should return 404 when trying to delete a non-existent employee", async () => {
            const request = new Request("http://localhost/employees/999", {
                method: "DELETE"
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Not Found");
        });

         it("should return 400 for invalid ID format on delete", async () => {
            const request = new Request("http://localhost/employees/invalid-id", {
                method: "DELETE"
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
             expect(body.details).toContain("Expected number");
        });
    });
}); 