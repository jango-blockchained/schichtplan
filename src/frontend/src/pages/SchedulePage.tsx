import React, { useState, useEffect } from 'react';
import { ShiftTable } from '@/components/ShiftTable';
import { useScheduleData } from '@/hooks/useScheduleData';
import { addDays, startOfWeek, endOfWeek, addWeeks, format, getWeek, isBefore } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { generateSchedule, exportSchedule, updateShiftDay, updateBreakNotes, updateSchedule, getSchedules, publishSchedule, archiveSchedule, updateVersionStatus, createNewVersion, duplicateVersion, getVersionDetails, compareVersions, updateVersionNotes, getAllVersions } from '@/services/api';
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
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

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
  const { toast } = useToast();
  const [generationLogs, setGenerationLogs] = useState<{
    type: "info" | "warning" | "error";
    timestamp: string;
    message: string;
    details?: string;
  }[]>([]);

  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
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

        setDateRange({ from, to });
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

  // Fetch schedules
  const {
    data,
    isLoading,
    refetch,
    isError,
    error,
  } = useQuery({
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

      const result = await getSchedules(
        fromStr,
        toStr,
        selectedVersion,
        includeEmpty
      );

      return result;
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
  });

  // Extract schedule data
  const scheduleData = data?.schedules || [];
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

  const queryClient = useQueryClient();

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
        console.error('🔶 Error refetching data after update:', error);
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

  const handleWeeksAmountChange = (amount: string) => {
    const weeks = parseInt(amount, 10);

    if (isNaN(weeks) || weeks < 1 || weeks > 4) {
      console.error('Invalid week amount:', amount);
      toast({
        title: "Fehler",
        description: "Ungültige Wochenanzahl ausgewählt",
        variant: "destructive"
      });
      return;
    }

    setWeeksAmount(weeks);

    if (selectedCalendarWeek) {
      try {
        // Parse the selected week value
        const [yearStr, weekStr] = selectedCalendarWeek.split('-');
        const week = parseInt(weekStr, 10);

        if (isNaN(week) || week < 1 || week > 53) {
          console.error('Invalid week value for amount change:', selectedCalendarWeek);
          toast({
            title: "Fehler",
            description: "Ungültige Kalenderwoche für die Wochenanzahl",
            variant: "destructive"
          });
          return;
        }

        // Update date range based on the selected week and new amount
        const newDateRange = getDateRangeFromWeekAndCount(week, weeks);

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

        console.log('Setting date range from week amount change:', {
          from: newDateRange.from.toISOString(),
          to: newDateRange.to.toISOString(),
          week,
          weeks
        });

        setDateRange(newDateRange);
      } catch (error) {
        console.error('Error during week amount change:', error);
        toast({
          title: "Fehler",
          description: "Fehler bei der Änderung der Wochenanzahl",
          variant: "destructive"
        });
      }
    }
  };

  const handleDrop = async (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => {
    try {
      // For drag and drop, we use a subset of ScheduleUpdate properties
      const update: ScheduleUpdate = {
        employee_id: newEmployeeId,
        date: format(newDate, 'yyyy-MM-dd'),
        shift_id: newShiftId
      };

      await updateSchedule(scheduleId, update);

      // Refetch data to update the UI
      await refetch();

      toast({
        title: "Success",
        description: "Shift updated successfully.",
      });
    } catch (error) {
      console.error('Error during drag and drop:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update shift",
        variant: "destructive",
      });
    }
  };

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedules = async () => {
    try {
      addGenerationLog('info', 'Loading schedules');
      const startDate = new Date();
      const endDate = addDays(startDate, 7);

      // Use the updated getSchedules function with individual parameters
      const response = await getSchedules(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        undefined,  // version parameter
        true        // includeEmpty parameter
      );

      // Since response is ScheduleResponse, extract the schedules array
      setSchedules(response.schedules || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load schedules',
        variant: 'destructive',
      });
    }
  };

  const handlePublish = async (version: number) => {
    try {
      await publishSchedule(version);
      await loadSchedules();
      toast({
        title: 'Success',
        description: 'Schedule published successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to publish schedule',
        variant: 'destructive'
      });
    }
  };

  const handleArchive = async (version: number) => {
    try {
      await archiveSchedule(version);
      await loadSchedules();
      toast({
        title: 'Success',
        description: 'Schedule archived successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to archive schedule',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  // Load versions for the selected week
  const versionsQuery = useQuery({
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

  // Version control handlers
  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
    refetch();
  };

  const handlePublishVersion = (version: number) => {
    updateVersionStatusMutation.mutate({ version, status: 'PUBLISHED' });
  };

  const handleArchiveVersion = (version: number) => {
    updateVersionStatusMutation.mutate({ version, status: 'ARCHIVED' });
  };

  // Add new version control handlers
  const handleDuplicateVersion = () => {
    if (!selectedVersion) {
      toast({
        title: "Error",
        description: "Please select a version to duplicate",
        variant: "destructive",
      });
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Error",
        description: "Please select a date range first",
        variant: "destructive",
      });
      return;
    }

    // Set initial notes for the duplicate
    setVersionNotes(`Duplicated from version ${selectedVersion}`);
    setDuplicateVersionDialogOpen(true);
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Schichtplan"
        description="Erstelle und verwalte Schichtpläne für deine Mitarbeiter"
      />

      {/* Error Alert - Shown when there's a fetch error */}
      {isError && error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fehler beim Laden der Daten</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten."}
          </AlertDescription>
        </Alert>
      )}

      {/* Combined Schedule Settings and Version Control */}
      <Card className="mb-4">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Schichtplan</CardTitle>
            {versions && versions.length > 0 && selectedVersion && (
              <Badge variant="outline" className="ml-2 flex items-center">
                Version {selectedVersion}
                {data?.version_statuses?.[selectedVersion] && (
                  <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${data.version_statuses[selectedVersion] === 'PUBLISHED'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    : data.version_statuses[selectedVersion] === 'ARCHIVED'
                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                    }`}>
                    {data.version_statuses[selectedVersion] === 'DRAFT' && <AlertCircle className="h-3 w-3 mr-1" />}
                    {data.version_statuses[selectedVersion] === 'PUBLISHED' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {data.version_statuses[selectedVersion] === 'ARCHIVED' && <Archive className="h-3 w-3 mr-1" />}
                    {data.version_statuses[selectedVersion]}
                  </span>
                )}
              </Badge>
            )}
          </div>

          {dateRange?.from && dateRange?.to && (
            <div className="text-sm text-muted-foreground flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              <span>
                {format(dateRange.from, 'dd.MM.yyyy')} - {format(dateRange.to, 'dd.MM.yyyy')}
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Version Control - Elegantly Integrated */}
          {dateRange?.from && dateRange?.to && (
            <div className={`${versions && versions.length > 0 ? 'mb-6 pb-6 border-b' : 'mb-2'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium flex items-center text-muted-foreground">
                  <History className="h-4 w-4 mr-2" />
                  Versionsverwaltung
                </h3>

                <Button
                  onClick={handleCreateNewVersion}
                  disabled={isLoading || createVersionMutation.isPending || updateVersionStatusMutation.isPending}
                  className="flex items-center"
                  variant="outline"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Neue Version
                </Button>
              </div>

              {versions && versions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Version Selector */}
                  <div className="md:col-span-4">
                    <div className="space-y-3">
                      <div className="flex flex-col space-y-1">
                        <div className="text-sm text-muted-foreground">Kalenderwoche</div>
                        <div className="flex items-center">
                          <Select
                            value={selectedCalendarWeek}
                            onValueChange={(value) => {
                              setSelectedCalendarWeek(value);
                              // Reset selected version when changing week
                              setSelectedVersion(undefined);
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="KW auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableCalendarWeeks().map((week) => (
                                <SelectItem key={week.value} value={week.value}>
                                  {week.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {versionsQuery.isLoading ? (
                          <Skeleton className="h-4 w-24" />
                        ) : versionsQuery.data?.versions?.length ? (
                          <div className="text-xs text-muted-foreground">
                            {versionsQuery.data.versions.length} {versionsQuery.data.versions.length === 1 ? 'Version' : 'Versionen'} verfügbar
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Keine Versionen für diese Woche</div>
                        )}
                      </div>

                      {/* Primary Version Actions */}
                      {selectedVersion && (
                        <div className="flex gap-2">
                          {data?.version_statuses?.[selectedVersion] === 'DRAFT' && (
                            <Button
                              onClick={() => handlePublishVersion(selectedVersion)}
                              disabled={
                                isLoading ||
                                createVersionMutation.isPending ||
                                updateVersionStatusMutation.isPending
                              }
                              size="sm"
                              className="flex-1 flex items-center justify-center"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1.5" />
                              Veröffentlichen
                            </Button>
                          )}

                          {(data?.version_statuses?.[selectedVersion] === 'DRAFT' ||
                            data?.version_statuses?.[selectedVersion] === 'PUBLISHED') && (
                              <Button
                                onClick={() => handleArchiveVersion(selectedVersion)}
                                disabled={
                                  isLoading ||
                                  createVersionMutation.isPending ||
                                  updateVersionStatusMutation.isPending
                                }
                                size="sm"
                                variant="outline"
                                className="flex-1 flex items-center justify-center"
                              >
                                <Archive className="h-4 w-4 mr-1.5" />
                                Archivieren
                              </Button>
                            )}
                        </div>
                      )}

                      {/* Advanced Version Actions */}
                      <div className="pt-2 border-t">
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={handleDuplicateVersion}
                            disabled={!selectedVersion}
                            size="sm"
                            variant="outline"
                            className="w-full justify-start"
                          >
                            <Copy className="h-4 w-4 mr-1.5" />
                            Version duplizieren
                          </Button>

                          <Button
                            onClick={handleUpdateNotes}
                            disabled={!selectedVersion}
                            size="sm"
                            variant="outline"
                            className="w-full justify-start"
                          >
                            <FileText className="h-4 w-4 mr-1.5" />
                            Notizen bearbeiten
                          </Button>
                        </div>
                      </div>

                      {/* Version Comparison */}
                      {versions.length > 1 && selectedVersion && (
                        <div className="pt-2 border-t">
                          <h4 className="text-sm font-medium mb-2">Versionen vergleichen</h4>
                          <div className="space-y-2">
                            <Select
                              value={versionToCompare?.toString() || ''}
                              onValueChange={(value) => setVersionToCompare(Number(value))}
                              disabled={isComparingVersions}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Version zum Vergleich wählen" />
                              </SelectTrigger>
                              <SelectContent>
                                {versions.filter(v => v !== selectedVersion).map(v => (
                                  <SelectItem key={v} value={v.toString()}>
                                    Version {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Button
                              onClick={handleCompareVersions}
                              disabled={!versionToCompare || isComparingVersions}
                              size="sm"
                              className="w-full"
                            >
                              {isComparingVersions ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                  Vergleiche...
                                </>
                              ) : (
                                <>
                                  <GitCompare className="h-4 w-4 mr-1.5" />
                                  Vergleichen
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Version Info */}
                  <div className="md:col-span-8">
                    {selectedVersion && data?.version_statuses?.[selectedVersion] ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`flex items-center ${data.version_statuses[selectedVersion] === 'PUBLISHED'
                              ? 'text-green-600'
                              : data.version_statuses[selectedVersion] === 'ARCHIVED'
                                ? 'text-gray-500'
                                : 'text-blue-600'
                              }`}>
                              {data.version_statuses[selectedVersion] === 'DRAFT' && <AlertCircle className="h-3 w-3 mr-1" />}
                              {data.version_statuses[selectedVersion] === 'PUBLISHED' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {data.version_statuses[selectedVersion] === 'ARCHIVED' && <Archive className="h-3 w-3 mr-1" />}
                              {data.version_statuses[selectedVersion]}
                            </Badge>

                            {data?.version_meta && (
                              <span className="text-xs text-muted-foreground flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Erstellt: {format(new Date(data.version_meta.created_at), 'dd.MM.yyyy HH:mm')}
                              </span>
                            )}
                          </div>

                          {data?.version_statuses?.[selectedVersion] === 'DRAFT' && (
                            <span className="text-xs text-blue-600 flex items-center">
                              <Pencil className="h-3 w-3 mr-1" />
                              Bearbeitbar
                            </span>
                          )}
                        </div>

                        {/* Status description */}
                        <div className="text-sm text-muted-foreground">
                          {data.version_statuses[selectedVersion] === 'DRAFT' && (
                            <div className="flex items-start text-blue-600/80">
                              <AlertCircle className="h-4 w-4 mr-2 mt-0.5" />
                              <p>Diese Version ist im Entwurfsmodus und kann bearbeitet werden.</p>
                            </div>
                          )}
                          {data.version_statuses[selectedVersion] === 'PUBLISHED' && (
                            <div className="flex items-start text-green-600/80">
                              <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5" />
                              <p>Diese Version ist veröffentlicht und kann nicht mehr bearbeitet werden.</p>
                            </div>
                          )}
                          {data.version_statuses[selectedVersion] === 'ARCHIVED' && (
                            <div className="flex items-start text-gray-500">
                              <Archive className="h-4 w-4 mr-2 mt-0.5" />
                              <p>Diese Version ist archiviert und dient als Referenz.</p>
                            </div>
                          )}
                        </div>

                        {/* Version details */}
                        {data?.version_meta && (data.version_meta.updated_at || data.version_meta.base_version || data.version_meta.notes) && (
                          <div className="text-xs grid gap-1.5 pt-3 border-t">
                            {data.version_meta.updated_at && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground min-w-24">Aktualisiert:</span>
                                <span>{format(new Date(data.version_meta.updated_at), 'dd.MM.yyyy HH:mm')}</span>
                              </div>
                            )}
                            {data.version_meta.base_version && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground min-w-24">Basiert auf:</span>
                                <span>Version {data.version_meta.base_version}</span>
                              </div>
                            )}
                            {data.version_meta.notes && (
                              <div className="flex items-start gap-2 mt-1">
                                <span className="text-muted-foreground min-w-24">Notizen:</span>
                                <span>{data.version_meta.notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center py-8">
                        <span className="text-muted-foreground mb-2">
                          {versions && versions.length > 0
                            ? "Bitte wählen Sie eine Version aus."
                            : "Keine Versionen vorhanden"}
                        </span>
                        {!(versions && versions.length > 0) && (
                          <Button
                            onClick={handleCreateNewVersion}
                            variant="outline"
                            size="sm">
                            Erste Version erstellen
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <History className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <h3 className="font-medium mb-2 text-base">Keine Versionen vorhanden</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Erstellen Sie Ihre erste Version, um Änderungen zu verfolgen.
                  </p>
                  <Button
                    onClick={handleCreateNewVersion}
                    variant="outline"
                    size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Erste Version erstellen
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Time Frame & Options */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left column - Time frame & Options */}
            <div className="md:col-span-7 space-y-6">
              {/* Timeframe Section */}
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="text-sm font-medium mb-3 flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Zeitraum festlegen
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  <div className="sm:col-span-7">
                    <label className="text-xs text-muted-foreground block mb-1.5">Kalenderwoche</label>
                    <Select value={selectedCalendarWeek} onValueChange={handleCalendarWeekChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="KW auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableCalendarWeeks().map(week => (
                          <SelectItem key={week.value} value={week.value}>
                            {week.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-5">
                    <label className="text-xs text-muted-foreground block mb-1.5">Dauer</label>
                    <Select value={weeksAmount.toString()} onValueChange={handleWeeksAmountChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Anzahl Wochen" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map(amount => (
                          <SelectItem key={amount} value={amount.toString()}>
                            {amount} {amount === 1 ? 'Woche' : 'Wochen'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Options Section */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Anzeigeoptionen
                </h3>
                <div className="flex flex-wrap gap-y-2 gap-x-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="createEmpty"
                      checked={createEmptySchedules}
                      onCheckedChange={handleCreateEmptyChange}
                    />
                    <label
                      htmlFor="createEmpty"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Leere Zeilen erstellen
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showEmpty"
                      checked={includeEmpty}
                      onCheckedChange={handleIncludeEmptyChange}
                    />
                    <label
                      htmlFor="showEmpty"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Leere Zeilen anzeigen
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column - Actions */}
            <div className="md:col-span-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center">
                  <Play className="h-4 w-4 mr-2" />
                  Aktionen
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className="w-full"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generiere...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Schichtplan generieren
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => exportMutation.mutate()}
                    disabled={exportMutation.isPending || scheduleData.length === 0}
                    className="w-full"
                  >
                    {exportMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exportiere...
                      </>
                    ) : (
                      <>
                        <FileDown className="mr-2 h-4 w-4" />
                        PDF Export
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generation Success Toast */}
      <GenerationOverlay />

      {/* Schedule Overview Stats */}
      {dateRange?.from && dateRange?.to && (
        <ScheduleOverview
          schedules={scheduleData}
          dateRange={{ from: dateRange.from, to: dateRange.to }}
          version={selectedVersion}
        />
      )}

      {/* Schedule Generation Errors */}
      {errors && errors.length > 0 && <ScheduleGenerationErrors errors={errors} />}

      {/* Main Schedule Table */}
      <DndProvider backend={HTML5Backend}>
        <ScheduleTable
          schedules={scheduleData.filter(s => includeEmpty || s.shift_id !== null)}
          dateRange={dateRange}
          onDrop={handleDrop}
          onUpdate={handleShiftUpdate}
          isLoading={isLoading}
        />
      </DndProvider>

      {/* Activity Log Collapsible Section */}
      {generationLogs.length > 0 && (
        <Card className="mt-4 relative">
          <CardHeader className="py-2 px-4 flex justify-between items-center border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock size={14} />
              Aktivitätsprotokoll
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={clearGenerationLogs} className="h-6 w-6">
              <X size={14} />
            </Button>
          </CardHeader>
          <CardContent className="max-h-[180px] overflow-y-auto p-3">
            <div className="space-y-1">
              {generationLogs.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    "text-xs p-1.5 rounded flex gap-2",
                    log.type === 'error' ? "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300" :
                      log.type === 'warning' ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300" :
                        "bg-slate-100 dark:bg-slate-800"
                  )}
                >
                  <span className="text-[10px] whitespace-nowrap opacity-80">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Versions Table - Only show if versions exist */}
      {versions && versions.length > 0 && (
        <ScheduleVersions
          schedules={scheduleData}
          onPublish={handlePublish}
          onArchive={handleArchive}
        />
      )}

      {/* Generation Modal */}
      {generateMutation.isPending && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-[400px] shadow-lg">
            <CardHeader>
              <CardTitle className="text-center">
                Generiere Schichtplan
                <div className="text-sm font-normal text-muted-foreground mt-1">
                  Bitte warten Sie, während der Schichtplan generiert wird...
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {generationSteps.map((step, index) => (
                <div key={step.id} className="flex items-center space-x-3">
                  {step.status === 'pending' && <Circle className="h-5 w-5 text-muted-foreground" />}
                  {step.status === 'in-progress' && <Clock className="h-5 w-5 text-blue-500 animate-pulse" />}
                  {step.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {step.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{step.title}</div>
                    {step.message && (
                      <div className="text-xs text-muted-foreground">{step.message}</div>
                    )}
                  </div>
                </div>
              ))}
              <Progress
                value={
                  (generationSteps.filter(step => step.status === 'completed').length /
                    generationSteps.length) * 100
                }
                className="mt-4"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Modal */}
      <Dialog
        open={generateMutation.isError && errors && errors.length > 0}
        onOpenChange={() => {
          if (generateMutation.isError) {
            // Clear error state by refetching data
            refetch();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              Schichtplan-Generierung fehlgeschlagen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ScheduleGenerationErrors errors={errors} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Date Range Picker */}
      <Card className="mb-4">
        {/* ...existing Card content... */}
      </Card>

      {/* Duplicate Version Dialog */}
      <Dialog open={duplicateVersionDialogOpen} onOpenChange={setDuplicateVersionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Version</DialogTitle>
            <DialogDescription>
              Create a new version as a duplicate of version {selectedVersion}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Version Notes
              </label>
              <textarea
                id="notes"
                className="w-full min-h-[100px] p-2 border rounded-md"
                placeholder="Enter notes for the new version"
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateVersionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDuplicateVersion}
              disabled={duplicateVersionMutation.isPending}
            >
              {duplicateVersionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Duplicate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Notes Dialog */}
      <Dialog open={isEditingNotes} onOpenChange={setIsEditingNotes}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Version Notes</DialogTitle>
            <DialogDescription>
              Update notes for version {selectedVersion}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="version-notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="version-notes"
                className="w-full min-h-[100px] p-2 border rounded-md"
                placeholder="Enter version notes"
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingNotes(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveVersionNotes}
              disabled={updateVersionNotesMutation.isPending}
            >
              {updateVersionNotesMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Notes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Comparison Dialog */}
      <Dialog open={!!comparisonResults} onOpenChange={() => setComparisonResults(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version Comparison</DialogTitle>
            <DialogDescription>
              Comparing Version {comparisonResults?.base_version} with Version {comparisonResults?.compare_version}
            </DialogDescription>
          </DialogHeader>
          {comparisonResults && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-md">
                  <div className="text-lg font-bold text-green-700 dark:text-green-400">
                    {comparisonResults.differences.added}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-400">Added</div>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-md">
                  <div className="text-lg font-bold text-red-700 dark:text-red-400">
                    {comparisonResults.differences.removed}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-400">Removed</div>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-md">
                  <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">
                    {comparisonResults.differences.changed}
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-400">Changed</div>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-md">
                  <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                    {comparisonResults.differences.unchanged}
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-400">Unchanged</div>
                </div>
              </div>
              {comparisonResults.differences.details.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-left font-medium">Employee</th>
                        <th className="p-2 text-left font-medium">Date</th>
                        <th className="p-2 text-left font-medium">Base Shift</th>
                        <th className="p-2 text-left font-medium">Compare Shift</th>
                        <th className="p-2 text-left font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonResults.differences.details
                        .filter((d: any) => d.type !== 'unchanged')
                        .map((diff: any, i: number) => (
                          <tr key={i} className={
                            diff.type === 'added' ? 'bg-green-50 dark:bg-green-900/10' :
                              diff.type === 'removed' ? 'bg-red-50 dark:bg-red-900/10' :
                                diff.type === 'changed' ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                          }>
                            <td className="p-2 border-t">{diff.employee_id}</td>
                            <td className="p-2 border-t">{diff.date}</td>
                            <td className="p-2 border-t">{diff.base_shift_id || '-'}</td>
                            <td className="p-2 border-t">{diff.compare_shift_id || '-'}</td>
                            <td className="p-2 border-t capitalize">{diff.type}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setComparisonResults(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 