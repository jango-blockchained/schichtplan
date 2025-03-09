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
                console.log('🔄 useScheduleData fetching schedules with params:', {
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0],
                    version,
                    includeEmpty
                });

                const response = await getSchedules(
                    startDate.toISOString().split('T')[0],
                    endDate.toISOString().split('T')[0],
                    version,
                    includeEmpty
                );

                console.log('🔄 useScheduleData received response:', {
                    scheduleCount: response.schedules?.length || 0,
                    shiftsWithData: response.schedules?.filter(s => s.shift_id !== null).length || 0,
                    versions: response.versions,
                    firstSchedule: response.schedules?.length > 0 ? response.schedules[0] : null
                });

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

    const scheduleData = data?.schedules || [];
    console.log('🔄 useScheduleData returning:', {
        scheduleCount: scheduleData.length,
        shiftsWithId: scheduleData.filter(s => s.shift_id !== null).length,
        date_range: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
    });

    return {
        scheduleData,
        versions: data?.versions ?? [],
        errors: data?.errors ?? [],
        loading: isLoading,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        refetch: async () => {
            console.log('🔄 useScheduleData manual refetch triggered');
            await refetch();
        },
    };
} 