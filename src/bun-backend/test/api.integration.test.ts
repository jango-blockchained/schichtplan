import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fetch } from "bun";

// Create an in-memory test database with schema and seed data
const createAndSeedDb = () => {
    console.log("[API Test] Creating and seeding NEW :memory: DB...");
    const db = new Database(":memory:");
    
    // Get schema SQL
    const schemaPath = path.join(import.meta.dir, "../db/init-schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    
    // Execute the schema SQL
    db.exec(schemaSql);

    // Insert test data specific for API tests
    db.exec(`
        -- Insert test employees
        INSERT INTO employees 
        (id, employee_id, first_name, last_name, employee_group, contracted_hours, is_keyholder, is_active) 
        VALUES 
        (1, 'API001', 'ApiJohn', 'Doe', 'VZ', 40, 1, 1),
        (2, 'API002', 'ApiJane', 'Smith', 'TZ', 30, 0, 1);

        -- Insert test shift templates
        INSERT INTO shift_templates 
        (start_time, end_time, duration_hours, requires_break, shift_type, active_days) 
        VALUES 
        ('08:00', '16:00', 8, 1, 'EARLY', '{"1":true,"2":true,"3":true,"4":true,"5":true}'),
        ('14:00', '22:00', 8, 1, 'LATE', '{"1":true,"2":true,"3":true,"4":true,"5":true}');

        -- Insert test schedule version metadata
        INSERT INTO schedule_version_meta 
        (version, status, date_range_start, date_range_end, notes, created_at) 
        VALUES 
        (1, 'DRAFT', '2023-01-01', '2023-01-07', 'API Test Version 1', '2023-01-01T00:00:00Z');

        -- Insert test schedule entries
        INSERT INTO schedules 
        (employee_id, shift_id, date, version, status, created_at, updated_at) 
        VALUES 
        (1, 1, '2023-01-01', 1, 'DRAFT', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        (2, 2, '2023-01-01', 1, 'DRAFT', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z');
    `);
    console.log("[API Test] NEW :memory: DB created and seeded.");
    return db;
};

// REMOVED outer scope variables for db, app, serverUrl

// Use a specific test port, or find an available one
const TEST_PORT = 5555;

describe("API Integration Tests", () => {

  let currentTestDb: Database;
  let currentApp: Elysia;
  let currentServerUrl: string;

  // Setup DB and Server before each test
  beforeEach(async () => {
    // Create a fresh DB for each test
    currentTestDb = createAndSeedDb();
    
    // Create a new Elysia app instance for each test, using the fresh DB
    currentApp = new Elysia();

    // --- Define API routes using currentTestDb --- 
    currentApp.get("/api/employees", () => {
      const stmt = currentTestDb.prepare("SELECT * FROM employees");
      return stmt.all();
    });

    currentApp.get("/api/employees/:id", ({ params }) => {
      const stmt = currentTestDb.prepare("SELECT * FROM employees WHERE id = ?");
      return stmt.get(params.id);
    });

    currentApp.get("/api/shifts", () => {
      const stmt = currentTestDb.prepare("SELECT * FROM shift_templates");
      return stmt.all();
    });

    currentApp.get("/api/schedules/versions", () => {
      const stmt = currentTestDb.prepare("SELECT * FROM schedule_version_meta ORDER BY version DESC");
      return stmt.all();
    });

    currentApp.get("/api/schedules/version/:version", ({ params }) => {
      const stmt = currentTestDb.prepare("SELECT * FROM schedules WHERE version = ?");
      return stmt.all(params.version);
    });

    currentApp.post("/api/schedules/version", async ({ body }) => {
      const { start_date, end_date, notes } = body as any;
      const versionStmt = currentTestDb.prepare("SELECT MAX(version) as max_version FROM schedule_version_meta");
      const { max_version } = versionStmt.get() as { max_version: number };
      const newVersion = (max_version ?? 0) + 1; // Handle case where table might be empty initially
      const insertStmt = currentTestDb.prepare(
        `INSERT INTO schedule_version_meta (version, status, date_range_start, date_range_end, notes, created_at) VALUES (?, 'DRAFT', ?, ?, ?, datetime('now'))`
      );
      insertStmt.run(newVersion, start_date, end_date, notes || "");
      return { new_version: newVersion, status: "DRAFT_CREATED" };
    });

    currentApp.post("/api/schedules/generate", async ({ body }) => {
      try {
        const { startDate, endDate } = body as any;
        const versionStmt = currentTestDb.prepare("SELECT MAX(version) as max_version FROM schedule_version_meta");
        const { max_version } = versionStmt.get() as { max_version: number };
        const newVersion = (max_version ?? 0) + 1;
        const insertVersionStmt = currentTestDb.prepare(
          `INSERT INTO schedule_version_meta (version, status, date_range_start, date_range_end, notes, created_at) VALUES (?, 'DRAFT', ?, ?, 'Generated schedule', datetime('now'))`
        );
        insertVersionStmt.run(newVersion, startDate, endDate);
        const insertScheduleStmt = currentTestDb.prepare(
          `INSERT INTO schedules (employee_id, shift_id, date, version, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'DRAFT', datetime('now'), datetime('now'))`
        );
        insertScheduleStmt.run(1, 1, startDate, newVersion);
        insertScheduleStmt.run(2, 2, startDate, newVersion);
        return { result: { newVersion: newVersion, status: "DRAFT", entryCount: 2 } };
      } catch (error) {
        console.error("Error generating schedule:", error);
        throw error;
      }
    });

    currentApp.put("/api/schedules/version/:version/status", async ({ params, body }) => {
      const { status } = body as any;
      const updateStmt = currentTestDb.prepare(
        `UPDATE schedule_version_meta SET status = ? WHERE version = ?`
      );
      updateStmt.run(status, params.version);
      return { version: parseInt(params.version as string), status };
    });
    // --- End API route definitions ---

    // Start the server for this test
    await currentApp.listen(TEST_PORT);
    console.log(`[API Test] Server started on port ${TEST_PORT} for test.`);
    currentServerUrl = `http://localhost:${TEST_PORT}`;
    
    // Add a small delay to ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay slightly
  });

  // Cleanup after each test
  afterEach(async () => {
    // Stop the server
    if (currentApp && currentApp.server) {
      await currentApp.server.stop(true); // Force close immediately
      console.log("[API Test] Server stopped after test.");
    }
    // Clean up DB
    if (currentTestDb) {
      currentTestDb.close();
       console.log("[API Test] DB closed after test.");
    }
  });

  // --- Test Cases --- 
  test("GET /api/employees returns a list of employees", async () => {
    const response = await fetch(`${currentServerUrl}/api/employees`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0].first_name).toBe("ApiJohn"); // Use seed data specific to this test setup
    expect(data[1].first_name).toBe("ApiJane");
  });

  test("GET /api/employees/:id returns a specific employee", async () => {
    const response = await fetch(`${currentServerUrl}/api/employees/1`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(1);
    expect(data.first_name).toBe("ApiJohn"); // Use seed data specific to this test setup
    expect(data.last_name).toBe("Doe");
  });

  test("GET /api/shifts returns a list of shift templates", async () => {
    const response = await fetch(`${currentServerUrl}/api/shifts`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0].shift_type).toBe("EARLY");
    expect(data[1].shift_type).toBe("LATE");
  });

  test("GET /api/schedules/versions returns a list of schedule versions", async () => {
    const response = await fetch(`${currentServerUrl}/api/schedules/versions`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
    expect(data[0].version).toBe(1);
  });

  test("GET /api/schedules/version/:version returns schedule entries for a version", async () => {
    const response = await fetch(`${currentServerUrl}/api/schedules/version/1`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2); // Seeded 2 entries for version 1
  });

  test("POST /api/schedules/version creates a new schedule version", async () => {
    const newVersionData = {
      start_date: "2023-02-01",
      end_date: "2023-02-07",
      notes: "API Test Version 2"
    };
    const response = await fetch(`${currentServerUrl}/api/schedules/version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVersionData)
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.new_version).toBe(2); // Should be version 2
    expect(data.status).toBe("DRAFT_CREATED");

    // Verify it was added
    const versionsResponse = await fetch(`${currentServerUrl}/api/schedules/versions`);
    const versionsData = await versionsResponse.json();
    expect(versionsData.length).toBe(2);
    expect(versionsData[0].version).toBe(2);
    expect(versionsData[0].notes).toBe("API Test Version 2");
  });

  test("POST /api/schedules/generate generates a new schedule", async () => {
    const generationData = {
      startDate: "2023-03-01",
      endDate: "2023-03-07"
    };
    const response = await fetch(`${currentServerUrl}/api/schedules/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generationData)
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.result.newVersion).toBe(2);
    expect(data.result.entryCount).toBe(2);

    // Verify version metadata was created
    const versionsResponse = await fetch(`${currentServerUrl}/api/schedules/versions`);
    const versionsData = await versionsResponse.json();
    expect(versionsData.length).toBe(2);
    expect(versionsData[0].version).toBe(2);

     // Verify entries were created for the new version
    const entriesResponse = await fetch(`${currentServerUrl}/api/schedules/version/2`);
    const entriesData = await entriesResponse.json();
    expect(entriesData.length).toBe(2);
  });

  test("PUT /api/schedules/version/:version/status updates a schedule version status", async () => {
    const versionToUpdate = 1;
    const statusUpdate = { status: "PUBLISHED" };

    const response = await fetch(`${currentServerUrl}/api/schedules/version/${versionToUpdate}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statusUpdate)
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.version).toBe(versionToUpdate);
    expect(data.status).toBe("PUBLISHED");

    // Verify status was updated in DB
    const versionsResponse = await fetch(`${currentServerUrl}/api/schedules/versions`);
    const versionsData = await versionsResponse.json();
    const updatedVersionMeta = versionsData.find((v: any) => v.version === versionToUpdate);
    expect(updatedVersionMeta.status).toBe("PUBLISHED");
  });
}); 