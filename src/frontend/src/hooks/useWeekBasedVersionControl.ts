/**
 * Week-based version control hook for the Schichtplan frontend.
 *
 * This hook replaces useVersionControl with week-centric version management,
 * providing navigation, version creation, and state management for week-based schedules.
 * Now integrates with the settings system for configuration.
 */

import { useToast } from "@/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";

import {
  createWeekVersion as apiCreateWeekVersion,
  getNextWeek as apiGetNextWeek,
  getPreviousWeek as apiGetPreviousWeek,
  getSettings,
  getWeekInfo,
  getWeekSegments,
  WeekSegmentsResponse,
} from "@/services/api";
import type { Settings } from "@/types";
import {
  MonthBoundaryMode,
  VersionIdentifier,
  WeekendStart,
  WeekNavigationState,
} from "@/types/weekVersion";
import {
  getCurrentWeekIdentifier,
  getWeekFromIdentifier,
} from "@/utils/weekUtils";

interface UseWeekBasedVersionControlProps {
  initialWeek?: string;
  onWeekChanged?: (weekIdentifier: string) => void;
  onVersionSelected?: (version: VersionIdentifier) => void;
  overrideSettings?: {
    weekendStart?: WeekendStart;
    monthBoundaryMode?: MonthBoundaryMode;
    enableWeekNavigation?: boolean;
  };
}

