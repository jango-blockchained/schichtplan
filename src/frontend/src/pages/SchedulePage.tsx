import React, { useState, useEffect } from 'react';
import { ShiftTable } from '@/components/ShiftTable';
import { useScheduleData } from '@/hooks/useScheduleData';
import { addDays, startOfWeek, endOfWeek, addWeeks, format, getWeek, isBefore } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { generateSchedule, exportSchedule, updateShiftDay, updateBreakNotes, updateSchedule, getSchedules, publishSchedule, archiveSchedule, updateVersionStatus, createNewVersion, duplicateVersion, getVersionDetails, compareVersions, updateVersionNotes, getAllVersions, getSettings, updateSettings, fixShiftDurations } from '@/services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, X, CheckCircle2, Circle, Clock, CheckCircle, XCircle, RefreshCw, Plus, Archive, Calendar, Settings2, Play, FileSpreadsheet, FileDown, History, CalendarIcon, Pencil, Copy, FileText, GitCompare } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScheduleTable } from '@/components/ScheduleTable';
import { ScheduleOverview } from '@/components/Schedule/ScheduleOverview';
import { Schedule, ScheduleError, ScheduleUpdate } from '@/types';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/PageHeader';
import { Progress } from '@/components/ui/progress';
import { DateRange } from 'react-day-picker';
import { getAvailableCalendarWeeks, getDateRangeFromWeekAndCount } from '@/utils/dateUtils';
import { ScheduleVersions } from '@/components/Schedule/ScheduleVersions';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { VersionControl } from '@/components/VersionControl';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { ScheduleGenerationSettings } from '@/components/ScheduleGenerationSettings';
import type { ScheduleResponse, VersionResponse } from '@/services/api';
import { type Settings } from '@/types';
import { type Schedule as APISchedule } from '@/services/api';
import { type UseScheduleDataResult } from '@/hooks/useScheduleData';
import { DateRangeSelector } from '@/components/DateRangeSelector';

interface GenerationStep {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  message?: string;
}

