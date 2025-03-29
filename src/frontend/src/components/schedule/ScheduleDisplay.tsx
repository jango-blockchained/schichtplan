import { Schedule, ScheduleUpdate } from '@/types';
import { DateRange } from 'react-day-picker';
import { ScheduleTable } from './views/ScheduleTable';
import { TimeGridView } from './views/TimeGridView';

export type ScheduleViewType = 'table' | 'grid';

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
}

export const ScheduleDisplay = ({
    viewType,
    ...props
}: ScheduleDisplayProps) => {
    return viewType === 'table' ? (
        <ScheduleTable {...props} />
    ) : (
        <TimeGridView {...props} />
    );
}; 