export function useWeekBasedVersionControl({
  initialWeek,
  onWeekChanged,
  onVersionSelected,
  overrideSettings,
}: UseWeekBasedVersionControlProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize current week
  const [currentWeek, setCurrentWeek] = useState<string>(
    initialWeek || getCurrentWeekIdentifier(),
  );

  // State for tracking current segment when in split mode
  const [currentSegment, setCurrentSegment] = useState<number>(1);

  // Fetch settings from the settings system
  const { data: settings, isLoading: isSettingsLoading } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Derive week navigation settings from settings or use defaults
  const weekNavigationSettings = useMemo(() => {
    const weekNavSettings = settings?.week_navigation || {
      week_weekend_start: "MONDAY",
      week_month_boundary_mode: "keep_intact",
    };

    return {
      enableWeekNavigation: overrideSettings?.enableWeekNavigation ?? true, // Always enable week navigation
      weekendStart:
        overrideSettings?.weekendStart ??
        (weekNavSettings.week_weekend_start === "SUNDAY"
          ? WeekendStart.SUNDAY
          : WeekendStart.MONDAY),
      monthBoundaryMode:
        overrideSettings?.monthBoundaryMode ??
        (weekNavSettings.week_month_boundary_mode === "split_by_month"
          ? MonthBoundaryMode.SPLIT_ON_MONTH
          : MonthBoundaryMode.KEEP_INTACT),
    };
  }, [settings, overrideSettings]);

  const [selectedVersion, setSelectedVersion] = useState<
    VersionIdentifier | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch week segments when month boundary mode is SPLIT_ON_MONTH
  const { data: segmentsData } = useQuery<WeekSegmentsResponse>({
    queryKey: ["week-segments", currentWeek],
    queryFn: () => getWeekSegments(currentWeek),
    enabled:
      weekNavigationSettings.monthBoundaryMode ===
        MonthBoundaryMode.SPLIT_ON_MONTH && !!currentWeek,
    staleTime: 5 * 60 * 1000,
  });

  const navigateToWeek = useCallback(
    async (weekIdentifier: string) => {
      try {
        setIsLoading(true);
        await getWeekInfo(weekIdentifier);
        setCurrentWeek(weekIdentifier);
        onWeekChanged?.(weekIdentifier);
      } catch (error) {
        console.error("Week navigation error:", error);
        toast({
          title: "Navigation Error",
          description: `Failed to navigate to week ${weekIdentifier}`,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onWeekChanged, toast],
  );

  const navigateNext = useCallback(async () => {
    try {
      setIsLoading(true);
      const nextWeekInfo = await apiGetNextWeek(currentWeek);
      setCurrentWeek(nextWeekInfo.week_identifier);
      onWeekChanged?.(nextWeekInfo.week_identifier);
    } catch (error) {
      console.error("Next week navigation error:", error);
      toast({
        title: "Navigation Error",
        description: "Failed to navigate to next week",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentWeek, onWeekChanged, toast]);

  const navigatePrevious = useCallback(async () => {
    try {
      setIsLoading(true);
      const prevWeekInfo = await apiGetPreviousWeek(currentWeek);
      setCurrentWeek(prevWeekInfo.week_identifier);
      onWeekChanged?.(prevWeekInfo.week_identifier);
    } catch (error) {
      console.error("Previous week navigation error:", error);
      toast({
        title: "Navigation Error",
        description: "Failed to navigate to previous week",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentWeek, onWeekChanged, toast]);

  const createVersionForWeek = useCallback(
    async (weekIdentifier: string) => {
      try {
        setIsLoading(true);
        console.log("[DEBUG] Creating week version for:", weekIdentifier);
        const result = await apiCreateWeekVersion({
          week_identifier: weekIdentifier,
          create_empty_schedules: true,
        });
        console.log("[DEBUG] Week version creation result:", result);
        toast({
          title: "Version Created",
          description: `Created version ${result.version} for week ${weekIdentifier}`,
        });

        // Set the new version as selected and trigger callback
        if (result.version) {
          setSelectedVersion(result.version);
          if (onVersionSelected) {
            onVersionSelected(result.version);
          }
        }
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
        queryClient.invalidateQueries({ queryKey: ["versions"] });
        queryClient.invalidateQueries({
          queryKey: ["week-version", weekIdentifier],
        });
        queryClient.invalidateQueries({ queryKey: ["week-version"] }); // Invalidate all week version queries

        return result;
      } catch (error) {
        console.error(
          "[DEBUG] Week version creation error for",
          weekIdentifier,
          error,
        );
        toast({
          title: "Creation Error",
          description: `Failed to create version for week ${weekIdentifier}: ${error instanceof Error ? error.message : String(error)}`,
          variant: "destructive",
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [queryClient, toast, onVersionSelected],
  );

  // Calculate current date range using settings
  const currentWeekInfo = useMemo(() => {
    // For now, use the standard ISO week calculation
    // TODO: Implement settings-aware week calculation
    return getWeekFromIdentifier(currentWeek);
  }, [currentWeek]);

  const dateRange: DateRange = useMemo(() => {
    // If in split mode and segments are available, use segment dates
    if (segmentsData?.isSplit && segmentsData.segments.length > 0) {
      const segment = segmentsData.segments.find(
        (s) => s.segment_number === currentSegment,
      );
      if (segment) {
        return {
          from: new Date(segment.start_date),
          to: new Date(segment.end_date),
        };
      }
    }
    return {
      from: currentWeekInfo.startDate,
      to: currentWeekInfo.endDate,
    };
  }, [currentWeekInfo, segmentsData, currentSegment]);

  // Handle segment change
  const handleSegmentChange = useCallback((segmentNumber: number) => {
    setCurrentSegment(segmentNumber);
  }, []);

  return {
    navigationState: {
      currentWeek,
      currentVersion: selectedVersion,
      dateRange,
      weekendStart: weekNavigationSettings.weekendStart,
      monthBoundaryMode: weekNavigationSettings.monthBoundaryMode,
      isLoading: isLoading || isSettingsLoading,
      hasVersions: false, // This would be determined by API query
    } as WeekNavigationState,
    settings: weekNavigationSettings,
    navigateToWeek,
    navigateNext,
    navigatePrevious,
    createVersionForWeek,
    currentWeekInfo,
    setSelectedVersion,
    // Segment management
    currentSegment,
    handleSegmentChange,
    weekSegments: segmentsData,
    // Backwards compatibility
    selectedVersion,
    versions: [], // Would be populated by API
    isError: false,
    isSettingsLoading,
  };
}
