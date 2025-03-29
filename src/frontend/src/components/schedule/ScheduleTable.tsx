import { Schedule } from '@/types';

export interface ScheduleTableProps {
    schedules: Schedule[];
    loading?: boolean;
    onSchedulesChange?: () => Promise<void>;
} 