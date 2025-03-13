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
import { addDays, startOfWeek, endOfWeek, addWeeks, format, getWeek, isBefore } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery } from '@tanstack/react-query';
import { exportSchedule, updateShiftDay, updateBreakNotes, updateSchedule, getSchedules, getSettings, updateSettings, createSchedule, getEmployees } from '@/services/api';
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
import { Schedule, ScheduleError, ScheduleUpdate } from '@/types';
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

export function SchedulePage() {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [createEmptySchedules, setCreateEmptySchedules] = useState<boolean>(true);
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState(false);
  // Add state for schedule duration (in weeks)
  const [scheduleDuration, setScheduleDuration] = useState<number>(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddScheduleDialogOpen, setIsAddScheduleDialogOpen] = useState(false);

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

  // Use our version control hook
  const {
    selectedVersion,
    handleVersionChange,
    handleCreateNewVersion,
    handlePublishVersion,
    handleArchiveVersion,
    handleDeleteVersion,
    handleDuplicateVersion,
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

  // Use our schedule generation hook
  const {
    generationSteps,
    generationLogs,
    showGenerationOverlay,
    isPending: isGenerationPending,
    generate,
    resetGenerationState,
    addGenerationLog,
    clearGenerationLogs
  } = useScheduleGeneration({
    dateRange,
    selectedVersion,
    createEmptySchedules,
    onSuccess: () => {
      // After generation completes successfully, refresh the data
      refetchScheduleData();

      // Force refresh the versions data as well to ensure we have the latest
      queryClient.invalidateQueries({ queryKey: ['versions'] });

      // Show a success message
      toast({
        title: "Generation Complete",
        description: "The schedule has been generated successfully."
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

        console.log('📊 Schedule details:', {
          totalSchedules: response.schedules?.length || 0,
          schedulesWithShifts: response.schedules?.filter(s => s.shift_id !== null)?.length || 0,
          uniqueEmployees: [...new Set(response.schedules?.map(s => s.employee_id) || [])].length,
          firstSchedule: response.schedules?.[0] || 'No schedules found',
          dateRange: { fromStr, toStr },
          includeEmpty,
          selectedVersion
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
        version: selectedVersion
      });

      console.log(`Updated schedule ${scheduleId} with version ${selectedVersion}`);

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
        version: selectedVersion
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

  // Fetch employee data for statistics
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

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
  const isUpdating = isLoading || updateShiftMutation.isPending || isGenerationPending || exportMutation.isPending;

  // Function to handle the generate action with better error handling
  const handleGenerateSchedule = () => {
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
      if (!selectedVersion) {
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

      // Make sure the date range and version match
      console.log("📋 Generating schedule with:", {
        dateRange: {
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString()
        },
        selectedVersion,
        versionMetas,
        createEmptySchedules
      });

      // Log detailed information about the generation request
      const formattedFromDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedToDate = format(dateRange.to, 'yyyy-MM-dd');

      addGenerationLog('info', 'Starting schedule generation',
        `Version: ${selectedVersion}, Date range: ${formattedFromDate} - ${formattedToDate}`);

      // Call the generate function from the hook
      generate();
    } catch (error) {
      console.error("Generation error:", error);
      addGenerationLog('error', 'Fehler bei der Generierung',
        error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten");

      toast({
        title: "Fehler bei der Generierung",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  // Handler for adding a new empty schedule
  const handleAddSchedule = () => {
    if (!selectedVersion) {
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
    if (!selectedVersion) {
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

    // Create confirmation dialog
    setConfirmDeleteMessage({
      title: "Schichtplan löschen?",
      message: "Möchten Sie wirklich alle Schichtpläne für die aktuelle Auswahl löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
      onConfirm: async () => {
        try {
          // Delete all schedules in the current view
          const deletePromises = convertedSchedules.map(schedule =>
            updateSchedule(schedule.id, { shift_id: null, version: selectedVersion })
          );

          await Promise.all(deletePromises);

          // Refetch schedule data
          await refetchScheduleData();

          toast({
            title: "Schichtpläne gelöscht",
            description: `${deletePromises.length} Schichtpläne wurden erfolgreich gelöscht.`,
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
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  return (
    <div className="container mx-auto py-4 space-y-4">
      <PageHeader title="Dienstplan" className="mb-4">
        <ScheduleControls
          onRefresh={handleRetryFetch}
          onExport={handleExportSchedule}
        />
      </PageHeader>

      {/* Add DateRangeSelector */}
      <DateRangeSelector
        dateRange={dateRange}
        scheduleDuration={scheduleDuration}
        onWeekChange={handleWeekChange}
        onDurationChange={handleDurationChange}
      />

      {/* Add Schedule Statistics if we have data */}
      {!isLoading && !isError && convertedSchedules.length > 0 && dateRange?.from && dateRange?.to && (
        <ScheduleStatistics
          schedules={convertedSchedules}
          employees={employees || []}
          startDate={format(dateRange.from, 'yyyy-MM-dd')}
          endDate={format(dateRange.to, 'yyyy-MM-dd')}
        />
      )}

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
            onGenerateSchedule={handleGenerateSchedule}
            isGenerating={isGenerationPending}
          />
        )}

        {/* Version Control */}
        <VersionControl
          versions={versions}
          versionStatuses={data?.version_statuses ?? {}}
          currentVersion={data?.current_version}
          versionMeta={data?.version_meta}
          dateRange={dateRange}
          onVersionChange={handleVersionChange}
          onCreateNewVersion={handleCreateNewVersion}
          onPublishVersion={handlePublishVersion}
          onArchiveVersion={handleArchiveVersion}
          onDeleteVersion={handleDeleteVersion}
          onDuplicateVersion={handleDuplicateVersion}
          isLoading={isLoadingVersions || isLoadingSchedule}
          hasError={isError && !!error && !data}
          schedules={convertedSchedules}
          onRetry={handleRetryFetch}
        />
      </div>

      {/* Schedule Actions */}
      <div className="flex justify-end mb-4">
        <ScheduleActions
          onAddSchedule={handleAddSchedule}
          onDeleteSchedule={handleDeleteSchedule}
          isLoading={isLoadingSchedule || isLoadingVersions || isGenerationPending}
          canAdd={!!selectedVersion}
          canDelete={!!selectedVersion && convertedSchedules.length > 0}
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
                    <Button
                      onClick={handleGenerateSchedule}
                      disabled={isGenerationPending || !selectedVersion}
                      className="flex items-center gap-2"
                    >
                      {isGenerationPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Schichtplan generieren
                    </Button>
                  )}
                  {!selectedVersion && versions.length > 0 && (
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

      {/* Use our extracted components */}
      <GenerationOverlay
        generationSteps={generationSteps}
        generationLogs={generationLogs}
        showGenerationOverlay={showGenerationOverlay}
        isPending={isGenerationPending}
        resetGenerationState={resetGenerationState}
        addGenerationLog={addGenerationLog}
      />

      <GenerationLogs
        logs={generationLogs}
        clearLogs={clearGenerationLogs}
      />

      {/* Add Schedule Dialog */}
      {isAddScheduleDialogOpen && selectedVersion && (
        <AddScheduleDialog
          isOpen={isAddScheduleDialogOpen}
          onClose={() => setIsAddScheduleDialogOpen(false)}
          onAddSchedule={handleCreateSchedule}
          version={selectedVersion}
          defaultDate={dateRange?.from}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDeleteMessage && (
        <Dialog open={!!confirmDeleteMessage} onOpenChange={(open) => !open && confirmDeleteMessage?.onCancel()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmDeleteMessage.title}</DialogTitle>
              <DialogDescription>{confirmDeleteMessage.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={confirmDeleteMessage.onCancel}>
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={confirmDeleteMessage.onConfirm}>
                Löschen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 