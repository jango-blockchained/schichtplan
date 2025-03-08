import { useQuery } from '@tanstack/react-query';
import { getSchedules, type ScheduleResponse } from '@/services/api';
import { Schedule, ScheduleError } from '@/types';
import { AxiosError } from 'axios';

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
    version?: number,
    includeEmpty: boolean = false
): UseScheduleDataResult {
    const { data, isLoading, error, refetch } = useQuery<ScheduleResponse>({
        queryKey: ['schedules', startDate.toISOString(), endDate.toISOString(), version, includeEmpty] as const,
        queryFn: async () => {
            try {
                const response = await getSchedules(
                    startDate.toISOString().split('T')[0],
                    endDate.toISOString().split('T')[0],
                    version,
                    includeEmpty
                );

                // Ensure versions array exists and is sorted in descending order
                if (response.versions) {
                    response.versions.sort((a, b) => b - a);
                }

                return response;
            } catch (error) {
                if (error instanceof AxiosError) {
                    const errorMessage = error.response?.data?.error || error.message;
                    console.error('Schedule fetch error:', {
                        message: errorMessage,
                        status: error.response?.status,
                        data: error.response?.data
                    });
                    throw new Error(errorMessage);
                }
                console.error('Schedule fetch error:', error);
                throw error;
            }
        },
        gcTime: 30 * 60 * 1000, // Keep unused data in cache for 30 minutes
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        refetchOnMount: true, // Always refetch when component mounts
        refetchOnWindowFocus: true, // Refetch when window regains focus
    });

    return {
        scheduleData: data?.schedules ?? [],
        versions: data?.versions ?? [],
        errors: data?.errors ?? [],
        loading: isLoading,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        refetch: async () => {
            await refetch();
        },
    };
} 