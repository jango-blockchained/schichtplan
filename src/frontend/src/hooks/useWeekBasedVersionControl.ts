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
  getISOWeekInfo,
  getWeekFromIdentifier,
  getCurrentWeekIdentifier,
  getNextWeek,
  getPreviousWeek,
  dateRangeToWeekIdentifier
} from '@/utils/weekUtils';

interface UseWeekBasedVersionControlProps {
  initialWeek?: string;
  onWeekChanged?: (weekIdentifier: string) => void;
  onVersionSelected?: (version: VersionIdentifier) => void;
  weekendStart?: WeekendStart;
  monthBoundaryMode?: MonthBoundaryMode;
}

interface WeekNavigationAPI {
  getCurrentWeek: () => Promise<any>;
  getWeekInfo: (weekIdentifier: string) => Promise<any>;
  getNextWeek: (weekIdentifier: string) => Promise<any>;
  getPreviousWeek: (weekIdentifier: string) => Promise<any>;
  createWeekVersion: (data: any) => Promise<any>;
  getVersions: (params: any) => Promise<any>;
}// Mock API functions - these would be replaced with actual API calls
const weekNavigationAPI: WeekNavigationAPI = {
  getCurrentWeek: async () => {
    const currentWeek = getCurrentWeekIdentifier();
    const weekInfo = getWeekFromIdentifier(currentWeek);
    return {
      week_identifier: currentWeek,
      ...weekInfo,
      start_date: weekInfo.startDate.toISOString(),
      end_date: weekInfo.endDate.toISOString()
    };
  },
  
  getWeekInfo: async (weekIdentifier: string) => {
    const weekInfo = getWeekFromIdentifier(weekIdentifier);
    return {
      week_identifier: weekIdentifier,
      ...weekInfo,
      start_date: weekInfo.startDate.toISOString(),
      end_date: weekInfo.endDate.toISOString(),
      has_version: false
    };
  },
  
  getNextWeek: async (weekIdentifier: string) => {
    const nextWeek = getNextWeek(weekIdentifier);
    return weekNavigationAPI.getWeekInfo(nextWeek);
  },
  
  getPreviousWeek: async (weekIdentifier: string) => {
    const prevWeek = getPreviousWeek(weekIdentifier);
    return weekNavigationAPI.getWeekInfo(prevWeek);
  },
  
  createWeekVersion: async (data: any) => {
    return { version: 1, week_identifier: data.week_identifier };
  },
  
  getVersions: async (params: any) => {
    return { versions: [] };
  }
};

export function useWeekBasedVersionControl({
  initialWeek,
  onWeekChanged,
  onVersionSelected,
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
  const [isLoading, setIsLoading] = useState(false);  // Navigation functions
  const navigateToWeek = useCallback(async (weekIdentifier: string) => {
    try {
      setIsLoading(true);
      await weekNavigationAPI.getWeekInfo(weekIdentifier);
      setCurrentWeek(weekIdentifier);
      onWeekChanged?.(weekIdentifier);
    } catch (error) {
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
    const nextWeek = getNextWeek(currentWeek);
    await navigateToWeek(nextWeek);
  }, [currentWeek, navigateToWeek]);

  const navigatePrevious = useCallback(async () => {
    const prevWeek = getPreviousWeek(currentWeek);
    await navigateToWeek(prevWeek);
  }, [currentWeek, navigateToWeek]);

  const createVersionForWeek = useCallback(async (weekIdentifier: string) => {
    try {
      setIsLoading(true);
      const result = await weekNavigationAPI.createWeekVersion({
        week_identifier: weekIdentifier
      });
      
      toast({
        title: "Version Created",
        description: `Created version ${result.version} for week ${weekIdentifier}`
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      
      return result;
    } catch (error) {
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