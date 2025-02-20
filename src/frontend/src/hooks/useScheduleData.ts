import { useQuery } from '@tanstack/react-query';
import { getSchedules } from '@/services/api';
import { Schedule, ScheduleError } from '@/types';

interface UseScheduleDataResult {
    scheduleData: Schedule[];
    versions: number[];
    errors: ScheduleError[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useScheduleData(
    startDate: Date,
    endDate: Date,
    version?: number
): UseScheduleDataResult {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['schedules', startDate.toISOString(), endDate.toISOString(), version],
        queryFn: async () => {
            const response = await getSchedules(
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0],
                version
            );
            return response;
        },
    });

    return {
        scheduleData: data?.schedules || [],
        versions: data?.versions || [],
        errors: data?.errors || [],
        loading: isLoading,
        error: error instanceof Error ? error.message : null,
        refetch: async () => {
            await refetch();
        },
    };
} 