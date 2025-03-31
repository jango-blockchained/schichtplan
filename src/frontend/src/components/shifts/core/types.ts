import { WeeklySchedule, WeeklyShift, Settings } from '@/types';

/**
 * Props for the ShiftTable component
 */
export interface ShiftTableProps {
    // Date range
    weekStart: Date;
    weekEnd: Date;
    
    // Data
    data: WeeklySchedule[];
    isLoading?: boolean;
    error?: string | null;
    
    // Settings
    settings?: Settings;
    
    // Callbacks
    onShiftUpdate?: (employeeId: number, fromDay: number, toDay: number) => Promise<void>;
    onBreakNotesUpdate?: (employeeId: number, day: number, notes: string) => Promise<void>;
    
    // Display options
    showValidation?: boolean;
    compact?: boolean;
    filterOpeningDays?: boolean;
}

/**
 * Props for the ShiftCell component
 */
export interface ShiftCellProps {
    shift: WeeklyShift | undefined;
    employeeId?: number;
    showValidation?: boolean;
    onBreakNotesUpdate?: (employeeId: number, day: number, notes: string) => Promise<void>;
    settings?: Settings;
    compact?: boolean;
}

/**
 * Props for the SubRow component
 */
export interface SubRowProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}