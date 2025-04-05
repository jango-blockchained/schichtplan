import { Settings, Shift, Schedule } from "@/types";

/**
 * Props for the ShiftCoverageView component
 */
export interface ShiftCoverageViewProps {
  // Settings
  settings: Settings;

  // Data
  shifts?: Shift[];
  schedules?: Schedule[];

  // Date range
  dateRange?: {
    from: Date;
    to: Date;
  };

  // Loading state
  isLoading?: boolean;

  // Callbacks
  onDrop?: (
    scheduleId: number,
    newEmployeeId: number,
    newDate: Date,
    newShiftId: number,
  ) => Promise<void>;
  onUpdate?: (scheduleId: number, updates: any) => Promise<void>;

  // Additional data
  employeeAbsences?: Record<number, any[]>;
  absenceTypes?: Array<{
    id: string;
    name: string;
    color: string;
    type: "absence";
  }>;

  // View options
  mode?: "shifts" | "schedules";
}

/**
 * Props for the KeyholderTimeBlock component
 */
export interface KeyholderTimeBlockProps {
  isBefore: boolean;
  widthPercentage: number;
  minutes: number;
}

/**
 * Props for the ShiftBlock component
 */
export interface ShiftBlockProps {
  shift: any;
  day: string;
  position: {
    left: number;
    width: number;
    debug: any;
  };
  index: number;
  totalShifts: number;
}

/**
 * Props for the EmployeeCounter component
 */
export interface EmployeeCounterProps {
  shifts: any[];
}

/**
 * Enhanced shift with additional properties for visualization
 */
export interface EnhancedShift extends Shift {
  isEarlyShift: boolean;
  isLateShift: boolean;
  positioning?: {
    left: number;
    width: number;
  };
}
