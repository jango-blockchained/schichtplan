/**
 * Week-based version control hook for the Schichtplan frontend.
 * 
 * This hook replaces useVersionControl with week-centric version management,
 * providing navigation, version creation, and state management for week-based schedules.
 */

import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { DateRange } from 'react-day-picker';

import {
    createWeekVersion as apiCreateWeekVersion,
    getNextWeek as apiGetNextWeek,
    getPreviousWeek as apiGetPreviousWeek,
    getWeekInfo,
} from '@/services/api';
import {
    MonthBoundaryMode,
    VersionIdentifier,
    WeekendStart,
    WeekNavigationState
} from '@/types/weekVersion';
import {
    getCurrentWeekIdentifier,
    getWeekFromIdentifier,
} from '@/utils/weekUtils';

interface UseWeekBasedVersionControlProps {
  initialWeek?: string;
  onWeekChanged?: (weekIdentifier: string) => void;
  onVersionSelected?: (version: VersionIdentifier) => void;
  weekendStart?: WeekendStart;
  monthBoundaryMode?: MonthBoundaryMode;
}

export function useWeekBasedVersionControl({
  initialWeek,
  onWeekChanged,
  onVersionSelected, // TODO: Implement version selection functionality
  weekendStart = WeekendStart.MONDAY,
  monthBoundaryMode = MonthBoundaryMode.KEEP_INTACT
}: UseWeekBasedVersionControlProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize current week
  const [currentWeek, setCurrentWeek] = useState<string>(
    initialWeek || getCurrentWeekIdentifier()
  );
  
  const [selectedVersion, setSelectedVersion] = useState<VersionIdentifier | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const navigateToWeek = useCallback(async (weekIdentifier: string) => {
    try {
      setIsLoading(true);
      await getWeekInfo(weekIdentifier);
      setCurrentWeek(weekIdentifier);
      onWeekChanged?.(weekIdentifier);
    } catch (error) {
      console.error('Week navigation error:', error);
      toast({
        title: "Navigation Error",
        description: `Failed to navigate to week ${weekIdentifier}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [onWeekChanged, toast]);

  const navigateNext = useCallback(async () => {
    try {
      setIsLoading(true);
      const nextWeekInfo = await apiGetNextWeek(currentWeek);
      setCurrentWeek(nextWeekInfo.week_identifier);
      onWeekChanged?.(nextWeekInfo.week_identifier);
    } catch (error) {
      console.error('Next week navigation error:', error);
      toast({
        title: "Navigation Error",
        description: "Failed to navigate to next week",
        variant: "destructive"
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
      console.error('Previous week navigation error:', error);
      toast({
        title: "Navigation Error",
        description: "Failed to navigate to previous week",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentWeek, onWeekChanged, toast]);

  const createVersionForWeek = useCallback(async (weekIdentifier: string) => {
    try {
      setIsLoading(true);
      console.log('[DEBUG] Creating week version for:', weekIdentifier);
      const result = await apiCreateWeekVersion({
        week_identifier: weekIdentifier,
        create_empty_schedules: true
      });
      console.log('[DEBUG] Week version creation result:', result);
      toast({
        title: "Version Created",
        description: `Created version ${result.version} for week ${weekIdentifier}`
      });
      
      // Set the new version as selected and trigger callback
      if (result.version) {
        setSelectedVersion(result.version);
        if (onVersionSelected) {
          onVersionSelected(result.version);
        }
      }
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      queryClient.invalidateQueries({ queryKey: ['week-version', weekIdentifier] });
      queryClient.invalidateQueries({ queryKey: ['week-version'] }); // Invalidate all week version queries
      
      return result;
    } catch (error) {
      console.error('[DEBUG] Week version creation error for', weekIdentifier, error);
      toast({
        title: "Creation Error", 
        description: `Failed to create version for week ${weekIdentifier}: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [queryClient, toast]);

  // Calculate current date range
  const currentWeekInfo = getWeekFromIdentifier(currentWeek);
  const dateRange: DateRange = {
    from: currentWeekInfo.startDate,
    to: currentWeekInfo.endDate
  };

  return {
    navigationState: {
      currentWeek,
      currentVersion: selectedVersion,
      dateRange,
      weekendStart,
      monthBoundaryMode,
      isLoading,
      hasVersions: false // This would be determined by API query
    } as WeekNavigationState,
    navigateToWeek,
    navigateNext,
    navigatePrevious,
    createVersionForWeek,
    currentWeekInfo,
    setSelectedVersion,
    // Backwards compatibility
    selectedVersion,
    versions: [], // Would be populated by API
    isError: false
  };
}