import React, { useState, useEffect } from 'react';
import { ShiftTable } from '@/components/ShiftTable';
import { useScheduleData } from '@/hooks/useScheduleData';
import { addDays, startOfWeek, endOfWeek, addWeeks, format, getWeek, isBefore } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { generateSchedule, exportSchedule, updateShiftDay, updateBreakNotes, updateSchedule, getSchedules, publishSchedule, archiveSchedule, updateVersionStatus, createNewVersion, duplicateVersion, getVersionDetails, compareVersions, updateVersionNotes, getAllVersions, getSettings, updateSettings } from '@/services/api';
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

interface GenerationStep {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  message?: string;
}

export function SchedulePage() {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [weeksAmount, setWeeksAmount] = useState(1);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>();
  const [isLayoutCustomizerOpen, setIsLayoutCustomizerOpen] = useState(false);
  const [createEmptySchedules, setCreateEmptySchedules] = useState<boolean>(true);
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);
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

  // Add a new state for selected calendar week
  const [selectedCalendarWeek, setSelectedCalendarWeek] = useState<string>(() => {
    const currentWeek = getWeek(today, { weekStartsOn: 1 });
    const currentYear = today.getFullYear();
    return `${currentYear}-${currentWeek}`;
  });

  // Initialize date range based on selected calendar week and week amount
  useEffect(() => {
    // Ensure we always have a valid dateRange on component mount
    if (!dateRange || !dateRange.from || !dateRange.to) {
      try {
        // If we have a selected calendar week, use that
        if (selectedCalendarWeek) {
          const [yearStr, weekStr] = selectedCalendarWeek.split('-');
          const week = parseInt(weekStr, 10);

          if (!isNaN(week) && week >= 1 && week <= 53) {
            const newDateRange = getDateRangeFromWeekAndCount(week, weeksAmount);

            // Validate and normalize the date range
            if (newDateRange.from && newDateRange.to &&
              !isNaN(newDateRange.from.getTime()) && !isNaN(newDateRange.to.getTime())) {
              const from = new Date(newDateRange.from.getTime());
              from.setHours(0, 0, 0, 0);
              const to = new Date(newDateRange.to.getTime());
              to.setHours(23, 59, 59, 999);
              setDateRange({ from, to });
            } else {
              throw new Error('Invalid date range generated');
            }
          } else {
            console.error('Invalid week value in initialization:', selectedCalendarWeek);
            // Fallback to current week
            const currentWeek = getWeek(today, { weekStartsOn: 1 });
            const newDateRange = getDateRangeFromWeekAndCount(currentWeek, weeksAmount);
            if (newDateRange.from && newDateRange.to) {
              const from = new Date(newDateRange.from.getTime());
              from.setHours(0, 0, 0, 0);
              const to = new Date(newDateRange.to.getTime());
              to.setHours(23, 59, 59, 999);
              setDateRange({ from, to });
            }
          }
        } else {
          // Fallback to current week if no selection exists
          const currentWeek = getWeek(today, { weekStartsOn: 1 });
          const newDateRange = getDateRangeFromWeekAndCount(currentWeek, weeksAmount);
          if (newDateRange.from && newDateRange.to) {
            const from = new Date(newDateRange.from.getTime());
            from.setHours(0, 0, 0, 0);
            const to = new Date(newDateRange.to.getTime());
            to.setHours(23, 59, 59, 999);
            setDateRange({ from, to });
          }
        }
      } catch (error) {
        console.error('Error during initialization:', error);
        // Last resort fallback: use current week
        const fallbackFrom = startOfWeek(today, { weekStartsOn: 1 });
        fallbackFrom.setHours(0, 0, 0, 0);
        const fallbackTo = addDays(fallbackFrom, (weeksAmount * 7) - 1);
        fallbackTo.setHours(23, 59, 59, 999);
        setDateRange({ from: fallbackFrom, to: fallbackTo });
      }
    }
  }, []);

  // Update date range when calendar week or week amount changes
  useEffect(() => {
    if (selectedCalendarWeek) {
      try {
        const [yearStr, weekStr] = selectedCalendarWeek.split('-');
        const week = parseInt(weekStr, 10);

        if (isNaN(week) || week < 1 || week > 53) {
          console.error('Invalid week value in calendar week change:', selectedCalendarWeek);
          return;
        }

        const newDateRange = getDateRangeFromWeekAndCount(week, weeksAmount);

        // Validate the generated date range
        if (!newDateRange.from || !newDateRange.to ||
          isNaN(newDateRange.from.getTime()) || isNaN(newDateRange.to.getTime())) {
          console.error('Invalid date range generated:', newDateRange);
          toast({
            title: "Fehler",
            description: "Fehler bei der Berechnung des Datumsbereichs",
            variant: "destructive"
          });
          return;
        }

        // Ensure dates are at the start of their respective days
        const from = new Date(newDateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(newDateRange.to);
        to.setHours(23, 59, 59, 999);

        console.log('Setting date range:', {
          from: from.toISOString(),
          to: to.toISOString(),
          week,
          weeksAmount
        });

        setDateRange(newDateRange);
      } catch (error) {
        console.error('Error during calendar week change:', error);
        toast({
          title: "Fehler",
          description: "Fehler bei der Verarbeitung der Kalenderwoche",
          variant: "destructive"
        });
      }
    }
  }, [selectedCalendarWeek, weeksAmount]);

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

  // Update the useQuery hook with proper types
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

      const fromStr = format(dateRange.from, 'yyyy-MM-dd');
      const toStr = format(dateRange.to, 'yyyy-MM-dd');

      return await getSchedules(
        fromStr,
        toStr,
        selectedVersion,
        includeEmpty
      );
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
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
      addGenerationLog('error', 'Error fetching schedule data',
        error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten");
    }
  }, [error]);

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

  // Add a handler for calendar week selection
  const handleCalendarWeekChange = (weekValue: string) => {
    setSelectedCalendarWeek(weekValue);

    try {
      // Parse the selected week value (format: "YYYY-WW")
      const [yearStr, weekStr] = weekValue.split('-');
      const year = parseInt(yearStr, 10);
      const week = parseInt(weekStr, 10);

      if (isNaN(year) || isNaN(week) || week < 1 || week > 53) {
        console.error('Invalid week value:', weekValue);
        toast({
          title: "Fehler",
          description: "Ungültige Kalenderwoche ausgewählt",
          variant: "destructive"
        });
        return;
      }

      // Get date range for the selected week and the current week amount
      const newDateRange = getDateRangeFromWeekAndCount(week, weeksAmount);

      // Validate the generated date range
      if (!newDateRange.from || !newDateRange.to ||
        isNaN(newDateRange.from.getTime()) || isNaN(newDateRange.to.getTime())) {
        console.error('Invalid date range generated:', newDateRange);
        toast({
          title: "Fehler",
          description: "Fehler bei der Berechnung des Datumsbereichs",
          variant: "destructive"
        });
        return;
      }

      console.log('Setting date range:', {
        from: newDateRange.from.toISOString(),
        to: newDateRange.to.toISOString(),
        week,
        weeksAmount
      });

      setDateRange(newDateRange);
    } catch (error) {
      console.error('Error parsing week value:', error);
      toast({
        title: "Fehler",
        description: "Fehler bei der Verarbeitung der Kalenderwoche",
        variant: "destructive"
      });
    }
  };

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

      // Only update if not already selected or if week has changed
      if (!selectedVersion || selectedVersion !== latestVersion) {
        console.log(`🔄 Auto-selecting latest version (${latestVersion}) for week ${selectedCalendarWeek}`);
        setSelectedVersion(latestVersion);
      }
    }
  }, [versionsQuery.data, selectedCalendarWeek]);

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
  const GenerationOverlay = () => (
    <Dialog open={showGenerationOverlay} onOpenChange={(open) => {
      // Only allow closing if not in progress
      if (!open && !generateMutation.isPending) {
        setShowGenerationOverlay(open);
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Generiere Schichtplan</DialogTitle>
        </DialogHeader>
        <div className="py-6">
          <div className="text-center mb-4">
            Bitte warten Sie, während der Schichtplan generiert wird...
          </div>
          <div className="space-y-4">
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
                    <div className="text-sm text-gray-500">{step.message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Progress
            value={
              (generationSteps.filter(
                (step) => step.status === "completed"
              ).length /
                generationSteps.length) *
              100
            }
            className="mt-6"
          />

          {/* Force cancel button - only show if we've been processing for a while or there's an error */}
          {(generationSteps.some(step => step.status === 'error') || !generateMutation.isPending) && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={resetGenerationState}
                className="mt-2"
              >
                {generationSteps.some(step => step.status === 'error')
                  ? 'Abbrechen'
                  : 'Schließen'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

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
      setDuplicateVersionDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to duplicate version: ${error}`,
        variant: "destructive",
      });
    }
  });

  const updateVersionNotesMutation = useMutation({
    mutationFn: (params: { version: number, notes: string }) =>
      updateVersionNotes(params.version, { notes: params.notes }),
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Notes updated for version ${data.version}`,
      });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update notes: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Add state for version control dialogs
  const [duplicateVersionDialogOpen, setDuplicateVersionDialogOpen] = useState(false);
  const [versionToCompare, setVersionToCompare] = useState<number | null>(null);
  const [comparisonResults, setComparisonResults] = useState<any>(null);
  const [versionNotes, setVersionNotes] = useState<string>('');
  const [isComparingVersions, setIsComparingVersions] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Add state for duplicate version dialog
  const [duplicateSourceVersion, setDuplicateSourceVersion] = useState<number | undefined>();
  const [isDuplicateVersionOpen, setIsDuplicateVersionOpen] = useState(false);

  // Update the fetchData function
  const fetchData = () => {
    void queryClient.invalidateQueries({
      queryKey: ['schedules'],
      exact: false
    });
  };

  // Update the refetchSchedules function
  const refetchSchedules = () => {
    if (queryClient && selectedVersion) {
      void queryClient.invalidateQueries({
        queryKey: ['schedules', selectedVersion],
        exact: false
      });
    } else {
      // Manual refetch logic using the existing fetch function
      if (dateRange?.from && dateRange?.to) {
        fetchData();
      }
    }
  };

  // Version control handlers
  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
  };

  const handlePublishVersion = async (version: number) => {
    if (version) {
      try {
        const result = await publishSchedule(version);
        toast({
          title: "Version Published",
          description: `Version ${version} has been published successfully.`,
        });

        // Refetch schedules to update status
        refetchSchedules();
      } catch (error) {
        toast({
          title: "Publish Error",
          description: "Failed to publish version.",
          variant: "destructive",
        });
      }
    }
  };

  const handleArchiveVersion = async (version: number) => {
    if (version) {
      try {
        const result = await archiveSchedule(version);
        toast({
          title: "Version Archived",
          description: `Version ${version} has been archived successfully.`,
        });

        // Refetch schedules to update status
        refetchSchedules();
      } catch (error) {
        toast({
          title: "Archive Error",
          description: "Failed to archive version.",
          variant: "destructive",
        });
      }
    }
  };

  // Add new version control handlers
  const handleDuplicateVersion = async (version: number) => {
    if (version) {
      try {
        // Open duplicate dialog with the selected version pre-filled
        setDuplicateSourceVersion(version);
        setIsDuplicateVersionOpen(true);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to prepare version duplication.",
          variant: "destructive",
        });
      }
    }
  };

  const handleCompareVersions = async () => {
    if (!selectedVersion || !versionToCompare) {
      toast({
        title: "Error",
        description: "Please select both versions to compare",
        variant: "destructive",
      });
      return;
    }

    setIsComparingVersions(true);
    try {
      const results = await compareVersions(selectedVersion, versionToCompare);
      setComparisonResults(results);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to compare versions: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsComparingVersions(false);
    }
  };

  const handleUpdateNotes = () => {
    if (!selectedVersion) {
      toast({
        title: "Error",
        description: "Please select a version first",
        variant: "destructive",
      });
      return;
    }

    if (data?.version_meta?.notes) {
      setVersionNotes(data.version_meta.notes);
    } else {
      setVersionNotes('');
    }
    setIsEditingNotes(true);
  };

  const saveVersionNotes = () => {
    if (!selectedVersion) return;

    updateVersionNotesMutation.mutate({
      version: selectedVersion,
      notes: versionNotes
    });
    setIsEditingNotes(false);
  };

  const confirmDuplicateVersion = () => {
    if (!selectedVersion || !dateRange?.from || !dateRange?.to) return;

    duplicateVersionMutation.mutate({
      source_version: selectedVersion,
      start_date: dateRange.from.toISOString().split('T')[0],
      end_date: dateRange.to.toISOString().split('T')[0],
      notes: versionNotes
    });
  };

  // Update the ErrorDisplay component to use better styling
  const ErrorDisplay = ({ error }: { error: any }) => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error loading schedule</AlertTitle>
      <AlertDescription>
        {error?.message || 'An unknown error occurred. Please try again.'}
      </AlertDescription>
    </Alert>
  );

  // Add a skeleton loader for schedule table
  const ScheduleTableSkeleton = () => (
    <div className="space-y-4">
      <Skeleton className="h-8 w-full" />
      <div className="grid grid-cols-7 gap-2">
        {Array(7).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      {Array(5).fill(0).map((_, i) => (
        <div key={i} className="grid grid-cols-7 gap-2">
          {Array(7).fill(0).map((_, j) => (
            <Skeleton key={j} className="h-16" />
          ))}
        </div>
      ))}
    </div>
  );

  const handleGenerateSchedule = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Datumsbereich aus",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setGenerationSteps([
      { id: '1', title: 'Initialisiere Generierung', status: 'pending' },
      { id: '2', title: 'Lade Mitarbeiterdaten', status: 'pending' },
      { id: '3', title: 'Generiere Schichtplan', status: 'pending' },
      { id: '4', title: 'Speichere Ergebnisse', status: 'pending' }
    ]);
    setGenerationLogs([]);
    setShowGenerationOverlay(true);

    try {
      // Update step 1 status
      setGenerationSteps(prev => prev.map(step =>
        step.id === '1' ? { ...step, status: 'in-progress' } : step
      ));
      addGenerationLog('info', 'Initialisiere Generierung...');

      // Prepare request data
      const fromStr = format(dateRange.from, 'yyyy-MM-dd');
      const toStr = format(dateRange.to, 'yyyy-MM-dd');

      // Update step 1 to completed and start step 2
      setGenerationSteps(prev => prev.map(step =>
        step.id === '1' ? { ...step, status: 'completed' } :
          step.id === '2' ? { ...step, status: 'in-progress' } : step
      ));
      addGenerationLog('info', 'Lade Mitarbeiterdaten...');

      // Update step 2 to completed and start step 3
      setGenerationSteps(prev => prev.map(step =>
        step.id === '2' ? { ...step, status: 'completed' } :
          step.id === '3' ? { ...step, status: 'in-progress' } : step
      ));
      addGenerationLog('info', 'Generiere Schichtplan...');

      // Call the generate schedule API
      const result = await generateSchedule(
        fromStr,
        toStr,
        createEmptySchedules
      );

      // Update step 3 to completed and start step 4
      setGenerationSteps(prev => prev.map(step =>
        step.id === '3' ? { ...step, status: 'completed' } :
          step.id === '4' ? { ...step, status: 'in-progress' } : step
      ));
      addGenerationLog('info', 'Speichere Ergebnisse...');

      // Process the result
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          addGenerationLog('error', error.message);
        });
      }

      // Update step 4 to completed
      setGenerationSteps(prev => prev.map(step =>
        step.id === '4' ? { ...step, status: 'completed' } : step
      ));
      addGenerationLog('info', 'Generierung abgeschlossen');

      // Refetch the schedule data
      await refetch();

      // Show success message
      toast({
        title: "Erfolg",
        description: "Schichtplan wurde erfolgreich generiert",
      });

      // Close the overlay after a short delay
      setTimeout(() => {
        setShowGenerationOverlay(false);
        setGenerationSteps([]);
        setGenerationLogs([]);
        setIsGenerating(false);
      }, 2000);

    } catch (error) {
      // Update current step to error
      setGenerationSteps(prev => prev.map(step =>
        step.status === 'in-progress' ? { ...step, status: 'error' } : step
      ));

      // Log the error
      addGenerationLog('error', 'Fehler bei der Generierung',
        error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten");

      // Show error toast
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });

      setIsGenerating(false);
    }
  };

  // Version management functions
  const handleVersionCreate = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Datumsbereich aus",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await createNewVersion({
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd'),
        base_version: selectedVersion
      });

      toast({
        title: "Erfolg",
        description: `Neue Version ${result.version} wurde erstellt`
      });

      setSelectedVersion(result.version);
      await refetch();
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const handleVersionDuplicate = async () => {
    if (!dateRange?.from || !dateRange?.to || !selectedVersion) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Datumsbereich und eine Version aus",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await duplicateVersion({
        source_version: selectedVersion,
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd')
      });

      toast({
        title: "Erfolg",
        description: `Version ${result.version} wurde dupliziert`
      });

      setSelectedVersion(result.version);
      await refetch();
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const handleVersionArchive = async () => {
    if (!selectedVersion) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie eine Version aus",
        variant: "destructive"
      });
      return;
    }

    try {
      await archiveSchedule(selectedVersion);
      toast({
        title: "Erfolg",
        description: `Version ${selectedVersion} wurde archiviert`
      });
      await refetch();
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const handleVersionPublish = async () => {
    if (!selectedVersion) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie eine Version aus",
        variant: "destructive"
      });
      return;
    }

    try {
      await publishSchedule(selectedVersion);
      toast({
        title: "Erfolg",
        description: `Version ${selectedVersion} wurde veröffentlicht`
      });
      await refetch();
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const handleVersionCompare = async (compareVersion: number) => {
    if (!selectedVersion) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie eine Version aus",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await compareVersions(selectedVersion, compareVersion);
      // Handle comparison result (e.g., show in a modal)
      console.log('Version comparison:', result);
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const handleVersionNotesUpdate = async (version: number, notes: string) => {
    try {
      await updateVersionNotes(version, { notes });
      toast({
        title: "Erfolg",
        description: "Notizen wurden aktualisiert"
      });
      await refetch();
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const handleVersionStatusUpdate = async (version: number, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    try {
      await updateVersionStatus(version, { status });
      toast({
        title: "Erfolg",
        description: `Status wurde auf ${status} geändert`
      });
      await refetch();
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
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

  // Update handleWeeksAmountChange to handle string to number conversion
  const handleWeeksAmountChange = (amount: string) => {
    const numAmount = parseInt(amount, 10);
    if (!isNaN(numAmount) && numAmount >= 1 && numAmount <= 4) {
      setWeeksAmount(numAmount);
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

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader title="Dienstplan">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refetchSchedules}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Aktualisieren
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLayoutCustomizerOpen(true)}
            className="flex items-center gap-1"
          >
            <Settings2 className="h-4 w-4" />
            Layout
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="sticky top-4">
            {settingsQuery.data && (
              <ScheduleGenerationSettings
                settings={settingsQuery.data}
                onUpdate={handleSettingsUpdate}
                selectedCalendarWeek={selectedCalendarWeek}
                weeksAmount={weeksAmount}
                createEmptySchedules={createEmptySchedules}
                includeEmpty={includeEmpty}
                onCalendarWeekChange={setSelectedCalendarWeek}
                onWeeksAmountChange={handleWeeksAmountChange}
                onCreateEmptyChange={handleCreateEmptyChange}
                onIncludeEmptyChange={handleIncludeEmptyChange}
                onGenerateSchedule={handleGenerateSchedule}
                isGenerating={isGenerating}
              />
            )}

            <VersionControl
              versions={versions}
              versionStatuses={data?.version_statuses ?? {}}
              currentVersion={data?.current_version}
              versionMeta={data?.version_meta}
              dateRange={dateRange}
              onVersionChange={setSelectedVersion}
              onCreateNewVersion={handleVersionCreate}
              onPublishVersion={handleVersionPublish}
              onArchiveVersion={handleVersionArchive}
              onDuplicateVersion={handleVersionDuplicate}
              isLoading={isLoadingSchedule}
              hasError={!!scheduleError}
              schedules={convertedSchedules}
            />
          </div>
        </div>

        <div className="lg:col-span-9">
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center justify-between">
                <div>
                  Schichtplan
                  {dateRange?.from && dateRange?.to && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {format(dateRange.from, 'dd.MM.yyyy')} - {format(dateRange.to, 'dd.MM.yyyy')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isLoading || isLoadingSchedule ? "outline" : "default"} className="ml-2">
                    {isLoading || isLoadingSchedule ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Laden...
                      </span>
                    ) : (
                      <span>{convertedSchedules.length} Einträge</span>
                    )}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
          </Card>

          <DndProvider backend={HTML5Backend}>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-[400px] w-full" />
              </div>
            ) : isError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten"}
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

                <div className={showGenerationOverlay ? 'relative opacity-30 pointer-events-none' : 'relative'}>
                  <ScheduleTable
                    schedules={convertedSchedules}
                    dateRange={dateRange}
                    onDrop={handleShiftDrop}
                    onUpdate={handleShiftUpdate}
                    isLoading={isLoadingSchedule}
                  />
                </div>
              </>
            )}
          </DndProvider>
        </div>
      </div>

      {showGenerationOverlay && <GenerationOverlay />}
    </div>
  );
} 