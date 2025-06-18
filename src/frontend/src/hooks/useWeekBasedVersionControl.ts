/**
 * Week-based version control hook for the Schichtplan frontend.
 * 
 * This hook replaces useVersionControl with week-centric version management,
 * providing navigation, version creation, and state management for week-based schedules.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

import { 
  WeekNavigationState, 
  WeekVersionMeta, 
  VersionIdentifier,
  WeekendStart,
  MonthBoundaryMode 
} from '@/types/weekVersion';
import {
  getWeekFromIdentifier,
  getCurrentWeekIdentifier,
} from '@/utils/weekUtils';
import {
  getWeekInfo,
  getNextWeek as apiGetNextWeek,
  getPreviousWeek as apiGetPreviousWeek,
  createWeekVersion as apiCreateWeekVersion,
} from '@/services/api';

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
      const result = await apiCreateWeekVersion({
        week_identifier: weekIdentifier,
        create_empty_schedules: true
      });
      
      toast({
        title: "Version Created",
        description: `Created version ${result.version} for week ${weekIdentifier}`
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      queryClient.invalidateQueries({ queryKey: ['week-version', weekIdentifier] });
      queryClient.invalidateQueries({ queryKey: ['week-version'] }); // Invalidate all week version queries
      
      return result;
    } catch (error) {
      console.error('Week version creation error:', error);
      toast({
        title: "Creation Error", 
        description: `Failed to create version for week ${weekIdentifier}`,
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