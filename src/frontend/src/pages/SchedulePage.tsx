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

import React, { useState, useEffect } from 'react';
import { ShiftTable } from '@/components/ShiftTable';
import { useScheduleData } from '@/hooks/useScheduleData';
import { addDays, startOfWeek, endOfWeek, addWeeks, format, getWeek, isBefore, differenceInCalendarWeeks } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery } from '@tanstack/react-query';
// MODIFIED: Added generateAiSchedule
import { exportSchedule, updateShiftDay, updateBreakNotes, updateSchedule, getSchedules, getSettings, updateSettings, createSchedule, getEmployees, getAbsences, fixScheduleDisplay, generateAiSchedule } from '@/services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, X, Calendar, CheckCircle, XCircle, RefreshCw, Plus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ScheduleTable } from '@/components/ScheduleTable';
import { ScheduleOverview } from '@/components/Schedule/ScheduleOverview';
import { Schedule, ScheduleError, ScheduleUpdate, ShiftType } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/PageHeader';
import { getAvailableCalendarWeeks, getDateRangeFromWeekAndCount } from '@/utils/dateUtils';
import { ScheduleVersions } from '@/components/Schedule/ScheduleVersions';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { VersionControl } from '@/components/VersionControl';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { ScheduleGenerationSettings } from '@/components/ScheduleGenerationSettings';
import type { ScheduleResponse } from '@/services/api';
import { type Settings } from '@/types';
import { type Schedule as APISchedule } from '@/services/api';
import { type UseScheduleDataResult } from '@/hooks/useScheduleData';
import { DateRangeSelector } from '@/components/DateRangeSelector';
// Import the new components and hooks
import GenerationOverlay from '@/components/Schedule/GenerationOverlay';
import GenerationLogs from '@/components/Schedule/GenerationLogs';
import ScheduleErrors from '@/components/Schedule/ScheduleErrors';
import ScheduleControls from '@/components/Schedule/ScheduleControls';
import useScheduleGeneration from '@/hooks/useScheduleGeneration';
import useVersionControl from '@/hooks/useVersionControl';
import { DateRange } from 'react-day-picker';
import { ScheduleActions } from '@/components/Schedule/ScheduleActions';
import { AddScheduleDialog } from '@/components/Schedule/AddScheduleDialog';
import { ScheduleStatistics } from '@/components/Schedule/ScheduleStatistics';
import { EnhancedDateRangeSelector } from '@/components/EnhancedDateRangeSelector';
import { VersionTable } from '@/components/Schedule/VersionTable';
import { ScheduleManager } from '@/components/ScheduleManager';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function SchedulePage() {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(today),
    to: endOfWeek(today),
  });
  const [weekAmount, setWeekAmount] = useState<number>(1);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(true);
  const [createEmptySchedules, setCreateEmptySchedules] = useState(true);
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [isGenerationSettingsOpen, setIsGenerationSettingsOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<'table' | 'grid'>('table');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddScheduleDialogOpen, setIsAddScheduleDialogOpen] = useState(false);
  const [employeeAbsences, setEmployeeAbsences] = useState<Record<number, any[]>>({});
  const [enableDiagnostics, setEnableDiagnostics] = useState<boolean>(false);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false); // MODIFIED: Added for AI generation loading state

  // Add settings query back inside the component
  const settingsQuery = useQuery<Settings, Error>({
    queryKey: ['settings'] as const,
    queryFn: async () => {
      const response = await getSettings();
      return response;
    },
    retry: 3,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Add a useEffect to update enableDiagnostics when settings change
  useEffect(() => {
    if (settingsQuery.data?.scheduling?.enable_diagnostics !== undefined) {
      setEnableDiagnostics(settingsQuery.data.scheduling.enable_diagnostics);
    }
  }, [settingsQuery.data]);

  // Initialize date range with current week
  useEffect(() => {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      const today = new Date();
      const from = startOfWeek(today, { weekStartsOn: 1 });
      from.setHours(0, 0, 0, 0);
      const to = addDays(from, 6 * weekAmount); // Use weekAmount to set the end date
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  }, [weekAmount]); // Add weekAmount as a dependency

  // Function to update date range when selecting a different week
  const handleWeekChange = (weekOffset: number) => {
    if (dateRange?.from) {
      const from = addWeeks(startOfWeek(dateRange.from, { weekStartsOn: 1 }), weekOffset);
      from.setHours(0, 0, 0, 0);
      const to = addDays(from, 6 * weekAmount);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  };

  // Function to handle schedule duration change
  const handleDurationChange = (duration: number) => {
    setWeekAmount(duration);

    // Update end date based on new duration
    if (dateRange?.from) {
      const from = dateRange.from;
      const to = addDays(startOfWeek(from, { weekStartsOn: 1 }), 6 * duration);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  };

  // Use our version control hook
  const {
    selectedVersion: versionControlSelectedVersion,
    handleVersionChange,
    handleCreateNewVersion,
    handlePublishVersion,
    handleArchiveVersion,
    handleDeleteVersion,
    handleDuplicateVersion,
    handleCreateNewVersionWithOptions: versionControlCreateWithOptions,
    versions,
    versionMetas,
    isLoading: isLoadingVersions
  } = useVersionControl({
    dateRange,
    onVersionSelected: (version) => {
      // When a version is selected via the version control, we need to refetch data
      refetchScheduleData();
    }
  });

  // Use our schedule generation hook (for standard generation)
  const {
    generationSteps,
    generationLogs,
    showGenerationOverlay,
    isPending: isStandardGenerationPending, // MODIFIED: Renamed for clarity
    generate: standardGenerate, // MODIFIED: Renamed for clarity
    resetGenerationState,
    addGenerationLog,
    clearGenerationLogs
  } = useScheduleGeneration({
    dateRange,
    selectedVersion: versionControlSelectedVersion,
    createEmptySchedules,
    enableDiagnostics,
    onSuccess: () => {
      // After generation completes successfully, refresh the data
      refetchScheduleData();

      // Force refresh the versions data as well to ensure we have the latest
      queryClient.invalidateQueries({ queryKey: ['versions'] });

      // Show a success message
      toast({
        title: "Generation Complete",
        description: "The standard schedule has been generated successfully."
      });
    }
  });

  // Update the useQuery hook with proper types and error handling
  const {
    data,
    isLoading,
    refetch: refetchScheduleData,
    isError,
    error,
  } = useQuery<ScheduleResponse, Error>({
    queryKey: ['schedules', dateRange?.from, dateRange?.to, versionControlSelectedVersion, includeEmpty],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        return {
          schedules: [],
          versions: [],
          version_statuses: {},
          current_version: undefined,
          version_meta: undefined,
          errors: [],
          filtered_schedules: 0,
          total_schedules: 0
        };
      }

      try {
        const fromStr = format(dateRange.from, 'yyyy-MM-dd');
        const toStr = format(dateRange.to, 'yyyy-MM-dd');

        console.log('🔄 Fetching schedules:', { fromStr, toStr, versionControlSelectedVersion, includeEmpty });

        const response = await getSchedules(
          fromStr,
          toStr,
          versionControlSelectedVersion,
          includeEmpty
        );

        console.log('📊 Schedule details:', {
          totalSchedules: response.schedules?.length || 0,
          schedulesWithShifts: response.schedules?.filter(s => s.shift_id !== null)?.length || 0,
          uniqueEmployees: [...new Set(response.schedules?.map(s => s.employee_id) || [])].length,
          firstSchedule: response.schedules?.[0] || 'No schedules found',
          dateRange: { fromStr, toStr },
          includeEmpty,
          versionControlSelectedVersion
        });

        return response;
      } catch (err) {
        console.error('❌ Error fetching schedules:', err);
        throw err;
      }
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Extract schedule data with proper types
  const { scheduleData, errors: scheduleErrors, loading: isLoadingSchedule, error: scheduleError } = useScheduleData(
    dateRange?.from ?? new Date(),
    dateRange?.to ?? new Date(),
    versionControlSelectedVersion,
    includeEmpty
  );

  const errors = data?.errors || [];

  // Log fetch errors
  useEffect(() => {
    if (error) {
      console.error('Schedule fetch error:', error);
      addGenerationLog('error', 'Error fetching schedule data',
        error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten");
    }
  }, [error]);

  // Add a retry mechanism for failed data fetches
  const handleRetryFetch = () => {
    console.log('Retrying data fetch...');
    // Clear any existing errors
    clearGenerationLogs();
    // Force refetch
    refetchScheduleData();
  };

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Bitte wählen Sie einen Zeitraum aus");
      }
      addGenerationLog('info', 'Starting PDF export');
      const response = await exportSchedule(
        dateRange.from.toISOString().split('T')[0],
        dateRange.to.toISOString().split('T')[0]
      );
      addGenerationLog('info', 'PDF export completed');
      const blob = new Blob([response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Schichtplan_${dateRange.from.toISOString().split('T')[0]}_${dateRange.to.toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onError: (error) => {
      addGenerationLog('error', 'PDF export failed',
        error instanceof Error ? error.message : "Unknown error");
      toast({
        title: "Fehler beim Export",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ scheduleId, updates }: { scheduleId: number, updates: ScheduleUpdate }) => {
      console.log('🔶 updateShiftMutation called with:', { scheduleId, updates });
      addGenerationLog('info', 'Updating shift',
        `Schedule ID: ${scheduleId}, Updates: ${JSON.stringify(updates)}`);

      try {
        const response = await updateSchedule(scheduleId, updates);
        console.log('🔶 updateShiftMutation success:', response);
        return { response, scheduleId, isNew: scheduleId === 0 };
      } catch (error) {
        console.error('🔶 updateShiftMutation error:', error);
        throw error;
      }
    },
    onSuccess: async ({ response, scheduleId, isNew }) => {
      try {
        console.log('🔶 updateShiftMutation onSuccess - about to refetch:', { response, scheduleId, isNew });

        // Wait a brief moment to ensure the backend has processed the update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Force invalidate any cached queries
        queryClient.invalidateQueries({ queryKey: ['schedules'] });

        // Immediately refetch to show updated data
        await refetchScheduleData();

        console.log('🔶 updateShiftMutation onSuccess - refetch completed');

        toast({
          title: "Success",
          description: isNew ? "Shift created successfully" : "Shift updated successfully",
        });

        if (isNew) {
          // For new schedules, log additional details for debugging
          addGenerationLog('info', 'New shift created',
            `New Schedule ID: ${response.id}, Employee ID: ${response.employee_id}, Shift ID: ${response.shift_id}`);
          console.log('🔶 New shift created:', response);
        }
      } catch (error) {
        console.error('🔄 Error refetching data after update:', error);
        // Still show success toast since the update succeeded
        toast({
          title: "Success",
          description: isNew ? "Shift created successfully" : "Shift updated successfully",
        });
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update shift";
      addGenerationLog('error', 'Failed to update shift', errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const updateBreakNotesMutation = useMutation({
    mutationFn: async ({ employeeId, day, notes }: { employeeId: number; day: number; notes: string }) => {
      if (!dateRange?.from) {
        throw new Error("Kein Zeitraum ausgewählt");
      }
      const date = addDays(dateRange.from, day);
      return updateBreakNotes(employeeId, date.toISOString().split('T')[0], notes);
    },
    onSuccess: () => {
      refetchScheduleData();
      toast({
        title: "Erfolg",
        description: "Pausennotizen wurden aktualisiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  const handleShiftDrop = async (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => {
    try {
      await updateSchedule(scheduleId, {
        employee_id: newEmployeeId,
        date: format(newDate, 'yyyy-MM-dd'),
        shift_id: newShiftId,
        version: versionControlSelectedVersion
      });

      console.log(`Updated schedule ${scheduleId} with version ${versionControlSelectedVersion}`);

      // Force invalidate any cached queries
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });

      // Immediately refetch to show updated data
      await refetchScheduleData();

      toast({
        title: "Schicht aktualisiert",
        description: "Die Schicht wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const handleShiftUpdate = async (scheduleId: number, updates: ScheduleUpdate): Promise<void> => {
    try {
      // Add the current version to the updates
      const updatesWithVersion = {
        ...updates,
        version: versionControlSelectedVersion
      };

      console.log('Updating schedule with:', { scheduleId, updates: updatesWithVersion });

      // Call the mutation
      await updateShiftMutation.mutateAsync({ scheduleId, updates: updatesWithVersion });
    } catch (error) {
      console.error('Error in handleShiftUpdate:', error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
      throw error; // Re-throw to allow calling code to handle it
    }
  };

  const handleBreakNotesUpdate = async (employeeId: number, day: number, notes: string) => {
    await updateBreakNotesMutation.mutateAsync({ employeeId, day, notes });
  };

  // Add settings update handler
  const handleSettingsUpdate = async (updates: Partial<Settings['scheduling']['generation_requirements']>) => {
    try {
      if (!settingsQuery.data) {
        throw new Error("Settings not loaded");
      }

      console.log('Updating settings with:', updates);

      // Create a deep copy of current settings to avoid mutation issues
      const currentSettings = JSON.parse(JSON.stringify(settingsQuery.data));

      // Ensure scheduling exists
      if (!currentSettings.scheduling) {
        currentSettings.scheduling = {
          generation_requirements: {}
        };
      }

      // Ensure generation_requirements exists in scheduling
      if (!currentSettings.scheduling.generation_requirements) {
        currentSettings.scheduling.generation_requirements = {};
      }

      // Update the primary generation_requirements for API consumption
      currentSettings.scheduling.generation_requirements = {
        ...currentSettings.scheduling.generation_requirements,
        ...updates
      };

      // Also update scheduling_advanced for backward compatibility
      if (!currentSettings.scheduling_advanced) {
        currentSettings.scheduling_advanced = {};
      }

      if (!currentSettings.scheduling_advanced.generation_requirements) {
        currentSettings.scheduling_advanced.generation_requirements = {};
      }

      // Update scheduling_advanced.generation_requirements
      currentSettings.scheduling_advanced.generation_requirements = {
        ...currentSettings.scheduling_advanced.generation_requirements,
        ...updates
      };

      console.log('About to update settings with:', {
        newSettings: currentSettings,
        generation: currentSettings.scheduling?.generation_requirements,
        advanced: currentSettings.scheduling_advanced?.generation_requirements
      });

      // Send the updated settings to the backend
      await updateSettings(currentSettings);

      // Log the update
      addGenerationLog('info', 'Generation settings updated',
        Object.entries(updates)
          .map(([key, value]) => `${key}: ${value ? 'enabled' : 'disabled'}`)
          .join(', ')
      );

      // Refresh settings data
      await settingsQuery.refetch();

      toast({
        title: "Einstellungen gespeichert",
        description: "Generierungseinstellungen wurden aktualisiert"
      });

      return true;
    } catch (error) {
      console.error('Error updating settings:', error);

      addGenerationLog('error', 'Failed to update settings',
        error instanceof Error ? error.message : 'Unknown error'
      );

      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });

      throw error;
    }
  };

  // Convert API Schedule to frontend Schedule
  const convertSchedule = (apiSchedule: APISchedule): Schedule => {
    // Log for debugging shift_type
    if (apiSchedule.shift_id && !apiSchedule.shift_type_id) {
      console.log('Schedule without shift_type_id:', apiSchedule);
    }

    // Check if shift_type_id is a valid ShiftType
    const validShiftTypes: ShiftType[] = ['EARLY', 'MIDDLE', 'LATE', 'NO_WORK'];
    const shift_type_id = apiSchedule.shift_type_id && validShiftTypes.includes(apiSchedule.shift_type_id as any) 
      ? apiSchedule.shift_type_id as ShiftType 
      : undefined;

    return {
      id: apiSchedule.id,
      employee_id: apiSchedule.employee_id,
      date: apiSchedule.date,
      shift_id: apiSchedule.shift_id,
      shift_start: apiSchedule.shift_start ?? null,
      shift_end: apiSchedule.shift_end ?? null,
      is_empty: apiSchedule.is_empty ?? false,
      version: apiSchedule.version,
      status: apiSchedule.status as Schedule['status'],
      break_start: apiSchedule.break_start ?? null,
      break_end: apiSchedule.break_end ?? null,
      notes: apiSchedule.notes ?? null,
      employee_name: undefined,
      shift_type_id
    };
  };

  // Convert schedules for the ScheduleTable
  const convertedSchedules = (data?.schedules ?? []).map((apiSchedule) => convertSchedule(apiSchedule));

  // Fetch employee data for statistics
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  // Fetch settings to get absence types
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings
  });

  // Fetch employee absences when date range changes
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      const fetchAbsences = async () => {
        // Get all employees
        const employees = await getEmployees();
        const absences: Record<number, any[]> = {};

        // Fetch absences for each employee
        for (const employee of employees) {
          try {
            const employeeAbsences = await getAbsences(employee.id);
            absences[employee.id] = employeeAbsences;
          } catch (error) {
            console.error(`Failed to fetch absences for employee ${employee.id}:`, error);
          }
        }

        setEmployeeAbsences(absences);
      };

      fetchAbsences();
    }
  }, [dateRange]);

  // Show loading skeleton for initial data fetch
  if (isLoading && !scheduleData) {
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

  // Function to handle exporting the schedule
  const handleExportSchedule = () => {
    exportMutation.mutate();
  };

  // Show loading overlay for subsequent data fetches
  const isUpdating = isLoading || updateShiftMutation.isPending || isStandardGenerationPending || exportMutation.isPending || isAiGenerating; // MODIFIED: Added isAiGenerating

  // Function to handle the STANDARD generate action
  const handleGenerateStandardSchedule = () => { // MODIFIED: Renamed from handleGenerateSchedule
    try {
      // Validate date range
      if (!dateRange?.from || !dateRange?.to) {
        toast({
          title: "Zeitraum erforderlich",
          description: "Bitte wählen Sie einen Zeitraum aus bevor Sie den Dienstplan generieren.",
          variant: "destructive"
        });
        return;
      }

      // Validate version selection
      if (!versionControlSelectedVersion) {
        toast({
          title: "Version erforderlich",
          description: "Bitte wählen Sie eine Version aus bevor Sie den Dienstplan generieren.",
          variant: "destructive"
        });
        return;
      }

      // Make sure version data is loaded
      if (isLoadingVersions) {
        toast({
          title: "Versionen werden geladen",
          description: "Bitte warten Sie, bis die Versionen geladen sind.",
          variant: "destructive"
        });
        return;
      }

      console.log("📋 Generating STANDARD schedule with:", {
        dateRange: {
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString()
        },
        versionControlSelectedVersion,
        versionMetas,
        createEmptySchedules
      });

      const formattedFromDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedToDate = format(dateRange.to, 'yyyy-MM-dd');

      addGenerationLog('info', 'Starting STANDARD schedule generation',
        `Version: ${versionControlSelectedVersion}, Date range: ${formattedFromDate} - ${formattedToDate}`);

      standardGenerate(); // MODIFIED: Call renamed function from hook
    } catch (error) {
      console.error("Standard Generation error:", error);
      addGenerationLog('error', 'Fehler bei der Standard-Generierung',
        error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten");

      toast({
        title: "Fehler bei der Standard-Generierung",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  // MODIFIED: Added handler for AI Schedule Generation
  const handleGenerateAiSchedule = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Zeitraum erforderlich (AI)",
        description: "Bitte wählen Sie einen Zeitraum für die AI-Generierung aus.",
        variant: "destructive"
      });
      return;
    }
    if (!versionControlSelectedVersion) {
      toast({
        title: "Version erforderlich (AI)",
        description: "Bitte wählen Sie eine Version für die AI-Generierung aus.",
        variant: "destructive"
      });
      return;
    }

    setIsAiGenerating(true);
    // Use addGenerationLog if you want AI logs in the same overlay, or handle logging separately.
    addGenerationLog('info', 'Starting AI schedule generation',
      `Version: ${versionControlSelectedVersion}, Date range: ${format(dateRange.from, 'yyyy-MM-dd')} - ${format(dateRange.to, 'yyyy-MM-dd')}`);
    
    // Show overlay for AI generation if desired
    // setShowGenerationOverlay(true); // You might want a different overlay or adapt the existing one

    try {
      const fromStr = format(dateRange.from, 'yyyy-MM-dd');
      const toStr = format(dateRange.to, 'yyyy-MM-dd');
      
      const result = await generateAiSchedule(fromStr, toStr, versionControlSelectedVersion);
      
      addGenerationLog('info', 'AI schedule generation API call successful');
      console.log("AI Generation Result:", result);

      await refetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      
      toast({
        title: "AI Generation Complete",
        description: "The AI schedule has been generated successfully.",
      });

      // if (result.logs) { // Assuming ScheduleResponse has logs for AI too
      //   result.logs.forEach(log => addGenerationLog('info', 'AI Log:', log));
      // }
      // if (result.errors && result.errors.length > 0) {
      //   result.errors.forEach(err => addGenerationLog('error', 'AI Error:', err.message));
      //   toast({
      //     title: "AI Generation Warnings",
      //     description: `AI generation completed with ${result.errors.length} issues.`,
      //     variant: "destructive"
      //   });
      // }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ein unerwarteter Fehler bei der AI-Generierung ist aufgetreten";
      addGenerationLog('error', 'Fehler bei der AI-Generierung', errorMessage);
      console.error("AI Generation error:", err);
      toast({
        title: "Fehler bei der AI-Generierung",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsAiGenerating(false);
      // resetGenerationState(); // Or a specific reset for AI if the overlay was used
    }
  };

  // Handler for adding a new empty schedule
  const handleAddSchedule = () => {
    if (!versionControlSelectedVersion) {
      toast({
        title: "Keine Version ausgewählt",
        description: "Bitte wählen Sie zuerst eine Version aus.",
        variant: "destructive"
      });
      return;
    }

    setIsAddScheduleDialogOpen(true);
  };

  // Function to handle the actual schedule creation
  const handleCreateSchedule = async (scheduleData: {
    employee_id: number;
    date: string;
    shift_id: number;
    version: number;
  }) => {
    try {
      await createSchedule(scheduleData);

      // Refetch schedule data to reflect changes
      refetchScheduleData();

      toast({
        title: "Schichtplan erstellt",
        description: `Ein neuer Schichtplan wurde erfolgreich erstellt.`,
      });
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast({
        title: "Fehler beim Erstellen",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Handler for deleting the current schedule
  const handleDeleteSchedule = () => {
    if (!versionControlSelectedVersion) {
      toast({
        title: "Keine Version ausgewählt",
        description: "Bitte wählen Sie zuerst eine Version aus.",
        variant: "destructive"
      });
      return;
    }

    if (convertedSchedules.length === 0) {
      toast({
        title: "Keine Schichtpläne",
        description: "Es gibt keine Schichtpläne zum Löschen.",
        variant: "destructive"
      });
      return;
    }

    // Create confirmation dialog with detailed information
    setConfirmDeleteMessage({
      title: "Schichtplan endgültig löschen?",
      message: `Sie sind dabei, alle ${convertedSchedules.length} Schichtpläne der Version ${versionControlSelectedVersion} zu löschen. Diese Aktion betrifft:`,
      details: [
        `• ${new Set(convertedSchedules.map(s => s.employee_id)).size} Mitarbeiter`,
        `• Zeitraum: ${format(dateRange?.from || new Date(), 'dd.MM.yyyy')} - ${format(dateRange?.to || new Date(), 'dd.MM.yyyy')}`,
        `• ${convertedSchedules.filter(s => s.shift_id !== null).length} zugewiesene Schichten`
      ],
      onConfirm: async () => {
        try {
          const deletePromises = convertedSchedules.map(schedule =>
            updateSchedule(schedule.id, { shift_id: null, version: versionControlSelectedVersion })
          );
          await Promise.all(deletePromises);
          await refetchScheduleData();

          toast({
            title: "Schichtpläne gelöscht",
            description: `${deletePromises.length} Einträge wurden entfernt.`,
          });
        } catch (error) {
          console.error('Error deleting schedules:', error);
          toast({
            title: "Fehler beim Löschen",
            description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
            variant: "destructive"
          });
        } finally {
          setConfirmDeleteMessage(null);
        }
      },
      onCancel: () => {
        setConfirmDeleteMessage(null);
      }
    });
  };

  // Add state for confirmation dialog
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<{
    title: string;
    message: string;
    details?: string[];
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const handleIncludeEmptyChange = (checked: boolean) => {
    console.log("Toggling includeEmpty:", { from: includeEmpty, to: checked });
    setIncludeEmpty(checked);
    addGenerationLog('info', `Will ${checked ? 'show' : 'hide'} empty schedules`);
  };

  const handleCreateEmptyChange = (checked: boolean) => {
    console.log("Toggling createEmptySchedules:", { from: createEmptySchedules, to: checked });
    setCreateEmptySchedules(checked);
    addGenerationLog('info', `Will ${checked ? 'create' : 'not create'} empty schedules for all employees during generation`);
  };

  // Renamed and updated function to handle new version creation from specific dates
  const handleCreateNewVersionFromDialog = (options: { dateRange: DateRange }) => {
    console.log('Creating new version from dialog with specific dateRange:', options.dateRange);

    if (options.dateRange.from && options.dateRange.to) {
      // Set the page's main dateRange to exactly what was selected in the dialog
      setDateRange(options.dateRange);

      // Calculate the weekAmount that corresponds to this new specific dateRange
      let newCalculatedWeekAmount = 1;
      if (options.dateRange.to >= options.dateRange.from) { // Ensure 'to' is not before 'from'
        newCalculatedWeekAmount = differenceInCalendarWeeks(
          options.dateRange.to,
          options.dateRange.from,
          { weekStartsOn: 1 }
        ) + 1;
      }
      // Update the page's weekAmount state. This will also make the "Anzahl Wochen" dropdown consistent.
      setWeekAmount(newCalculatedWeekAmount);

      // Call the version control hook's function to create the version in the backend.
      // The hook itself doesn't use weekAmount for the API call but it's part of its current signature.
      versionControlCreateWithOptions({
        dateRange: options.dateRange,
        weekAmount: newCalculatedWeekAmount 
      });
    } else {
      toast({
        title: "Fehler",
        description: "Ungültiger Zeitraum für neue Version ausgewählt.",
        variant: "destructive",
      });
    }
  };

  // Add a handler for view changes
  const handleViewChange = (newView: 'table' | 'grid') => {
    setActiveView(newView);
  };

  // Handler for fixing the schedule display
  const handleFixDisplay = async () => {
    if (!versionControlSelectedVersion) {
      toast({
        title: "No version selected",
        description: "Please select a version to fix the display",
        variant: "destructive",
      });
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "No date range selected",
        description: "Please select a date range to fix the display",
        variant: "destructive",
      });
      return;
    }

    addGenerationLog('info', 'Starting display fix', 
      `Version: ${versionControlSelectedVersion}, Date range: ${format(dateRange.from, 'yyyy-MM-dd')} - ${format(dateRange.to, 'yyyy-MM-dd')}`);

    try {
      const result = await fixScheduleDisplay(
        format(dateRange.from, 'yyyy-MM-dd'),
        format(dateRange.to, 'yyyy-MM-dd'),
        versionControlSelectedVersion
      );

      addGenerationLog('info', 'Display fix complete', 
        `Fixed ${result.empty_schedules_count} schedules. Days fixed: ${result.days_fixed.join(', ') || 'none'}`);

      // Refetch to show updated data
      await refetchScheduleData();

      toast({
        title: "Display Fix Complete",
        description: `Fixed ${result.empty_schedules_count} schedules.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      addGenerationLog('error', 'Display fix failed', errorMessage);
      
      toast({
        title: "Display Fix Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Add a handler for enableDiagnostics change
  const handleEnableDiagnosticsChange = (checked: boolean) => {
    setEnableDiagnostics(checked);
  };

  return (
    <div className="container mx-auto py-4 space-y-4">
      <PageHeader title="Dienstplan" className="mb-4">
        <ScheduleControls
          onRefresh={handleRetryFetch}
          onExport={handleExportSchedule}
        />
      </PageHeader>

      {/* Enhanced Date Range Selector with version confirmation */}
      <EnhancedDateRangeSelector
        dateRange={dateRange}
        scheduleDuration={weekAmount}
        onWeekChange={handleWeekChange}
        onDurationChange={handleDurationChange}
        hasVersions={versions.length > 0}
        onCreateNewVersion={handleCreateNewVersion}
        onCreateNewVersionWithSpecificDateRange={handleCreateNewVersionFromDialog}
      />

      {/* Add Schedule Statistics if we have data */}
      {!isLoading && !isError && convertedSchedules.length > 0 && dateRange?.from && dateRange?.to && (
        <ScheduleStatistics
          schedules={convertedSchedules}
          employees={employees || []}
          startDate={format(dateRange.from, 'yyyy-MM-dd')}
          endDate={format(dateRange.to, 'yyyy-MM-dd')}
          version={versionControlSelectedVersion}
        />
      )}

      {/* Version Table */}
      {versionMetas && versionMetas.length > 0 && (
        <VersionTable
          versions={versionMetas}
          selectedVersion={versionControlSelectedVersion}
          onSelectVersion={handleVersionChange}
          onPublishVersion={handlePublishVersion}
          onArchiveVersion={handleArchiveVersion}
          onDeleteVersion={handleDeleteVersion}
          onDuplicateVersion={handleDuplicateVersion}
          onCreateNewVersion={handleCreateNewVersion}
        />
      )}

      {/* Schedule Actions */}
      <div className="flex justify-end mb-4">
        <ScheduleActions
          onAddSchedule={handleAddSchedule}
          onDeleteSchedule={handleDeleteSchedule}
          onGenerateStandardSchedule={handleGenerateStandardSchedule} // MODIFIED
          onGenerateAiSchedule={handleGenerateAiSchedule}         // MODIFIED
          onOpenGenerationSettings={() => setIsGenerationSettingsOpen(true)}
          onFixDisplay={handleFixDisplay}
          isLoading={isLoadingSchedule || isLoadingVersions}
          isGenerating={isStandardGenerationPending || isAiGenerating} // MODIFIED
          canAdd={!!versionControlSelectedVersion}
          canDelete={!!versionControlSelectedVersion && convertedSchedules.length > 0}
          canGenerate={!!versionControlSelectedVersion && !(isStandardGenerationPending || isAiGenerating)} // MODIFIED
          canFix={!!versionControlSelectedVersion}
          activeView={activeView}
          onViewChange={handleViewChange}
        />
      </div>

      {/* Schedule Content */}
      <DndProvider backend={HTML5Backend}>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : isError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Fehler beim Laden des Dienstplans</AlertTitle>
            <AlertDescription className="flex flex-col">
              <div>Failed to fetch schedules: Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.</div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-fit"
                onClick={handleRetryFetch}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Erneut versuchen
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {scheduleErrors.length > 0 && <ScheduleErrors errors={scheduleErrors} />}

            {convertedSchedules.length === 0 && !isLoading && !isError ? (
              <Card className="mb-4 border-dashed border-2 border-muted">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Keine Einträge gefunden</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {versions.length === 0
                      ? "Für den ausgewählten Zeitraum wurde noch keine Version erstellt."
                      : "Für den ausgewählten Zeitraum wurden keine Schichtplan-Einträge gefunden."}
                  </p>
                  {versions.length === 0 ? (
                    <Button
                      onClick={handleCreateNewVersion}
                      disabled={isLoadingVersions || !dateRange?.from || !dateRange?.to}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Erste Version erstellen
                    </Button>
                  ) : (
                    // This button might need to become a DropdownMenu as well, or ScheduleActions used here.
                    <Button 
                      onClick={handleGenerateStandardSchedule} // Default to standard, or show dropdown
                      disabled={(isStandardGenerationPending || isAiGenerating) || !versionControlSelectedVersion}
                      className="flex items-center gap-2"
                    >
                      {(isStandardGenerationPending || isAiGenerating) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Schichtplan generieren
                    </Button>
                  )}
                  {!versionControlSelectedVersion && versions.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Bitte wählen Sie eine Version aus, um den Dienstplan zu generieren.
                    </p>
                  )}
                  {(!dateRange?.from || !dateRange?.to) && versions.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Bitte wählen Sie einen Datumsbereich aus, um eine Version zu erstellen.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="relative">
                <ScheduleManager
                  schedules={convertedSchedules}
                  dateRange={dateRange}
                  onDrop={handleShiftDrop}
                  onUpdate={handleShiftUpdate}
                  isLoading={isLoadingSchedule}
                  employeeAbsences={employeeAbsences}
                  absenceTypes={settingsData?.employee_groups?.absence_types || []}
                  activeView={activeView}
                  currentVersion={versionControlSelectedVersion}
                />
              </div>
            )}
          </>
        )}
      </DndProvider>

      {/* Use our extracted components */}
      <GenerationOverlay
        generationSteps={generationSteps}
        generationLogs={generationLogs}
        showGenerationOverlay={showGenerationOverlay}
        isPending={isStandardGenerationPending} // Only show standard gen overlay for now
        resetGenerationState={resetGenerationState}
        addGenerationLog={addGenerationLog}
      />

      <GenerationLogs
        logs={generationLogs}
        clearLogs={clearGenerationLogs}
      />

      {/* Generation Settings Dialog */}
      {settingsQuery.data && (
        <Dialog open={isGenerationSettingsOpen} onOpenChange={setIsGenerationSettingsOpen}>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>Generierungseinstellungen</DialogTitle>
              <DialogDescription>
                Passen Sie die Einstellungen für die Dienstplangenerierung an
              </DialogDescription>
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
                handleGenerateStandardSchedule(); // MODIFIED: Calls standard now
              }}
              isGenerating={isStandardGenerationPending || isAiGenerating} // MODIFIED
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGenerationSettingsOpen(false)}>
                Schließen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Schedule Dialog */}
      {isAddScheduleDialogOpen && versionControlSelectedVersion && (
        <AddScheduleDialog
          isOpen={isAddScheduleDialogOpen}
          onClose={() => setIsAddScheduleDialogOpen(false)}
          onAddSchedule={handleCreateSchedule}
          version={versionControlSelectedVersion}
          defaultDate={dateRange?.from}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDeleteMessage && (
        <AlertDialog open={!!confirmDeleteMessage} onOpenChange={(open) => !open && confirmDeleteMessage?.onCancel()}>
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
                    Möchten Sie diesen Vorgang wirklich fortsetzen?
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
