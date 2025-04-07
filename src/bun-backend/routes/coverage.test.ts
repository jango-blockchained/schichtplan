import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "bun:test";
import app from '../index'; // Import the Elysia app instance
import { setupTestDb, teardownTestDb, getTestDb, seedTestData } from "../test/setup";
import { Coverage, EmployeeGroup } from "../db/schema";
import { getCoverageById as getCoverageByIdSvc, deleteCoverage } from "../services/coverageService"; // For verification
import { NotFoundError } from "elysia"; // Import NotFoundError

describe("Coverage API Routes", () => {

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
        // Ensure seeded coverage exists if prior tests modified/deleted it
        seedTestData(getTestDb()); // Re-run seeding logic
    });

    afterEach(() => {});

    describe("GET /coverage", () => {
        it("should return all coverage entries with status 200", async () => {
            const request = new Request("http://localhost/coverage");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeArray();
            expect(body.length).toBe(3); // Check against seeded data (restored by beforeEach)
            expect(body[0].day_index).toBe(1);
            expect(body[0].start_time).toBe("08:00");
            expect(body[1].day_index).toBe(1);
            expect(body[1].start_time).toBe("16:00");
            expect(body[2].day_index).toBe(2);
        });
    });

    describe("POST /coverage", () => {
        it("should create a new coverage entry with valid data and return 201", async () => {
            const newCoverageData = {
                day_index: 4,
                start_time: "09:00",
                end_time: "15:00",
                min_employees: 1,
                max_employees: 2,
                employee_types: [EmployeeGroup.TZ, EmployeeGroup.GFB],
                requires_keyholder: false,
                // allowed_employee_groups is optional
            };
            const request = new Request("http://localhost/coverage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newCoverageData)
            });

            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(body).toBeObject();
            expect(body.id).toBeDefined();
            expect(body.day_index).toBe(4);
            expect(body.start_time).toBe("09:00");
            expect(body.min_employees).toBe(1);
            expect(body.employee_types).toEqual([EmployeeGroup.TZ, EmployeeGroup.GFB]);
            expect(body.allowed_employee_groups).toEqual([]); // Check default when not provided

            // Verify in DB
            const dbEntry = await getCoverageByIdSvc(body.id);
            expect(dbEntry).not.toBeNull();
            expect(dbEntry?.day_index).toBe(4);

            // Cleanup created entry
            if (body.id) {
                await deleteCoverage(body.id); 
            }
        });

        it("should return 400 for missing required fields", async () => {
            const incompleteData = {
                day_index: 5,
                start_time: "10:00",
                // end_time, min_employees, etc. missing
            };
            const request = new Request("http://localhost/coverage", {
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
                day_index: 1,
                start_time: "09:00",
                end_time: "17:00",
                min_employees: "one", // Invalid
                max_employees: 3,
                employee_types: ["VZ"],
                requires_keyholder: false,
            };
            const request = new Request("http://localhost/coverage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invalidData)
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
             expect(body.details).toContain("Expected number"); // Check specific detail
        });
    });

    describe("GET /coverage/:id", () => {
        it("should return a coverage entry by ID with status 200", async () => {
            const entryId = 1;
            const request = new Request(`http://localhost/coverage/${entryId}`);
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeObject();
            expect(body.id).toBe(entryId);
            expect(body.day_index).toBe(1);
            expect(body.start_time).toBe("08:00");
        });

        it("should return 404 for non-existent coverage ID", async () => {
            const request = new Request("http://localhost/coverage/999");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Not Found");
        });

        it("should return 400 for invalid ID format", async () => {
            const request = new Request("http://localhost/coverage/invalid");
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
            expect(body.details).toContain("Expected number");
        });
    });

    describe("PUT /coverage/:id", () => {
        it("should update an existing coverage entry with valid data and return 200", async () => {
            const entryId = 2;
            const updateData = {
                start_time: "16:30",
                min_employees: 2,
                requires_keyholder: false,
                allowed_employee_groups: [EmployeeGroup.VZ, EmployeeGroup.TZ],
            };
            const request = new Request(`http://localhost/coverage/${entryId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData)
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toBeObject();
            expect(body.id).toBe(entryId);
            expect(body.start_time).toBe("16:30");
            expect(body.min_employees).toBe(2);
            expect(body.requires_keyholder).toBe(false);
            expect(body.allowed_employee_groups).toEqual([EmployeeGroup.VZ, EmployeeGroup.TZ]);

            // Verify in DB
            const dbEntry = await getCoverageByIdSvc(entryId);
            expect(dbEntry?.start_time).toBe("16:30");
            expect(dbEntry?.requires_keyholder).toBe(false);
        });

        it("should return 400 for invalid data types in update", async () => {
            const entryId = 1;
            const invalidUpdate = { min_employees: "two" };
            const request = new Request(`http://localhost/coverage/${entryId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invalidUpdate)
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
        });

        it("should return 404 when trying to update a non-existent entry", async () => {
            const updateData = { start_time: "10:00" };
            const request = new Request("http://localhost/coverage/999", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData)
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Not Found");
        });
    });

    describe("DELETE /coverage/:id", () => {
        it("should delete an existing coverage entry and return 204", async () => {
            const entryId = 3; // Assume beforeEach restored this entry
            const request = new Request(`http://localhost/coverage/${entryId}`, {
                method: "DELETE"
            });
            const response = await app.handle(request);

            expect(response.status).toBe(204);

            // Verify deletion in DB
            await expect(getCoverageByIdSvc(entryId)).rejects.toThrow(NotFoundError);
            
            // beforeEach will re-seed for the next test
        });

        it("should return 404 when trying to delete a non-existent entry", async () => {
            const request = new Request("http://localhost/coverage/999", {
                method: "DELETE"
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("Not Found");
        });

        it("should return 400 for invalid ID format on delete", async () => {
            const request = new Request("http://localhost/coverage/bad-id", {
                method: "DELETE"
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
            expect(body.details).toContain("Expected number");
        });
    });

    describe("PUT /coverage/bulk", () => {
        it("should replace coverage for specified days and return 200", async () => {
            const bulkUpdateData = [
                { // Replace day 1
                    day_index: 1,
                    start_time: "09:00",
                    end_time: "17:00",
                    min_employees: 1,
                    max_employees: 1,
                    employee_types: [EmployeeGroup.VZ],
                    requires_keyholder: true,
                },
                 { // Add for day 3
                    day_index: 3,
                    start_time: "10:00",
                    end_time: "14:00",
                    min_employees: 1,
                    max_employees: 1,
                    employee_types: [EmployeeGroup.GFB],
                    requires_keyholder: false,
                }
            ];
            const request = new Request("http://localhost/coverage/bulk", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bulkUpdateData)
            });

            const response = await app.handle(request);
             // Bulk update returns the input data, not the result from service
             // Need to fetch coverage to verify
            expect(response.status).toBe(200);

            // Verify changes by fetching all coverage
            const getAllReq = new Request("http://localhost/coverage");
            const getAllRes = await app.handle(getAllReq);
            const finalCoverage = await getAllRes.json();

            expect(finalCoverage).toBeArray();
            // Should have: 1 new for day 1, 1 original for day 2, 1 new for day 3
            expect(finalCoverage.length).toBe(3);

            const day1Entries = finalCoverage.filter((c: Coverage) => c.day_index === 1);
            const day2Entries = finalCoverage.filter((c: Coverage) => c.day_index === 2);
            const day3Entries = finalCoverage.filter((c: Coverage) => c.day_index === 3);

            expect(day1Entries.length).toBe(1);
            expect(day1Entries[0].start_time).toBe("09:00");
            expect(day1Entries[0].requires_keyholder).toBe(true);

            expect(day2Entries.length).toBe(1);
            expect(day2Entries[0].id).toBe(3); // Original entry for day 2

            expect(day3Entries.length).toBe(1);
            expect(day3Entries[0].start_time).toBe("10:00");
            expect(day3Entries[0].employee_types).toEqual([EmployeeGroup.GFB]);
        });

        it("should return 400 for invalid data in bulk update array", async () => {
            const invalidBulkData = [
                { day_index: 1, start_time: "09:00", end_time: "17:00", min_employees: 1, max_employees: 1, employee_types: ["VZ"], requires_keyholder: true },
                { day_index: 2, start_time: "10:00", end_time: "14:00", min_employees: "invalid" } // Invalid field
            ];
            const request = new Request("http://localhost/coverage/bulk", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invalidBulkData)
            });
            const response = await app.handle(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toContain("Validation Error");
             // Check details - Elysia validation might point to the specific array item/field
             expect(body.details).toBeDefined();
        });

         it("should handle empty array for bulk update gracefully", async () => {
             const request = new Request("http://localhost/coverage/bulk", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([])
            });
             const response = await app.handle(request);
             // Should likely return 200 OK with empty array or similar
             expect(response.status).toBe(200);
             // The body might be the empty array passed in, or a success message
             // Let's assume it returns the processed (empty) array:
             const body = await response.json();
             expect(body).toBeArrayOfSize(0);

             // Verify no changes happened
             const getAllReq = new Request("http://localhost/coverage");
            const getAllRes = await app.handle(getAllReq);
            const finalCoverage = await getAllRes.json();
            expect(finalCoverage.length).toBe(3); // Original seeded data
         });
    });
}); 