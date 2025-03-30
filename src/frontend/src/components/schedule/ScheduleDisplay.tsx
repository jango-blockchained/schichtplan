import React from 'react';
import { Schedule, ScheduleUpdate, Settings } from '@/types';
import { DateRange } from 'react-day-picker';
import { ScheduleTable } from './views/ScheduleTable';
import { TimeGridView } from './views/TimeGridView';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ShiftCoverageView } from './views/ShiftCoverageView';
import { MonthlyView } from './views/MonthlyView';
import { DailyView } from './views/DailyView';
import { EmployeeView } from './views/EmployeeView';
import { CalendarView } from './views/CalendarView';
import { ShiftsTableView } from './views/ShiftsTableView';

// Extended view types to include all available views
export type ScheduleViewType = 'table' | 'grid' | 'coverage' | 'monthly' | 'daily' | 'employee' | 'calendar' | 'shifts';

interface ScheduleDisplayProps {
    viewType: ScheduleViewType;
    schedules: Schedule[];
    dateRange: DateRange | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
    isLoading: boolean;
    employeeAbsences?: Record<number, any[]>;
    absenceTypes?: Array<{
        id: string;
        name: string;
        color: string;
        type: 'absence';
    }>;
    settings?: Settings;
}

export const ScheduleDisplay = ({
    viewType,
    dateRange,
    settings,
    ...props
}: ScheduleDisplayProps) => {
    // Ensure dateRange has valid from and to dates
    if (!dateRange || !dateRange.from || !dateRange.to) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Bitte wählen Sie einen Datumsbereich aus. 
                    Ein gültiges Startdatum und Enddatum werden benötigt.
                </AlertDescription>
            </Alert>
        );
    }

    // Ensure dateRange from is not after to
    if (dateRange.from > dateRange.to) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Das Startdatum kann nicht nach dem Enddatum liegen.
                </AlertDescription>
            </Alert>
        );
    }

    // Clone the dateRange to ensure we don't have any reference issues
    const safeRange: DateRange = {
        from: new Date(dateRange.from),
        to: new Date(dateRange.to)
    };
    
    // Common props for all views
    const viewProps = {
        dateRange: safeRange,
        storeSettings: settings,
        ...props
    };
    
    // Render appropriate view based on viewType
    switch (viewType) {
        case 'table':
            return <ScheduleTable {...viewProps} />;
        case 'grid':
            return <TimeGridView {...viewProps} />;
        case 'coverage':
            return <ShiftCoverageView {...viewProps} />;
        case 'monthly':
            return <MonthlyView {...viewProps} />;
        case 'daily':
            // return <DailyView {...viewProps} />;
            return <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Tagesansicht ist noch nicht implementiert.
                </AlertDescription>
            </Alert>;
        case 'employee':
            // return <EmployeeView {...viewProps} />;
            return <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Mitarbeiteransicht ist noch nicht implementiert.
                </AlertDescription>
            </Alert>;
        case 'calendar':
            return <CalendarView {...viewProps} />;
        case 'shifts':
            return <ShiftsTableView {...viewProps} />;
        default:
            return <ScheduleTable {...viewProps} />;
    }
}; 