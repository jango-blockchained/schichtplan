import { useQuery } from "@tanstack/react-query";
import {
  getSchedules,
  type ScheduleResponse,
  type Schedule as APISchedule,
} from "@/services/api";
import { Schedule, ScheduleError } from "@/types";
import { AxiosError } from "axios";

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
  includeEmpty: boolean = false,
): UseScheduleDataResult {
  const { data, isLoading, error, refetch } = useQuery<ScheduleResponse>({
    queryKey: [
      "schedules",
      startDate.toISOString(),
      endDate.toISOString(),
      version,
      includeEmpty,
    ] as const,
    queryFn: async () => {
      try {
        console.log("🔄 useScheduleData fetching schedules with params:", {
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
          version,
          includeEmpty,
        });

        const response = await getSchedules(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0],
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
    gcTime: 30 * 60 * 1000, // Keep unused data in cache for 30 minutes
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: 2, // Retry failed requests up to 2 times
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
    date_range: `${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`,
    hasError: !!errorMessage,
  });

  return {
    scheduleData,
    versions: data?.versions ?? [],
    errors: data?.errors ?? [],
    loading: isLoading,
    error: errorMessage,
    refetch: async () => {
      console.log("🔄 useScheduleData manual refetch triggered");
      await refetch();
    },
  };
}
