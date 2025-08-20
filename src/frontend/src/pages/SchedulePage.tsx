/* REFACTORING PLAN for SchedulePage.tsx
 *
 * Issues:
 * - File is too large (~1300 lines)
 * - Too many responsibilities
 * - Complex state management
 * - Unused/incomplete features
 *
 * Solution:
 * 1. Extract components:
 *    - GenerationOverlay → components/Schedule/GenerationOverlay.tsx
 *    - GenerationLogs → components/Schedule/GenerationLogs.tsx
 *    - ScheduleErrors → components/Schedule/ScheduleErrors.tsx
 *    - ScheduleControls → components/Schedule/ScheduleControls.tsx
 *
 * 2. Extract hooks:
 *    - useScheduleGeneration.ts (generation logic)
 *    - useVersionControl.ts (version management)
 *
 * 3. Clean up:
 *    - Remove isLayoutCustomizerOpen (unused)
 *    - Remove incomplete version notes editing
 *    - Remove unused isDuplicateVersionOpen dialog
 */

import React, { useCallback, useEffect, useMemo, useState } from "react"; // Added useCallback and useMemo
import { DateRange } from "react-day-picker";
// import { ShiftTable } from '@/components/ShiftTable'; // Original, might be unused if ScheduleManager is primary
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useScheduleData } from "@/hooks/useScheduleData";
import {
  createAvailability,
  createSchedule,
  exportSchedule,
  generateAiSchedule,
  getEmployees,
  getSettings,
  importAiScheduleResponse,
  previewAiData,
  updateSchedule,
  updateSettings
} from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  format
} from "date-fns";
import {
  AlertCircle,
  FileTextIcon,
  RefreshCw,
  Settings,
  Sliders,
  Wand2
} from "lucide-react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
// import { ScheduleTable } from '@/components/ScheduleTable'; // Original, might be unused
// import { ScheduleOverview } from '@/components/Schedule/ScheduleOverview'; // Original, might be unused
import type { CreateWeekVersionResponse } from "@/services/api";
import {
  AiImportResponse,
  ScheduleUpdate,
  Settings as SettingsType
} from "@/types"; // Renamed Settings to avoid conflict
import type { WeekVersionMeta } from "@/types/weekVersion";
// import { Checkbox } from '@/components/ui/checkbox'; // Original, might be unused
import { PageHeader } from "@/components/PageHeader";
// import { getAvailableCalendarWeeks, getDateRangeFromWeekAndCount } from '@/utils/dateUtils'; // Original, might be unused
// import { ScheduleVersions } from '@/components/Schedule/ScheduleVersions'; // Original, might be unused
// import { Badge } from '@/components/ui/badge'; // Original, might be unused
// import { VersionControl } from '@/components/VersionControl'; // Original, might be unused
// import { CollapsibleSection } from '@/components/CollapsibleSection'; // Original, might be unused
import { ScheduleGenerationSettings } from "@/components/ScheduleGenerationSettings";
// import type { ScheduleResponse } from '@/services/api'; // Original, might be unused
// import { type Schedule as APISchedule } from '@/services/api'; // Original, might be unused
// import { type UseScheduleDataResult } from '@/hooks/useScheduleData'; // Original, might be unused
// import { DateRangeSelector } from '@/components/DateRangeSelector'; // Original, might be unused
import GenerationLogs from "@/components/Schedule/GenerationLogs";
import GenerationOverlay from "@/components/Schedule/GenerationOverlay";
import { ScheduleActions } from "@/components/Schedule/ScheduleActions";
import ScheduleControls from "@/components/Schedule/ScheduleControls";
import ScheduleErrors from "@/components/Schedule/ScheduleErrors";
import useScheduleGeneration, { GenerationOptions } from "@/hooks/useScheduleGeneration";
import { useVersionManager } from "@/hooks/useVersionManager";
// import { ScheduleFixActions } from '@/components/Schedule/ScheduleFixActions'; // Original, might be unused

import AbsenceModal from "@/components/AbsenceModal";
import { EnhancedAvailabilityModal } from "@/components/EnhancedAvailabilityModal";
import { AddAvailabilityDialog } from "@/components/Schedule/AddAvailabilityDialog";
import { AddScheduleDialog } from "@/components/Schedule/AddScheduleDialog";
import { DiagnosticsDialog } from "@/components/Schedule/DiagnosticsDialog";
import { MEPTemplate } from "@/components/Schedule/MEPTemplate";
import { ScheduleStatisticsModal } from "@/components/Schedule/ScheduleStatisticsModal";

import { ActionDock } from "@/components/dock/ActionDock";
import { AIConversationGenerationDialog } from "@/components/Schedule/AIConversationGenerationDialog";
import { ClassicAIGenerationDialog } from "@/components/Schedule/ClassicAIGenerationDialog";
import { ScheduleManager } from "@/components/ScheduleManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VersionManager } from "@/components/VersionManager";
import { WeekNavigator } from "@/components/WeekNavigator";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";
import { MEPDataService } from "@/services/mepDataService";
import ReactDOM from "react-dom/client";

// Utility function to convert CreateWeekVersionResponse to WeekVersionMeta
function convertToWeekVersionMeta(versionResponse?: CreateWeekVersionResponse): WeekVersionMeta | undefined {
  if (!versionResponse) return undefined;

  return {
    version: versionResponse.version,
    weekIdentifier: versionResponse.week_identifier,
    dateRange: {
      start: versionResponse.date_range_start,
      end: versionResponse.date_range_end,
    },
    isWeekBased: versionResponse.is_week_based,
    status: versionResponse.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    createdAt: versionResponse.created_at,
    notes: versionResponse.notes,
  };
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return (error as Error).message;
  }
  return "Ein unerwarteter Fehler ist aufgetreten";
}

