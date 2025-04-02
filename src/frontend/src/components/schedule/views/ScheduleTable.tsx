import React from 'react';
import { Schedule, ScheduleUpdate, Settings } from '@/types';
import { DateRange } from 'react-day-picker';
import { OriginalScheduleTable } from './original/OriginalScheduleTable';

interface ScheduleTableProps {
    schedules: Schedule[];
    dateRange: DateRange;
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
    storeSettings?: Settings;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = (props) => {
    // Just pass all props to the original ScheduleTable component
    return (
        <OriginalScheduleTable 
            schedules={props.schedules}
            dateRange={props.dateRange}
            onDrop={props.onDrop}
            onUpdate={props.onUpdate}
            isLoading={props.isLoading}
            employeeAbsences={props.employeeAbsences}
            absenceTypes={props.absenceTypes}
        />
    );
}; 