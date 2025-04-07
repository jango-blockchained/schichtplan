import { describe, it, expect, beforeEach, afterAll, beforeAll, afterEach } from "bun:test";
import app from '../index'; // Revert to static import
import { Database } from "bun:sqlite"; // Import Database type
import { setupTestDb, teardownTestDb, seedTestData } from "../test/setup"; // Removed getTestDb
import { Employee, EmployeeGroup } from "../db/schema";
// Only import service functions if needed for direct verification (generally avoid in route tests)
// import { getAllEmployees as getAllEmployeesSvc, getEmployeeById as getEmployeeByIdSvc, createEmployee, deleteEmployee } from "../services/employeesService"; 

describe("Employees API Routes", () => {
    let testDb: Database; // Suite-specific DB instance

    // Setup DB once for the entire suite
    beforeAll(async () => {
        testDb = await setupTestDb(); // Assign instance
        // Decorate the imported app instance with the testDb
        app.decorate('db', testDb);
    });

    // Teardown DB once after the entire suite
    afterAll(() => {
        teardownTestDb(testDb); // Pass instance
    });

    // beforeEach to reset state modified by tests (e.g., active status, specific employees)
    beforeEach(() => {
        try {
             // Re-seed to ensure consistent starting data (including default employees)
             seedTestData(testDb); 
             
             // Example: Set specific states if seeding defaults aren't enough
             // testDb.run("UPDATE employees SET is_active = 1 WHERE id = 1;");
             // testDb.run("UPDATE employees SET is_active = 0 WHERE id = 4;");
        } catch (e) {
             console.error("Error during beforeEach seed/setup in employees.test.ts:", e);
        }
    });

    afterEach(() => {
         // Clean up specific test employees created with predictable IDs
         try {
            testDb.run("DELETE FROM employees WHERE employee_id LIKE 'EMP_TEST_%' OR employee_id = 'EMP999' OR employee_id = 'EMP888';");
         } catch (e) {
             console.error("Error during afterEach cleanup in employees.test.ts:", e);
         }
    });

    describe("GET /employees", () => {
        it("should return active employees by default with status 200", async () => {
            const request = new Request("http://localhost/api/employees"); // Add /api prefix
            const response = await app.handle(request); // app is now initialized
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeArray();
            expect(body.length).toBe(3); // Alice, Bob, Charlie seeded as active
            expect(body.every((e: Employee) => e.is_active)).toBe(true);
        });

        it("should filter employees by status (all)", async () => {
            const request = new Request("http://localhost/api/employees?status=all"); // Add /api prefix
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.length).toBe(4); // Includes inactive Diana
        });

        it("should filter employees by status (inactive)", async () => {
            const request = new Request("http://localhost/api/employees?status=inactive"); // Add /api prefix
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.length).toBe(1);
            expect(body[0].first_name).toBe("Diana");
            expect(body[0].is_active).toBe(false);
        });

        it("should filter employees by group", async () => {
            const request = new Request(`http://localhost/api/employees?group=${EmployeeGroup.VZ}&status=all`); // Add /api prefix
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.length).toBe(2); // Alice (active), Diana (inactive)
            expect(body.every((e: Employee) => e.employee_group === EmployeeGroup.VZ)).toBe(true);
        });

        it("should filter employees by status and group", async () => {
             const request = new Request(`http://localhost/api/employees?group=${EmployeeGroup.VZ}&status=active`); // Add /api prefix
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.length).toBe(1); // Only Alice
            expect(body[0].first_name).toBe("Alice");
        });

         it("should return 400 for invalid status filter", async () => {
            const request = new Request("http://localhost/api/employees?status=pending"); // Add /api prefix
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
        });

         it("should return 400 for invalid group filter", async () => {
            const request = new Request("http://localhost/api/employees?group=INVALID_GROUP"); // Add /api prefix
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
            };
            const request = new Request("http://localhost/api/employees", {
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

            // Verify via API GET
            const verifyRequest = new Request(`http://localhost/api/employees/${body.id}`); // Use /api prefix
            const verifyResponse = await app.handle(verifyRequest);
            const verifyBody = await verifyResponse.json();
            expect(verifyResponse.status).toBe(200);
            expect(verifyBody.employee_id).toBe("EMP999");
        });

        it("should return 400 for missing required fields", async () => {
            const incompleteData = {
                first_name: "Incomplete",
                // last_name, employee_id, etc. missing
            };
            const request = new Request("http://localhost/api/employees", {
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
            const request = new Request("http://localhost/api/employees", {
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
            const request = new Request("http://localhost/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(duplicateData)
            });
            const response = await app.handle(request);
            const body = await response.json();

            // Expecting an error from the service layer constraint
            expect(response.status).toBe(500); // Or 409 Conflict if handled specifically
            expect(body.error).toBeDefined();
            expect(body.details).toContain("UNIQUE constraint failed"); // More generic check
        });

        // Add similar test for duplicate email if constraint exists and is handled
    });

    describe("GET /employees/:id", () => {
        it("should return an employee by ID with status 200", async () => {
            const employeeId = 1; // Alice
            const request = new Request(`http://localhost/api/employees/${employeeId}`); // Add /api prefix
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeObject();
            expect(body.id).toBe(employeeId);
            expect(body.first_name).toBe("Alice");
            expect(body.employee_id).toBe("EMP001");
        });

        it("should return 404 for non-existent employee ID", async () => {
            const request = new Request("http://localhost/api/employees/999"); // Add /api prefix
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Not Found");
        });

         it("should return 400 for invalid ID format", async () => {
            const request = new Request("http://localhost/api/employees/invalid-id"); // Add /api prefix
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
            const request = new Request(`http://localhost/api/employees/${employeeId}`, {
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

            // Verify via API GET
            const verifyRequest = new Request(`http://localhost/api/employees/${employeeId}`); // Use /api prefix
            const verifyResponse = await app.handle(verifyRequest);
            const verifyBody = await verifyResponse.json();
            expect(verifyResponse.status).toBe(200);
            expect(verifyBody.first_name).toBe("Robert");
            expect(verifyBody.contracted_hours).toBe(22);
        });

        it("should return 400 for invalid data types in update", async () => {
            const employeeId = 2;
            const invalidUpdate = { contracted_hours: "invalid" };
            const request = new Request(`http://localhost/api/employees/${employeeId}`, {
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
            const request = new Request("http://localhost/api/employees/999", {
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
            const employeeId = 3; // Charlie (assuming beforeEach restores Charlie)
            
            // Ensure Charlie exists before deleting via API
            const preCheckRequest = new Request(`http://localhost/api/employees/${employeeId}`); // Use /api prefix
            const preCheckResponse = await app.handle(preCheckRequest);
            expect(preCheckResponse.status).toBe(200); 

            const deleteRequest = new Request(`http://localhost/api/employees/${employeeId}`, {
                method: "DELETE"
            });
            const deleteResponse = await app.handle(deleteRequest);

            expect(deleteResponse.status).toBe(204);

            // Verify deletion via API GET (expect 404)
            const verifyRequest = new Request(`http://localhost/api/employees/${employeeId}`); // Use /api prefix
            const verifyResponse = await app.handle(verifyRequest);
            expect(verifyResponse.status).toBe(404);
        });

        it("should return 404 when trying to delete a non-existent employee", async () => {
            const request = new Request("http://localhost/api/employees/999", {
                method: "DELETE"
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Not Found");
        });

         it("should return 400 for invalid ID format on delete", async () => {
            const request = new Request("http://localhost/api/employees/invalid-id", {
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