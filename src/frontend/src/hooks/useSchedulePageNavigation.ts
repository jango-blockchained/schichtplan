/**
 * Custom hook for managing schedule page state
 * Consolidates week navigation, version management, and data fetching
 */

import type { VersionMeta, WeekSegmentsResponse } from '@/services/api';
import type { WeekInfo } from '@/types/weekVersion';
import { MonthBoundaryMode } from '@/types/weekVersion';
import { createDebugger } from '@/utils/debug';
import { useCallback, useMemo } from 'react';
import type { DateRange } from 'react-day-picker';
import { useVersionManager, type UseVersionManagerReturn } from './useVersionManager';
import { useWeekBasedVersionControl } from './useWeekBasedVersionControl';

const debug = createDebugger('useSchedulePageNavigation');

interface UseSchedulePageNavigationProps {
  initialWeek?: string;
  autoSelectLatestVersion?: boolean;
}

interface UseSchedulePageNavigationReturn {
  // Week navigation state
  currentWeek: string;
  dateRange: DateRange;
  currentWeekInfo: WeekInfo;
  
  // Navigation functions
  navigateToWeek: (weekIdentifier: string) => Promise<void>;
  navigateToPreviousWeek: () => Promise<void>;
  navigateToNextWeek: () => Promise<void>;
  
  // Segment management (for split mode)
  currentSegment: number;
  handleSegmentChange: (segmentNumber: number) => void;
  weekSegments: WeekSegmentsResponse | undefined;
  
  // Version management
  selectedVersion: number | undefined;
  versions: VersionMeta[];
  isLoadingVersions: boolean;
  versionActions: UseVersionManagerReturn['actions'];
  
  // Settings
  weekNavigationSettings: {
    weekendStart: number;
    monthBoundaryMode: string;
  };
  
  // Loading states
  isLoading: boolean;
  isSettingsLoading: boolean;
}

/**
 * Consolidated hook for schedule page navigation and version management
 * 
 * This hook combines:
 * - Week-based navigation (useWeekBasedVersionControl)
 * - Version management (useVersionManager)
 * - Automatic synchronization between week and version state
 * 
 * Replaces the complex manual state management in SchedulePage
 */
export function useSchedulePageNavigation({
  initialWeek,
  autoSelectLatestVersion = true,
}: UseSchedulePageNavigationProps = {}): UseSchedulePageNavigationReturn {
  
  // Use week-based navigation as the primary state manager
  const weekControl = useWeekBasedVersionControl({
    initialWeek,
    onWeekChanged: (weekIdentifier) => {
      debug.log('Week changed:', weekIdentifier);
    },
    onVersionSelected: (version) => {
      debug.log('Version selected:', version);
    },
  });

  // Extract week navigation state
  const {
    navigationState,
    settings: weekNavigationSettings,
    navigateToWeek,
    navigateNext,
    navigatePrevious,
    currentWeekInfo,
    currentSegment,
    handleSegmentChange,
    weekSegments,
    isSettingsLoading,
  } = weekControl;

  const { currentWeek, dateRange, isLoading } = navigationState;

  // Use version manager for version-specific operations
  const versionManager = useVersionManager({
    dateRange,
    autoSelectLatest: autoSelectLatestVersion,
  });

  const { state: versionState, actions: versionActions } = versionManager;

  // Filter versions to only those valid for current date range
  const validVersionsForCurrentRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return [];
    }

    const currentFrom = dateRange.from.toISOString().split('T')[0];
    const currentTo = dateRange.to.toISOString().split('T')[0];

    return versionState.versions.filter(version => {
      const versionStart = version.date_range.start;
      const versionEnd = version.date_range.end;
      return versionStart === currentFrom && versionEnd === currentTo;
    });
  }, [dateRange, versionState.versions]);

  // Only use selected version if it's valid for current date range
  const effectiveSelectedVersion = useMemo(() => {
    if (!versionState.selectedVersion) return undefined;
    
    const isValid = validVersionsForCurrentRange.some(
      v => v.version === versionState.selectedVersion
    );
    
    return isValid ? versionState.selectedVersion : undefined;
  }, [versionState.selectedVersion, validVersionsForCurrentRange]);

  // Wrap navigation functions to reset version selection
  const wrappedNavigateToWeek = useCallback(async (weekIdentifier: string) => {
    debug.log('Navigating to week:', weekIdentifier);
    await navigateToWeek(weekIdentifier);
    // Version manager will auto-handle selection for new date range
  }, [navigateToWeek]);

  const wrappedNavigatePrevious = useCallback(async () => {
    debug.log('Navigating to previous week');
    await navigatePrevious();
  }, [navigatePrevious]);

  const wrappedNavigateNext = useCallback(async () => {
    debug.log('Navigating to next week');
    await navigateNext();
  }, [navigateNext]);

  // Debug output
  debug.log('State:', {
    currentWeek,
    dateRange: dateRange ? {
      from: dateRange.from?.toISOString(),
      to: dateRange.to?.toISOString(),
    } : null,
    selectedVersion: effectiveSelectedVersion,
    availableVersions: validVersionsForCurrentRange.length,
    isLoading,
  });

  return {
    // Week navigation
    currentWeek,
    dateRange,
    currentWeekInfo,
    
    // Navigation functions
    navigateToWeek: wrappedNavigateToWeek,
    navigateToPreviousWeek: wrappedNavigatePrevious,
    navigateToNextWeek: wrappedNavigateNext,
    
    // Segment management
    currentSegment,
    handleSegmentChange,
    weekSegments,
    
    // Version management
    selectedVersion: effectiveSelectedVersion,
    versions: validVersionsForCurrentRange,
    isLoadingVersions: versionState.isLoading,
    versionActions,
    
    // Settings
    weekNavigationSettings: {
      weekendStart: weekNavigationSettings.weekendStart === 0 ? 0 : 1,
      monthBoundaryMode: weekNavigationSettings.monthBoundaryMode === MonthBoundaryMode.SPLIT_ON_MONTH
        ? 'split_by_month' 
        : 'keep_intact',
    },
    
    // Loading states
    isLoading: isLoading || versionState.isLoading,
    isSettingsLoading,
  };
}
