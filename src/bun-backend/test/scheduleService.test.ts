import { describe, expect, test, beforeAll, afterAll, mock } from "bun:test";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { 
  getScheduleByVersion, 
  getScheduleVersions, 
  generateSchedule, 
  createNewScheduleVersion 
} from "../services/scheduleService";
import { ScheduleStatus, EmployeeGroup, ShiftType } from "../db/schema";

// 1. Create the test DB instance and apply schema FIRST
const TEST_DB_PATH = ":memory:";
const testDb = new Database(TEST_DB_PATH);

// Apply schema
const schemaPath = path.join(import.meta.dir, "../db/init-schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf-8");
testDb.exec(schemaSql);

// 2. Mock the database module to return the PRE-CONFIGURED instance
mock.module("../db", () => {
  // Return the instance that already has the schema
  return { default: testDb }; 
});

// Mock related services
mock.module("../services/employeesService.js", () => ({
  getAllEmployees: async ({ status }: { status?: string } = {}) => {
    return [
      {
        id: 1,
        employee_id: "EMP001",
        first_name: "John",
        last_name: "Doe",
        employee_group: EmployeeGroup.VZ,
        contracted_hours: 40,
        is_keyholder: true,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        employee_id: "EMP002",
        first_name: "Jane",
        last_name: "Smith",
        employee_group: EmployeeGroup.TZ,
        contracted_hours: 30,
        is_keyholder: false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  },
  getEmployeeById: async (id: number) => {
    if (id === 1) {
      return {
        id: 1,
        employee_id: "EMP001",
        first_name: "John",
        last_name: "Doe",
        employee_group: EmployeeGroup.VZ,
        contracted_hours: 40,
        is_keyholder: true,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    return null;
  }
}));

mock.module("../services/shiftTemplateService.js", () => ({
  getAllShiftTemplates: async () => {
    return [
      {
        id: 1,
        start_time: "08:00",
        end_time: "16:00",
        duration_hours: 8,
        requires_break: true,
        shift_type: ShiftType.EARLY,
        shift_type_id: "EARLY",
        active_days: { "1": true, "2": true, "3": true, "4": true, "5": true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        start_time: "14:00",
        end_time: "22:00",
        duration_hours: 8,
        requires_break: true,
        shift_type: ShiftType.LATE,
        shift_type_id: "LATE",
        active_days: { "1": true, "2": true, "3": true, "4": true, "5": true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }
}));

mock.module("../services/coverageService.js", () => ({
  getAllCoverage: async () => {
    return [
      {
        id: 1,
        day_index: 1, // Monday
        start_time: "08:00",
        end_time: "16:00",
        min_employees: 1,
        max_employees: 2,
        employee_types: [EmployeeGroup.VZ, EmployeeGroup.TZ],
        requires_keyholder: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }
}));

mock.module("../services/recurringCoverageService.js", () => ({
  getAllRecurringCoverage: async () => {
    return [
      {
        id: 1,
        name: "Monday Late",
        days: [1], // Monday
        start_time: "14:00",
        end_time: "22:00",
        min_employees: 1,
        max_employees: 2,
        requires_keyholder: false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }
}));

mock.module("../services/employeeAvailabilityService.js", () => ({
  getAvailabilitiesInRange: async () => {
    return []; // No specific availabilities for this test
  }
}));

mock.module("../services/absenceService.js", () => ({
  getAbsencesInRange: async () => {
    return []; // No absences for this test
  }
}));

describe("Schedule Service", () => {
  // 3. Use the SAME testDb instance (already has schema) in beforeAll
  beforeAll(async () => {
    const now = new Date().toISOString();

    // Insert required employees
    testDb.exec(`
      INSERT INTO employees 
      (id, employee_id, first_name, last_name, employee_group, contracted_hours, created_at, updated_at) 
      VALUES 
      (1, 'EMP001', 'John', 'Doe', ?, 40, ?, ?),
      (2, 'EMP002', 'Jane', 'Smith', ?, 30, ?, ?)
    `, [EmployeeGroup.VZ, now, now, EmployeeGroup.TZ, now, now]);

    // Insert required shift templates
    testDb.exec(`
      INSERT INTO shift_templates 
      (id, start_time, end_time, duration_hours, shift_type, active_days, created_at, updated_at) 
      VALUES 
      (1, '08:00', '16:00', 8, ?, ?, ?, ?),
      (2, '14:00', '22:00', 8, ?, ?, ?, ?)
    `, [
      ShiftType.EARLY, JSON.stringify({ "1": true, "2": true, "3": true, "4": true, "5": true }), now, now,
      ShiftType.LATE, JSON.stringify({ "1": true, "2": true, "3": true, "4": true, "5": true }), now, now
    ]);

    // Insert test schedule version metadata
    testDb.exec(`
      INSERT INTO schedule_version_meta 
      (version, status, date_range_start, date_range_end, notes, created_at) 
      VALUES 
      (1, ?, '2023-01-01', '2023-01-07', 'Test version', '2023-01-01T00:00:00Z')
    `, [ScheduleStatus.DRAFT]);
    
    // Insert test schedule entries
    testDb.exec(`
      INSERT INTO schedules 
      (id, employee_id, shift_id, date, version, status, created_at, updated_at) 
      VALUES 
      (1, 1, 1, '2023-01-01', 1, ?, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
      (2, 2, 2, '2023-01-01', 1, ?, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
    `, [ScheduleStatus.DRAFT, ScheduleStatus.DRAFT]);
  });
  
  afterAll(() => {
    // Clean up: Close the single testDb instance
    testDb.close();
  });
  
  test("getScheduleVersions should return all schedule versions", async () => {
    const versions = await getScheduleVersions();
    
    expect(versions).toBeDefined();
    expect(versions.length).toBeGreaterThan(0);
    expect(versions[0].version).toBe(1);
    expect(versions[0].status).toBe(ScheduleStatus.DRAFT);
  });
  
  test("getScheduleByVersion should return schedule entries for a specific version", async () => {
    const scheduleEntries = await getScheduleByVersion(1);
    
    expect(scheduleEntries).toBeDefined();
    expect(scheduleEntries.length).toBe(2);
    expect(scheduleEntries[0].version).toBe(1);
  });
  
  test("getScheduleByVersion should handle non-existent version", async () => {
    // Test that getting a non-existent version returns an empty array (or throws, depending on implementation)
    // Assuming it should return empty based on typical behavior:
    const scheduleEntries = await getScheduleByVersion(999);
    expect(scheduleEntries).toBeDefined();
    expect(scheduleEntries.length).toBe(0);
    
    // If it's supposed to throw an error, the test would look like this:
    // try {
    //   await getScheduleByVersion(999);
    //   expect(true).toBe(false); // Should not reach here
    // } catch (error: any) {
    //   expect(error.message).toContain("Schedule version 999 not found"); // Or similar specific error
    // }
  });
  
  test("createNewScheduleVersion should create a new version", async () => {
    const result = await createNewScheduleVersion({
      start_date: "2023-02-01",
      end_date: "2023-02-07",
      notes: "New test version"
    });
    
    expect(result).toBeDefined();
    expect(result.new_version).toBe(2);
    expect(result.status).toBe("DRAFT_CREATED");
    
    // Verify it was created in the database
    const versions = await getScheduleVersions();
    expect(versions.length).toBe(2);
    expect(versions[0].version).toBe(2); // Newest first
  });
  
  test("createNewScheduleVersion should validate dates", async () => {
    try {
      await createNewScheduleVersion({
        start_date: "2023-03-07", // End before start
        end_date: "2023-03-01",
        notes: "Invalid date range"
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Assuming the service throws a specific validation error
      expect(error.message).toContain("Start date must be before end date");
    }
  });
  
  test("generateSchedule should create a new schedule version with entries", async () => {
    // Get the state BEFORE generating the schedule
    const versionsBefore = await getScheduleVersions();
    const maxVersionBefore = versionsBefore[0]?.version || 0;
    
    // Now generate the schedule
    const result = await generateSchedule("2023-04-01", "2023-04-07");
    
    // Assert based on the state BEFORE generation
    expect(result).toBeDefined();
    expect(result.newVersion).toBe(maxVersionBefore + 1);
    expect(result.status).toBe(ScheduleStatus.DRAFT); // Use enum for comparison
    expect(result.entryCount).toBeGreaterThan(0);
    
    // Verify it was created in the database by checking the state AFTER
    const versionsAfter = await getScheduleVersions();
    expect(versionsAfter.length).toBe(versionsBefore.length + 1);
    expect(versionsAfter[0]?.version).toBe(result.newVersion); // Check the newest version ID
    
    // Verify schedule entries were created
    const scheduleEntries = await getScheduleByVersion(result.newVersion);
    expect(scheduleEntries.length).toBeGreaterThan(0);
    expect(scheduleEntries.length).toBe(result.entryCount); // Match reported entry count
  });
}); 