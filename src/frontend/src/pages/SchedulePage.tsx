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

import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
// import { ShiftTable } from '@/components/ShiftTable'; // Original, might be unused if ScheduleManager is primary
import { useScheduleData } from "@/hooks/useScheduleData";
import {
  addDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
  getWeek,
  isBefore,
  differenceInCalendarWeeks,
  differenceInDays,
  parseISO,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  exportSchedule,
  updateSchedule,
  getSettings,
  updateSettings,
  createSchedule,
  getEmployees,
  getAbsences,
  fixScheduleDisplay,
  generateAiSchedule,
  importAiScheduleResponse,
} from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  AlertCircle,
  X,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
// import { ScheduleTable } from '@/components/ScheduleTable'; // Original, might be unused
// import { ScheduleOverview } from '@/components/Schedule/ScheduleOverview'; // Original, might be unused
import {
  Schedule,
  ScheduleError,
  ScheduleUpdate,
  Settings,
  AiImportResponse, // Import the new type
} from "@/types"; // Added Settings
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
import GenerationLogs from "@/components/Schedule/GenerationLogs";
import ScheduleErrors from "@/components/Schedule/ScheduleErrors";
import ScheduleControls from "@/components/Schedule/ScheduleControls";
import useScheduleGeneration from "@/hooks/useScheduleGeneration";
import useVersionControl from "@/hooks/useVersionControl";
import { DateRange } from "react-day-picker";
import { ScheduleActions } from "@/components/Schedule/ScheduleActions";
// import { ScheduleFixActions } from '@/components/Schedule/ScheduleFixActions'; // Original, might be unused
import { AddScheduleDialog } from "@/components/Schedule/AddScheduleDialog";
import { ScheduleStatistics } from "@/components/Schedule/ScheduleStatistics";
import { EnhancedDateRangeSelector } from "@/components/EnhancedDateRangeSelector";
import { VersionTable } from "@/components/Schedule/VersionTable";
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

function getErrorMessage(error: any): string {
  if (error && typeof error === "object" && "message" in error) {
    return error.message;
  }
  return "Ein unerwarteter Fehler ist aufgetreten";
}

