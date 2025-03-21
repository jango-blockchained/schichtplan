import { useQuery } from '@tanstack/react-query';
import { getSchedules, type ScheduleResponse, type Schedule as APISchedule } from '@/services/api';
import { Schedule, ScheduleError, ShiftType } from '@/types';
import { AxiosError } from 'axios';

export interface UseScheduleDataResult {
    scheduleData: Schedule[];
    versions: number[];
    errors: ScheduleError[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

// Helper function to convert API Schedule to frontend Schedule
const convertSchedule = (apiSchedule: APISchedule): Schedule => {
    const shiftTypeId = apiSchedule.shift_type_id;
    return {
        id: apiSchedule.id,
        employee_id: apiSchedule.employee_id,
        date: apiSchedule.date,
        shift_id: apiSchedule.shift_id,
        shift_start: apiSchedule.shift_start ?? null,
        shift_end: apiSchedule.shift_end ?? null,
        start_time: apiSchedule.shift_start ?? null,
        end_time: apiSchedule.shift_end ?? null,
        is_empty: apiSchedule.is_empty ?? false,
        version: apiSchedule.version,
        status: apiSchedule.status as Schedule['status'],
        break_start: apiSchedule.break_start ?? null,
        break_end: apiSchedule.break_end ?? null,
        notes: apiSchedule.notes ?? null,
        employee_name: undefined,
        availability_type: apiSchedule.availability_type,
        shift_type_id: shiftTypeId && ['EARLY', 'MIDDLE', 'LATE'].includes(shiftTypeId) ? shiftTypeId as ShiftType : undefined
    };
};

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

                console.log('📊 Schedule data fetched:', response);
                return response;
            } catch (err) {
                console.error('Error fetching schedules:', err);
                throw err;
            }
        },
        enabled: true, // Always enable to force refetch when needed
        staleTime: 10 * 1000, // Set to 10 seconds to allow some caching but still refresh often
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });

    // Convert API Schedule objects to frontend Schedule objects
    const scheduleData = data?.schedules ? data.schedules.map(convertSchedule) : [];

    // Only set error if we actually have an error and data retrieval failed
    const errorMessage = error instanceof Error && !data ? error.message : null;

    console.log('🔄 useScheduleData returning:', {
        scheduleCount: scheduleData.length,
        shiftsWithId: scheduleData.filter(s => s.shift_id !== null).length,
        date_range: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        hasError: !!errorMessage
    });

    return {
        scheduleData,
        versions: data?.versions ?? [],
        errors: data?.errors ?? [],
        loading: isLoading,
        error: errorMessage,
        refetch: async () => {
            console.log('🔄 useScheduleData manual refetch triggered');
            await refetch();
        },
    };
} 