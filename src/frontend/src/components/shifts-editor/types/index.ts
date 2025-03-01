import { Settings, Shift } from '@/types';

export interface TimeRange {
    start: Date;
    end: Date;
}

export interface ShiftDebugInfo {
    shiftId: number;
    originalShiftStart: string;
    originalShiftEnd: string;
    rangeStart: string;
    rangeEnd: string;
    isShiftBeforeRange: boolean;
    isShiftAfterRange: boolean;
    positioningResult?: string | PositioningDetails;
}

export interface PositioningDetails {
    totalDuration: number;
    shiftStartFromRangeStart: number;
    shiftDuration: number;
    left: number;
    width: number;
}

export interface EnhancedShift extends Shift {
    isEarlyShift: boolean;
    isLateShift: boolean;
}

export interface ShiftEditorProps {
    shifts: Shift[];
    settings: Settings;
    onAddShift?: () => void;
    onUpdateShift?: (shift: Shift) => Promise<void>;
    onDeleteShift?: (shiftId: number) => Promise<void>;
    onEmployeeCountChange?: (shiftId: number, minEmployees: number, maxEmployees: number) => Promise<void>;
} 