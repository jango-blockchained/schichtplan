import { Schedule } from '@/types';

/**
 * Props interface for ScheduleTable components
 */
export interface ScheduleTableProps {
    schedules: Schedule[];
    loading?: boolean;
    onSchedulesChange?: () => Promise<void>;
    dateRange?: { from: Date; to: Date };
} 