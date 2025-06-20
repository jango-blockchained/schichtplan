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

import React, { useCallback, useEffect, useMemo, useState } from "react"; // Added useCallback, useMemo
// import { ShiftTable } from '@/components/ShiftTable'; // Original, might be unused if ScheduleManager is primary
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  createSchedule,
  exportSchedule,
  fixScheduleDisplay,
  generateAiSchedule,
  getEmployees,
  getSettings,
  getWeekVersions,
  importAiScheduleResponse,
  previewAiData,
  updateSchedule,
  updateSettings
} from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addWeeks,
  differenceInCalendarWeeks,
  differenceInDays,
  endOfWeek,
  format,
  parseISO,
  startOfWeek
} from "date-fns";
// import { ScheduleTable } from '@/components/ScheduleTable'; // Original, might be unused
// import { ScheduleOverview } from '@/components/Schedule/ScheduleOverview'; // Original, might be unused
import {
  Absence,
  AiImportResponse,
  ApplicableShift,
  Employee,
  Schedule as ScheduleEntry,
  ScheduleResponse,
  ScheduleUpdate,
  Settings
} from "@/types"; // Added Settings and other types
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
import GenerationOverlay from "@/components/Schedule/GenerationOverlay";
import { ScheduleActions } from "@/components/Schedule/ScheduleActions";
import ScheduleControls from "@/components/Schedule/ScheduleControls";
import useScheduleGeneration from "@/hooks/useScheduleGeneration";
import useVersionControl from "@/hooks/useVersionControl";
import { useWeekBasedVersionControl } from "@/hooks/useWeekBasedVersionControl";
import { DateRange } from "react-day-picker";
// import { ScheduleFixActions } from '@/components/Schedule/ScheduleFixActions'; // Original, might be unused
import { EnhancedDateRangeSelector } from "@/components/EnhancedDateRangeSelector";
import AddAvailabilityShiftsDialog from "@/components/Schedule/AddAvailabilityShiftsDialog";
import { AddScheduleDialog } from "@/components/Schedule/AddScheduleDialog";
import { DiagnosticsDialog } from "@/components/Schedule/DiagnosticsDialog";
import { MEPTemplate } from "@/components/Schedule/MEPTemplate";
import { ScheduleStatisticsModal } from "@/components/Schedule/ScheduleStatisticsModal";
import { VersionTable } from "@/components/Schedule/VersionTable";
import { ScheduleManager } from "@/components/ScheduleManager";
import { WeekNavigator } from "@/components/WeekNavigator";
import { WeekVersionDisplay } from "@/components/WeekVersionDisplay";
import { ActionDock } from "@/components/dock/ActionDock";
import { DetailedAIGenerationModal, DetailedAIOptions } from "@/components/modals/DetailedAIGenerationModal";
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
import { MEPDataService } from "@/services/mepDataService";
import ReactDOM from "react-dom/client";

// Define a more specific type for AI Preview data to avoid using `any`
interface AiPreviewData {
    status: string;
    data_pack: {
        employees: Employee[];
        shifts: ScheduleEntry[];
        coverage_rules: any[]; // Replace with specific type if available
        schedule_period: { start: string; end: string };
        availability: ApplicableShift[];
        absences: Absence[];
    };
    metadata: {
        estimated_size_reduction: string;
        optimization_applied: boolean;
        data_structure_version: string;
        start_date: string;
        end_date: string;
        total_sections: number;
    };
    system_prompt?: string;
    optimized_data?: Record<string, unknown>;
}


function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Ein unerwarteter Fehler ist aufgetreten";
}