export function SchedulePage() {
  // 1. All useState calls
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(true);
  const [createEmptySchedules, setCreateEmptySchedules] = useState(true);
  const [isGenerationSettingsOpen, setIsGenerationSettingsOpen] = useState(false);
  const [isAddScheduleDialogOpen, setIsAddScheduleDialogOpen] = useState(false);
  const [isAddAvailabilityDialogOpen, setIsAddAvailabilityDialogOpen] = useState(false);
  const [isEnhancedAvailabilityModalOpen, setIsEnhancedAvailabilityModalOpen] = useState(false);
  const [selectedAvailabilityType, setSelectedAvailabilityType] = useState<"FIXED" | "PREFERRED">("FIXED");
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [selectedEmployeeForAbsence, setSelectedEmployeeForAbsence] = useState<number | null>(null);
  const [isStatisticsModalOpen, setIsStatisticsModalOpen] = useState(false);
  const [employeeAbsences, setEmployeeAbsences] = useState<Record<number, unknown[]>>({});
  const [enableDiagnostics, setEnableDiagnostics] = useState<boolean>(false);

  // Generation options state
  const [generationOptions, setGenerationOptions] = useState<GenerationOptions>({
    keepExistingAssignments: false,
    usePhase1FixedAssignments: true,
    usePhase2PreferredAvailability: true,
    usePhase3StandardGeneration: true,
  });

  // AI generation states
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [isAiFastGenerating, setIsAiFastGenerating] = useState<boolean>(false);
  const [isAiDetailedGenerating, setIsAiDetailedGenerating] = useState<boolean>(false);
  const [isDetailedAiModalOpen, setIsDetailedAiModalOpen] = useState<boolean>(false);
  const [aiDialogType, setAiDialogType] = useState<'classic' | 'modern'>('classic');
  const [isClassicAiModalOpen, setIsClassicAiModalOpen] = useState<boolean>(false);
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<{
    title: string;
    message: string;
    details?: string[];
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [isAiDataPreviewOpen, setIsAiDataPreviewOpen] = useState<boolean>(false);
  const [aiPreviewData, setAiPreviewData] = useState<{
    status: string;
    data_pack: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    optimized_data?: Record<string, unknown>;
    system_prompt?: string;
  } | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  // const [selectedAvailabilityType, setSelectedAvailabilityType] = useState<'FIXED' | 'PREFERRED' | 'UNAVAILABLE' | null>(null); // Removed - unused

  // 2. Other React hooks
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 3. React Query hooks (useQuery, useMutation)
  const settingsQuery = useQuery<SettingsType, Error>({
    queryKey: ["settings"] as const,
    queryFn: getSettings,
    retry: 3,
    staleTime: 5 * 60 * 1000,
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  // This fetches all settings, potentially useful for absence types in ScheduleManager
  const { data: settingsDataFromHook } = useQuery({
    queryKey: ["settings", "general"], // General key, or be specific if only parts are needed
    queryFn: getSettings,
  });
  const effectiveSettingsData = settingsDataFromHook || settingsQuery.data;

  // Extract openingDays from settings
  const openingDays = React.useMemo(() => {
    if (!effectiveSettingsData?.general?.opening_days) {
      return [];
    }
    // Assuming the structure is { "monday": true, "tuesday": true, ... }
    return Object.entries(effectiveSettingsData.general.opening_days)
      .filter(([, isOpen]) => isOpen) // Filter for days that are open
      .map(([dayName]) => {
        const lowerDayName = dayName.toLowerCase();
        switch (lowerDayName) {
          case 'monday': return 0; // Monday=0
          case 'tuesday': return 1;
          case 'wednesday': return 2;
          case 'thursday': return 3;
          case 'friday': return 4;
          case 'saturday': return 5;
          case 'sunday': return 6; // Sunday=6
          default: return -1; // Should not happen with valid data
        }
      })
      .filter(dayIndex => dayIndex !== -1) // Remove any invalid entries
      .sort((a, b) => a - b);
  }, [effectiveSettingsData]);

  // Week-based navigation is now the default and only navigation mode

  // Week-based navigation state for date range management
  const [currentWeek, setCurrentWeek] = useState(() => {
    // Get current week identifier (2025-W26 format)
    const today = new Date();
    const year = today.getFullYear();
    // Simple week calculation (ISO week would be more accurate)
    const startOfYear = new Date(year, 0, 1);
    const weekNumber = Math.ceil(((today.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  });

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    // Initialize with current week
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

    return {
      from: startOfWeek,
      to: endOfWeek
    };
  });

  // Use the new unified version manager hook
  const versionManager = useVersionManager({
    dateRange,
    onVersionSelected: (version) => {
      // Version selection is handled internally by the hook
      console.log("📅 SchedulePage: Version selected:", version);
    },
    autoSelectLatest: true,
  });

  // Extract state and actions from version manager
  const { state: versionState, actions: versionActions } = versionManager;
  const { selectedVersion, isLoading: isLoadingVersions } = versionState;

  // Helper function to filter versions by current date range
  const getVersionsForCurrentDateRange = useCallback(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return [];
    }

    const currentFrom = format(dateRange.from, 'yyyy-MM-dd');
    const currentTo = format(dateRange.to, 'yyyy-MM-dd');

    console.log("📅 Filtering versions - looking for date range:", currentFrom, "to", currentTo);

    const filteredVersions = versionState.versions.filter(version => {
      const versionStart = version.date_range.start;
      const versionEnd = version.date_range.end;

      // Strict date range matching - version must exactly match current date range
      const exactMatch = versionStart === currentFrom && versionEnd === currentTo;

      console.log(`📅 Version ${version.version}: ${versionStart} - ${versionEnd} ${exactMatch ? "✅ MATCH" : "❌ NO MATCH"}`);

      return exactMatch;
    });

    console.log("📅 Filtered versions:", filteredVersions.map(v => `v${v.version}`));
    return filteredVersions;
  }, [dateRange, versionState.versions]);

  // Filter to get only versions that are valid for current date range
  const validVersionsForCurrentRange = getVersionsForCurrentDateRange();

  // Only use selected version if it's actually valid for current date range
  const effectiveSelectedVersionNumber = selectedVersion &&
    validVersionsForCurrentRange.some(v => v.version === selectedVersion)
    ? selectedVersion
    : undefined;

  // Debug logging for version state
  console.log("📅 SchedulePage Debug:");
  console.log("📅 Current week:", currentWeek);
  console.log("📅 Date range:", dateRange?.from?.toDateString(), "to", dateRange?.to?.toDateString());
  console.log("📅 All versions:", versionState.versions.map(v => `v${v.version} (${v.date_range.start} - ${v.date_range.end})`));
  console.log("📅 Valid versions for current range:", validVersionsForCurrentRange.map(v => `v${v.version}`));
  console.log("📅 Selected version from manager:", selectedVersion);
  console.log("📅 Effective selected version:", effectiveSelectedVersionNumber);

  // Will compute effectiveDateRange after weekBasedVersionControl is defined
  const effectiveSelectedVersion = effectiveSelectedVersionNumber; // Compatibility alias

  // Helper function to get the number of weeks in a year (52 or 53)
  const getWeeksInYear = useCallback((year: number): number => {
    // January 4th is always in week 1
    const jan4 = new Date(year, 0, 4);
    // December 28th is always in the last week of the year
    const dec28 = new Date(year, 11, 28);

    // Calculate the ISO week number for December 28th
    const jan4WeekDay = jan4.getDay() || 7; // Convert Sunday (0) to 7
    const dec28DayOfYear = Math.floor((dec28.getTime() - new Date(year, 0, 1).getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const dec28WeekNumber = Math.floor((dec28DayOfYear - jan4WeekDay + 10) / 7);

    return dec28WeekNumber;
  }, []);

  // Helper function to update week and date range together
  const navigateToWeek = useCallback((weekIdentifier: string) => {
    setCurrentWeek(weekIdentifier);

    try {
      // Parse week identifier and update date range
      const [year, week] = weekIdentifier.split('-W');
      const yearNum = parseInt(year);
      const weekNum = parseInt(week);

      // Validate inputs
      if (isNaN(yearNum) || isNaN(weekNum) || weekNum < 1 || weekNum > 53) {
        console.warn('Invalid week identifier:', weekIdentifier);
        return;
      }

      // Calculate start of week using a more robust method
      // Get January 4th of the year (this is always in week 1)
      const jan4 = new Date(yearNum, 0, 4);
      const startOfWeek = new Date(jan4);

      // Calculate days from start of year to the target week
      const daysToAdd = (weekNum - 1) * 7 - jan4.getDay() + 1;
      startOfWeek.setDate(jan4.getDate() + daysToAdd);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      // Validate the calculated dates
      if (isNaN(startOfWeek.getTime()) || isNaN(endOfWeek.getTime())) {
        console.warn('Invalid dates calculated for week:', weekIdentifier);
        return;
      }

      setDateRange({
        from: startOfWeek,
        to: endOfWeek
      });
    } catch (error) {
      console.error('Error navigating to week:', weekIdentifier, error);
    }

    // Reset version selection when navigating to new week
    console.log("📅 Navigating to week:", weekIdentifier, "- resetting version selection");
    versionActions.resetVersionSelection();
  }, [versionActions]);

  // Week navigation functions
  const navigatePrevious = useCallback(() => {
    try {
      const [year, week] = currentWeek.split('-W');
      const yearNum = parseInt(year);
      const weekNum = parseInt(week);

      if (isNaN(yearNum) || isNaN(weekNum)) {
        console.warn('Invalid current week:', currentWeek);
        return;
      }

      let newWeek = weekNum - 1;
      let newYear = yearNum;

      if (newWeek < 1) {
        newYear = yearNum - 1;
        // Check if previous year has 53 weeks
        const lastWeekOfPrevYear = getWeeksInYear(newYear);
        newWeek = lastWeekOfPrevYear;
      }

      const newWeekIdentifier = `${newYear}-W${newWeek.toString().padStart(2, '0')}`;
      navigateToWeek(newWeekIdentifier);
    } catch (error) {
      console.error('Error navigating to previous week:', error);
    }
  }, [currentWeek, navigateToWeek, getWeeksInYear]);

  const navigateNext = useCallback(() => {
    try {
      const [year, week] = currentWeek.split('-W');
      const yearNum = parseInt(year);
      const weekNum = parseInt(week);

      if (isNaN(yearNum) || isNaN(weekNum)) {
        console.warn('Invalid current week:', currentWeek);
        return;
      }

      let newWeek = weekNum + 1;
      let newYear = yearNum;

      const weeksInCurrentYear = getWeeksInYear(yearNum);
      if (newWeek > weeksInCurrentYear) {
        newWeek = 1;
        newYear = yearNum + 1;
      }

      const newWeekIdentifier = `${newYear}-W${newWeek.toString().padStart(2, '0')}`;
      navigateToWeek(newWeekIdentifier);
    } catch (error) {
      console.error('Error navigating to next week:', error);
    }
  }, [currentWeek, navigateToWeek, getWeeksInYear]);

  // Note: Version validation is now handled entirely by useVersionManager hook to prevent infinite loops

  // Effective date range used throughout (segment changes update local dateRange)
  const effectiveDateRange = dateRange;
  // Ensure effectiveDateRange always has .from and .to as Date objects
  const safeEffectiveDateRange = {
    from: effectiveDateRange?.from && !isNaN(effectiveDateRange.from.getTime())
      ? new Date(effectiveDateRange.from)
      : new Date(),
    to: effectiveDateRange?.to && !isNaN(effectiveDateRange.to.getTime())
      ? new Date(effectiveDateRange.to)
      : new Date(),
  };

  // Create a compatibility object for components that expect the old week-based structure
  const weekBasedVersionControl = {
    navigationState: {
      currentWeek,
      dateRange,
      isLoading: isLoadingVersions,
      hasVersions: !isLoadingVersions && !versionState.isError && getVersionsForCurrentDateRange().length > 0,
    },
    currentWeekInfo: (() => {
      try {
        const [yearStr, weekStr] = currentWeek.split('-W');
        const year = parseInt(yearStr);
        const weekNumber = parseInt(weekStr);

        // Validate parsed values
        if (isNaN(year) || isNaN(weekNumber)) {
          console.warn('Invalid week identifier for currentWeekInfo:', currentWeek);
          // Fallback to current date info
          const now = new Date();
          const fallbackYear = now.getFullYear();
          const fallbackWeek = Math.ceil((now.getDate() + 6 - now.getDay()) / 7);
          return {
            year: fallbackYear,
            weekNumber: fallbackWeek,
            startDate: safeEffectiveDateRange.from,
            endDate: safeEffectiveDateRange.to,
            spansMonths: safeEffectiveDateRange.from.getMonth() !== safeEffectiveDateRange.to.getMonth(),
            months: [format(safeEffectiveDateRange.from, 'MMMM')]
          };
        }

        return {
          year,
          weekNumber,
          startDate: safeEffectiveDateRange.from,
          endDate: safeEffectiveDateRange.to,
          spansMonths: safeEffectiveDateRange.from.getMonth() !== safeEffectiveDateRange.to.getMonth(),
          months: [
            format(safeEffectiveDateRange.from, 'MMMM'),
            ...(safeEffectiveDateRange.from.getMonth() !== safeEffectiveDateRange.to.getMonth()
              ? [format(safeEffectiveDateRange.to, 'MMMM')]
              : [])
          ]
        };
      } catch (error) {
        console.error('Error constructing currentWeekInfo:', error);
        // Fallback to current date info
        const now = new Date();
        return {
          year: now.getFullYear(),
          weekNumber: Math.ceil((now.getDate() + 6 - now.getDay()) / 7),
          startDate: safeEffectiveDateRange.from,
          endDate: safeEffectiveDateRange.to,
          spansMonths: false,
          months: [format(safeEffectiveDateRange.from, 'MMMM')]
        };
      }
    })(),
    selectedVersion,
    navigatePrevious,
    navigateNext,
    setSelectedVersion: versionActions.selectVersion,
    settings: {
      weekendStart: effectiveSettingsData?.week_navigation?.week_weekend_start === 'SUNDAY' ? 0 : 1,
      monthBoundaryMode: effectiveSettingsData?.week_navigation?.week_month_boundary_mode || 'keep_intact',
    },
    createVersionForWeek: () => {
      if (!dateRange?.from || !dateRange?.to || isNaN(dateRange.from.getTime()) || isNaN(dateRange.to.getTime())) {
        return Promise.reject("Invalid date range");
      }

      return versionActions.createVersion({
        startDate: format(dateRange.from, "yyyy-MM-dd"),
        endDate: format(dateRange.to, "yyyy-MM-dd"),
      });
    },
  };

  // Custom Hook for Schedule Data Fetching
  const {
    scheduleData,
    errors: scheduleErrorsData,
    loading: isLoadingSchedule,
    error: scheduleErrorObj, // Renamed to avoid conflict with `errors` const
    refetch: refetchScheduleData,
  } = useScheduleData(
    safeEffectiveDateRange.from,
    safeEffectiveDateRange.to,
    effectiveSelectedVersionNumber, // Use the numeric version for API compatibility
    includeEmpty,
  );

  // Calculate the month range for fetching monthly published schedules
  const monthRange = useMemo(() => {
    const from = safeEffectiveDateRange.from;
    const startOfMonth = new Date(from.getFullYear(), from.getMonth(), 1);
    const endOfMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    return { from: startOfMonth, to: endOfMonth };
  }, [safeEffectiveDateRange.from]);

  // Fetch published schedules for the entire month
  const { data: monthlyScheduleResponse } = useQuery({
    queryKey: [
      "monthlyPublishedSchedules",
      format(monthRange.from, "yyyy-MM-dd"),
      format(monthRange.to, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      // Fetch all schedules for the month (no version filter)
      const response = await getSchedules(
        format(monthRange.from, "yyyy-MM-dd"),
        format(monthRange.to, "yyyy-MM-dd"),
        undefined, // No version filter - get all versions
        false // Don't include empty schedules
      );
      return response;
    },
    enabled: !!monthRange.from && !!monthRange.to,
  });

  // Filter monthly schedules to only include published versions
  const monthlyPublishedSchedules = useMemo(() => {
    if (!monthlyScheduleResponse) return undefined;

    // Get all published versions from the version metadata
    const publishedVersions = new Set<number>();
    if (monthlyScheduleResponse.version_statuses) {
      Object.entries(monthlyScheduleResponse.version_statuses).forEach(([version, status]) => {
        if (status === "PUBLISHED") {
          publishedVersions.add(parseInt(version));
        }
      });
    }

    // Filter schedules to only include those from published versions
    return monthlyScheduleResponse.schedules.filter(
      schedule => publishedVersions.has(schedule.version)
    );
  }, [monthlyScheduleResponse]);

  // Custom Hook for Schedule Generation Logic
  const {
    generateSchedule,
    isGenerating,
    generationSteps,
    generationLogs,
    showGenerationOverlay,
    lastSessionId,
    resetGenerationState,
    updateGenerationStep,
    addGenerationLog,
    clearGenerationLogs,
  } = useScheduleGeneration({
    dateRange: effectiveDateRange,
    selectedVersion: effectiveSelectedVersionNumber,
    createEmptySchedules,
    enableDiagnostics,
    generationOptions,
    onSuccess: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      queryClient.invalidateQueries({ queryKey: ["week-version"] });
    }, [queryClient]),
  });

  // Mutations
  const exportMutation = useMutation<Blob, Error, { format: 'standard' | 'mep' | 'mep-html', filiale?: string }>({
    mutationFn: async ({ format: exportFormat, filiale }) => {
      if (!effectiveDateRange?.from || !effectiveDateRange?.to) {
        throw new Error("Bitte wählen Sie einen Zeitraum aus");
      }
      const exportType = exportFormat === 'mep' ? 'MEP' : 'Standard';
      addGenerationLog("info", `Starting ${exportType} PDF export`);

      const response = await exportSchedule(
        format(safeEffectiveDateRange.from, "yyyy-MM-dd"),
        format(safeEffectiveDateRange.to, "yyyy-MM-dd"),
        undefined, // layoutConfig
        exportFormat,
        filiale
      );

      addGenerationLog("info", `${exportType} PDF export completed`);
      const blob = new Blob([response], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Generate appropriate filename based on format
      const prefix = exportFormat === 'mep' ? 'MEP' : 'Schichtplan';
      const dateStr = `${format(safeEffectiveDateRange.from, "yyyy-MM-dd")}_${format(safeEffectiveDateRange.to, "yyyy-MM-dd")}`;
      a.download = `${prefix}_${dateStr}.pdf`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return blob; // Return blob on success
    },
    onError: (error) => {
      addGenerationLog("error", "PDF export failed", getErrorMessage(error));
      toast({
        title: "Fehler beim Export",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const importAiResponseMutation = useMutation<AiImportResponse, Error, FormData>({
    mutationFn: importAiScheduleResponse,
    onMutate: () => {
      toast({
        title: "Import wird verarbeitet",
        description: "Die KI-Antwort wird importiert...",
        variant: "default",
      });
    },
    onSuccess: (data) => {
      // Batch the query invalidations to reduce rapid updates
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
        queryClient.invalidateQueries({ queryKey: ['versions'] });
      }, 100);

      toast({
        title: "Import erfolgreich",
        description: data.message || `Es wurden ${data.imported_count} Zuweisungen importiert.`, // Use message from backend if available
        variant: "default", // Changed to default
      });
    },
    onError: (error) => {
      toast({
        title: "Import fehlgeschlagen",
        description: `Fehler: ${getErrorMessage(error)}`,
        variant: "destructive",
      });
    },
  });

  // 5. Helper constants derived from hook results
  const errors = scheduleErrorsData || [];

  // 6. Event Handlers and other functions (wrapped in useCallback)
  const handleImportAiResponse = useCallback(() => {
    if (!effectiveSelectedVersionNumber || !effectiveDateRange?.from || !effectiveDateRange?.to) {
      toast({
        title: "Import nicht möglich",
        description: "Bitte Zeitraum und Version wählen.",
        variant: "destructive",
      });
      return;
    }

    // Create a file input element programmatically
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    fileInput.style.display = 'none'; // Hide the input
    document.body.appendChild(fileInput); // Append to body temporarily

    fileInput.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const file = files[0];

        const formData = new FormData();
        formData.append('file', file);
        formData.append('version_id', effectiveSelectedVersionNumber?.toString() || '1');
        formData.append('start_date', format(effectiveDateRange!.from!, 'yyyy-MM-dd'));
        formData.append('end_date', format(effectiveDateRange!.to!, 'yyyy-MM-dd'));

        // Use a mutation hook for the import process
        importAiResponseMutation.mutate(formData);
      }

      // Clean up the file input element
      document.body.removeChild(fileInput);
    };

    // Trigger the file picker
    fileInput.click();
  }, [effectiveSelectedVersionNumber, effectiveDateRange, toast, importAiResponseMutation]);

  const handleRetryFetch = useCallback(() => {
    clearGenerationLogs();
    // Use query invalidation instead of manual refetch to prevent loops
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
  }, [clearGenerationLogs, queryClient]); // Removed refetchScheduleData dependency

  const handleHTMLMEPExport = useCallback((filiale: string) => {
    if (!effectiveDateRange?.from || !effectiveDateRange?.to || !scheduleData || !employees) {
      toast({
        title: "Export nicht möglich",
        description: "Bitte stellen Sie sicher, dass Zeitraum und Daten geladen sind.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Process the data for MEP template
      const mepData = MEPDataService.processSchedulesForMEP(
        scheduleData,
        employees,
        effectiveDateRange!.from!,
        effectiveDateRange!.to!,
        filiale
      );

      // Create a new window/tab for the MEP template
      const newWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!newWindow) {
        throw new Error('Popup blockiert. Bitte erlauben Sie Popups für diese Seite.');
      }

      // Write the HTML structure
      newWindow.document.write(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MEP - ${mepData.filiale} - ${mepData.dateInfo.weekFrom} bis ${mepData.dateInfo.weekTo}</title>
          <style>
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            #mep-root { width: 100%; height: 100vh; }
          </style>
        </head>
        <body>
          <div id="mep-root"></div>
        </body>
        </html>
      `);
      newWindow.document.close();

      // Inline the CSS content directly instead of fetching
      const addInlineCSS = () => {
        const style = newWindow.document.createElement('style');
        style.textContent = `
          /* MEP Template Styles - Landscape Format */
          .mep-container {
            width: 100%;
            background: white;
          }

          /* Print Button - Hidden when printing */
          .print-button-container {
            text-align: center;
            padding: 20px;
            background: #f5f5f5;
            border-bottom: 1px solid #ddd;
          }

          .print-button {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.2s;
          }

          .print-button:hover {
            background: #0056b3;
          }

          /* MEP Document Container */
          .mep-document {
            width: 297mm; /* A4 Landscape width */
            height: 210mm; /* A4 Landscape height */
            margin: 0 auto;
            padding: 15mm;
            box-sizing: border-box;
            font-family: Arial, sans-serif;
            font-size: 10px;
            line-height: 1.2;
            background: white;
            border: 1px solid #ddd;
          }

          /* Header Section */
          .mep-header {
            margin-bottom: 8mm;
          }

          .mep-title {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            border: 2px solid black;
            padding: 6px;
            margin-bottom: 6px;
            background: white;
          }

          .mep-info-row {
            display: flex;
            gap: 8px;
            font-size: 9px;
            margin-bottom: 6px;
          }

          .info-item {
            flex: 1;
            white-space: nowrap;
          }

          /* Main Table */
          .mep-table {
            width: 100%;
            border: 1px solid black;
            font-size: 8px;
          }

          /* Table Header */
          .table-header {
            display: flex;
            background: #f0f0f0;
            border-bottom: 1px solid black;
            font-weight: bold;
            text-align: center;
          }

          .col-employee {
            width: 40mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 20px;
          }

          .col-function {
            width: 25mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .col-plan {
            width: 20mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .col-time-type {
            width: 20mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: yellow; /* Visual indicator for new layout */
            font-weight: bold;
          }

          .col-day-single {
            width: 20mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .col-weekly {
            width: 20mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .col-monthly {
            width: 20mm;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          /* Employee Rows */
          .employee-group {
            border-bottom: 1px solid black;
          }

          .employee-row {
            display: flex;
            border-bottom: 1px solid #ddd;
            min-height: 18px;
          }

          .employee-row:last-child {
            border-bottom: 1px solid black;
          }

          /* Time labels */
          .col-time-label {
            width: 20mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            background: #f8f8f8;
          }

          /* Day time cells */
          .col-day-time {
            width: 20mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          /* Employee info cells that span multiple rows */
          .employee-name-cell {
            width: 40mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-weight: bold;
            background: #f8f8f8;
          }

          .employee-function-cell {
            width: 25mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: #f8f8f8;
          }

          .employee-plan-cell {
            width: 20mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: #f8f8f8;
          }

          .employee-weekly-cell {
            width: 20mm;
            border-right: 1px solid black;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: #f8f8f8;
            font-weight: bold;
          }

          .employee-monthly-cell {
            width: 20mm;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: #f8f8f8;
            font-weight: bold;
          }

          /* Spanning cells for rows that don't show employee info */
          .col-employee-span, .col-function-span, .col-plan-span, .col-weekly-span, .col-monthly-span {
            border-right: 1px solid black;
            padding: 2px;
          }

          .col-employee-span {
            width: 40mm;
          }

          .col-function-span {
            width: 25mm;
          }

          .col-plan-span {
            width: 20mm;
          }

          .col-weekly-span {
            width: 20mm;
          }

          .col-monthly-span {
            width: 20mm;
          }

          /* Empty rows */
          .empty-row {
            min-height: 18px;
          }

          /* Footer */
          .mep-footer {
            margin-top: 8mm;
            font-size: 8px;
            line-height: 1.3;
          }

          .footer-line {
            margin-bottom: 2px;
          }

          .footer-date {
            margin-top: 4mm;
            text-align: right;
            font-style: italic;
          }

          /* Print styles */
          @media print {
            .no-print {
              display: none !important;
            }

            .mep-document {
              border: none;
              margin: 0;
              padding: 15mm;
            }

            body {
              margin: 0;
              padding: 0;
            }
          }

          @page {
            size: A4 landscape;
            margin: 0;
          }
        `;
        newWindow.document.head.appendChild(style);

        // Now render the MEP component
        renderMEPComponent();
      };

      const renderMEPComponent = () => {
        // Handle new version creation
        const handleCreateNewVersion = (weekNumber: number, versionNumber: number) => {
          // Close the MEP window
          newWindow.close();

          // Create new version with specified week and version number
          toast({
            title: "Neue Version erstellt",
            description: `Version ${versionNumber} für Woche ${weekNumber} wurde erstellt.`,
          });

          // Here you can add logic to actually create the new version
          // For example, navigate to the new week/version or update the state
          console.log(`Creating new version: Week ${weekNumber}, Version ${versionNumber}`);
        };

        // Create React element
        const mepElement = React.createElement(MEPTemplate, {
          data: mepData,
          onPrint: () => newWindow.print(),
          onCreateNewVersion: handleCreateNewVersion
        });

        // Render it in the new window
        const root = ReactDOM.createRoot(newWindow.document.getElementById('mep-root')!);
        root.render(mepElement);
      };

      // Load CSS and render
      addInlineCSS();

      addGenerationLog("info", "MEP Template in neuem Fenster geöffnet");
      toast({
        title: "MEP Export erfolgreich",
        description: "Das MEP-Template wurde in einem neuen Fenster geöffnet. Verwenden Sie Strg+P zum Drucken.",
      });

    } catch (error) {
      addGenerationLog("error", "HTML MEP export failed", getErrorMessage(error));
      toast({
        title: "Fehler beim MEP Export",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  }, [effectiveDateRange, scheduleData, employees, addGenerationLog, toast]);

  const handleExportSchedule = useCallback(async (format: 'standard' | 'mep' | 'mep-html', filiale?: string) => {
    if (format === 'mep-html') {
      // Handle HTML MEP export differently - open in new tab
      handleHTMLMEPExport(filiale || '');
    } else {
      exportMutation.mutate({ format, filiale });
    }
  }, [exportMutation, handleHTMLMEPExport]);

  const handlePreviewAiData = useCallback(async () => {
    if (!effectiveDateRange?.from || !effectiveDateRange?.to) {
      toast({
        title: "Vorschau nicht möglich",
        description: "Bitte Zeitraum wählen.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Lade KI-Daten...",
        description: "Die optimierten KI-Daten werden abgerufen.",
      });

      const fromStr = format(effectiveDateRange.from, "yyyy-MM-dd");
      const toStr = format(effectiveDateRange.to, "yyyy-MM-dd");

      const aiDataPreview = await previewAiData(fromStr, toStr);

      setAiPreviewData(aiDataPreview);
      setIsAiDataPreviewOpen(true);

      toast({
        title: "KI-Daten geladen",
        description: "Datenvorschau erfolgreich geladen",
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Fehler beim Laden der KI-Daten",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [effectiveDateRange, toast]);

  // Removed checkAndFixMissingTimeData function - automatic schedule repair is no longer needed
  // Manual repair is still available via the "Fix Display" button in ScheduleActions

  // Page-level handler for creating a new version
  const handleCreateNewVersionPage = useCallback(() => {
    if (!effectiveDateRange?.from || !effectiveDateRange?.to) {
      toast({
        title: "Fehler",
        description: "Ungültiger Datumsbereich",
        variant: "destructive",
      });
      return;
    }

    versionActions.createVersion({
      startDate: format(effectiveDateRange.from, "yyyy-MM-dd"),
      endDate: format(effectiveDateRange.to, "yyyy-MM-dd"),
    });
  }, [effectiveDateRange, versionActions, toast]);

  // 7. All useEffect hooks
  useEffect(() => {
    if (scheduleErrorObj) {
      addGenerationLog(
        "error",
        "Error fetching schedule data",
        getErrorMessage(scheduleErrorObj),
      );
    }
  }, [scheduleErrorObj, addGenerationLog]);

  useEffect(() => {
    if (settingsQuery.data?.scheduling?.enable_diagnostics !== undefined) {
      setEnableDiagnostics(settingsQuery.data.scheduling.enable_diagnostics);
    }
  }, [settingsQuery.data, setEnableDiagnostics]);

  // Remove manual date range management - now handled by week-based version control

  useEffect(() => {
    // This effect handles version changes but avoids infinite loops
    // by using query invalidation instead of manual refetch
    const timeoutId = setTimeout(() => {
      if (effectiveSelectedVersionNumber !== undefined) {
        // Use query invalidation instead of manual refetch to prevent loops
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
      }
    }, 200); // Debounce by 200ms

    return () => clearTimeout(timeoutId);
  }, [effectiveSelectedVersionNumber, queryClient]);

  // Extract date range values for stable comparison
  // const effectiveDateFromTime = effectiveDateRange?.from?.getTime(); // Unused
  // const effectiveDateToTime = effectiveDateRange?.to?.getTime(); // Unused

  // Remove legacy version sync useEffect - now handled by week-based version control
  // Week-based version control manages date ranges automatically

  // Removed automatic schedule repair useEffect - it was causing unnecessary background processing
  // The checkAndFixMissingTimeData function is still available for manual use if needed

  const { data: absenceData } = useQuery({
    queryKey: ["absences"] as const, // Simplified query key
    queryFn: async () => {
      // The backend currently only supports fetching absences for a specific employee,
      // not by date range across all employees.
      // To avoid a 404, we will not call getAbsences with the date range.
      // A future task is needed to implement a backend route for fetching absences by date range.
      return {}; // Return empty object or appropriate default
    },
    // Removed dependency on dateRange for enabling the query to prevent incorrect calls
    // The display logic in ScheduleTable will handle the absence data it receives (or doesn't receive)
    enabled: true, // Always enable the query, but the queryFn will return empty/warn
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  useEffect(() => {
    if (absenceData) {
      setEmployeeAbsences(absenceData);
    }
  }, [absenceData]);

  // Define handlers that might depend on the fully initialized state and hooks

  // Define other handlers that might depend on the fully initialized state and hooks
  const handleGenerateStandardSchedule = async () => {
    if (!effectiveDateRange?.from || !effectiveDateRange?.to) {
      toast({
        title: "Zeitraum erforderlich",
        description: "Bitte wählen Sie einen Zeitraum aus.",
        variant: "destructive",
      });
      return;
    }

    let versionNumber = effectiveSelectedVersionNumber;

    if (!versionNumber) {
      // Auto-create a version for the current week
      try {
        console.log("Auto-creating version for current week:", weekBasedVersionControl.navigationState.currentWeek);
        const result = await weekBasedVersionControl.createVersionForWeek(weekBasedVersionControl.navigationState.currentWeek);
        versionNumber = result.version;

        toast({
          title: "Version erstellt",
          description: "Eine neue Version wurde automatisch erstellt.",
        });
      } catch {
        toast({
          title: "Fehler beim Erstellen der Version",
          description: "Die Version konnte nicht automatisch erstellt werden.",
          variant: "destructive",
        });
        return;
      }
    }

    const formattedFromDate = format(effectiveDateRange!.from!, "yyyy-MM-dd");
    const formattedToDate = format(effectiveDateRange!.to!, "yyyy-MM-dd");

    addGenerationLog(
      "info",
      "Starting phased schedule generation",
      `Version: ${versionNumber}, Date range: ${formattedFromDate} - ${formattedToDate}, Options: ${JSON.stringify(generationOptions)}`,
    );

    try {
      await generateSchedule();

      toast({
        title: "Generierung erfolgreich",
        description: "Mehrstufige Schichtplan-Generierung abgeschlossen.",
      });
    } catch (error) {
      toast({
        title: "Generierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
      });
    }
  };

  // Unused function - replaced by handleGenerateAiFastSchedule and handleGenerateAiDetailedSchedule
  /* 
  const handleGenerateAiSchedule = async () => {
    if (!effectiveDateRange?.from || !effectiveDateRange?.to) {
      toast({
        title: "Zeitraum erforderlich (AI)",
        description: "Bitte Zeitraum für AI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }
    if (!effectiveSelectedVersionNumber) {
      toast({
        title: "Version erforderlich (AI)",
        description: "Bitte Version für AI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }
    setIsAiGenerating(true);
    clearGenerationLogs();
    const aiSteps = [
      {
        id: "ai-init",
        title: "Initialisiere KI-Generierung",
        status: "pending" as const,
      },
      {
        id: "ai-analyze",
        title: "Analysiere Verfügbarkeiten",
        status: "pending" as const,
      },
      {
        id: "ai-generate",
        title: "Erstelle Schichtplan",
        status: "pending" as const,
      },
      {
        id: "ai-finalize",
        title: "Finalisiere KI-Schichtplan",
        status: "pending" as const,
      },
    ];
    setGenerationSteps(aiSteps);
    setShowGenerationOverlay(true);
    addGenerationLog(
      "info",
      "Starting AI schedule generation",
      `Version: ${effectiveSelectedVersionNumber}, Date range: ${format(effectiveDateRange!.from!, "yyyy-MM-dd")} - ${format(effectiveDateRange!.to!, "yyyy-MM-dd")}`,
    );
    try {
      updateGenerationStep("ai-init", "in-progress");
      await new Promise((r) => setTimeout(r, 200)); // Reduced delay
      const fromStr = format(effectiveDateRange!.from!, "yyyy-MM-dd");
      const toStr = format(effectiveDateRange!.to!, "yyyy-MM-dd");
      updateGenerationStep("ai-init", "completed");
      updateGenerationStep("ai-analyze", "in-progress");
      await new Promise((r) => setTimeout(r, 200)); // Reduced delay
      const result = await generateAiSchedule(
        fromStr,
        toStr,
        effectiveSelectedVersionNumber,
      );
      updateGenerationStep("ai-analyze", "completed");
      updateGenerationStep("ai-generate", "in-progress");
      await new Promise((r) => setTimeout(r, 200)); // Reduced delay
      addGenerationLog("info", "AI schedule generation API call successful");
      if (result.generated_assignments_count)
        addGenerationLog(
          "info",
          `Generated ${result.generated_assignments_count} schedule entries`,
        );
      updateGenerationStep("ai-generate", "completed");
      updateGenerationStep("ai-finalize", "in-progress");
      await new Promise((r) => setTimeout(r, 200)); // Reduced delay
      
      // Batch the query invalidations to reduce rapid updates
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
        queryClient.invalidateQueries({ queryKey: ["versions"] });
      }, 100);
      
      updateGenerationStep("ai-finalize", "completed");
      toast({
        title: "AI Generation Complete",
        description: "AI schedule generated successfully.",
      });
      // Log diagnostic information if available
      if (result.diagnostic_log) {
        addGenerationLog("info", "Diagnostic log available:", result.diagnostic_log);
      }
      setTimeout(() => setIsAiGenerating(false), 1000); // Reduced delay
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      addGenerationLog("error", "AI Generation Error", errorMessage);
      aiSteps.forEach((step) =>
        updateGenerationStep(step.id, "error", "Generation failed"),
      );
      toast({
        title: "AI Generation Error",
        description: errorMessage,
        variant: "destructive",
      });
      setTimeout(() => setIsAiGenerating(false), 1500); // Reduced delay
    }
  };
  */

  const handleGenerateAiFastSchedule = async () => {
    if (!effectiveDateRange?.from || !effectiveDateRange?.to) {
      toast({
        title: "Zeitraum erforderlich (Schnelle KI)",
        description: "Bitte Zeitraum für schnelle KI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }

    let versionNumber = effectiveSelectedVersionNumber;

    if (!versionNumber) {
      // Auto-create a version for the current week
      try {
        console.log("Auto-creating version for current week:", weekBasedVersionControl.navigationState.currentWeek);
        const result = await weekBasedVersionControl.createVersionForWeek(weekBasedVersionControl.navigationState.currentWeek);
        versionNumber = result.version;

        toast({
          title: "Version erstellt",
          description: "Eine neue Version wurde automatisch erstellt.",
        });
      } catch {
        toast({
          title: "Fehler beim Erstellen der Version",
          description: "Die Version konnte nicht automatisch erstellt werden.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsAiFastGenerating(true);
    clearGenerationLogs();
    const aiSteps = [
      {
        id: "ai-fast-init",
        title: "Initialisiere schnelle KI-Generierung",
        status: "pending" as const,
      },
      {
        id: "ai-fast-analyze",
        title: "Schnelle Analyse der Verfügbarkeiten",
        status: "pending" as const,
      },
      {
        id: "ai-fast-generate",
        title: "Erstelle Schichtplan (schnell)",
        status: "pending" as const,
      },
      {
        id: "ai-fast-finalize",
        title: "Finalisiere schnellen Schichtplan",
        status: "pending" as const,
      },
    ];
    setGenerationSteps(aiSteps);
    setShowGenerationOverlay(true);
    addGenerationLog(
      "info",
      "Starting fast AI schedule generation",
      `Version: ${versionNumber}, Date range: ${format(effectiveDateRange!.from!, "yyyy-MM-dd")} - ${format(effectiveDateRange!.to!, "yyyy-MM-dd")}`,
    );
    try {
      updateGenerationStep("ai-fast-init", "in-progress");
      await new Promise((r) => setTimeout(r, 300));
      const fromStr = format(effectiveDateRange!.from!, "yyyy-MM-dd");
      const toStr = format(effectiveDateRange!.to!, "yyyy-MM-dd");
      updateGenerationStep("ai-fast-init", "completed");
      updateGenerationStep("ai-fast-analyze", "in-progress");
      await new Promise((r) => setTimeout(r, 300));
      const result = await generateAiSchedule(
        fromStr,
        toStr,
        versionNumber,
      );
      updateGenerationStep("ai-fast-analyze", "completed");
      updateGenerationStep("ai-fast-generate", "in-progress");
      await new Promise((r) => setTimeout(r, 300));
      addGenerationLog("info", "Fast AI schedule generation API call successful");
      if (result.generated_assignments_count)
        addGenerationLog(
          "info",
          `Generated ${result.generated_assignments_count} schedule entries`,
        );
      updateGenerationStep("ai-fast-generate", "completed");
      updateGenerationStep("ai-fast-finalize", "in-progress");
      await new Promise((r) => setTimeout(r, 300));
      await refetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      updateGenerationStep("ai-fast-finalize", "completed");
      toast({
        title: "Schnelle KI-Generierung abgeschlossen",
        description: "Schichtplan wurde schnell generiert.",
      });
      if (result.diagnostic_log) {
        addGenerationLog("info", "Diagnostic log available:", result.diagnostic_log);
      }
      setTimeout(() => setIsAiFastGenerating(false), 2000);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      addGenerationLog("error", "Fast AI Generation Error", errorMessage);
      aiSteps.forEach((step) =>
        updateGenerationStep(step.id, "error", "Generation failed"),
      );
      toast({
        title: "Schnelle KI-Generierung fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      });
      setTimeout(() => setIsAiFastGenerating(false), 3000);
    }
  };

  const handleGenerateAiDetailedSchedule = async () => {
    if (!effectiveDateRange?.from || !effectiveDateRange?.to) {
      toast({
        title: "Zeitraum erforderlich (Erweiterte KI)",
        description: "Bitte Zeitraum für erweiterte KI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }

    let versionNumber = effectiveSelectedVersionNumber;

    if (!versionNumber) {
      // Auto-create a version for the current week
      try {
        console.log("Auto-creating version for current week:", weekBasedVersionControl.navigationState.currentWeek);
        const result = await weekBasedVersionControl.createVersionForWeek(weekBasedVersionControl.navigationState.currentWeek);
        versionNumber = result.version;

        toast({
          title: "Version erstellt",
          description: "Eine neue Version wurde automatisch erstellt.",
        });

        // Force a state update to ensure the version number is available
        await versionActions.refresh();
      } catch {
        toast({
          title: "Fehler beim Erstellen der Version",
          description: "Die Version konnte nicht automatisch erstellt werden.",
          variant: "destructive",
        });
        return;
      }
    }

    // Open the appropriate AI dialog based on user preference
    if (aiDialogType === 'classic') {
      setIsClassicAiModalOpen(true);
    } else {
      setIsDetailedAiModalOpen(true);
    }
  };

  // No longer needed - the AIConversationGenerationDialog handles the entire flow internally

  const handleAddSchedule = async () => {
    if (!effectiveSelectedVersion) {
      // Auto-create a version for the current week
      try {
        console.log("Auto-creating version for current week:", weekBasedVersionControl.navigationState.currentWeek);
        await weekBasedVersionControl.createVersionForWeek(weekBasedVersionControl.navigationState.currentWeek);
        toast({
          title: "Version erstellt",
          description: "Eine neue Version wurde automatisch erstellt.",
        });
      } catch {
        toast({
          title: "Fehler beim Erstellen der Version",
          description: "Die Version konnte nicht automatisch erstellt werden.",
          variant: "destructive",
        });
        return;
      }
    }
    setIsAddScheduleDialogOpen(true);
  };

  // Availability handlers
  const handleAddFixed = () => {
    setSelectedAvailabilityType("FIXED");
    setIsEnhancedAvailabilityModalOpen(true);
  };

  const handleAddPreferred = () => {
    setSelectedAvailabilityType("PREFERRED");
    setIsEnhancedAvailabilityModalOpen(true);
  };

  const handleAddAbsence = () => {
    // Use the first available employee as default, or prompt to select one
    const firstEmployee = employees?.[0];
    if (firstEmployee) {
      setSelectedEmployeeForAbsence(firstEmployee.id);
      setIsAbsenceModalOpen(true);
    } else {
      toast({
        title: "Fehler",
        description: "Keine Mitarbeiter verfügbar. Bitte fügen Sie erst Mitarbeiter hinzu.",
        variant: "destructive",
      });
    }
  };

  const handleAddAbsenceForEmployee = (employeeId: number, _date: Date) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    setSelectedEmployeeForAbsence(employeeId);
    setIsAbsenceModalOpen(true);
  };

  const handleCreateSchedule = async (newScheduleData: {
    employee_id: number;
    date: string;
    shift_id: number;
    version: number;
  }) => {
    try {
      await createSchedule(newScheduleData);
      // Use query invalidation instead of manual refetch to prevent loops
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast({
        title: "Schichtplan erstellt",
        description: `Neuer Schichtplan erfolgreich erstellt.`,
      });
    } catch (error) {
      toast({
        title: "Fehler beim Erstellen",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handler for availability submission
  const handleCreateAvailability = async (availabilityData: {
    employee_id: number;
    date: string;
    shift_type: string;
    availability_type: string;
  }) => {
    try {
      const availability = {
        employee_id: availabilityData.employee_id,
        start_date: availabilityData.date,
        end_date: availabilityData.date,
        availability_type: availabilityData.availability_type as "AVAILABLE" | "FIXED" | "PREFERRED" | "UNAVAILABLE",
        is_recurring: false,
      };

      await createAvailability(availability);
      toast({
        title: "Erfolg!",
        description: "Verfügbarkeit wurde erfolgreich hinzugefügt.",
      });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setIsAddAvailabilityDialogOpen(false);
    } catch {
      toast({
        title: "Fehler!",
        description: "Verfügbarkeit konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSchedule = () => {
    if (!effectiveSelectedVersion) {
      toast({
        title: "Keine Version ausgewählt",
        description: "Bitte Version wählen.",
        variant: "destructive",
      });
      return;
    }
    if (scheduleData.length === 0) {
      toast({
        title: "Keine Schichtpläne",
        description: "Keine Schichtpläne zum Löschen.",
        variant: "destructive",
      });
      return;
    }
    setConfirmDeleteMessage({
      title: "Schichtplan endgültig löschen?",
      message: `Alle ${scheduleData.filter((s) => s.shift_id !== null).length} zugewiesenen Schichten der Version ${effectiveSelectedVersion} löschen. Betrifft:`,
      details: [
        `• ${new Set(scheduleData.map((s) => s.employee_id)).size} Mitarbeiter`,
        `• Zeitraum: ${format(effectiveDateRange?.from || new Date(), "dd.MM.yyyy")} - ${format(effectiveDateRange?.to || new Date(), "dd.MM.yyyy")}`,
        `• ${scheduleData.filter((s) => s.shift_id !== null).length} zugewiesene Schichten`,
      ],
      onConfirm: async () => {
        try {
          const schedulesToDelete = scheduleData.filter(
            (s) => s.shift_id !== null,
          );
          if (schedulesToDelete.length === 0) {
            toast({
              title: "Keine Schichten zum Löschen",
              variant: "destructive",
            });
            setConfirmDeleteMessage(null);
            return;
          }
          const deletePromises = schedulesToDelete.map((s) =>
            updateSchedule(s.id, {
              shift_id: null,
              version: effectiveSelectedVersionNumber || 1,
            }),
          );
          const batchSize = 10;
          let resultsCount = 0;
          for (let i = 0; i < deletePromises.length; i += batchSize) {
            const batch = deletePromises.slice(i, i + batchSize);
            try {
              await Promise.all(batch);
              resultsCount += batch.length;
            } catch (batchError) {
              console.error("Batch delete error:", batchError);
            }
          }
          // Use query invalidation instead of manual refetch to prevent loops
          queryClient.invalidateQueries({ queryKey: ["schedules"] });
          toast({
            title: "Schichtpläne gelöscht",
            description: `${resultsCount} Schichten entfernt.`, // Corrected to use resultsCount
          });
        } catch (error) {
          toast({
            title: "Fehler beim Löschen",
            description: getErrorMessage(error),
            variant: "destructive",
          });
        } finally {
          setConfirmDeleteMessage(null);
        }
      },
      onCancel: () => setConfirmDeleteMessage(null),
    });
  };

  const handleIncludeEmptyChange = (checked: boolean) => {
    setIncludeEmpty(checked);
    addGenerationLog(
      "info",
      `Will ${checked ? "show" : "hide"} empty schedules`,
    );
  };
  const handleCreateEmptyChange = (checked: boolean) => {
    setCreateEmptySchedules(checked);
    addGenerationLog(
      "info",
      `Will ${checked ? "create" : "not create"} empty schedules during generation`,
    );
  };
  const handleEnableDiagnosticsChange = (checked: boolean) => {
    setEnableDiagnostics(checked);
  };

  // Legacy version creation is handled by week-based version control
  // handleCreateNewVersionFromDialog and handleFixDisplay are no longer needed

  // Week navigation handlers

  // Week navigation is now handled by WeekNavigator component
  // handleWeekChange and handleDurationChange are no longer needed

  const handleShiftDrop = async (
    scheduleId: number,
    newEmployeeId: number,
    newDate: Date,
    newShiftId: number,
  ) => {
    if (scheduleId === undefined || scheduleId === null || scheduleId <= 0) {
      toast({
        title: "Fehler Verschieben",
        description: "Ungültige ID.",
        variant: "destructive",
      });
      return;
    }
    try {
      const updateData: Partial<ScheduleUpdate> = {
        shift_id: newShiftId,
        version: effectiveSelectedVersionNumber || 1,
        employee_id: newEmployeeId,
      };

      // If the date has changed, include it in the update
      const formattedDate = format(newDate, "yyyy-MM-dd");
      updateData.date = formattedDate;

      await updateSchedule(scheduleId, updateData);
      // Use query invalidation instead of manual refetch to prevent loops
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast({
        title: "Schicht aktualisiert",
        description: "Schicht erfolgreich verschoben.",
      });
    } catch (error) {
      toast({
        title: "Fehler Aktualisieren",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDockDrop = useCallback(async (employeeId: number, date: Date, shiftId: number) => {
    if (!effectiveSelectedVersion) {
      toast({
        title: "Fehler",
        description: "Keine Version ausgewählt.",
        variant: "destructive",
      });
      return;
    }

    // Use the numeric version number directly
    const versionNumber = effectiveSelectedVersionNumber || 1;

    console.log("🔧 handleDockDrop:", {
      employeeId,
      date: format(date, "yyyy-MM-dd"),
      shiftId,
      effectiveSelectedVersion,
      extractedVersionNumber: versionNumber
    });

    try {
      await createSchedule({
        employee_id: employeeId,
        date: format(date, "yyyy-MM-dd"),
        shift_id: shiftId,
        version: versionNumber,
      });
      // Use query invalidation instead of manual refetch to prevent loops
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast({
        title: "Schicht hinzugefügt",
        description: "Schicht erfolgreich aus dem Dock zugewiesen.",
      });
    } catch (error) {
      console.error("🚨 Dock drop error:", error);
      toast({
        title: "Fehler beim Hinzufügen",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  }, [effectiveSelectedVersion, effectiveSelectedVersionNumber, queryClient, toast]);

  // Add event listener for dock drops from schedule cells
  useEffect(() => {
    const handleDockDropEvent = (event: CustomEvent) => {
      const { employeeId, date, shiftId } = event.detail;
      console.log("🎯 Received dock drop event:", { employeeId, date, shiftId });
      handleDockDrop(employeeId, date, shiftId);
    };

    window.addEventListener('dockDrop', handleDockDropEvent as EventListener);

    return () => {
      window.removeEventListener('dockDrop', handleDockDropEvent as EventListener);
    };
  }, [handleDockDrop]);

  const handleShiftUpdate = async (scheduleId: number, updates: ScheduleUpdate) => {
    if (scheduleId === undefined || scheduleId === null || scheduleId <= 0) {
      toast({
        title: "Fehler Aktualisieren",
        description: "Ungültige ID.",
        variant: "destructive",
      });
      return;
    }
    try {
      const updateData = {
        ...updates,
        version: effectiveSelectedVersionNumber || 1,
      };

      await updateSchedule(scheduleId, updateData);
      // Use query invalidation instead of manual refetch to prevent loops
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast({
        title: "Schicht aktualisiert",
        description: "Schicht erfolgreich aktualisiert.",
      });
    } catch (error) {
      toast({
        title: "Fehler Aktualisieren",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleGenerationRequirementsUpdate = (updatedRequirements: Record<string, boolean>) => {
    if (!settingsQuery.data) return;

    const updatedSettings: SettingsType = {
      ...settingsQuery.data,
      scheduling: {
        ...settingsQuery.data.scheduling,
        generation_requirements: updatedRequirements
      }
    };

    handleSettingsUpdate(updatedSettings);
  };

  const handleSettingsUpdate = async (updatedSettings: SettingsType) => {
    try {
      await updateSettings(updatedSettings);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Einstellungen aktualisiert" });
      setIsGenerationSettingsOpen(false);
    } catch (error) {
      toast({
        title: "Fehler Aktualisieren",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleAIPrompt = async (prompt: string) => {
    if (!effectiveDateRange?.from || !effectiveDateRange?.to) {
      toast({
        title: "KI-Anweisung nicht möglich",
        description: "Bitte Zeitraum wählen.",
        variant: "destructive",
      });
      return;
    }
    if (!effectiveSelectedVersion) {
      toast({
        title: "KI-Anweisung nicht möglich",
        description: "Bitte Version wählen.",
        variant: "destructive",
      });
      return;
    }

    // For now, use the detailed AI generation with the prompt
    // In the future, this could be a separate conversation API
    toast({
      title: "KI-Anweisung verarbeitet",
      description: `Anweisung: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`,
    });

    // TODO: Implement conversation mode endpoint
    // For now, trigger detailed AI generation
    handleGenerateAiDetailedSchedule();
  };

  const isUpdating =
    !versionState.versions.length ||
    isGenerating ||
    exportMutation.isPending ||
    isAiGenerating;

  // Handler for updating generation options
  const handleGenerationOptionsUpdate = useCallback((options: GenerationOptions) => {
    setGenerationOptions(options);
  }, []);

  return (
    <div className="container mx-auto py-4 space-y-4">
      <PageHeader title="Dienstplan" className="mb-4">
        <ScheduleControls
          onRefresh={handleRetryFetch}
          onExport={handleExportSchedule}
          isExporting={exportMutation.isPending}
        />
      </PageHeader>

      {/* Week Navigation - Settings-aware components */}
      <div className="mb-4 space-y-4">
        <WeekNavigator
          currentWeekInfo={weekBasedVersionControl.currentWeekInfo}
          onNavigatePrevious={weekBasedVersionControl.navigatePrevious}
          onNavigateNext={weekBasedVersionControl.navigateNext}
          isLoading={weekBasedVersionControl.navigationState.isLoading}
          hasVersion={weekBasedVersionControl.navigationState.hasVersions}
          weekNavigationSettings={{
            weekendStart: weekBasedVersionControl.settings.weekendStart,
            monthBoundaryMode: weekBasedVersionControl.settings.monthBoundaryMode,
          }}
          currentSegment={weekBasedVersionControl.currentSegment}
          onSegmentChange={(seg) => {
            weekBasedVersionControl.handleSegmentChange(seg);
            // Force dateRange to be replaced with the segment's dates immediately
            const segData = weekBasedVersionControl.weekSegments;
            if (segData?.isSplit) {
              const chosen = segData.segments.find(s => s.segment_number === seg);
              if (chosen) {
                setDateRange({ from: new Date(chosen.start_date), to: new Date(chosen.end_date) });
                // Reset version selection for the new segment and refetch data
                versionActions.resetVersionSelection();
                queryClient.invalidateQueries({ queryKey: ["schedules"] });
                queryClient.invalidateQueries({ queryKey: ["monthlyPublishedSchedules"] });
              }
            }
          }}
        />

        <VersionManager
          dateRange={safeEffectiveDateRange}
          versions={validVersionsForCurrentRange}
          selectedVersion={effectiveSelectedVersionNumber}
          onVersionSelected={(version) => {
            console.log("🔄 SchedulePage: Version selected:", version);
            if (version) {
              weekBasedVersionControl.setSelectedVersion(version);
            }
          }}
          autoSelectLatest={true}
          layout="horizontal"
          showCreateButton={true}
          weekNavigationSettings={{
            weekendStart: weekBasedVersionControl.settings.weekendStart,
            monthBoundaryMode: weekBasedVersionControl.settings.monthBoundaryMode,
          }}
        />
      </div>

      {/* 3. Actions */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <ScheduleActions
            isLoading={isUpdating}
            isGenerating={isGenerating || isAiGenerating}
            isAiFastGenerating={isAiFastGenerating}
            isAiDetailedGenerating={isAiDetailedGenerating}
            canAdd={!!effectiveDateRange?.from && !!effectiveDateRange?.to}
            canDelete={
              scheduleData?.length > 0 && !!effectiveSelectedVersion
            }
            canGenerate={!!effectiveDateRange?.from && !!effectiveDateRange?.to}
            hasScheduleData={scheduleData?.length > 0}
            onAddSchedule={handleAddSchedule}
            onAddFixed={handleAddFixed}
            onAddPreferred={handleAddPreferred}
            onAddAbsence={handleAddAbsence}
            onDeleteSchedule={handleDeleteSchedule}
            onGenerateStandardSchedule={handleGenerateStandardSchedule}
            onGenerateAiFastSchedule={handleGenerateAiFastSchedule}
            onGenerateAiDetailedSchedule={handleGenerateAiDetailedSchedule}
            onOpenGenerationSettings={() => setIsGenerationSettingsOpen(true)}
            onOpenStatistics={() => setIsStatisticsModalOpen(true)}
            isAiEnabled={!!settingsQuery.data?.ai_scheduling?.enabled}
            onPreviewAiData={handlePreviewAiData}
            onImportAiResponse={handleImportAiResponse}
          />
        </div>

        {/* AI Dialog Type Selector */}
        {settingsQuery.data?.ai_scheduling?.enabled && (
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">KI-Dialog:</span>
            <div className="flex items-center gap-1">
              <Button
                variant={aiDialogType === 'classic' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setAiDialogType('classic')}
                className="h-7 px-2 text-xs"
              >
                <Sliders className="h-3 w-3 mr-1" />
                Klassisch
              </Button>
              <Button
                variant={aiDialogType === 'modern' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setAiDialogType('modern')}
                className="h-7 px-2 text-xs"
              >
                <Wand2 className="h-3 w-3 mr-1" />
                Modern
              </Button>
            </div>
          </div>
        )}
      </div>

      <DndProvider backend={HTML5Backend}>

        {isLoadingSchedule ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Skeleton className="h-10 w-48" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>
                      <Skeleton className="h-6 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <TableCell key={i}>
                        <Skeleton className="h-6 w-24" />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-24 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-24 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-24 w-24" />
                      </TableCell>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-24 w-24" />
                        </TableCell>
                      ))}
                      <TableCell>
                        <Skeleton className="h-24 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-24 w-24" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        ) : scheduleErrorObj ? (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Fehler beim Laden des Dienstplans</AlertTitle>
            <AlertDescription className="flex flex-col">
              <div>
                Failed to fetch schedules: {getErrorMessage(scheduleErrorObj)}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-fit"
                onClick={handleRetryFetch}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Erneut versuchen
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {errors.length > 0 && <ScheduleErrors errors={errors} />}
            <div className="relative">
              <AvailabilityProvider dateRange={safeEffectiveDateRange} enabled={!isLoadingSchedule}>
                <ScheduleManager
                  schedules={effectiveSelectedVersionNumber ? (scheduleData || []) : []} // Only show schedules when version is selected
                  monthlyPublishedSchedules={monthlyPublishedSchedules}
                  dateRange={effectiveDateRange}
                  onDrop={handleShiftDrop}
                  onUpdate={handleShiftUpdate}
                  onAddAbsence={handleAddAbsenceForEmployee}
                  isLoading={isLoadingSchedule}
                  employeeAbsences={employeeAbsences}
                  absenceTypes={
                    (effectiveSettingsData?.employee_groups?.absence_types || [])
                      .filter(type => type.type === "absence")
                      .map(type => ({ ...type, type: "absence" as const }))
                  }
                  currentVersion={effectiveSelectedVersionNumber || 1}
                  versionStatus={versionState.versions[0]?.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined}
                  openingDays={openingDays}
                  isEmptyState={
                    !effectiveSelectedVersionNumber || // Show empty state when no version selected
                    !scheduleData ||
                    (scheduleData.length === 0 && !isLoadingSchedule)
                  }
                  versions={validVersionsForCurrentRange}
                  isGenerating={isGenerating || isAiGenerating}
                  onEmptyStateCreateVersion={handleCreateNewVersionPage}
                  onEmptyStateGenerateSchedule={handleGenerateStandardSchedule}
                  // Week navigation props for fullscreen mode
                  weekInfo={weekBasedVersionControl.currentWeekInfo}
                  onNavigatePrevious={weekBasedVersionControl.navigatePrevious}
                  onNavigateNext={weekBasedVersionControl.navigateNext}
                  weekNavigationSettings={{
                    weekendStart: weekBasedVersionControl.settings.weekendStart,
                    monthBoundaryMode: weekBasedVersionControl.settings.monthBoundaryMode,
                  }}
                />
              </AvailabilityProvider>
            </div>
          </>
        )}

        {/* Schedule Dock - Sticky bottom dock for drag and drop */}
        <ActionDock
          currentVersion={effectiveSelectedVersionNumber}
          selectedDate={effectiveDateRange?.from}
          dateRange={effectiveDateRange}
          versionMeta={validVersionsForCurrentRange.length > 0 ? convertToWeekVersionMeta({
            version: validVersionsForCurrentRange[0].version,
            week_identifier: currentWeek,
            date_range_start: format(dateRange?.from || new Date(), "yyyy-MM-dd"),
            date_range_end: format(dateRange?.to || new Date(), "yyyy-MM-dd"),
            is_week_based: true,
            status: validVersionsForCurrentRange[0].status,
            created_at: validVersionsForCurrentRange[0].created_at || new Date().toISOString(),
            notes: validVersionsForCurrentRange[0].notes || '',
          }) : undefined}
          versionStatus={validVersionsForCurrentRange[0]?.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined}
          schedules={effectiveSelectedVersionNumber ? (scheduleData || []) : []} // Only pass schedules when version is selected
          onDrop={handleDockDrop}
          onAIPrompt={handleAIPrompt}
        />
      </DndProvider>

      <GenerationOverlay
        generationSteps={generationSteps}
        generationLogs={generationLogs}
        showGenerationOverlay={showGenerationOverlay || isAiGenerating}
        isPending={isGenerating || isAiGenerating}
        resetGenerationState={() => {
          resetGenerationState();
          setIsAiGenerating(false);
        }}
        addGenerationLog={addGenerationLog}
      />

      <GenerationLogs logs={generationLogs} clearLogs={clearGenerationLogs} />

      {lastSessionId && enableDiagnostics && (
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => setIsDiagnosticsOpen(true)}
            className="gap-2"
          >
            <FileTextIcon className="h-4 w-4" />
            Show Full Diagnostics
          </Button>
        </div>
      )}

      {settingsQuery.data && (
        <Dialog
          open={isGenerationSettingsOpen}
          onOpenChange={setIsGenerationSettingsOpen}
        >
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>Generierungseinstellungen</DialogTitle>
              <DialogDescription>Anpassen</DialogDescription>
            </DialogHeader>
            <ScheduleGenerationSettings
              settings={settingsQuery.data?.scheduling?.generation_requirements || null}
              onUpdate={handleGenerationRequirementsUpdate}
              generationOptions={generationOptions}
              onGenerationOptionsUpdate={handleGenerationOptionsUpdate}
              createEmptySchedules={createEmptySchedules}
              includeEmpty={includeEmpty}
              enableDiagnostics={enableDiagnostics}
              onCreateEmptyChange={handleCreateEmptyChange}
              onIncludeEmptyChange={handleIncludeEmptyChange}
              onEnableDiagnosticsChange={handleEnableDiagnosticsChange}
              onGenerateSchedule={() => {
                setIsGenerationSettingsOpen(false);
                handleGenerateStandardSchedule();
              }}
              isGenerating={isGenerating || isAiGenerating}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsGenerationSettingsOpen(false)}
              >
                Schließen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isAddScheduleDialogOpen && effectiveSelectedVersion && (
        <AddScheduleDialog
          isOpen={isAddScheduleDialogOpen}
          onClose={() => setIsAddScheduleDialogOpen(false)}
          onAddSchedule={handleCreateSchedule}
          version={effectiveSelectedVersionNumber || 1}
          defaultDate={effectiveDateRange?.from}
        />
      )}

      {isAddAvailabilityDialogOpen && (
        <AddAvailabilityDialog
          isOpen={isAddAvailabilityDialogOpen}
          onClose={() => setIsAddAvailabilityDialogOpen(false)}
          onSubmit={handleCreateAvailability}
          employees={employees?.map(emp => ({
            id: emp.id,
            name: emp.last_name,
            vorname: emp.first_name
          })) || []}
        />
      )}

      {/* Enhanced Availability Modal */}
      {isEnhancedAvailabilityModalOpen && effectiveDateRange?.from && effectiveDateRange?.to && (
        <EnhancedAvailabilityModal
          isOpen={isEnhancedAvailabilityModalOpen}
          onClose={() => setIsEnhancedAvailabilityModalOpen(false)}
          dateRange={{ from: effectiveDateRange.from, to: effectiveDateRange.to }}
          availabilityType={selectedAvailabilityType}
          currentVersion={effectiveSelectedVersionNumber}
        />
      )}

      {/* Absence Modal */}
      {isAbsenceModalOpen && selectedEmployeeForAbsence && (
        <AbsenceModal
          isOpen={isAbsenceModalOpen}
          onClose={() => {
            setIsAbsenceModalOpen(false);
            setSelectedEmployeeForAbsence(null);
          }}
          employeeId={selectedEmployeeForAbsence}
          absenceTypes={effectiveSettingsData?.employee_groups?.absence_types || []}
          employees={employees || []}
          allowEmployeeSelection={true}
        />
      )}

      {/* Statistics Modal */}
      <ScheduleStatisticsModal
        isOpen={isStatisticsModalOpen}
        onClose={() => setIsStatisticsModalOpen(false)}
        schedules={effectiveSelectedVersionNumber ? (scheduleData || []) : []} // Only show schedules when version is selected
        employees={employees || []}
        dateRange={effectiveDateRange}
        version={effectiveSelectedVersionNumber || 1}
      />

      <DiagnosticsDialog
        sessionId={lastSessionId}
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

      {confirmDeleteMessage && (
        <AlertDialog
          open={!!confirmDeleteMessage}
          onOpenChange={(open) => {
            if (!open) confirmDeleteMessage?.onCancel();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">
                {confirmDeleteMessage.title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2">
                  <p>{confirmDeleteMessage.message}</p>
                  {confirmDeleteMessage.details && (
                    <div className="mt-3 text-sm border-l-4 border-destructive pl-3 py-1 bg-destructive/5">
                      {confirmDeleteMessage.details.map((detail, i) => (
                        <p key={i}>{detail}</p>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 font-medium text-destructive">
                    Wirklich fortsetzen?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteMessage.onConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Endgültig löschen

              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* AI Data Preview Dialog */}
      <Dialog open={isAiDataPreviewOpen} onOpenChange={setIsAiDataPreviewOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Optimierte KI-Daten Vorschau</DialogTitle>
            <DialogDescription>Vorschau der optimierten Daten, die an die KI gesendet werden</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Metadata Summary */}
            {aiPreviewData?.metadata && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.data_pack?.employees?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Gefilterte Mitarbeiter</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.data_pack?.shifts?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Relevante Schichten</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.data_pack?.coverage_rules?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Abdeckungsregeln</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.data_pack?.availability?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Verfügbarkeitsfenster</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.data_pack?.absences?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Abwesenheiten</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.metadata.estimated_size_reduction}</div>
                  <div className="text-sm text-muted-foreground">Datenreduktion</div>
                </div>
              </div>
            )}

            {/* Optimization Info */}
            {aiPreviewData?.metadata && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h3 className="font-semibold mb-2 text-green-700 dark:text-green-400">✅ Optimierungsstatus:</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Optimierung aktiv:</span> {aiPreviewData.metadata.optimization_applied ? "Ja" : "Nein"}
                  </div>
                  <div>
                    <span className="font-medium">Datenstruktur:</span> {aiPreviewData.metadata.data_structure_version}
                  </div>
                  <div>
                    <span className="font-medium">Zeitraum:</span> {aiPreviewData.metadata.start_date} bis {aiPreviewData.metadata.end_date}
                  </div>
                  <div>
                    <span className="font-medium">Abschnitte:</span> {aiPreviewData.metadata.total_sections}
                  </div>
                </div>
              </div>
            )}

            {/* Main Data Display */}
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {/* Optimized Data */}
                {aiPreviewData?.data_pack && (
                  <div>
                    <h3 className="font-semibold mb-2 text-blue-700 dark:text-blue-400">📊 Optimierte KI-Daten:</h3>

                    {/* Schedule Period */}
                    {aiPreviewData.data_pack.schedule_period && (
                      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                        <h4 className="font-medium mb-2">📅 Planungszeitraum:</h4>
                        <pre className="text-sm">{JSON.stringify(aiPreviewData.data_pack.schedule_period, null, 2)}</pre>
                      </div>
                    )}

                    {/* Coverage Rules */}
                    {aiPreviewData.data_pack.coverage_rules && aiPreviewData.data_pack.coverage_rules.length > 0 && (
                      <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                        <h4 className="font-medium mb-2">🎯 Abdeckungsregeln (Muster-basiert, {aiPreviewData.data_pack.coverage_rules.length}):</h4>
                        <pre className="text-sm max-h-32 overflow-y-auto">{JSON.stringify(aiPreviewData.data_pack.coverage_rules, null, 2)}</pre>
                        <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                          ✨ Optimiert: Regeln statt tägliche Expansion (90% weniger Daten)
                        </div>
                      </div>
                    )}

                    {/* Employees */}
                    {aiPreviewData.data_pack.employees && aiPreviewData.data_pack.employees.length > 0 && (
                      <div className="mb-4 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-md">
                        <h4 className="font-medium mb-2">👥 Gefilterte Mitarbeiter ({aiPreviewData.data_pack.employees.length}):</h4>
                        <pre className="text-sm max-h-32 overflow-y-auto">{JSON.stringify(aiPreviewData.data_pack.employees.slice(0, 3), null, 2)}</pre>
                        {aiPreviewData.data_pack.employees.length > 3 && (
                          <p className="text-xs text-muted-foreground mt-2">... und {aiPreviewData.data_pack.employees.length - 3} weitere</p>
                        )}
                        <div className="mt-2 text-xs text-cyan-600 dark:text-cyan-400">
                          ✨ Optimiert: Nur verfügbare Mitarbeiter, essenzielle Felder
                        </div>
                      </div>
                    )}

                    {/* Shift Templates */}
                    {aiPreviewData.data_pack.shifts && aiPreviewData.data_pack.shifts.length > 0 && (
                      <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-md">
                        <h4 className="font-medium mb-2">⏰ Relevante Schichtvorlagen ({aiPreviewData.data_pack.shifts.length}):</h4>
                        <pre className="text-sm max-h-32 overflow-y-auto">{JSON.stringify(aiPreviewData.data_pack.shifts, null, 2)}</pre>
                        <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                          ✨ Optimiert: Nur aktive Schichten, redundante Felder entfernt
                        </div>
                      </div>
                    )}

                    {/* Availability Windows */}
                    {aiPreviewData.data_pack.availability && aiPreviewData.data_pack.availability.length > 0 && (
                      <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                        <h4 className="font-medium mb-2">🕐 Verfügbarkeitsfenster ({aiPreviewData.data_pack.availability.length}):</h4>
                        <pre className="text-sm max-h-32 overflow-y-auto">{JSON.stringify(aiPreviewData.data_pack.availability.slice(0, 5), null, 2)}</pre>
                        {aiPreviewData.data_pack.availability.length > 5 && (
                          <p className="text-xs text-muted-foreground mt-2">... und {aiPreviewData.data_pack.availability.length - 5} weitere</p>
                        )}
                        <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                          ✨ Optimiert: Zeitspannen statt stündliche Arrays (75% weniger Daten)
                        </div>
                      </div>
                    )}

                    {/* Absences */}
                    {aiPreviewData.data_pack.absences && aiPreviewData.data_pack.absences.length > 0 && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                        <h4 className="font-medium mb-2">🚫 Abwesenheiten ({aiPreviewData.data_pack.absences.length}):</h4>
                        <pre className="text-sm max-h-32 overflow-y-auto">{JSON.stringify(aiPreviewData.data_pack.absences, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (aiPreviewData?.data_pack) {
                  navigator.clipboard.writeText(JSON.stringify(aiPreviewData.optimized_data, null, 2));
                  toast({
                    title: "In Zwischenablage kopiert",
                    description: "Die optimierten KI-Daten wurden kopiert.",
                  });
                }
              }}
            >
              📋 Daten kopieren
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (aiPreviewData?.system_prompt) {
                  navigator.clipboard.writeText(aiPreviewData.system_prompt);
                  toast({
                    title: "Prompt kopiert",
                    description: "Der System-Prompt wurde kopiert.",
                  });
                }
              }}
            >
              🤖 Prompt kopieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Conversation Generation Dialog */}
      <AIConversationGenerationDialog
        isOpen={isDetailedAiModalOpen}
        onClose={() => setIsDetailedAiModalOpen(false)}
        startDate={format(effectiveDateRange?.from || new Date(), "yyyy-MM-dd")}
        endDate={format(effectiveDateRange?.to || new Date(), "yyyy-MM-dd")}
        versionId={effectiveSelectedVersionNumber || 1}
        onComplete={() => {
          setIsAiDetailedGenerating(false);
          refetchScheduleData();
          queryClient.invalidateQueries({ queryKey: ["versions"] });
          toast({
            title: "KI-Generierung abgeschlossen",
            description: "Der Schichtplan wurde erfolgreich generiert.",
          });
        }}
      />

      {/* Classic AI Generation Dialog */}
      <ClassicAIGenerationDialog
        isOpen={isClassicAiModalOpen}
        onClose={() => setIsClassicAiModalOpen(false)}
        startDate={format(effectiveDateRange?.from || new Date(), "yyyy-MM-dd")}
        endDate={format(effectiveDateRange?.to || new Date(), "yyyy-MM-dd")}
        versionId={effectiveSelectedVersionNumber || 1}
        onComplete={() => {
          setIsAiDetailedGenerating(false);
          refetchScheduleData();
          queryClient.invalidateQueries({ queryKey: ["versions"] });
          toast({
            title: "Klassische KI-Generierung abgeschlossen",
            description: "Der Schichtplan wurde erfolgreich generiert.",
          });
        }}
      />
    </div>
  );
}
