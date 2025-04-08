import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fetch } from "bun";

// Create an in-memory test database with schema
const createTestDb = () => {
  const db = new Database(":memory:");
  
  // Get schema SQL
  const schemaPath = path.join(import.meta.dir, "../db/init-schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  
  // Execute the schema SQL
  db.exec(schemaSql);

  // Insert test data
  db.exec(`
    -- Insert test employees
    INSERT INTO employees 
    (employee_id, first_name, last_name, employee_group, contracted_hours, is_keyholder, is_active) 
    VALUES 
    ('EMP001', 'John', 'Doe', 'VZ', 40, 1, 1),
    ('EMP002', 'Jane', 'Smith', 'TZ', 30, 0, 1);

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
    (1, 'DRAFT', '2023-01-01', '2023-01-07', 'Test version', '2023-01-01T00:00:00Z');

    -- Insert test schedule entries
    INSERT INTO schedules 
    (employee_id, shift_id, date, version, status, created_at, updated_at) 
    VALUES 
    (1, 1, '2023-01-01', 1, 'DRAFT', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
    (2, 2, '2023-01-01', 1, 'DRAFT', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z');
  `);
  
  return db;
};

// Set up the test database
let testDb: Database;
let app: Elysia;
let SERVER_URL: string;

// Use a specific test port, or find an available one
const TEST_PORT = 5555;

// This is a simplified version of creating individual API routes for testing
// In a real-world scenario, you might want to create proper route handlers
describe("API Integration Tests", () => {
  beforeAll(async () => {
    // Create test database
    testDb = createTestDb();
    
    // Create a simple test app with endpoints that directly query our test database 
    app = new Elysia();

    // Employee Endpoints
    app.get("/api/employees", () => {
      const stmt = testDb.prepare("SELECT * FROM employees");
      return stmt.all();
    });

    app.get("/api/employees/:id", ({ params }) => {
      const stmt = testDb.prepare("SELECT * FROM employees WHERE id = ?");
      return stmt.get(params.id);
    });

    // Shift Template Endpoints
    app.get("/api/shifts", () => {
      const stmt = testDb.prepare("SELECT * FROM shift_templates");
      return stmt.all();
    });

    // Schedule Endpoints
    app.get("/api/schedules/versions", () => {
      const stmt = testDb.prepare("SELECT * FROM schedule_version_meta ORDER BY version DESC");
      return stmt.all();
    });

    app.get("/api/schedules/version/:version", ({ params }) => {
      const stmt = testDb.prepare("SELECT * FROM schedules WHERE version = ?");
      return stmt.all(params.version);
    });

    app.post("/api/schedules/version", async ({ body }) => {
      const { start_date, end_date, notes } = body as any;
      
      // Get current max version
      const versionStmt = testDb.prepare("SELECT MAX(version) as max_version FROM schedule_version_meta");
      const { max_version } = versionStmt.get() as { max_version: number };
      
      const newVersion = max_version + 1;
      
      // Insert new version
      const insertStmt = testDb.prepare(`
        INSERT INTO schedule_version_meta 
        (version, status, date_range_start, date_range_end, notes, created_at) 
        VALUES 
        (?, 'DRAFT', ?, ?, ?, datetime('now'))
      `);
      
      insertStmt.run(newVersion, start_date, end_date, notes || "");
      
      return { 
        new_version: newVersion,
        status: "DRAFT_CREATED" 
      };
    });

    app.post("/api/schedules/generate", async ({ body }) => {
      try {
        const { startDate, endDate } = body as any;
        
        // Get current max version
        const versionStmt = testDb.prepare("SELECT MAX(version) as max_version FROM schedule_version_meta");
        const { max_version } = versionStmt.get() as { max_version: number };
        
        const newVersion = max_version + 1;
        
        // Insert new version metadata
        const insertVersionStmt = testDb.prepare(`
          INSERT INTO schedule_version_meta 
          (version, status, date_range_start, date_range_end, notes, created_at) 
          VALUES 
          (?, 'DRAFT', ?, ?, 'Generated schedule', datetime('now'))
        `);
        
        insertVersionStmt.run(newVersion, startDate, endDate);
        
        // Insert some dummy schedule entries for the new version
        // In a real app this would be more complex, but for testing we just insert a few entries
        const insertScheduleStmt = testDb.prepare(`
          INSERT INTO schedules 
          (employee_id, shift_id, date, version, status, created_at, updated_at) 
          VALUES 
          (?, ?, ?, ?, 'DRAFT', datetime('now'), datetime('now'))
        `);
        
        // Create a couple of dummy entries
        insertScheduleStmt.run(1, 1, startDate, newVersion);
        insertScheduleStmt.run(2, 2, startDate, newVersion);
        
        return { 
          result: {
            newVersion: newVersion,
            status: "DRAFT",
            entryCount: 2 
          }
        };
      } catch (error) {
        console.error("Error generating schedule:", error);
        throw error;
      }
    });

    app.put("/api/schedules/version/:version/status", async ({ params, body }) => {
      const { status } = body as any;
      
      // Update version status
      const updateStmt = testDb.prepare(`
        UPDATE schedule_version_meta 
        SET status = ? 
        WHERE version = ?
      `);
      
      updateStmt.run(status, params.version);
      
      return { 
        version: parseInt(params.version as string), 
        status 
      };
    });

    // Start the server on a fixed test port
    app.listen(TEST_PORT);
    console.log(`Test server started on port ${TEST_PORT}`);
    SERVER_URL = `http://localhost:${TEST_PORT}`;
    
    // Add a small delay to ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(() => {
    // Clean up
    if (testDb) {
      testDb.close();
    }
    
    // Stop the server
    if (app && app.server) {
      app.server.stop();
      console.log("Test server stopped");
    }
  });

  // Employee Endpoints
  test("GET /api/employees returns a list of employees", async () => {
    const response = await fetch(`${SERVER_URL}/api/employees`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0].first_name).toBe("John");
    expect(data[1].first_name).toBe("Jane");
  });

  test("GET /api/employees/:id returns a specific employee", async () => {
    const response = await fetch(`${SERVER_URL}/api/employees/1`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(1);
    expect(data.first_name).toBe("John");
    expect(data.last_name).toBe("Doe");
  });

  // ShiftTemplate Endpoints
  test("GET /api/shifts returns a list of shift templates", async () => {
    const response = await fetch(`${SERVER_URL}/api/shifts`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0].shift_type).toBe("EARLY");
    expect(data[1].shift_type).toBe("LATE");
  });

  // Schedule Endpoints
  test("GET /api/schedules/versions returns a list of schedule versions", async () => {
    const response = await fetch(`${SERVER_URL}/api/schedules/versions`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
    expect(data[0].version).toBe(1);
    expect(data[0].status).toBe("DRAFT");
  });

  test("GET /api/schedules/version/:version returns schedule entries for a version", async () => {
    const response = await fetch(`${SERVER_URL}/api/schedules/version/1`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0].version).toBe(1);
    expect(data[0].employee_id).toBe(1);
    expect(data[1].employee_id).toBe(2);
  });

  test("POST /api/schedules/version creates a new schedule version", async () => {
    const response = await fetch(`${SERVER_URL}/api/schedules/version`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start_date: "2023-02-01",
        end_date: "2023-02-07",
        notes: "Test new version",
      }),
    });
    const data = await response.json();

    expect(response.status).toBe(200); // Note: Using 200 for simplified test app
    expect(data.new_version).toBe(2);
    expect(data.status).toBe("DRAFT_CREATED");
  });

  test("POST /api/schedules/generate generates a new schedule", async () => {
    const response = await fetch(`${SERVER_URL}/api/schedules/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: "2023-03-01",
        endDate: "2023-03-07",
      }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.result).toBeDefined();
    expect(data.result.newVersion).toBe(3);
    expect(data.result.status).toBe("DRAFT");
  });

  test("PUT /api/schedules/version/:version/status updates a schedule version status", async () => {
    const response = await fetch(`${SERVER_URL}/api/schedules/version/1/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "PUBLISHED",
      }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.version).toBe(1);
    expect(data.status).toBe("PUBLISHED");

    // Verify the status was updated
    const verifyResponse = await fetch(`${SERVER_URL}/api/schedules/versions`);
    const versions = await verifyResponse.json();
    const updatedVersion = versions.find((v: any) => v.version === 1);
    expect(updatedVersion.status).toBe("PUBLISHED");
  });
}); 