import { Employee } from "./employee";
import { DateRange } from "react-day-picker";

// Schedule Status types
export type ScheduleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

// Shift type identifiers
export type ShiftTypeId = "EARLY" | "MIDDLE" | "LATE";

// TimeSlot definition
export interface TimeSlot {
  start: number; // Minutes from midnight
  end: number; // Minutes from midnight
  label: string; // Formatted time
}

// ShiftType definition
export interface ShiftType {
  id: string;
  name: string;
  color: string;
  type: "shift";
}

// AbsenceType definition
export interface AbsenceType {
  id: string;
  name: string;
  color: string;
  type: "absence";
}

// Absence definition
export interface Absence {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  absence_type_id: string;
  note?: string;
}

// Settings type definition for app settings
export interface ScheduleSettings {
  general?: {
    store_opening?: string;
    store_closing?: string;
    opening_days?: Record<string, boolean>;
  };
  shift_types?: ShiftType[];
  absence_types?: AbsenceType[];
}

// DragItem for react-dnd
export interface ScheduleDragItem {
  type: "EMPLOYEE_SCHEDULE";
  scheduleId: number;
  employeeId: number;
  shiftId: number;
  date: string;
  startTime: string;
  endTime: string;
}

// Improved Schedule type
export interface Schedule {
  id: number;
  employee_id: number;
  date: string;
  shift_id: number;
  shift_start: string;
  shift_end: string;
  version: number;
  status: ScheduleStatus;
  is_empty: boolean;
  shift_type_id?: string;
  shift_type_name?: string;
}

// Type for schedule updates
export interface ScheduleUpdate {
  employee_id?: number;
  date?: string;
  shift_id?: number;
  shift_start?: string;
  shift_end?: string;
  shift_type_id?: string;
  version?: number;
  status?: ScheduleStatus;
  is_empty?: boolean;
}

// Type for common props shared across schedule view components
export interface BaseScheduleViewProps {
  schedules: Schedule[];
  dateRange: DateRange | undefined;
  onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
  isLoading: boolean;
  employeeAbsences?: Record<number, Absence[]>;
  absenceTypes?: AbsenceType[];
}

// Props specific to the TimeGridView
export interface TimeGridViewProps extends BaseScheduleViewProps {
  onDrop: (
    scheduleId: number,
    newEmployeeId: number,
    newDate: Date,
    newShiftId: number,
  ) => Promise<void>;
}

// Props specific to the ScheduleDisplay component
export interface ScheduleDisplayProps extends BaseScheduleViewProps {
  viewType: "grid" | "table" | "versions" | "statistics" | "overview";
  onDrop: (
    scheduleId: number,
    newEmployeeId: number,
    newDate: Date,
    newShiftId: number,
  ) => Promise<void>;
}

// Context type for schedule data
export interface ScheduleContextType {
  schedules: Schedule[];
  employees: Employee[];
  settings: ScheduleSettings | null;
  isLoading: boolean;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  refreshSchedules: () => Promise<void>;
  updateSchedule: (
    scheduleId: number,
    updates: ScheduleUpdate,
  ) => Promise<void>;
  deleteSchedule: (scheduleId: number) => Promise<void>;
  createSchedule: (scheduleData: Partial<Schedule>) => Promise<void>;
}

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
