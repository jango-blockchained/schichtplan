import { describe, expect, it } from "bun:test";
import type { DateRange } from "react-day-picker";
import { ScheduleBusinessLogic } from "../scheduleBusinessLogic";

describe("ScheduleBusinessLogic", () => {
  describe("validateDateRange", () => {
    it("validates a proper date range", () => {
      const dateRange: DateRange = {
        from: new Date("2024-02-01"),
        to: new Date("2024-02-29"),
      };
      
      const result = ScheduleBusinessLogic.validateDateRange(dateRange);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.totalDays).toBe(29);
      expect(result.metadata.weekCount).toBe(5);
    });

    it("fails validation for missing date range", () => {
      const result = ScheduleBusinessLogic.validateDateRange(undefined);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Date range must have both start and end dates');
    });

    it("fails validation when start date equals end date", () => {
      const dateRange: DateRange = {
        from: new Date("2024-02-01"),
        to: new Date("2024-02-01"),
      };
      
      const result = ScheduleBusinessLogic.validateDateRange(dateRange);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date must be before end date');
    });

    it("fails validation for very short date range", () => {
      const dateRange: DateRange = {
        from: new Date("2024-02-01"),
        to: new Date("2024-02-03"),
      };
      
      const result = ScheduleBusinessLogic.validateDateRange(dateRange);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Schedule must span at least one week');
    });

    it("fails validation for very long date range", () => {
      const dateRange: DateRange = {
        from: new Date("2024-01-01"),
        to: new Date("2025-12-31"),
      };
      
      const result = ScheduleBusinessLogic.validateDateRange(dateRange);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Schedule cannot span more than one year');
    });

    it("generates warnings for long schedules", () => {
      const dateRange: DateRange = {
        from: new Date("2024-01-01"),
        to: new Date("2024-07-31"),
      };
      
      const result = ScheduleBusinessLogic.validateDateRange(dateRange);
      
      expect(result.warnings).toContain('Long schedules may impact performance');
    });

    it("calculates correct metadata for working days", () => {
      const dateRange: DateRange = {
        from: new Date("2024-02-05"), // Monday
        to: new Date("2024-02-11"), // Sunday
      };
      
      const result = ScheduleBusinessLogic.validateDateRange(dateRange);
      
      expect(result.metadata.totalDays).toBe(7);
      expect(result.metadata.weekendDays).toBe(2); // Saturday and Sunday
      expect(result.metadata.workingDays).toBe(5); // Monday to Friday
    });
  });

  describe("checkVersionCompatibility", () => {
    const currentSchedule = {
      id: 1,
      version: "v1.0",
      from_date: "2024-02-01",
      to_date: "2024-02-29",
      created_at: "2024-01-15T00:00:00Z",
      updated_at: "2024-01-15T00:00:00Z",
      is_active: true,
    };

    it("detects compatible schedules", () => {
      const targetSchedule = {
        id: 2,
        version: "v1.1",
        from_date: "2024-03-01",
        to_date: "2024-03-31",
        created_at: "2024-02-15T00:00:00Z",
        updated_at: "2024-02-15T00:00:00Z",
        is_active: false,
      };
      
      const result = ScheduleBusinessLogic.checkVersionCompatibility(currentSchedule, targetSchedule);
      
      expect(result.isCompatible).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations).toContain('Schedules are compatible for creation');
    });

    it("detects date range overlaps", () => {
      const overlappingSchedule = {
        id: 2,
        version: "v1.1",
        from_date: "2024-02-15", // Overlaps with current schedule
        to_date: "2024-03-15",
        created_at: "2024-02-01T00:00:00Z",
        updated_at: "2024-02-01T00:00:00Z",
        is_active: false,
      };
      
      const result = ScheduleBusinessLogic.checkVersionCompatibility(currentSchedule, overlappingSchedule);
      
      expect(result.isCompatible).toBe(false);
      expect(result.issues).toContain('Date ranges overlap with existing schedule');
    });

    it("detects duplicate version numbers", () => {
      const duplicateVersionSchedule = {
        id: 2,
        version: "v1.0", // Same version as current
        from_date: "2024-03-01",
        to_date: "2024-03-31",
        created_at: "2024-02-15T00:00:00Z",
        updated_at: "2024-02-15T00:00:00Z",
        is_active: false,
      };
      
      const result = ScheduleBusinessLogic.checkVersionCompatibility(currentSchedule, duplicateVersionSchedule);
      
      expect(result.isCompatible).toBe(false);
      expect(result.issues).toContain('Version numbers must be unique');
    });

    it("warns about creating schedules for past dates", () => {
      const pastSchedule = {
        id: 2,
        version: "v0.9",
        from_date: "2024-01-01", // Before current schedule
        to_date: "2024-01-31",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        is_active: false,
      };
      
      const result = ScheduleBusinessLogic.checkVersionCompatibility(currentSchedule, pastSchedule);
      
      expect(result.warnings).toContain('Creating schedule for past dates');
    });

    it("warns about gaps between schedules", () => {
      const gappedSchedule = {
        id: 2,
        version: "v1.1",
        from_date: "2024-03-15", // Gap of 2 weeks
        to_date: "2024-04-15",
        created_at: "2024-02-15T00:00:00Z",
        updated_at: "2024-02-15T00:00:00Z",
        is_active: false,
      };
      
      const result = ScheduleBusinessLogic.checkVersionCompatibility(currentSchedule, gappedSchedule);
      
      expect(result.warnings.some(w => w.includes('day gap between schedules'))).toBe(true);
    });
  });

  describe("analyzeScheduleConflicts", () => {
    it("detects no conflicts in non-overlapping schedules", () => {
      const schedules = [
        {
          id: 1,
          version: "v1.0",
          from_date: "2024-01-01",
          to_date: "2024-01-31",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          is_active: true,
        },
        {
          id: 2,
          version: "v1.1",
          from_date: "2024-02-01",
          to_date: "2024-02-29",
          created_at: "2024-01-15T00:00:00Z",
          updated_at: "2024-01-15T00:00:00Z",
          is_active: false,
        },
      ];
      
      const result = ScheduleBusinessLogic.analyzeScheduleConflicts(schedules);
      
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it("detects overlapping schedules", () => {
      const schedules = [
        {
          id: 1,
          version: "v1.0",
          from_date: "2024-01-01",
          to_date: "2024-01-31",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          is_active: true,
        },
        {
          id: 2,
          version: "v1.1",
          from_date: "2024-01-15", // Overlaps with first schedule
          to_date: "2024-02-15",
          created_at: "2024-01-10T00:00:00Z",
          updated_at: "2024-01-10T00:00:00Z",
          is_active: false,
        },
      ];
      
      const result = ScheduleBusinessLogic.analyzeScheduleConflicts(schedules);
      
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('overlap');
      expect(result.conflicts[0].severity).toBe('high');
    });

    it("detects invalid date ranges", () => {
      const schedules = [
        {
          id: 1,
          version: "v1.0",
          from_date: "2024-01-31", // End date before start date
          to_date: "2024-01-01",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          is_active: true,
        },
      ];
      
      const result = ScheduleBusinessLogic.analyzeScheduleConflicts(schedules);
      
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('invalid_range');
      expect(result.conflicts[0].severity).toBe('high');
    });

    it("provides resolution suggestions for conflicts", () => {
      const schedules = [
        {
          id: 1,
          version: "v1.0",
          from_date: "2024-01-01",
          to_date: "2024-01-31",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          is_active: true,
        },
        {
          id: 2,
          version: "v1.1",
          from_date: "2024-01-15",
          to_date: "2024-02-15",
          created_at: "2024-01-10T00:00:00Z",
          updated_at: "2024-01-10T00:00:00Z",
          is_active: false,
        },
      ];
      
      const result = ScheduleBusinessLogic.analyzeScheduleConflicts(schedules);
      
      expect(result.resolutions).toHaveLength(1);
      expect(result.resolutions[0].action).toBe('Adjust dates');
      expect(result.resolutions[0].description).toContain('Move v1.1 start date');
    });
  });

  describe("transformScheduleData", () => {
    const sampleSchedule = {
      id: 1,
      version: "v1.0",
      from_date: "2024-02-01",
      to_date: "2024-02-29",
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-01-15T10:30:00Z",
      is_active: true,
      meta: {
        version: "1.0",
        created_by: "Admin",
        notes: "Initial schedule",
      },
    };

    it("transforms to standard format", () => {
      const result = ScheduleBusinessLogic.transformScheduleData(sampleSchedule, 'standard');
      
      expect(result.id).toBe(1);
      expect('version' in result && result.version).toBe("v1.0");
      expect('isActive' in result && result.isActive).toBe(true);
      expect('metadata' in result && result.metadata).toEqual(sampleSchedule.meta);
    });

    it("transforms to MEP format", () => {
      const result = ScheduleBusinessLogic.transformScheduleData(sampleSchedule, 'mep');
      
      expect('filiale' in result && result.filiale).toBe("Admin");
      expect('erstellungsdatum' in result && result.erstellungsdatum).toBe("15.01.2024");
      expect('zeitraum' in result && result.zeitraum).toBe("01.02.2024 - 29.02.2024");
      expect('version_info' in result && result.version_info).toBe("1.0");
    });

    it("transforms to compact format", () => {
      const result = ScheduleBusinessLogic.transformScheduleData(sampleSchedule, 'compact');
      
      expect(result.id).toBe(1);
      expect('v' in result && result.v).toBe("v1.0");
      expect('dates' in result && result.dates).toBe("2024-02-01_2024-02-29");
      expect('active' in result && result.active).toBe(1);
    });
  });

  describe("calculateScheduleMetrics", () => {
    it("calculates metrics for a normal month", () => {
      const schedule = {
        id: 1,
        version: "v1.0",
        from_date: "2024-02-01",
        to_date: "2024-02-29",
        created_at: "2024-01-15T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
        is_active: true,
      };
      
      const metrics = ScheduleBusinessLogic.calculateScheduleMetrics(schedule);
      
      expect(metrics.totalDays).toBe(29);
      expect(metrics.weekCount).toBe(5);
      expect(metrics.workingDays).toBeGreaterThan(0);
      expect(metrics.weekendDays).toBeGreaterThan(0);
      expect(metrics.weekendPercentage).toBeGreaterThan(0);
      expect(metrics.isLongTerm).toBe(false);
      expect(metrics.isShortTerm).toBe(false);
    });

    it("identifies long-term schedules", () => {
      const longSchedule = {
        id: 1,
        version: "v1.0",
        from_date: "2024-01-01",
        to_date: "2024-06-30",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        is_active: true,
      };
      
      const metrics = ScheduleBusinessLogic.calculateScheduleMetrics(longSchedule);
      
      expect(metrics.isLongTerm).toBe(true);
      expect(metrics.isShortTerm).toBe(false);
    });

    it("identifies short-term schedules", () => {
      const shortSchedule = {
        id: 1,
        version: "v1.0",
        from_date: "2024-02-01",
        to_date: "2024-02-07",
        created_at: "2024-01-15T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
        is_active: true,
      };
      
      const metrics = ScheduleBusinessLogic.calculateScheduleMetrics(shortSchedule);
      
      expect(metrics.isLongTerm).toBe(false);
      expect(metrics.isShortTerm).toBe(true);
    });
  });

  describe("generateScheduleSuggestions", () => {
    it("generates suggestions for valid date range", () => {
      const dateRange: DateRange = {
        from: new Date("2024-02-01"),
        to: new Date("2024-05-31"),
      };
      
      const suggestions = ScheduleBusinessLogic.generateScheduleSuggestions(dateRange);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("returns empty array for invalid date range", () => {
      const suggestions = ScheduleBusinessLogic.generateScheduleSuggestions(undefined);
      
      expect(suggestions).toEqual([]);
    });

    it("identifies monthly alignment optimization", () => {
      const dateRange: DateRange = {
        from: new Date("2024-02-01"),
        to: new Date("2024-05-31"), // Exactly 4 months = 16 weeks
      };
      
      const suggestions = ScheduleBusinessLogic.generateScheduleSuggestions(dateRange);
      
      const monthlyOptimization = suggestions.find(s => 
        s.type === 'optimization' && s.message.includes('monthly cycles')
      );
      expect(monthlyOptimization).toBeDefined();
    });

    it("warns about conflicts with existing schedules", () => {
      const dateRange: DateRange = {
        from: new Date("2024-02-15"),
        to: new Date("2024-03-15"),
      };
      
      const existingSchedules = [
        {
          id: 1,
          version: "v1.0",
          from_date: "2024-02-01",
          to_date: "2024-02-29",
          created_at: "2024-01-15T00:00:00Z",
          updated_at: "2024-01-15T00:00:00Z",
          is_active: true,
        },
      ];
      
      const suggestions = ScheduleBusinessLogic.generateScheduleSuggestions(dateRange, existingSchedules);
      
      const conflictWarning = suggestions.find(s => 
        s.type === 'warning' && s.message.includes('conflicts')
      );
      expect(conflictWarning).toBeDefined();
      expect(conflictWarning?.priority).toBe('high');
    });
  });
});
