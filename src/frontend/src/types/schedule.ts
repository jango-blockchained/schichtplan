import { Schedule } from './models';

export interface GenerationSettings {
  enforceMinCoverage: boolean;
  enforceQualifications: boolean;
  enforceMaxHours: boolean;
  allowOvertime: boolean;
  maxOvertimeHours: number;
  respectAvailability: boolean;
  allowDynamicShiftAdjustment: boolean;
  maxShiftAdjustmentMinutes: number;
  preferOriginalTimes: boolean;
}

export interface GenerationRequest {
  startDate: string;
  endDate: string;
  version?: number;
  settings?: Partial<GenerationSettings>;
}

export interface GenerationResponse {
  success: boolean;
  schedules: Schedule[];
  warnings: string[];
  errors: string[];
  logs: string[];
  metadata: {
    generatedAt: string;
    totalDays: number;
    dateMetadata: {
      datesProcessed: number;
      datesWithCoverage: number;
      emptyDates: number;
      assignmentsCreated: number;
      invalidAssignments: number;
      assignmentsByDate: Record<string, number>;
    };
    resources: {
      employees: number;
      shifts: number;
      coverage: number;
    };
    generationTimeSeconds: number;
  };
} 