export function SchedulePage() {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>();
  const [isLayoutCustomizerOpen, setIsLayoutCustomizerOpen] = useState(false);
  const [createEmptySchedules, setCreateEmptySchedules] = useState<boolean>(true);
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // Add state for schedule duration (in weeks)
  const [scheduleDuration, setScheduleDuration] = useState<number>(1);
  const { toast } = useToast();

  // Add state for generation steps and logs
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  const [generationLogs, setGenerationLogs] = useState<{
    type: "info" | "warning" | "error";
    timestamp: string;
    message: string;
    details?: string;
  }[]>([]);
  const [showGenerationOverlay, setShowGenerationOverlay] = useState(false);

  // Initialize date range with current week
  useEffect(() => {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      const today = new Date();
      const from = startOfWeek(today, { weekStartsOn: 1 });
      from.setHours(0, 0, 0, 0);
      const to = addDays(from, 6 * scheduleDuration); // Use scheduleDuration to set the end date
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  }, [scheduleDuration]); // Add scheduleDuration as a dependency

  // Function to update date range when selecting a different week
  const handleWeekChange = (weekOffset: number) => {
    if (dateRange?.from) {
      const from = addWeeks(startOfWeek(dateRange.from, { weekStartsOn: 1 }), weekOffset);
      from.setHours(0, 0, 0, 0);
      const to = addDays(from, 6 * scheduleDuration);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  };

  // Function to handle schedule duration change
  const handleDurationChange = (duration: number) => {
    setScheduleDuration(duration);

    // Update end date based on new duration
    if (dateRange?.from) {
      const from = dateRange.from;
      const to = addDays(startOfWeek(from, { weekStartsOn: 1 }), 6 * duration);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  };

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

  const queryClient = useQueryClient();

  // Update the useQuery hook with proper types and error handling
  const {
    data,
    isLoading,
    refetch,
    isError,
    error,
  } = useQuery<ScheduleResponse, Error>({
    queryKey: ['schedules', dateRange?.from, dateRange?.to, selectedVersion, includeEmpty],
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

        console.log('🔄 Fetching schedules:', { fromStr, toStr, selectedVersion, includeEmpty });

        const response = await getSchedules(
          fromStr,
          toStr,
          selectedVersion,
          includeEmpty
        );

        console.log('✅ Received schedule response:', {
          scheduleCount: response.schedules?.length || 0,
          versions: response.versions,
          currentVersion: response.current_version,
          versionStatuses: response.version_statuses
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
    selectedVersion,
    includeEmpty
  );

  const versions = data?.versions || [];
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
    setGenerationLogs(prev => prev.filter(log => log.type !== 'error'));
    // Force refetch
    refetch();
  };

  const addGenerationLog = (type: 'info' | 'warning' | 'error', message: string, details?: string) => {
    setGenerationLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      type,
      message,
      details
    }]);
  };

  const clearGenerationLogs = () => {
    setGenerationLogs([]);
  };

  const resetGenerationState = () => {
    setGenerationSteps([]);
    setGenerationLogs([]);
    setShowGenerationOverlay(false);
  };

  const updateGenerationStep = (stepId: string, status: GenerationStep['status'], message?: string) => {
    setGenerationSteps(steps =>
      steps.map(step =>
        step.id === stepId
          ? { ...step, status, message }
          : step
      )
    );
  };

  // Generation mutation with timeout
  const generateMutation = useMutation({
    mutationFn: async () => {
      try {
        if (!dateRange?.from || !dateRange?.to) {
          throw new Error("Bitte wählen Sie einen Zeitraum aus");
        }

        // Set up steps
        const steps: GenerationStep[] = [
          { id: "init", title: "Initialisiere Generierung", status: "pending" },
          { id: "validate", title: "Validiere Eingabedaten", status: "pending" },
          { id: "process", title: "Verarbeite Schichtplan", status: "pending" },
          { id: "assign", title: "Weise Schichten zu", status: "pending" },
          { id: "finalize", title: "Finalisiere Schichtplan", status: "pending" },
        ];
        setGenerationSteps(steps);
        setShowGenerationOverlay(true);

        // Set a timeout to automatically reset if it takes too long
        const timeout = setTimeout(() => {
          addGenerationLog('error', 'Zeitüberschreitung', 'Die Generierung dauert länger als erwartet. Bitte versuchen Sie es erneut.');
          updateGenerationStep('init', 'error', 'Zeitüberschreitung');
          throw new Error('Die Generierung dauert länger als erwartet.');
        }, 30000); // 30 second timeout

        try {
          // Init
          updateGenerationStep("init", "in-progress");
          addGenerationLog("info", "Initialisiere Generierung");
          await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
          updateGenerationStep("init", "completed");

          // Validate
          updateGenerationStep("validate", "in-progress");
          addGenerationLog("info", "Validiere Eingabedaten");
          await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
          updateGenerationStep("validate", "completed");

          // Process
          updateGenerationStep("process", "in-progress");
          addGenerationLog("info", "Starte Verarbeitung");

          // Call API to generate schedule
          const fromStr = format(dateRange.from, 'yyyy-MM-dd');
          const toStr = format(dateRange.to, 'yyyy-MM-dd');

          try {
            const result = await generateSchedule(
              fromStr,
              toStr,
              createEmptySchedules
            );

            updateGenerationStep("process", "completed");

            // Assign shifts
            updateGenerationStep("assign", "in-progress");
            addGenerationLog("info", "Weise Schichten zu");
            await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
            updateGenerationStep("assign", "completed");

            // Finalize
            updateGenerationStep("finalize", "in-progress");
            addGenerationLog("info", "Finalisiere Schichtplan");
            await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
            updateGenerationStep("finalize", "completed");

            // Clear the timeout since we finished successfully
            clearTimeout(timeout);

            return result;
          } catch (apiError) {
            // Handle API-specific errors
            console.error("API error during generation:", apiError);

            // Update the appropriate step to error state
            updateGenerationStep("process", "error", apiError instanceof Error ? apiError.message : "Unbekannter Fehler");

            // Add detailed error log
            if (apiError instanceof Error) {
              addGenerationLog("error", apiError.message, "Fehler bei der API-Anfrage");

              // Check for various patterns that indicate duration_hours issues
              const durationPatterns = [
                'duration_hours',
                'schichtdauer',
                'nonetype',
                'attribute',
                'none',
                'shift',
                'duration',
                'has no attribute',
                'fehlt ein attribut',
                'missing attribute'
              ];

              const hasDurationError = durationPatterns.some(pattern =>
                apiError.message.includes(pattern)
              );

              if (hasDurationError) {
                addGenerationLog("error", "Schichtdauer fehlt", "Bitte überprüfen Sie die Schichteinstellungen und stellen Sie sicher, dass alle Schichten eine Dauer haben.");
              }
            } else {
              addGenerationLog("error", "Unbekannter API-Fehler", String(apiError));
            }

            // Clear the timeout on error
            clearTimeout(timeout);
            throw apiError;
          }
        } catch (error) {
          // Clear the timeout on error
          clearTimeout(timeout);
          throw error;
        }
      } catch (error) {
        console.error("Generation error:", error);
        if (error instanceof Error) {
          addGenerationLog("error", "Fehler bei der Generierung", error.message);
        } else {
          addGenerationLog("error", "Unbekannter Fehler", String(error));
        }

        // Mark any in-progress steps as error
        setGenerationSteps(prev =>
          prev.map(step => step.status === 'in-progress' ? { ...step, status: 'error' } : step)
        );

        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Erfolg",
        description: `Schichtplan für ${scheduleData.length} Mitarbeiter generiert`,
      });

      // Allow time for UI update before hiding overlay
      setTimeout(() => {
        setShowGenerationOverlay(false);
      }, 1500);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";

      toast({
        variant: "destructive",
        title: "Fehler",
        description: `Fehler bei der Generierung: ${errorMessage}`,
      });

      // Don't auto-hide the overlay on error so user can see what happened
    },
  });

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
        await refetch();

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
      refetch();
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

  const handleShiftUpdate = async (scheduleId: number, updates: ScheduleUpdate): Promise<void> => {
    console.log('🔄 handleShiftUpdate called with:', { scheduleId, updates });
    try {
      await updateShiftMutation.mutateAsync({ scheduleId, updates });
      console.log('🔄 handleShiftUpdate completed successfully');

      // Force a complete refresh of the data after a short delay
      setTimeout(() => {
        console.log('🔄 Forcing complete data refresh after shift update');
        queryClient.invalidateQueries({ queryKey: ['schedules'] });
        refetch();
      }, 500);
    } catch (error) {
      console.error('🔄 handleShiftUpdate error:', error);
      toast({
        title: "Error",
        description: "Failed to update shift. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBreakNotesUpdate = async (employeeId: number, day: number, notes: string) => {
    await updateBreakNotesMutation.mutateAsync({ employeeId, day, notes });
  };

  // Version management mutations
  const createVersionMutation = useMutation({
    mutationFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Please select a date range");
      }

      // Get the date range from the selected week
      const fromStr = format(dateRange.from, 'yyyy-MM-dd');
      const toStr = format(dateRange.to, 'yyyy-MM-dd');

      const data = {
        start_date: fromStr,
        end_date: toStr,
        base_version: selectedVersion,
        notes: `New version for week ${getWeek(dateRange.from)} (${format(dateRange.from, 'dd.MM.yyyy')} - ${format(dateRange.to, 'dd.MM.yyyy')})`
      };

      return await createNewVersion(data);
    },
    onSuccess: (data) => {
      toast({
        title: "Neue Version erstellt",
        description: `Version ${data.version} wurde erfolgreich erstellt.`,
      });

      // Automatically select the new version
      setSelectedVersion(data.version);

      // Refresh the versions list
      versionsQuery.refetch();

      // Refetch schedule data with the new version
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Erstellen der neuen Version: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        variant: "destructive",
      });
    }
  });

  const handleCreateNewVersion = () => {
    createVersionMutation.mutate();
  };

  const updateVersionStatusMutation = useMutation({
    mutationFn: (params: { version: number, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }) =>
      updateVersionStatus(params.version, { status: params.status }),
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Version ${data.version} status updated to ${data.status}`,
      });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update version status: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Add new mutations for duplicating version and comparing versions
  const duplicateVersionMutation = useMutation({
    mutationFn: duplicateVersion,
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Version ${data.version} created as a duplicate`,
      });
      setSelectedVersion(data.version);
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      refetch();
      setIsDuplicateVersionOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to duplicate version: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Add state for version control dialogs
  const [versionNotes, setVersionNotes] = useState<string>('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Add state for duplicate version dialog
  const [duplicateSourceVersion, setDuplicateSourceVersion] = useState<number | undefined>();
  const [isDuplicateVersionOpen, setIsDuplicateVersionOpen] = useState(false);

  // Version control handlers
  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
  };

  // Add schedule update handlers
  const handleShiftDrop = async (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => {
    try {
      await updateSchedule(scheduleId, {
        employee_id: newEmployeeId,
        date: format(newDate, 'yyyy-MM-dd'),
        shift_id: newShiftId
      });
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  // Add settings query
  const settingsQuery = useQuery<Settings, Error>({
    queryKey: ['settings'] as const,
    queryFn: async () => {
      const response = await getSettings();
      return response;
    },
    retry: 3,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Add settings update handler
  const handleSettingsUpdate = async (updates: Partial<Settings['scheduling']['generation_requirements']>) => {
    try {
      if (!settingsQuery.data) {
        throw new Error("Settings not loaded");
      }

      const updatedSettings = {
        ...settingsQuery.data,
        scheduling: {
          ...settingsQuery.data.scheduling,
          generation_requirements: {
            ...settingsQuery.data.scheduling.generation_requirements,
            ...updates
          }
        }
      };
      await updateSettings(updatedSettings);
      await settingsQuery.refetch();
      toast({
        title: "Erfolg",
        description: "Einstellungen wurden aktualisiert"
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  // Convert API Schedule to frontend Schedule
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
      status: apiSchedule.status as Schedule['status'],
      break_start: apiSchedule.break_start ?? null,
      break_end: apiSchedule.break_end ?? null,
      notes: apiSchedule.notes ?? null,
      employee_name: undefined
    };
  };

  // Convert schedules for the ScheduleTable
  const convertedSchedules = (data?.schedules ?? []).map((apiSchedule) => convertSchedule(apiSchedule));

  // Update the useQuery hook with proper types
  const versionsQuery: UseQueryResult<VersionResponse, Error> = useQuery({
    queryKey: ['versions', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Date range is required");
      }

      const fromStr = format(dateRange.from, 'yyyy-MM-dd');
      const toStr = format(dateRange.to, 'yyyy-MM-dd');

      return await getAllVersions(fromStr, toStr);
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
  });

  // Set selected version to the latest version for this week when versions change or week changes
  useEffect(() => {
    if (versionsQuery.data?.versions && versionsQuery.data.versions.length > 0) {
      // Sort by version number (descending) to get the latest version
      const sortedVersions = [...versionsQuery.data.versions].sort((a, b) => b.version - a.version);
      const latestVersion = sortedVersions[0].version;

      // Only update if not already selected
      if (!selectedVersion || selectedVersion !== latestVersion) {
        console.log(`🔄 Auto-selecting latest version (${latestVersion})`);
        setSelectedVersion(latestVersion);
      }
    }
  }, [versionsQuery.data]);

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

  // Show loading overlay for subsequent data fetches
  const isUpdating = isLoading || updateShiftMutation.isPending || generateMutation.isPending || exportMutation.isPending;

  // Add this component for the generation overlay
  const GenerationOverlay = () => {
    // Check if there are any errors in the generation steps
    const hasErrors = generationSteps.some(step => step.status === 'error');
    const errorLogs = generationLogs.filter(log => log.type === 'error');
    const hasDurationError = errorLogs.some(log => {
      const message = (log.message || '').toLowerCase();
      const details = (log.details || '').toLowerCase();

      // Check for various patterns that indicate duration_hours issues
      const durationPatterns = [
        'duration_hours',
        'schichtdauer',
        'nonetype',
        'attribute',
        'none',
        'shift',
        'duration',
        'has no attribute',
        'fehlt ein attribut',
        'missing attribute'
      ];

      return durationPatterns.some(pattern =>
        message.includes(pattern) || details.includes(pattern)
      );
    });

    // Function to fix shift durations
    const handleFixShiftDurations = async () => {
      try {
        // Show loading state
        toast({
          title: "Schichtdauer wird berechnet",
          description: "Bitte warten Sie, während die Schichtdauer berechnet wird...",
        });

        // Add a log to show we're attempting to fix the issue
        addGenerationLog("info", "Versuche, Schichtdauer zu berechnen",
          "Die fehlenden Schichtdauern werden automatisch berechnet und aktualisiert.");

        // Call the API to fix shift durations
        const result = await fixShiftDurations();

        // Show success message
        toast({
          title: "Schichtdauer berechnet",
          description: `${result.fixed_count} Schichten wurden aktualisiert. Bitte versuchen Sie erneut, den Dienstplan zu generieren.`,
          variant: "default",
        });

        // Add a success log
        addGenerationLog("info", "Schichtdauer erfolgreich berechnet",
          `${result.fixed_count} Schichten wurden aktualisiert. Sie können jetzt den Dienstplan erneut generieren.`);

        // Reset the generation state after a short delay to allow the user to see the success message
        setTimeout(() => {
          resetGenerationState();
        }, 2000);
      } catch (error) {
        console.error("Error fixing shift durations:", error);

        // Add an error log
        addGenerationLog("error", "Fehler bei der Berechnung der Schichtdauer",
          error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten");

        toast({
          variant: "destructive",
          title: "Fehler",
          description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        });
      }
    };

    if (!showGenerationOverlay) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold">
              {hasErrors ? (
                <span className="text-red-500 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Fehler bei der Generierung
                </span>
              ) : (
                "Generiere Schichtplan"
              )}
            </h2>
          </div>

          <div className="py-4">
            {!hasErrors ? (
              <div className="text-center mb-4">
                Bitte warten Sie, während der Schichtplan generiert wird...
              </div>
            ) : (
              <div className="text-center mb-4 text-red-500">
                Bei der Generierung des Schichtplans ist ein Fehler aufgetreten.
              </div>
            )}

            <div className="space-y-4 mt-4">
              {generationSteps.map((step) => (
                <div key={step.id} className="flex items-center">
                  <div className="mr-4 flex-shrink-0">
                    {step.status === "completed" ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : step.status === "in-progress" ? (
                      <Circle className="h-6 w-6 text-blue-500 animate-pulse" />
                    ) : step.status === "error" ? (
                      <XCircle className="h-6 w-6 text-red-500" />
                    ) : (
                      <Circle className="h-6 w-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-grow">
                    <div className="font-medium">{step.title}</div>
                    {step.message && (
                      <div className={`text-sm ${step.status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                        {step.message}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Show error details if there are any */}
            {hasErrors && errorLogs.length > 0 && (
              <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-md">
                <h4 className="font-medium text-red-700 mb-2">Fehlerdetails:</h4>
                <ul className="space-y-2 text-sm text-red-700">
                  {errorLogs.map((log, index) => (
                    <li key={index}>
                      <div className="font-medium">{log.message}</div>
                      {log.details && <div className="text-xs mt-1">{log.details}</div>}
                    </li>
                  ))}
                </ul>

                {/* Show specific help for known errors */}
                {hasDurationError && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
                    <strong>Tipp:</strong> Es scheint ein Problem mit der Schichtdauer zu geben. Dies kann auftreten, wenn Schichten keine gültige Dauer haben.

                    <p className="mt-1">
                      Klicken Sie auf die Schaltfläche unten, um die Schichtdauer automatisch zu berechnen.
                      Dies wird die Dauer für alle Schichten basierend auf deren Start- und Endzeiten berechnen.
                    </p>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 bg-blue-100 hover:bg-blue-200 border-blue-300 flex items-center justify-center"
                      onClick={handleFixShiftDurations}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Schichtdauer automatisch berechnen
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Progress
              value={
                (generationSteps.filter(
                  (step) => step.status === "completed"
                ).length /
                  generationSteps.length) *
                100
              }
              className={`mt-6 ${hasErrors ? 'bg-red-100' : ''}`}
            />

            {/* Force cancel button - only show if we've been processing for a while or there's an error */}
            {(hasErrors || !generateMutation.isPending) && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant={hasErrors ? "destructive" : "outline"}
                  onClick={resetGenerationState}
                  className="w-full"
                >
                  {hasErrors ? 'Schließen' : 'Fertig'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Add a component to display schedule generation errors
  const ScheduleGenerationErrors = ({ errors }: { errors: ScheduleError[] }) => {
    if (!errors || errors.length === 0) return null;

    return (
      <Card className="mt-4 border-red-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-red-600 flex items-center gap-2">
            <AlertCircle size={18} />
            Fehler bei der Schichtplan-Generierung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {errors.map((error, index) => (
              <Alert key={index} variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{error.type === 'critical' ? 'Kritischer Fehler' : 'Warnung'}</AlertTitle>
                <AlertDescription className="mt-2">
                  <div>{error.message}</div>
                  {error.date && (
                    <div className="text-sm mt-1">
                      Datum: {format(new Date(error.date), 'dd.MM.yyyy')}
                    </div>
                  )}
                  {error.shift && (
                    <div className="text-sm">
                      Schicht: {error.shift}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Function to handle exporting the schedule
  const handleExportSchedule = () => {
    if (dateRange?.from && dateRange?.to) {
      const fromStr = format(dateRange.from, 'yyyy-MM-dd');
      const toStr = format(dateRange.to, 'yyyy-MM-dd');

      exportSchedule(fromStr, toStr)
        .then((blob) => {
          // Create a download link for the blob
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `schichtplan_${fromStr}_${toStr}.pdf`;
          document.body.appendChild(a);
          a.click();

          // Clean up
          setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }, 100);

          toast({
            title: "Export erfolgreich",
            description: "Der Dienstplan wurde erfolgreich exportiert."
          });
        })
        .catch((error) => {
          toast({
            title: "Export fehlgeschlagen",
            description: `Fehler beim Exportieren des Dienstplans: ${error}`,
            variant: "destructive"
          });
        });
    }
  };

  return (
    <div className="container mx-auto py-4 space-y-4">
      <PageHeader title="Dienstplan" className="mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsLayoutCustomizerOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Layout
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportSchedule}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportieren
          </Button>
        </div>
      </PageHeader>

      {/* Add DateRangeSelector */}
      <DateRangeSelector
        dateRange={dateRange}
        scheduleDuration={scheduleDuration}
        onWeekChange={handleWeekChange}
        onDurationChange={handleDurationChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Generation Settings */}
        {settingsQuery.data && (
          <ScheduleGenerationSettings
            settings={settingsQuery.data}
            onUpdate={handleSettingsUpdate}
            createEmptySchedules={createEmptySchedules}
            includeEmpty={includeEmpty}
            onCreateEmptyChange={handleCreateEmptyChange}
            onIncludeEmptyChange={handleIncludeEmptyChange}
            onGenerateSchedule={() => generateMutation.mutate()}
            isGenerating={isGenerating}
          />
        )}

        {/* Version Control */}
        <VersionControl
          versions={versions}
          versionStatuses={data?.version_statuses ?? {}}
          currentVersion={data?.current_version}
          versionMeta={data?.version_meta}
          dateRange={dateRange}
          onVersionChange={setSelectedVersion}
          onCreateNewVersion={() => createVersionMutation.mutate()}
          onPublishVersion={(version) => updateVersionStatusMutation.mutate({ version, status: 'PUBLISHED' })}
          onArchiveVersion={(version) => updateVersionStatusMutation.mutate({ version, status: 'ARCHIVED' })}
          onDuplicateVersion={(version) => {
            if (dateRange?.from && dateRange?.to) {
              duplicateVersionMutation.mutate({
                source_version: version,
                start_date: dateRange.from.toISOString().split('T')[0],
                end_date: dateRange.to.toISOString().split('T')[0]
              });
            }
          }}
          isLoading={isLoadingSchedule}
          hasError={isError && !!error && !data}
          schedules={convertedSchedules}
          onRetry={handleRetryFetch}
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
            {scheduleErrors.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Fehler im Dienstplan</AlertTitle>
                <AlertDescription>
                  <div className="max-h-40 overflow-y-auto">
                    <ul className="list-disc pl-4">
                      {scheduleErrors.map((error, index) => (
                        <li key={index}>{error.message}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {convertedSchedules.length === 0 && !isLoading && !isError ? (
              <Card className="mb-4 border-dashed border-2 border-muted">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Keine Einträge gefunden</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Für den ausgewählten Zeitraum wurden keine Schichtplan-Einträge gefunden.
                  </p>
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={isGenerating}
                    className="flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Schichtplan generieren
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="relative">
                <ScheduleTable
                  schedules={convertedSchedules}
                  dateRange={dateRange}
                  onDrop={handleShiftDrop}
                  onUpdate={handleShiftUpdate}
                  isLoading={isLoadingSchedule}
                />
              </div>
            )}
          </>
        )}
      </DndProvider>

      {showGenerationOverlay && <GenerationOverlay />}
    </div>
  );
} 