export function SchedulePage() {
  // 1. All useState calls
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(today, { weekStartsOn: 1 }),
    to: endOfWeek(today, { weekStartsOn: 1 }),
  });
  const [weekAmount, setWeekAmount] = useState<number>(1);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(
    undefined,
  );
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(true);
  const [createEmptySchedules, setCreateEmptySchedules] = useState(true);
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false); // Keep if used by a dialog not yet removed
  const [isGenerationSettingsOpen, setIsGenerationSettingsOpen] =
    useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null); // Keep if used by features not yet removed
  const [isAddScheduleDialogOpen, setIsAddScheduleDialogOpen] = useState(false);
  const [employeeAbsences, setEmployeeAbsences] = useState<
    Record<number, any[]>
  >({}); // Keep if used by ScheduleTable/Manager
  const [enableDiagnostics, setEnableDiagnostics] = useState<boolean>(false);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<{
    title: string;
    message: string;
    details?: string[];
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [isAiDataPreviewOpen, setIsAiDataPreviewOpen] = useState<boolean>(false);
  const [aiPreviewData, setAiPreviewData] = useState<any>(null);

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
      .filter(([dayName, isOpen]) => isOpen) // Filter for days that are open
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
    versions, // This is number[] from the hook, might be `versionNumbers` or similar
    versionMetas, // This is VersionMeta[] from the hook, used for VersionTable etc.
    isLoading: isLoadingVersions,
  } = useVersionControl({
    dateRange,
    initialVersion: undefined,
    onVersionSelected: (version) => {
      console.log(
        "🔄 SchedulePage: Version selected by useVersionControl hook (onVersionSelected callback):",
        version,
      );
      setSelectedVersion(version); // Update local state, an effect will handle refetching
    },
  });

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
    versionControlSelectedVersion, // This comes from useVersionControl
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
  } = useScheduleGeneration({
    dateRange,
    selectedVersion: versionControlSelectedVersion,
    createEmptySchedules,
    enableDiagnostics,
    onSuccess: () => {
      refetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      toast({
        title: "Generation Complete",
        description: "The standard schedule has been generated successfully.",
      });
    },
  });

  // Mutations
  const exportMutation = useMutation<Blob, Error>({
    mutationFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Bitte wählen Sie einen Zeitraum aus");
      }
      addGenerationLog("info", "Starting PDF export");
      const response = await exportSchedule(
        format(dateRange.from, "yyyy-MM-dd"),
        format(dateRange.to, "yyyy-MM-dd"),
      );
      addGenerationLog("info", "PDF export completed");
      const blob = new Blob([response], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Schichtplan_${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}.pdf`;
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
      refetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ['versions'] });
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
    console.log("Retrying data fetch...");
    clearGenerationLogs();
    refetchScheduleData();
  }, [clearGenerationLogs, refetchScheduleData]);

  const handleExportSchedule = useCallback(() => {
    exportMutation.mutate();
  }, [exportMutation]);

  const handlePreviewAiData = useCallback(() => {
    if (!dateRange?.from || !dateRange?.to || !versionControlSelectedVersion) {
      toast({
        title: "Vorschau nicht möglich",
        description: "Bitte Zeitraum und Version wählen.",
        variant: "destructive",
      });
      return;
    }
    // Collect the data that would be sent to the AI.
    // This is a simplified representation based on available data.
    const dataToPreview = {
      dateRange: { from: dateRange.from, to: dateRange.to },
      version: versionControlSelectedVersion,
      schedules: scheduleData, // Current schedules in the selected range/version
      employees: employees, // All employees
      settings: effectiveSettingsData, // All effective settings
      employeeAbsences: employeeAbsences, // Employee absences
      // Add other relevant data like coverage, shift templates if available in scope
      // Note: A real AI integration might require more specific data structures
    };
    setAiPreviewData(dataToPreview);
    setIsAiDataPreviewOpen(true);
  }, [dateRange, versionControlSelectedVersion, scheduleData, employees, effectiveSettingsData, employeeAbsences]);

  const aiSystemPrompt = `You are an advanced AI scheduling assistant. Your task is to generate an optimal employee shift schedule based on the provided data and rules.\n  Schedule Period: ${dateRange?.from?.toISOString().split('T')[0]} to ${dateRange?.to?.toISOString().split('T')[0]}\n  Output Format:\n  Please provide the schedule STRICTLY in CSV format. The CSV should have the following columns, in this exact order:\n  EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime\n  Example CSV Row:\n  101,2024-07-15,3,Morning Shift,08:00,16:00\n  Instructions and Data:\n  1. Adhere to all specified coverage needs for each shift and day. Coverage blocks in the provided data define the minimum and maximum number of employees required during that specific time period.\n  2. Respect all employee availability (fixed, preferred, unavailable) and absences.\n  3. Consider general scheduling rules provided.\n  4. Aim for a fair distribution of shifts among employees.\n  5. Prioritize fulfilling fixed assignments and preferred shifts where possible.\n  6. Ensure assigned shifts match employee qualifications (i.e., keyholder).\n  7. The ShiftTemplateID in the output CSV must correspond to an existing ShiftTemplateID from the input data.\n  8. The Date must be in YYYY-MM-DD format.\n  9. StartTime and EndTime in the output CSV should be in HH:MM format and match the times of the assigned ShiftTemplateID.\n  10. Only output the CSV data. Do not include any explanations, comments, or any text before or after the CSV data block.`;

  const checkAndFixMissingTimeData = useCallback(async () => {
    if (
      !versionControlSelectedVersion ||
      !dateRange?.from ||
      !dateRange?.to ||
      !scheduleData
    ) {
      return;
    }
    const schedulesWithShiftId = scheduleData.filter(
      (s) => s.shift_id !== null,
    );
    const problemSchedules = schedulesWithShiftId.filter(
      (s) => !s.shift_start || !s.shift_end,
    );
    if (problemSchedules.length > 0) {
      const { dismiss } = toast({
        title: "Prüfe Schichtdaten...",
        description: "Überprüfe und korrigiere fehlende Zeitdaten...",
      });
      console.log(
        `🔧 Found ${problemSchedules.length} schedules with missing time data. Attempting to fix...`,
      );
      try {
        const result = await fixScheduleDisplay(
          format(dateRange.from, "yyyy-MM-dd"),
          format(dateRange.to, "yyyy-MM-dd"),
          versionControlSelectedVersion,
        );
        dismiss();
        toast({
          title: "Schichtdaten repariert",
          description: `${result.total_schedules || 0} Schichten geprüft, ${problemSchedules.length} Probleme gefunden, ${result.empty_schedules_count || 0} Einträge aktualisiert.`, // Corrected to use result properties
          variant: "default",
        });
        await refetchScheduleData();
      } catch (error) {
        dismiss();
        console.error("Failed to fix schedule time data:", error);
        toast({
          title: "Fehler bei der Korrektur",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      }
    }
  }, [
    versionControlSelectedVersion,
    dateRange,
    scheduleData,
    toast,
    refetchScheduleData,
  ]);

  // Page-level handler for creating a new version (delegates to hook's function)
  const handleCreateNewVersionPage = useCallback(() => {
    triggerCreateNewVersionHook(); // Call the renamed hook function
  }, [triggerCreateNewVersionHook]);

  // 7. All useEffect hooks
  useEffect(() => {
    if (scheduleErrorObj) {
      console.error("Schedule fetch error:", scheduleErrorObj);
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
    // This effect triggers data refetch when the locally managed `selectedVersion` changes.
    // `selectedVersion` is updated by the `onVersionSelected` callback from `useVersionControl`.
    if (selectedVersion !== undefined) {
      console.log(
        "🔄 SchedulePage: Local selectedVersion changed, refetching data for version:",
        selectedVersion,
      );
      refetchScheduleData();
    } else if (versionControlSelectedVersion === undefined) {
      // If the hook also indicates no version, refetch to clear (e.g., after delete)
      console.log(
        "🔄 SchedulePage: Both local and hook selectedVersion are undefined, refetching.",
      );
      refetchScheduleData();
    }
  }, [selectedVersion, refetchScheduleData, versionControlSelectedVersion]);

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
    dateRange,
    weekAmount,
    setDateRange,
    setWeekAmount,
  ]);

  useEffect(() => {
    if (
      scheduleData &&
      scheduleData.length > 0 &&
      !isLoadingVersions &&
      !isPending &&
      !isAiGenerating
    ) {
      checkAndFixMissingTimeData();
    }
  }, [
    scheduleData,
    isLoadingVersions,
    isPending,
    isAiGenerating,
    checkAndFixMissingTimeData,
  ]);

  const { data: absenceData } = useQuery({
    queryKey: ["absences"] as const, // Simplified query key
    queryFn: async () => {
      // The backend currently only supports fetching absences for a specific employee,
      // not by date range across all employees.
      // To avoid a 404, we will not call getAbsences with the date range.
      // A future task is needed to implement a backend route for fetching absences by date range.
      console.warn("Fetching all absences by date range is not yet supported by the backend.");
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

  // Conditional returns are now AFTER all hooks and necessary handler definitions
  if (isLoadingSchedule) {
    return (
      <div className="container mx-auto py-6 space-y-6">
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
    );
  }

  if (scheduleErrorObj) {
    return (
      <div className="container mx-auto py-4 space-y-4">
        <PageHeader title="Dienstplan" className="mb-4">
          <ScheduleControls
            onRefresh={handleRetryFetch}
            onExport={handleExportSchedule}
          />
        </PageHeader>
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
      </div>
    );
  }

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
    if (!versionControlSelectedVersion) {
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
      `Version: ${versionControlSelectedVersion}, Date range: ${formattedFromDate} - ${formattedToDate}`,
    );
    generate();
  };

  const handleGenerateAiSchedule = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Zeitraum erforderlich (AI)",
        description: "Bitte Zeitraum für AI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }
    if (!versionControlSelectedVersion) {
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
      `Version: ${versionControlSelectedVersion}, Date range: ${format(dateRange.from, "yyyy-MM-dd")} - ${format(dateRange.to, "yyyy-MM-dd")}`,
    );
    try {
      updateGenerationStep("ai-init", "in-progress");
      await new Promise((r) => setTimeout(r, 500));
      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      const toStr = format(dateRange.to, "yyyy-MM-dd");
      updateGenerationStep("ai-init", "completed");
      updateGenerationStep("ai-analyze", "in-progress");
      await new Promise((r) => setTimeout(r, 500));
      const result = await generateAiSchedule(
        fromStr,
        toStr,
        versionControlSelectedVersion,
      );
      updateGenerationStep("ai-analyze", "completed");
      updateGenerationStep("ai-generate", "in-progress");
      await new Promise((r) => setTimeout(r, 500));
      addGenerationLog("info", "AI schedule generation API call successful");
      if (result.schedules)
        addGenerationLog(
          "info",
          `Generated ${result.schedules.length} schedule entries`,
        );
      updateGenerationStep("ai-generate", "completed");
      updateGenerationStep("ai-finalize", "in-progress");
      await new Promise((r) => setTimeout(r, 500));
      await refetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      updateGenerationStep("ai-finalize", "completed");
      toast({
        title: "AI Generation Complete",
        description: "AI schedule generated successfully.",
      });
      if (result.logs?.length)
        result.logs.forEach((log) => addGenerationLog("info", "AI Log:", log));
      if (result.errors?.length) {
        result.errors.forEach((err) =>
          addGenerationLog("error", "AI Error:", getErrorMessage(err)),
        );
        toast({
          title: "AI Generation Warnings",
          description: `Completed with ${result.errors.length} issues.`,
          variant: "destructive",
        });
      }
      setTimeout(() => setIsAiGenerating(false), 2000);
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
      setTimeout(() => setIsAiGenerating(false), 3000);
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
      refetchScheduleData();
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
              console.error("Batch delete error:", batchError);
            }
          }
          queryClient.invalidateQueries({ queryKey: ["schedules"] });
          await refetchScheduleData();
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
    if (!versionControlSelectedVersion || !dateRange?.from || !dateRange?.to) {
      toast({ title: "Operation nicht möglich", variant: "destructive" });
      return;
    }
    addGenerationLog(
      "info",
      "Starting display fix",
      `Version: ${versionControlSelectedVersion}, Range: ${format(dateRange.from, "yy-MM-dd")} - ${format(dateRange.to, "yy-MM-dd")}`,
    );
    try {
      const result = await fixScheduleDisplay(
        format(dateRange.from, "yyyy-MM-dd"),
        format(dateRange.to, "yyyy-MM-dd"),
        versionControlSelectedVersion,
      );
      addGenerationLog(
        "info",
        "Display fix complete",
        `Fixed ${result.empty_schedules_count}. Days: ${result.days_fixed.join(", ") || "none"}`,
      );
      await refetchScheduleData();
      toast({
        title: "Display Fix Complete",
        description: `Fixed ${result.empty_schedules_count} schedules.`, // Corrected to use result property
      });
    } catch (error) {
      addGenerationLog("error", "Display fix failed", getErrorMessage(error));
      toast({
        title: "Display Fix Failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleWeekChange = (weekOffset: number) => {
    if (dateRange?.from) {
      const from = addWeeks(
        startOfWeek(dateRange.from, { weekStartsOn: 1 }),
        weekOffset,
      );
      from.setHours(0, 0, 0, 0);
      const to = addDays(from, 6 * weekAmount);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  };

  const handleDurationChange = (duration: number) => {
    setWeekAmount(duration);
    if (dateRange?.from) {
      const from = startOfWeek(dateRange.from, { weekStartsOn: 1 });
      const to = addDays(from, 6 * duration);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  };

  const handleShiftDrop = async (update: ScheduleUpdate) => {
    if (update.id === undefined || update.id === null) {
      toast({
        title: "Fehler Verschieben",
        description: "Ungültige ID.",
        variant: "destructive",
      });
      return;
    }
    try {
      await updateSchedule(update.id, {
        shift_id: update.shift_id,
        version: versionControlSelectedVersion,
        employee_id: update.employee_id,
      });
      await refetchScheduleData();
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

  const handleShiftUpdate = async (update: ScheduleUpdate) => {
    if (update.id === undefined || update.id === null) {
      toast({
        title: "Fehler Aktualisieren",
        description: "Ungültige ID.",
        variant: "destructive",
      });
      return;
    }
    try {
      await updateSchedule(update.id, {
        shift_id: update.shift_id,
        version: versionControlSelectedVersion,
        employee_id: update.employee_id,
      });
      await refetchScheduleData();
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

  const handleSettingsUpdate = async (updatedSettings: Settings) => {
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

  const isUpdating =
    isLoadingVersions ||
    isPending ||
    exportMutation.isPending ||
    isAiGenerating;
  const canFix =
    !!dateRange?.from && !!dateRange?.to && !!versionControlSelectedVersion;

  return (
    <div className="container mx-auto py-4 space-y-4">
      <div className="bg-red-200 p-4 text-xl font-bold text-center mb-4">
        DEBUG: SchedulePage rendering. Schedules: {scheduleData?.length || 0},
        Version: {selectedVersion ?? "N/A"}
      </div>
      <PageHeader title="Dienstplan" className="mb-4">
        <ScheduleControls
          onRefresh={handleRetryFetch}
          onExport={handleExportSchedule}
        />
      </PageHeader>

      <EnhancedDateRangeSelector
        dateRange={dateRange}
        scheduleDuration={weekAmount}
        onWeekChange={handleWeekChange}
        onDurationChange={handleDurationChange}
        hasVersions={versionMetas.length > 0} // Use versionMetas from useVersionControl
        onCreateNewVersion={handleCreateNewVersionPage} // Use page-level handler
        onCreateNewVersionWithSpecificDateRange={
          handleCreateNewVersionFromDialog
        }
      />

      {!isLoadingVersions &&
        scheduleData?.length > 0 &&
        dateRange?.from &&
        dateRange?.to && (
          <ScheduleStatistics
            schedules={scheduleData}
            employees={employees || []}
            startDate={format(dateRange.from, "yyyy-MM-dd")}
            endDate={format(dateRange.to, "yyyy-MM-dd")}
            version={versionControlSelectedVersion}
          />
        )}

      <div className="flex justify-start gap-2 mb-4">
        <ScheduleActions
          isLoading={isUpdating}
          isGenerating={isPending || isAiGenerating}
          canAdd={
            !!dateRange?.from &&
            !!dateRange?.to &&
            !!versionControlSelectedVersion
          }
          canDelete={
            scheduleData?.length > 0 && !!versionControlSelectedVersion
          }
          canGenerate={
            !!dateRange?.from &&
            !!dateRange?.to &&
            !!versionControlSelectedVersion
          }
          onAddSchedule={handleAddSchedule}
          onDeleteSchedule={handleDeleteSchedule}
          onGenerateStandardSchedule={handleGenerateStandardSchedule}
          onGenerateAiSchedule={handleGenerateAiSchedule}
          onOpenGenerationSettings={() => setIsGenerationSettingsOpen(true)}
          onFixDisplay={handleFixDisplay}
          onFixTimeData={checkAndFixMissingTimeData}
          canFix={canFix}
          isAiEnabled={!!settingsQuery.data?.ai_scheduling?.enabled}
          onPreviewAiData={handlePreviewAiData}
          onImportAiResponse={handleImportAiResponse} // Pass the new prop
        />
      </div>

      {versionMetas && versionMetas.length > 0 && (
        <VersionTable
          versions={versionMetas}
          selectedVersion={versionControlSelectedVersion}
          onSelectVersion={handleVersionChange} // from useVersionControl
          onPublishVersion={handlePublishVersion} // from useVersionControl
          onArchiveVersion={handleArchiveVersion} // from useVersionControl
          onDeleteVersion={triggerDeleteVersionHook} // Renamed from useVersionControl
          onDuplicateVersion={triggerDuplicateVersionHook} // Renamed from useVersionControl
          onCreateNewVersion={handleCreateNewVersionPage} // Page-level handler
        />
      )}

      <DndProvider backend={HTML5Backend}>

        {isLoadingSchedule ? (
          <div className="space-y-4">
            {/* Skeleton already defined earlier in this block */}
          </div>
        ) : (
          <>
            {errors.length > 0 && <ScheduleErrors errors={errors} />}
            <div className="relative">
              <ScheduleManager
                schedules={scheduleData || []} // Ensure array even if undefined
                dateRange={dateRange}
                onDrop={handleShiftDrop}
                onUpdate={handleShiftUpdate}
                isLoading={isLoadingSchedule}
                employeeAbsences={employeeAbsences}
                absenceTypes={
                  effectiveSettingsData?.employee_groups?.absence_types || []
                }
                currentVersion={versionControlSelectedVersion}
                openingDays={openingDays}
                isEmptyState={
                  !scheduleData ||
                  (scheduleData.length === 0 && !isLoadingSchedule)
                }
                versions={versionMetas || []}
                isGenerating={isPending || isAiGenerating}
                onEmptyStateCreateVersion={handleCreateNewVersionPage}
                onEmptyStateGenerateSchedule={handleGenerateStandardSchedule}
              />
            </div>
          </>
        )}
      </DndProvider>

      <GenerationOverlay
        generationSteps={generationSteps}
        generationLogs={generationLogs}
        showGenerationOverlay={showGenerationOverlay || isAiGenerating}
        isPending={isPending || isAiGenerating}
        resetGenerationState={() => {
          resetGenerationState();
          setIsAiGenerating(false);
        }}
        addGenerationLog={addGenerationLog}
      />

      <GenerationLogs logs={generationLogs} clearLogs={clearGenerationLogs} />

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
              settings={settingsQuery.data}
              onUpdate={handleSettingsUpdate}
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
              isGenerating={isPending || isAiGenerating}
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

      {isAddScheduleDialogOpen && versionControlSelectedVersion && (
        <AddScheduleDialog
          isOpen={isAddScheduleDialogOpen}
          onClose={() => setIsAddScheduleDialogOpen(false)}
          onAddSchedule={handleCreateSchedule}
          version={versionControlSelectedVersion}
          defaultDate={dateRange?.from}
        />
      )}

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
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>KI Daten Vorschau</DialogTitle>
            <DialogDescription>Vorschau der Daten, die an die KI gesendet werden</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap max-h-[60vh] overflow-y-auto p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-sm">
            <p className="font-semibold mb-2">KI System Prompt:</p>
            <p className="mb-4">{aiSystemPrompt}</p>
            <p className="font-semibold mb-2">Daten für KI:</p>
            {JSON.stringify(aiPreviewData, null, 2)}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (aiPreviewData) {
                  navigator.clipboard.writeText(JSON.stringify(aiPreviewData, null, 2));
                }
              }}
            >
              Kopieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
