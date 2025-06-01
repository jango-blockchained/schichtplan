import { useQuery } from "@tanstack/react-query";
import {
  getSchedules,
  type ScheduleResponse,
  type Schedule as APISchedule,
} from "@/services/api";
import { Schedule, ScheduleError } from "@/types";
import { AxiosError } from "axios";
import React from "react";

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
  return {
    id: apiSchedule.id,
    employee_id: apiSchedule.employee_id,
    date: apiSchedule.date,
    shift_id: apiSchedule.shift_id,
    shift_start: apiSchedule.shift_start ?? null,
    shift_end: apiSchedule.shift_end ?? null,
    is_empty: apiSchedule.is_empty ?? false,
    version: apiSchedule.version,
    status: apiSchedule.status as Schedule["status"],
    break_start: apiSchedule.break_start ?? null,
    break_end: apiSchedule.break_end ?? null,
    notes: apiSchedule.notes ?? null,
    employee_name: undefined,
  };
};

export function useScheduleData(
  startDate: Date,
  endDate: Date,
  version?: number,
  includeEmpty: boolean = true,
): UseScheduleDataResult {
  // Stabilize date strings to prevent query key from changing on every render
  const startDateStr = React.useMemo(() => startDate.toISOString().split("T")[0], [startDate.getTime()]);
  const endDateStr = React.useMemo(() => endDate.toISOString().split("T")[0], [endDate.getTime()]);

  const { data, isLoading, error, refetch } = useQuery<ScheduleResponse>({
    queryKey: [
      "schedules",
      startDateStr, // Use stable string instead of calling toISOString() in query key
      endDateStr,   // Use stable string instead of calling toISOString() in query key
      version,
      includeEmpty,
    ] as const,
    queryFn: async () => {
      try {
        console.log("🔄 useScheduleData fetching schedules with params:", {
          startDate: startDateStr,
          endDate: endDateStr,
          version,
          includeEmpty,
        });

        const response = await getSchedules(
          startDateStr,
          endDateStr,
          version,
          includeEmpty,
        );

        // Validate response structure
        if (!response.schedules) {
          throw new Error("Invalid response format: missing schedules array");
        }

        console.log("🔄 useScheduleData received response:", {
          scheduleCount: response.schedules?.length || 0,
          shiftsWithData:
            response.schedules?.filter((s) => s.shift_id !== null).length || 0,
          versions: response.versions,
          firstSchedule:
            response.schedules?.length > 0 ? response.schedules[0] : null,
        });

        // Ensure versions array exists and is sorted in descending order
        if (response.versions) {
          response.versions.sort((a, b) => b - a);
        }

        return response;
      } catch (error) {
        if (error instanceof AxiosError) {
          const errorMessage = error.response?.data?.error || error.message;
          console.error("Schedule fetch error:", {
            message: errorMessage,
            status: error.response?.status,
            data: error.response?.data,
            config: error.config,
          });

          // More user-friendly error messages based on status code
          if (error.code === "ECONNABORTED") {
            throw new Error(
              "The request timed out. Please check your internet connection and try again.",
            );
          } else if (!error.response) {
            throw new Error(
              "Could not connect to the server. Please check if the backend is running.",
            );
          } else if (error.response.status === 404) {
            throw new Error("The schedule data could not be found.");
          } else if (error.response.status >= 500) {
            throw new Error(
              "The server encountered an error. Please try again later.",
            );
          }

          throw new Error(errorMessage);
        }
        console.error("Schedule fetch error:", error);
        throw error;
      }
    },
    gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes (reduced from 30)
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes (reduced from 5)
    refetchOnMount: false, // Don't always refetch on mount to reduce rapid updates
    refetchOnWindowFocus: false, // Don't refetch on window focus to reduce rapid updates
    refetchOnReconnect: true, // Still refetch when connection is restored
    retry: 1, // Reduce retry attempts from 2 to 1
    retryDelay: 1000, // Add 1 second delay between retries
  });

  // Convert API Schedule objects to frontend Schedule objects
  const scheduleData = data?.schedules
    ? data.schedules.map(convertSchedule)
    : [];

  // Only set error if we actually have an error and data retrieval failed
  const errorMessage = error instanceof Error && !data ? error.message : null;

  console.log("🔄 useScheduleData returning:", {
    scheduleCount: scheduleData.length,
    shiftsWithId: scheduleData.filter((s) => s.shift_id !== null).length,
    date_range: `${startDateStr} to ${endDateStr}`,
    hasError: !!errorMessage,
  });

  // Memoize the refetch function to prevent it from changing on every render
  const stableRefetch = React.useCallback(async () => {
    console.log("🔄 useScheduleData manual refetch triggered");
    await refetch();
  }, [refetch]);

  return {
    scheduleData,
    versions: data?.versions ?? [],
    errors: data?.errors ?? [],
    loading: isLoading,
    error: errorMessage,
    refetch: stableRefetch,
  };
}