export function SchedulePage() {
  // 1. All useState calls
  const today = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const initialToday = new Date();
    return {
        from: startOfWeek(initialToday, { weekStartsOn: 1 }),
        to: endOfWeek(initialToday, { weekStartsOn: 1 }),
    };
  });
  const [weekAmount, setWeekAmount] = useState<number>(1);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(
    undefined,
  );
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(true);
  const [createEmptySchedules, setCreateEmptySchedules] = useState(true);
  const [isGenerationSettingsOpen, setIsGenerationSettingsOpen] =
    useState(false);
  const [isAddScheduleDialogOpen, setIsAddScheduleDialogOpen] = useState(false);
  const [isStatisticsModalOpen, setIsStatisticsModalOpen] = useState(false);
  const [employeeAbsences, setEmployeeAbsences] = useState<
    Record<number, unknown[]>
  >({}); // Keep if used by ScheduleTable/Manager
  const [enableDiagnostics, setEnableDiagnostics] = useState<boolean>(false);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [isAiFastGenerating, setIsAiFastGenerating] = useState<boolean>(false);
  const [isAiDetailedGenerating, setIsAiDetailedGenerating] = useState<boolean>(false);
  const [isDetailedAiModalOpen, setIsDetailedAiModalOpen] = useState<boolean>(false);
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<{
    title: string;
    message: string;
    details?: string[];
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [isAiDataPreviewOpen, setIsAiDataPreviewOpen] = useState<boolean>(false);
  const [aiPreviewData, setAiPreviewData] = useState<AiPreviewData | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isAddAvailabilityShiftsDialogOpen, setIsAddAvailabilityShiftsDialogOpen] = useState(false);
  const [availabilityShiftType, setAvailabilityShiftType] = useState<'FIXED' | 'UNAVAILABLE' | 'PREFERRED'>('FIXED');

  // 2. Other React hooks
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 3. React Query hooks (useQuery, useMutation)
  const settingsQuery = useQuery<Settings, Error>({
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

  // Week-based navigation toggle state
  const [useWeekBasedNavigation, setUseWeekBasedNavigation] = useState(false);

  // Week-based Version Control Hook (Alternative to legacy version control)
  const weekBasedVersionControl = useWeekBasedVersionControl({
    onWeekChanged: (weekIdentifier) => {
      // The hook handles date range updates internally
    },
    onVersionSelected: (version) => {
      // Convert version identifier to number if needed for backward compatibility
      const versionNumber = typeof version === 'string' ? parseInt(version.split('-')[0], 10) || 1 : version;
      setSelectedVersion(versionNumber);
    },
  });

  // Query for week-based version metadata when using week navigation
  const { data: currentWeekVersionMeta } = useQuery({
    queryKey: ["week-version", weekBasedVersionControl.navigationState.currentWeek],
    queryFn: async () => {
      const versions = await getWeekVersions(weekBasedVersionControl.navigationState.currentWeek);
      // Return the first version for this week (there should typically be only one)
      return versions.length > 0 ? versions[0] : null;
    },
    enabled: useWeekBasedNavigation && !!weekBasedVersionControl.navigationState.currentWeek,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  // Custom Hook for Version Control
  const {
    selectedVersion: versionControlSelectedVersion,
    handleVersionChange, // This is the function from the hook to change version
    handleCreateNewVersion: triggerCreateNewVersionHook, // Renamed to avoid conflict with page-level handler
    handlePublishVersion,
    handleArchiveVersion,
    handleDeleteVersion: triggerDeleteVersionHook, // Renamed
    handleDuplicateVersion: triggerDuplicateVersionHook, // Renamed
    handleCreateNewVersionWithOptions: versionControlCreateWithOptions,
    versionMetas, // This is VersionMeta[] from the hook, used for VersionTable etc.
    isLoading: isLoadingVersions,
  } = useVersionControl({
    dateRange,
    initialVersion: undefined,
    onVersionSelected: (version) => {
      setSelectedVersion(version); // Update local state, an effect will handle refetching
    },
  });

  // Determine which version to use based on navigation mode
  const effectiveSelectedVersion = useWeekBasedNavigation 
    ? (currentWeekVersionMeta?.version ? parseInt(currentWeekVersionMeta.version.toString()) : undefined)
    : versionControlSelectedVersion;

  // Custom Hook for Schedule Data Fetching
  const {
    scheduleData,
    errors: scheduleErrorsData,
    loading: isLoadingSchedule,
    error: scheduleErrorObj, // Renamed to avoid conflict with `errors` const
    refetch: refetchScheduleData,
  } = useScheduleData(
    dateRange?.from ?? new Date(),
    dateRange?.to ?? new Date(),
    effectiveSelectedVersion, // Use the effective version based on navigation mode
    includeEmpty,
  );

  // Custom Hook for Schedule Generation Logic
  const {
    generationSteps,
    generationLogs,
    showGenerationOverlay,
    isPending,
    generate,
    resetGenerationState,
    addGenerationLog,
    clearGenerationLogs,
    updateGenerationStep,
    setGenerationSteps,
    setShowGenerationOverlay,
    lastSessionId,
  } = useScheduleGeneration({
    dateRange,
    selectedVersion: effectiveSelectedVersion, // Use effective version for generation too
    createEmptySchedules,
    enableDiagnostics,
    onSuccess: useCallback(() => {
      // Only refetch data once, don't duplicate query invalidations
      // The hook already handles query invalidation internally
      
      // Only invalidate versions if they might have changed
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      
      // Invalidate week version queries too if in week mode
      if (useWeekBasedNavigation) {
        queryClient.invalidateQueries({ queryKey: ["week-version"] });
      }
    }, [queryClient, useWeekBasedNavigation]), // Added useWeekBasedNavigation dependency
  });

  // Mutations
  const exportMutation = useMutation<Blob, Error, { format: 'standard' | 'mep' | 'mep-html', filiale?: string }>({
    mutationFn: async ({ format: exportFormat, filiale }) => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Bitte wählen Sie einen Zeitraum aus");
      }
      const exportType = exportFormat === 'mep' ? 'MEP' : 'Standard';
      addGenerationLog("info", `Starting ${exportType} PDF export`);
      
      const response = await exportSchedule(
        format(dateRange.from, "yyyy-MM-dd"),
        format(dateRange.to, "yyyy-MM-dd"),
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
      const dateStr = `${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}`;
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
    if (!versionControlSelectedVersion || !dateRange?.from || !dateRange?.to) {
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
        formData.append('version_id', versionControlSelectedVersion.toString());
        formData.append('start_date', format(dateRange.from!, 'yyyy-MM-dd'));
        formData.append('end_date', format(dateRange.to!, 'yyyy-MM-dd'));

        // Use a mutation hook for the import process
        importAiResponseMutation.mutate(formData);
      }

      // Clean up the file input element
      document.body.removeChild(fileInput);
    };

    // Trigger the file picker
    fileInput.click();
  }, [versionControlSelectedVersion, dateRange, toast, importAiResponseMutation]);

  const handleRetryFetch = useCallback(() => {
    clearGenerationLogs();
    // Use query invalidation instead of manual refetch to prevent loops
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
  }, [clearGenerationLogs, queryClient]); // Removed refetchScheduleData dependency

  const handleHTMLMEPExport = useCallback((filiale: string) => {
    if (!dateRange?.from || !dateRange?.to || !scheduleData || !employees) {
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
        scheduleData as ScheduleResponse, // More specific type
        employees,
        dateRange.from,
        dateRange.to,
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

      // Load the CSS file content and inject it
      const loadCSS = async () => {
        try {
          const response = await fetch('/src/components/Schedule/MEPTemplate.css');
          const cssContent = await response.text();
          
          const style = newWindow.document.createElement('style');
          style.textContent = cssContent;
          newWindow.document.head.appendChild(style);
          
          // Now render the MEP component
          renderMEPComponent();
        } catch (e) {
          renderMEPComponent();
        }
      };

      const renderMEPComponent = () => {
        // Create React element
        const mepElement = React.createElement(MEPTemplate, {
          data: mepData,
          onPrint: () => newWindow.print()
        });

        // Render it in the new window
        const root = ReactDOM.createRoot(newWindow.document.getElementById('mep-root')!);
        root.render(mepElement);
      };

      // Load CSS and render
      loadCSS();

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
  }, [dateRange, scheduleData, employees, addGenerationLog, toast]);

  const handleExportSchedule = useCallback(async (format: 'standard' | 'mep' | 'mep-html', filiale?: string) => {
    if (format === 'mep-html') {
      // Handle HTML MEP export differently - open in new tab
      handleHTMLMEPExport(filiale || '');
    } else {
      exportMutation.mutate({ format, filiale });
    }
  }, [exportMutation, handleHTMLMEPExport]);

  const handlePreviewAiData = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
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

      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      const toStr = format(dateRange.to, "yyyy-MM-dd");
      
      const aiDataPreview = await previewAiData(fromStr, toStr);
      
      setAiPreviewData(aiDataPreview);
      setIsAiDataPreviewOpen(true);

      toast({
        title: "KI-Daten geladen",
        description: `Daten für ${aiDataPreview.data_pack?.employees?.length || 0} Mitarbeiter optimiert.`,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Fehler beim Laden der KI-Daten",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [dateRange, toast]);

  // Removed checkAndFixMissingTimeData function - automatic schedule repair is no longer needed
  // Manual repair is still available via the "Fix Display" button in ScheduleActions

  // Page-level handler for creating a new version (delegates to hook's function)
  const handleCreateNewVersionPage = useCallback(() => {
    triggerCreateNewVersionHook(); // Call the renamed hook function
  }, [triggerCreateNewVersionHook]);

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

  useEffect(() => {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      const from = startOfWeek(today, { weekStartsOn: 1 });
      from.setHours(0, 0, 0, 0);
      const to = addDays(from, 6 * weekAmount);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  }, [weekAmount, today, dateRange, setDateRange]);

  useEffect(() => {
    // This effect handles version changes but avoids infinite loops
    // by using query invalidation instead of manual refetch
    const timeoutId = setTimeout(() => {
      if (selectedVersion !== undefined || versionControlSelectedVersion === undefined) {
        // Use query invalidation instead of manual refetch to prevent loops
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
      }
    }, 200); // Debounce by 200ms

    return () => clearTimeout(timeoutId);
  }, [selectedVersion, versionControlSelectedVersion, queryClient]); // Removed refetchScheduleData dependency

  const fromTime = dateRange?.from?.getTime();
  const toTime = dateRange?.to?.getTime();

  useEffect(() => {
    if (
      versionControlSelectedVersion &&
      versionMetas &&
      versionMetas.length > 0
    ) {
      const selectedMeta = versionMetas.find(
        (vm) => vm.version === versionControlSelectedVersion,
      );
      if (selectedMeta) {
        // @ts-expect-error - Legacy support for different version meta structures
        const metaAny = selectedMeta as any;
        const dateRangeStartStr =
          selectedMeta.date_range?.start ||
          metaAny.version_meta?.date_range?.start;
        const dateRangeEndStr =
          selectedMeta.date_range?.end || metaAny.version_meta?.date_range?.end;
        if (dateRangeStartStr && dateRangeEndStr) {
          const versionStartDate = parseISO(dateRangeStartStr);
          versionStartDate.setHours(0, 0, 0, 0);
          const versionEndDate = parseISO(dateRangeEndStr);
          versionEndDate.setHours(23, 59, 59, 999);
          const daysDiff = differenceInDays(versionEndDate, versionStartDate);
          const newWeekAmount = Math.ceil((daysDiff + 1) / 7);
          const currentDRValid = dateRange && dateRange.from && dateRange.to;
          const drNeedsUpdate =
            !currentDRValid ||
            dateRange.from!.getTime() !== versionStartDate.getTime() ||
            dateRange.to!.getTime() !== versionEndDate.getTime();
          const waNeedsUpdate = weekAmount !== newWeekAmount;
          if (drNeedsUpdate || waNeedsUpdate) {
            if (waNeedsUpdate) setWeekAmount(newWeekAmount);
            if (drNeedsUpdate)
              setDateRange({ from: versionStartDate, to: versionEndDate });
          }
        }
      }
    }
  }, [
    versionControlSelectedVersion,
    versionMetas,
    fromTime,
    toTime,
    weekAmount,
    dateRange,
  ]);

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
      // Original incorrect call:
      // const data = await getAbsences(
      //   // @ts-ignore // Temporarily ignore type error until backend API is updated
      //   dateRange.from,
      //   // @ts-ignore // Temporarily ignore type error until backend API is updated
      //   dateRange.to
      // );
      // Assuming the backend returns a list of absence objects
      // We need to transform it into a map by employee ID if that's how employeeAbsences is used
      // const absencesByEmployee: Record<number, any[]> = {};
      // if (Array.isArray(data)) {
      //   data.forEach(absence => {
      //     if (!absencesByEmployee[absence.employee_id]) {
      //       absencesByEmployee[absence.employee_id] = [];
      //     }
      //     absencesByEmployee[absence.employee_id].push(absence);
      //   });
      // }
      // return absencesByEmployee;
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
  const handleGenerateStandardSchedule = () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Zeitraum erforderlich",
        description: "Bitte wählen Sie einen Zeitraum aus.",
        variant: "destructive",
      });
      return;
    }
    if (!effectiveSelectedVersion) {
      toast({
        title: "Version erforderlich",
        description: "Bitte wählen Sie eine Version aus.",
        variant: "destructive",
      });
      return;
    }
    if (isLoadingVersions) {
      toast({
        title: "Versionen werden geladen",
        description: "Bitte warten Sie.",
        variant: "destructive",
      });
      return;
    }
    const formattedFromDate = format(dateRange.from, "yyyy-MM-dd");
    const formattedToDate = format(dateRange.to, "yyyy-MM-dd");
    addGenerationLog(
      "info",
      "Starting STANDARD schedule generation",
      `Version: ${effectiveSelectedVersion}, Date range: ${formattedFromDate} - ${formattedToDate}`,
    );
    generate();
  };

  const handleGenerateAiFastSchedule = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Zeitraum erforderlich (Schnelle KI)",
        description: "Bitte Zeitraum für schnelle KI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }
    if (!versionControlSelectedVersion) {
      toast({
        title: "Version erforderlich (Schnelle KI)",
        description: "Bitte Version für schnelle KI-Generierung wählen.",
        variant: "destructive",
      });
      return;
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
      `Version: ${versionControlSelectedVersion}, Date range: ${format(dateRange.from, "yyyy-MM-dd")} - ${format(dateRange.to, "yyyy-MM-dd")}`,
    );
    try {
      updateGenerationStep("ai-fast-init", "in-progress");
      await new Promise((r) => setTimeout(r, 300));
      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      const toStr = format(dateRange.to, "yyyy-MM-dd");
      updateGenerationStep("ai-fast-init", "completed");
      updateGenerationStep("ai-fast-analyze", "in-progress");
      await new Promise((r) => setTimeout(r, 300));
      const result = await generateAiSchedule(
        fromStr,
        toStr,
        versionControlSelectedVersion,
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
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Zeitraum erforderlich (Erweiterte KI)",
        description: "Bitte Zeitraum für erweiterte KI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }
    if (!versionControlSelectedVersion) {
      toast({
        title: "Version erforderlich (Erweiterte KI)",
        description: "Bitte Version für erweiterte KI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }
    // Open the detailed AI modal instead of running generation immediately
    setIsDetailedAiModalOpen(true);
  };

  const handleDetailedAiModalConfirm = async (options: DetailedAIOptions) => {
    setIsDetailedAiModalOpen(false);
    setIsAiDetailedGenerating(true);
    clearGenerationLogs();
    const aiSteps = [
      {
        id: "ai-detailed-init",
        title: "Initialisiere erweiterte KI-Generierung",
        status: "pending" as const,
      },
      {
        id: "ai-detailed-analyze",
        title: "Detaillierte Analyse mit Konfiguration",
        status: "pending" as const,
      },
      {
        id: "ai-detailed-generate",
        title: "Erstelle optimierten Schichtplan",
        status: "pending" as const,
      },
      {
        id: "ai-detailed-finalize",
        title: "Finalisiere erweiterten Schichtplan",
        status: "pending" as const,
      },
    ];
    setGenerationSteps(aiSteps);
    setShowGenerationOverlay(true);
    addGenerationLog(
      "info",
      "Starting detailed AI schedule generation",
      `Version: ${versionControlSelectedVersion}, Date range: ${format(dateRange!.from!, "yyyy-MM-dd")} - ${format(dateRange!.to!, "yyyy-MM-dd")}, Options: ${JSON.stringify(options)}`,
    );
    try {
      updateGenerationStep("ai-detailed-init", "in-progress");
      await new Promise((r) => setTimeout(r, 500));
      const fromStr = format(dateRange!.from!, "yyyy-MM-dd");
      const toStr = format(dateRange!.to!, "yyyy-MM-dd");
      updateGenerationStep("ai-detailed-init", "completed");
      updateGenerationStep("ai-detailed-analyze", "in-progress");
      await new Promise((r) => setTimeout(r, 700));
      // Pass options to generateAiSchedule when backend supports detailed options
      const result = await generateAiSchedule(
        fromStr,
        toStr,
        versionControlSelectedVersion!,
        options // Pass detailed options here
      );
      updateGenerationStep("ai-detailed-analyze", "completed");
      updateGenerationStep("ai-detailed-generate", "in-progress");
      await new Promise((r) => setTimeout(r, 700));
      addGenerationLog("info", "Detailed AI schedule generation API call successful");
      if (result.generated_assignments_count)
        addGenerationLog(
          "info",
          `Generated ${result.generated_assignments_count} schedule entries with detailed options`,
        );
      updateGenerationStep("ai-detailed-generate", "completed");
      updateGenerationStep("ai-detailed-finalize", "in-progress");
      await new Promise((r) => setTimeout(r, 500));
      await refetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      updateGenerationStep("ai-detailed-finalize", "completed");
      toast({
        title: "Erweiterte KI-Generierung abgeschlossen",
        description: "Schichtplan wurde mit erweiterten Optionen generiert.",
      });
      if (result.diagnostic_log) {
        addGenerationLog("info", "Diagnostic log available:", result.diagnostic_log);
      }
      setTimeout(() => setIsAiDetailedGenerating(false), 2000);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      addGenerationLog("error", "Detailed AI Generation Error", errorMessage);
      aiSteps.forEach((step) =>
        updateGenerationStep(step.id, "error", "Generation failed"),
      );
      toast({
        title: "Erweiterte KI-Generierung fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      });
      setTimeout(() => setIsAiDetailedGenerating(false), 3000);
    }
  };

  const handleAddSchedule = () => {
    if (!versionControlSelectedVersion) {
      toast({
        title: "Keine Version ausgewählt",
        description: "Bitte Version wählen.",
        variant: "destructive",
      });
      return;
    }
    setIsAddScheduleDialogOpen(true);
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

  const handleDeleteSchedule = () => {
    if (!versionControlSelectedVersion) {
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
      message: `Alle ${scheduleData.length} Schichtpläne der Version ${versionControlSelectedVersion} löschen. Betrifft:`,
      details: [
        `• ${new Set(scheduleData.map((s) => s.employee_id)).size} Mitarbeiter`,
        `• Zeitraum: ${format(dateRange?.from || new Date(), "dd.MM.yyyy")} - ${format(dateRange?.to || new Date(), "dd.MM.yyyy")}`,
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
              version: versionControlSelectedVersion,
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
              // Silently continue with other batches
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

  const handleWeekChange = useCallback((weekOffset: number) => {
    if (!dateRange?.from) return;
    
    const newFrom = addWeeks(dateRange.from, weekOffset);
    const newTo = addDays(newFrom, (weekAmount * 7) - 1);
    
    setDateRange({
      from: newFrom,
      to: newTo,
    });
    
    addGenerationLog(
      "info",
      `Week navigation: moved ${weekOffset > 0 ? 'forward' : 'backward'} by ${Math.abs(weekOffset)} week(s)`,
    );
  }, [dateRange, weekAmount, addGenerationLog]);

  const handleDurationChange = useCallback((duration: number) => {
    setWeekAmount(duration);
    
    // Update the date range to reflect the new duration
    if (dateRange?.from) {
      const newTo = addDays(dateRange.from, (duration * 7) - 1);
      setDateRange({
        from: dateRange.from,
        to: newTo,
      });
    }
    
    addGenerationLog(
      "info",
      `Schedule duration changed to ${duration} week(s)`,
    );
  }, [dateRange, addGenerationLog]);

  const handleCreateNewVersionFromDialog = (options: {
    dateRange: DateRange;
  }) => {
    if (options.dateRange.from && options.dateRange.to) {
      setDateRange(options.dateRange);
      let newCalculatedWeekAmount = 1;
      if (options.dateRange.to >= options.dateRange.from)
        newCalculatedWeekAmount =
          differenceInCalendarWeeks(
            options.dateRange.to,
            options.dateRange.from,
            { weekStartsOn: 1 },
          ) + 1;
      setWeekAmount(newCalculatedWeekAmount);
      versionControlCreateWithOptions({
        dateRange: options.dateRange,
        weekAmount: newCalculatedWeekAmount,
        isUserInitiated: true,
      });
    } else {
      toast({
        title: "Fehler",
        description: "Ungültiger Zeitraum für neue Version.",
        variant: "destructive",
      });
    }
  };

  const handleFixDisplay = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Fix Display nicht möglich",
        description: "Bitte wählen Sie einen Zeitraum aus.",
        variant: "destructive",
      });
      return;
    }

    try {
      await fixScheduleDisplay(
        format(dateRange.from, "yyyy-MM-dd"),
        format(dateRange.to, "yyyy-MM-dd"),
        effectiveSelectedVersion
      );
      toast({
        title: "Anzeige repariert",
        description: "Die Anzeige der Schichtdaten wurde erfolgreich repariert.",
      });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    } catch (error) {
      toast({
        title: "Fehler bei der Reparatur",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleAddFixedShifts = () => {
    setAvailabilityShiftType('FIXED');
    setIsAddAvailabilityShiftsDialogOpen(true);
  };

  const handleAddUnavailableShifts = () => {
    setAvailabilityShiftType('UNAVAILABLE');
    setIsAddAvailabilityShiftsDialogOpen(true);
  };

  const handleAddPreferredShifts = () => {
    setAvailabilityShiftType('PREFERRED');
    setIsAddAvailabilityShiftsDialogOpen(true);
  };

  // 8. Render logic
  if (settingsQuery.isLoading) {
    return (
      <div className="container mx-auto py-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
        <Card className="overflow-hidden">
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
    );
  }

  return (
    <div className="container mx-auto py-4 space-y-4">
      <PageHeader title="Dienstplan" className="mb-4">
        <ScheduleControls
          onRefresh={handleRetryFetch}
          onExport={handleExportSchedule}
          isExporting={exportMutation.isPending}
        />
      </PageHeader>

      {/* Navigation Mode Toggle */}
      <div className="mb-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">Navigation Modus</div>
                <div className="text-xs text-muted-foreground">
                  {useWeekBasedNavigation 
                    ? 'Wochenbasierte Navigation (Beta) - ISO Kalenderwochen' 
                    : 'Standard Datumsbereich Navigation'}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm">Standard</span>
                <Switch
                  checked={useWeekBasedNavigation}
                  onCheckedChange={setUseWeekBasedNavigation}
                />
                <span className="text-sm">Wochenbasiert</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 1. Date Selection - Conditional based on navigation mode */}
      {useWeekBasedNavigation ? (
        <div className="mb-4 space-y-4">
          <WeekNavigator
            currentWeekInfo={weekBasedVersionControl.currentWeekInfo}
            onNavigatePrevious={weekBasedVersionControl.navigateNext}
            onNavigateNext={weekBasedVersionControl.navigatePrevious}
            isLoading={weekBasedVersionControl.navigationState.isLoading}
            hasVersion={weekBasedVersionControl.navigationState.hasVersions}
          />
          
          <WeekVersionDisplay
            currentWeekInfo={weekBasedVersionControl.currentWeekInfo}
            versionMeta={currentWeekVersionMeta as any}
            selectedVersion={weekBasedVersionControl.selectedVersion}
            onCreateVersion={() => weekBasedVersionControl.createVersionForWeek(
              weekBasedVersionControl.navigationState.currentWeek
            )}
            onSelectVersion={(version) => {
              // Convert version identifier to number for backward compatibility
              const versionNumber = typeof version === 'string' ? parseInt(version.split('-')[0], 10) || 1 : version;
              setSelectedVersion(versionNumber);
              weekBasedVersionControl.setSelectedVersion(version);
            }}
          />
        </div>
      ) : (
        <div className="mb-4">
          <EnhancedDateRangeSelector
            dateRange={dateRange}
            scheduleDuration={weekAmount}
            onWeekChange={handleWeekChange}
            onDurationChange={handleDurationChange}
            hasVersions={versionMetas.length > 0}
            onCreateNewVersion={handleCreateNewVersionPage}
            onCreateNewVersionWithSpecificDateRange={
              handleCreateNewVersionFromDialog
            }
            currentVersion={versionControlSelectedVersion}
          />
        </div>
      )}

      {/* 2. Version Table - Only show when NOT using week-based navigation */}
      {!useWeekBasedNavigation && (
        <div className="mb-4">
          <VersionTable
            versions={versionMetas || []}
            selectedVersion={versionControlSelectedVersion}
            onSelectVersion={handleVersionChange}
            onPublishVersion={handlePublishVersion}
            onArchiveVersion={handleArchiveVersion}
            onDeleteVersion={triggerDeleteVersionHook}
            onDuplicateVersion={triggerDuplicateVersionHook}
            onCreateNewVersion={handleCreateNewVersionPage}
          />
        </div>
      )}

      {/* 3. Actions */}
      <div className="flex justify-start gap-2 mb-4">
        <ScheduleActions
          isLoading={isLoadingSchedule || isPending}
          isGenerating={isPending || isAiGenerating}
          isAiFastGenerating={isAiFastGenerating}
          isAiDetailedGenerating={isAiDetailedGenerating}
          canAdd={
            !!dateRange?.from &&
            !!dateRange?.to &&
            !!effectiveSelectedVersion
          }
          canDelete={
            scheduleData?.length > 0 && !!effectiveSelectedVersion
          }
          canGenerate={
            !!dateRange?.from &&
            !!dateRange?.to &&
            !!effectiveSelectedVersion
          }
          hasScheduleData={scheduleData?.length > 0}
          onAddSchedule={handleAddSchedule}
          onDeleteSchedule={handleDeleteSchedule}
          onGenerateStandardSchedule={handleGenerateStandardSchedule}
          onGenerateAiFastSchedule={handleGenerateAiFastSchedule}
          onGenerateAiDetailedSchedule={handleGenerateAiDetailedSchedule}
          onOpenGenerationSettings={() => setIsGenerationSettingsOpen(true)}
          onOpenStatistics={() => setIsStatisticsModalOpen(true)}
          isAiEnabled={!!settingsQuery.data?.ai_scheduling?.enabled}
          onPreviewAiData={handlePreviewAiData}
          onImportAiResponse={handleImportAiResponse}
          onFixDisplay={handleFixDisplay}
          onAddFixed={handleAddFixedShifts}
          onAddUnavailable={handleAddUnavailableShifts}
          onAddPreferred={handleAddPreferredShifts}
        />
        <ActionDock
          actions={[
// ...existing code...
            ]}
          />
        </div>

        <WeekVersionDisplay
            isWeekBased={useWeekBasedNavigation}
            weekIdentifier={weekBasedVersionControl.navigationState.currentWeek}
            versionMeta={currentWeekVersionMeta}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 space-y-4 mb-16">
          <ScheduleManager
                  scheduleResponse={scheduleData}
                  employees={employees || []}
                  dateRange={dateRange}
                  absences={employeeAbsences}
                  openingDays={openingDays}
                  absenceTypes={effectiveSettingsData?.employee_groups?.absence_types || []}
                  onUpdateSchedule={async (updates: ScheduleUpdate[]) => {
                    if (!effectiveSelectedVersion) return;
                    await updateSchedule(updates, effectiveSelectedVersion);
                    toast({ title: "Plan aktualisiert" });
                    refetchScheduleData();
                  }}
                  viewMode={settingsDataFromHook?.display?.view_mode || 'weekly'}
            isVersionSelected={effectiveSelectedVersion !== undefined}
          />
        </main>

      {/* Generation Overlay for displaying logs */}
      <GenerationOverlay 
        showGenerationOverlay={showGenerationOverlay}
        generationSteps={generationSteps}
        generationLogs={generationLogs}
        isPending={isAiGenerating}
        resetGenerationState={() => setShowGenerationOverlay(false)}
        addGenerationLog={(type, message, details) => {
          // Add log logic here if needed
        }}
      />

      {/* Modals and Dialogs */}
      <AddScheduleDialog
        isOpen={isAddScheduleDialogOpen}
        onOpenChange={setIsAddScheduleDialogOpen}
        onCreate={(...args) => {
          // @ts-ignore
          versionControlCreateWithOptions(...args);
          setIsAddScheduleDialogOpen(false);
        }}
      />

      <ScheduleStatisticsModal
        isOpen={isStatisticsModalOpen}
        onOpenChange={setIsStatisticsModalOpen}
        dateRange={dateRange}
      />

      {isGenerationSettingsOpen && (
        <ScheduleGenerationSettings
          isOpen={isGenerationSettingsOpen}
          onOpenChange={setIsGenerationSettingsOpen}
          settings={settingsQuery.data?.scheduling}
          onSave={async (newSettings) => {
            await updateSettings({ scheduling: newSettings });
            toast({ title: "Einstellungen gespeichert" });
            queryClient.invalidateQueries({ queryKey: ["settings"] });
            setIsGenerationSettingsOpen(false);
          }}
        />
      )}

      <DetailedAIGenerationModal
        isOpen={isDetailedAiModalOpen}
        onOpenChange={setIsDetailedAiModalOpen}
        onConfirm={handleDetailedAiModalConfirm}
      />

      <DiagnosticsDialog
        isOpen={isDiagnosticsOpen}
        onOpenChange={setIsDiagnosticsOpen}
        sessionId={lastSessionId}
      />

      <AddAvailabilityShiftsDialog
        isOpen={isAddAvailabilityShiftsDialogOpen}
        onOpenChange={setIsAddAvailabilityShiftsDialogOpen}
        type={availabilityShiftType}
      />

      {confirmDeleteMessage && (
        <AlertDialog open onOpenChange={() => setConfirmDeleteMessage(null)}>
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

      {confirmDeleteMessage && (
        <AlertDialog open onOpenChange={() => setConfirmDeleteMessage(null)}>
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
    </div>
  );
}
