import { Settings } from "@/types";
import { Shift } from "@/services/api";

export interface TimeRange {
  start: string;
  end: string;
}

export interface ShiftDebugInfo {
  id: number;
  startTime: string;
  endTime: string;
  startX: number;
  width: number;
  day: number;
}

export interface PositioningDetails {
  x: number;
  width: number;
}

export interface EnhancedShift extends Shift {
  positioning?: PositioningDetails;
  debugInfo?: ShiftDebugInfo;
}

export interface ShiftEditorProps {
  shifts: Shift[];
  settings: Settings;
  onAddShift?: () => void;
  onUpdateShift?: (shift: Shift) => void;
  onDeleteShift?: (shiftId: number) => void;
  onEmployeeCountChange?: (day: number, hour: number, count: number) => void;
}
