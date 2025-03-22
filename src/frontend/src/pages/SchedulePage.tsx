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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { addDays, startOfWeek, format, addWeeks } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScheduleTable } from '@/components/Schedule/Table/ScheduleTable';
import ScheduleControls from '@/components/Schedule/ScheduleControls';
import { EnhancedDateRangeSelector } from '@/components/EnhancedDateRangeSelector';
import { VersionControl } from '@/components/VersionControl';
import { ScheduleGenerationSettings } from '@/components/Schedule/ScheduleGenerationSettings';
import { ScheduleStatistics } from '@/components/Schedule/ScheduleStatistics';
import { useScheduleData } from '@/hooks/useScheduleData';
import { useScheduleGeneration } from '@/hooks/useScheduleGeneration';
import { useVersionControl } from '@/hooks/useVersionControl';
import { exportSchedule, updateShiftDay, updateBreakNotes, updateSchedule, getSchedules, getSettings, updateSettings, createSchedule, getEmployees, getAbsences, updateVersionStatus, subscribeToEvents, unsubscribeFromEvents } from '@/services/api';
import type { Schedule, ScheduleUpdate } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, AlertCircle, X, Calendar, CheckCircle, XCircle, RefreshCw, User, Wand2, Settings2, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { ScheduleOverview } from '@/components/Schedule/ScheduleOverview';
import { ScheduleError } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/PageHeader';
import { getAvailableCalendarWeeks, getDateRangeFromWeekAndCount } from '@/utils/dateUtils';
import { Badge } from '@/components/ui/badge';
import { ScheduleActions } from '@/components/Schedule/ScheduleActions';
import { ShiftEditModal } from '@/components/Schedule/ShiftEditModal';
import { VersionTable } from '@/components/Schedule/VersionTable';
import { ScheduleManager } from '@/components/Schedule/ScheduleManager';
import { Dashboard } from '@/components/Dashboard';
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
import GenerationOverlay from '@/components/Schedule/GenerationOverlay';
import GenerationLogs from '@/components/Schedule/GenerationLogs';
import ScheduleErrors from '@/components/Schedule/ScheduleErrors';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { ScheduleVersions } from '@/components/Schedule/ScheduleVersions';
import { type ScheduleResponse } from '@/services/api';
import { type UseScheduleDataResult } from '@/hooks/useScheduleData';
import { type Schedule as APISchedule } from '@/services/api';
import { ScheduleView } from '@/components/Schedule/ScheduleView';
import { EmployeeStatistics } from '@/components/Schedule/EmployeeStatistics';
import { VersionCompare } from '@/components/Schedule/VersionCompare';
import { ShiftModal } from '@/components/Schedule/ShiftModal';
import { AddScheduleDialog } from '@/components/Schedule/AddScheduleDialog';
import { useWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScheduleTable as ScheduleTableV2 } from '@/components/Schedule/ScheduleTable';
import { ScheduleTable as ScheduleTableV3 } from '@/components/Schedule/Table/ScheduleTable';
import { Settings, Play, Plus, Trash2, Wifi } from 'lucide-react';
import type { Settings as AppSettings } from '@/types';
import { useWebSocket } from '../contexts/WebSocketBunContext';

interface ConnectionStatusProps {
  isConnected: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => (
  <div className="flex items-center gap-2">
    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
    <span className="text-sm text-muted-foreground">
      {isConnected ? 'Connected' : 'Reconnecting...'}
    </span>
  </div>
);

type ShiftType = 'EARLY' | 'MIDDLE' | 'LATE';

export function SchedulePage() {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [createEmptySchedules, setCreateEmptySchedules] = useState<boolean>(true);
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduleDuration, setScheduleDuration] = useState<number>(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddScheduleDialogOpen, setIsAddScheduleDialogOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState<Schedule | null>(null);
  const [employeeAbsences, setEmployeeAbsences] = useState<Record<number, any[]>>({});
  const [activeView, setActiveView] = useState<'table' | 'table2' | 'table3' | 'grid' | 'schedule-table' | 'table-overview'>('table');
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [compareVersions, setCompareVersions] = useState<boolean>(false);
  const [previousVersionForCompare, setPreviousVersionForCompare] = useState<number | null>(null);
  const [isQuickShiftModalOpen, setIsQuickShiftModalOpen] = useState<boolean>(false);
  const [quickShiftSchedule, setQuickShiftSchedule] = useState<Schedule | null>(null);
  const [isConnected, subscribe, unsubscribe] = useWebSocket();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const onSettingsOpen = () => setIsSettingsOpen(true);

  // Memoize the toast callback to prevent unnecessary re-renders
  const showToast = useMemo(() => (props: {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => {
    toast({
      ...props,
      duration: 5000,
    });
  }, [toast]);

  // Memoize the query invalidation callbacks
  const invalidateSchedules = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
  }, [queryClient]);

  const invalidateShiftTemplates = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['shift-templates'] });
  }, [queryClient]);

  const invalidateAvailabilities = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['availabilities'] });
  }, [queryClient]);

  const invalidateAbsences = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['absences'] });
  }, [queryClient]);

  // Memoize the connection status handlers
  const handleConnectionError = useCallback((error: Error) => {
    showToast({
      title: "Connection Error",
      description: 'Lost connection to server. Some updates may be delayed.',
      variant: 'destructive',
    });
  }, [showToast]);

  const handleReconnecting = useCallback((attempt: number) => {
    showToast({
      title: 'Reconnecting...',
      description: `Attempting to reconnect (${attempt}/5)`,
      variant: 'default',
    });
  }, [showToast]);

  // Memoize WebSocket events with stable references
  const webSocketEvents = useMemo(() => [
    {
      type: 'schedule_updated',
      handler: invalidateSchedules,
      onError: handleConnectionError,
      onReconnecting: handleReconnecting
    },
    {
      type: 'shift_template_updated',
      handler: invalidateShiftTemplates
    },
    {
      type: 'availability_updated',
      handler: invalidateAvailabilities
    },
    {
      type: 'absence_updated',
      handler: invalidateAbsences
    }
  ], [
    invalidateSchedules,
    invalidateShiftTemplates,
    invalidateAvailabilities,
    invalidateAbsences,
    handleConnectionError,
    handleReconnecting
  ]);

  // Use the memoized events array with a stable reference
  useWebSocketEvents(webSocketEvents);

  useEffect(() => {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      const today = new Date();
      const from = startOfWeek(today, { weekStartsOn: 1 });
      from.setHours(0, 0, 0, 0);
      const to = addDays(from, 6 * scheduleDuration);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  }, [scheduleDuration]);

  const handleWeekChange = (weekOffset: number) => {
    if (dateRange?.from) {
      const from = addWeeks(startOfWeek(dateRange.from, { weekStartsOn: 1 }), weekOffset);
      from.setHours(0, 0, 0, 0);
      const to = addDays(from, 6 * scheduleDuration);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  };

  const handleDurationChange = (duration: number) => {
    setScheduleDuration(duration);

    if (dateRange?.from) {
      const from = dateRange.from;
      const to = addDays(startOfWeek(from, { weekStartsOn: 1 }), 6 * duration);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  };

  const {
    selectedVersion,
    handleVersionChange,
    handleCreateNewVersion,
    handlePublishVersion: publishVersion,
    handleArchiveVersion: archiveVersion,
    handleDeleteVersion: handleVersionDelete,
    handleDuplicateVersion: handleVersionDuplicate,
    handleCreateNewVersionWithOptions: versionControlCreateWithOptions,
    versions,
    versionMetas,
    isLoading: isLoadingVersions
  } = useVersionControl({
    dateRange,
    onVersionSelected: (version) => {
      refetchScheduleData();
    }
  });

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
      refetchScheduleData();

      queryClient.invalidateQueries({ queryKey: ['versions'] });

      toast({
        title: "Generation Complete",
        description: "The schedule has been generated successfully."
      });
    }
  });

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

        const response = await getSchedules(
          fromStr,
          toStr,
          selectedVersion,
          includeEmpty
        );

        return response;
      } catch (err) {
        console.error('Error fetching schedules:', err);
        throw err;
      }
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { scheduleData, errors: scheduleErrors, loading: isLoadingSchedule, error: scheduleError } = useScheduleData(
    dateRange?.from ?? new Date(),
    dateRange?.to ?? new Date(),
    selectedVersion,
    includeEmpty
  );

  const errors = data?.errors || [];

  useEffect(() => {
    if (error) {
      console.error('Schedule fetch error:', error);
      addGenerationLog('error', 'Error fetching schedule data',
        error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten");
    }
  }, [error]);

  const handleRetryFetch = async (): Promise<void> => {
    clearGenerationLogs();
    await refetchScheduleData();
  };

  const handleExportSchedule = async (): Promise<void> => {
    await exportMutation.mutateAsync();
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
      addGenerationLog('info', 'Updating shift',
        `Schedule ID: ${scheduleId}, Updates: ${JSON.stringify(updates)}`);

      try {
        const response = await updateSchedule(scheduleId, updates);
        return { response, scheduleId, isNew: scheduleId === 0 };
      } catch (error) {
        console.error('Error updating shift:', error);
        throw error;
      }
    },
    onSuccess: async ({ response, scheduleId, isNew }) => {
      try {
        // Add more delay to ensure database operations complete before refetching
        await new Promise(resolve => setTimeout(resolve, 500));

        // Force invalidate the queries using the correct syntax
        queryClient.invalidateQueries({ queryKey: ['schedules'] });
        queryClient.invalidateQueries({ queryKey: ['shifts'] });

        // Directly refetch data to ensure UI updates
        await refetchScheduleData();

        // Double-check if refetch worked by forcing another refetch after a brief delay
        setTimeout(async () => {
          await refetchScheduleData();
        }, 1000);

        toast({
          title: "Success",
          description: isNew ? "Shift created successfully" : "Shift updated successfully",
        });

        if (isNew) {
          addGenerationLog('info', 'New shift created',
            `New Schedule ID: ${response.id}, Employee ID: ${response.employee_id}, Shift ID: ${response.shift_id}`);
        }
      } catch (error) {
        console.error('Error refetching data after update:', error);
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

      queryClient.invalidateQueries({ queryKey: ['schedules'] });

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
      const updatesWithVersion = {
        ...updates,
        version: selectedVersion
      };

      await updateShiftMutation.mutateAsync({ scheduleId, updates: updatesWithVersion });
    } catch (error) {
      console.error('Error in handleShiftUpdate:', error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleBreakNotesUpdate = async (employeeId: number, day: number, notes: string) => {
    await updateBreakNotesMutation.mutateAsync({ employeeId, day, notes });
  };

  const settingsQuery = useQuery<AppSettings, Error>({
    queryKey: ['settings'] as const,
    queryFn: async () => {
      const response = await getSettings();
      return response;
    },
    retry: 3,
    staleTime: 5 * 60 * 1000
  });

  const handleSettingsUpdate = async (updates: Partial<AppSettings['scheduling']['generation_requirements']>) => {
    try {
      if (!settingsQuery.data) {
        throw new Error("Settings not loaded");
      }

      const currentSettings = JSON.parse(JSON.stringify(settingsQuery.data));

      if (!currentSettings.scheduling) {
        currentSettings.scheduling = {
          generation_requirements: {}
        };
      }

      if (!currentSettings.scheduling.generation_requirements) {
        currentSettings.scheduling.generation_requirements = {};
      }

      currentSettings.scheduling.generation_requirements = {
        ...currentSettings.scheduling.generation_requirements,
        ...updates
      };

      if (!currentSettings.scheduling_advanced) {
        currentSettings.scheduling_advanced = {};
      }

      if (!currentSettings.scheduling_advanced.generation_requirements) {
        currentSettings.scheduling_advanced.generation_requirements = {};
      }

      currentSettings.scheduling_advanced.generation_requirements = {
        ...currentSettings.scheduling_advanced.generation_requirements,
        ...updates
      };

      await updateSettings(currentSettings);

      addGenerationLog('info', 'Generation settings updated',
        Object.entries(updates)
          .map(([key, value]) => `${key}: ${value ? 'enabled' : 'disabled'}`)
          .join(', ')
      );

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

  const convertSchedule = (apiSchedule: APISchedule): Schedule => {
    const shiftTypeId = apiSchedule.shift_type_id;
    return {
      id: apiSchedule.id,
      employee_id: apiSchedule.employee_id,
      date: apiSchedule.date,
      shift_id: apiSchedule.shift_id,
      shift_start: apiSchedule.shift_start,
      shift_end: apiSchedule.shift_end,
      start_time: apiSchedule.shift_start,
      end_time: apiSchedule.shift_end,
      is_empty: apiSchedule.is_empty,
      version: apiSchedule.version,
      status: apiSchedule.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
      break_start: apiSchedule.break_start,
      break_end: apiSchedule.break_end,
      notes: apiSchedule.notes,
      availability_type: apiSchedule.availability_type,
      shift_type_id: shiftTypeId && ['EARLY', 'MIDDLE', 'LATE'].includes(shiftTypeId) ? shiftTypeId as ShiftType : undefined
    };
  };

  const convertedSchedules = (data?.schedules ?? []).map((apiSchedule) => convertSchedule(apiSchedule));

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings
  });

  const fetchAbsences = async () => {
    try {
      if (!employees) return;

      const absencePromises = employees.map(employee =>
        getAbsences(employee.id)
          .then(absences => ({ employeeId: employee.id, absences }))
          .catch(() => ({ employeeId: employee.id, absences: [] }))
      );

      const results = await Promise.all(absencePromises);

      const absencesMap: Record<number, any[]> = {};
      results.forEach(({ employeeId, absences }) => {
        absencesMap[employeeId] = absences;
      });

      setEmployeeAbsences(absencesMap);
    } catch (error) {
      console.error('Error fetching absences:', error);
      toast({
        title: "Error",
        description: "Failed to fetch employee absences",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchAbsences();
  }, [employees]);

  useEffect(() => {
    // Subscribe to relevant events
    subscribe('schedule_updated');
    subscribe('availability_updated');
    subscribe('absence_updated');

    // Listen for schedule updates
    const handleScheduleUpdate = (event: CustomEvent) => {
      console.log('Schedule updated:', event.detail);
      // Handle schedule update
    };

    const handleAvailabilityUpdate = (event: CustomEvent) => {
      console.log('Availability updated:', event.detail);
      // Handle availability update
    };

    const handleAbsenceUpdate = (event: CustomEvent) => {
      console.log('Absence updated:', event.detail);
      // Handle absence update
    };

    // Add event listeners
    window.addEventListener('schedule_updated', handleScheduleUpdate as EventListener);
    window.addEventListener('availability_updated', handleAvailabilityUpdate as EventListener);
    window.addEventListener('absence_updated', handleAbsenceUpdate as EventListener);

    // Cleanup function
    return () => {
      // Unsubscribe from events
      unsubscribe('schedule_updated');
      unsubscribe('availability_updated');
      unsubscribe('absence_updated');

      // Remove event listeners
      window.removeEventListener('schedule_updated', handleScheduleUpdate as EventListener);
      window.removeEventListener('availability_updated', handleAvailabilityUpdate as EventListener);
      window.removeEventListener('absence_updated', handleAbsenceUpdate as EventListener);
    };
  }, [subscribe, unsubscribe]);

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

  const handleGenerateSchedule = () => {
    try {
      if (!dateRange?.from || !dateRange?.to) {
        showToast({
          title: "Zeitraum erforderlich",
          description: "Bitte wählen Sie einen Zeitraum aus bevor Sie den Dienstplan generieren.",
          variant: 'destructive',
        });
        return;
      }

      if (!selectedVersion) {
        showToast({
          title: "Version erforderlich",
          description: "Bitte wählen Sie eine Version aus bevor Sie den Dienstplan generieren.",
          variant: 'destructive',
        });
        return;
      }

      if (isLoadingVersions) {
        showToast({
          title: "Versionen werden geladen",
          description: "Bitte warten Sie, bis die Versionen geladen sind.",
          variant: 'default',
        });
        return;
      }

      const formattedFromDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedToDate = format(dateRange.to, 'yyyy-MM-dd');

      addGenerationLog('info', 'Starting schedule generation',
        `Version: ${selectedVersion}, Date range: ${formattedFromDate} - ${formattedToDate}`);

      generate();
    } catch (error) {
      console.error("Generation error:", error);
      showToast({
        title: "Fehler bei der Generierung",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: 'destructive',
      });
    }
  };

  const handleAddScheduleClick = () => {
    setIsAddScheduleDialogOpen(true);
  };

  const handleCreateSchedule = async (scheduleData: {
    employee_id: number;
    date: string;
    shift_id: number;
    version: number;
  }) => {
    try {
      const response = await createSchedule(scheduleData);
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: "Erfolg",
        description: "Schichtplan wurde erfolgreich erstellt",
      });
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Erstellen des Schichtplans",
        variant: "destructive",
      });
    }
  };

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

    setConfirmDeleteMessage({
      title: "Schichtplan endgültig löschen?",
      message: `Sie sind dabei, alle ${convertedSchedules.length} Schichtpläne der Version ${selectedVersion} zu löschen. Diese Aktion betrifft:`,
      details: [
        `• ${new Set(convertedSchedules.map(s => s.employee_id)).size} Mitarbeiter`,
        `• Zeitraum: ${format(dateRange?.from || new Date(), 'dd.MM.yyyy')} - ${format(dateRange?.to || new Date(), 'dd.MM.yyyy')}`,
        `• ${convertedSchedules.filter(s => s.shift_id !== null).length} zugewiesene Schichten`
      ],
      onConfirm: async () => {
        try {
          const deletePromises = convertedSchedules.map(schedule =>
            updateSchedule(schedule.id, { shift_id: null, version: selectedVersion })
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

  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<{
    title: string;
    message: string;
    details?: string[];
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const handleViewChange = (newView: 'table' | 'table2' | 'table3' | 'grid' | 'schedule-table' | 'table-overview') => {
    setActiveView(newView);
  };

  const handleToggleVersionCompare = () => {
    setCompareVersions(!compareVersions);
    if (!compareVersions && versions.length > 1) {
      const selectedIndex = versions.findIndex(v => v === selectedVersion);
      if (selectedIndex > 0) {
        setPreviousVersionForCompare(versions[selectedIndex - 1]);
      } else if (selectedIndex === 0 && versions.length > 1) {
        setPreviousVersionForCompare(versions[1]);
      }
    }
  };

  const handleQuickShiftEdit = (schedule: Schedule) => {
    setQuickShiftSchedule(schedule);
    setIsQuickShiftModalOpen(true);
  };

  const handleQuickShiftSave = async (updatedScheduleData: any) => {
    if (!quickShiftSchedule) return;

    const updates: ScheduleUpdate = {
      shift_id: quickShiftSchedule.shift_id,
      employee_id: quickShiftSchedule.employee_id,
      date: quickShiftSchedule.date,
      notes: updatedScheduleData.notes,
      version: selectedVersion
    };

    // Update shift directly since ScheduleUpdate doesn't have shift_start/shift_end
    await updateShiftMutation.mutateAsync({
      scheduleId: quickShiftSchedule.id,
      updates
    });
  };

  const handleDeleteVersion = async (version: number): Promise<void> => {
    try {
      await handleVersionDelete(version);
      toast({
        title: "Version gelöscht",
        description: `Version ${version} wurde erfolgreich gelöscht.`
      });
    } catch (error) {
      console.error('Error deleting version:', error);
      toast({
        title: "Fehler beim Löschen",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const handleDuplicateVersion = async (version: number): Promise<void> => {
    try {
      await handleVersionDuplicate(version);
      toast({
        title: "Version dupliziert",
        description: `Version ${version} wurde erfolgreich dupliziert.`
      });
    } catch (error) {
      console.error('Error duplicating version:', error);
      toast({
        title: "Fehler beim Duplizieren",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const handleCreateNewVersionWithOptions = (options: { dateRange: DateRange; weekAmount: number }) => {
    if (options.dateRange.from && options.dateRange.to) {
      setDateRange(options.dateRange);
      setScheduleDuration(options.weekAmount);

      versionControlCreateWithOptions(options);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Button
              onClick={onSettingsOpen}
              variant="ghost"
              size="sm"
              className="flex items-center"
            >
              <Settings className="mr-2 h-4 w-4" />
              Einstellungen
            </Button>
            <Button
              onClick={handleGenerateSchedule}
              variant="default"
              size="sm"
              disabled={isGenerating}
              className="flex items-center"
            >
              <Play className="mr-2 h-4 w-4" />
              Generieren
            </Button>
          </div>

          <Separator orientation="vertical" className="mx-4 h-6" />

          <div className="flex items-center gap-2">
            <Button
              onClick={handleCreateNewVersion}
              variant="ghost"
              size="sm"
              className="flex items-center"
            >
              <Plus className="mr-2 h-4 w-4" />
              Hinzufügen
            </Button>
            <Button
              onClick={() => selectedVersion && handleDeleteVersion(selectedVersion)}
              variant="ghost"
              size="sm"
              disabled={!selectedVersion}
              className="flex items-center"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Löschen
            </Button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {!isConnected && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Wifi className="h-4 w-4" />
                <span>Offline</span>
              </Badge>
            )}
            <div className="border rounded-md p-1">
              <Button
                variant={activeView === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('table')}
                className="text-xs"
              >
                Tabelle 1
              </Button>
              <Button
                variant={activeView === 'table2' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('table2')}
                className="text-xs"
              >
                Tabelle 2
              </Button>
              <Button
                variant={activeView === 'table3' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('table3')}
                className="text-xs"
              >
                Tabelle 3
              </Button>
              <Button
                variant={activeView === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('grid')}
                className="text-xs"
              >
                Raster
              </Button>
            </div>
          </div>
        </div>

        <Dashboard>
          <div className="container mx-auto py-6 space-y-6">
            <PageHeader title="Dienstplan" className="mb-4">
              <div className="flex items-center gap-4">
                <ConnectionStatus isConnected={isConnected} />
                <ScheduleControls
                  onRefresh={handleRetryFetch}
                  onExport={handleExportSchedule}
                />
              </div>
            </PageHeader>

            <EnhancedDateRangeSelector
              dateRange={dateRange}
              scheduleDuration={scheduleDuration}
              onWeekChange={handleWeekChange}
              onDurationChange={handleDurationChange}
              hasVersions={versions.length > 0}
              onCreateNewVersion={handleCreateNewVersion}
              onCreateNewVersionWithOptions={handleCreateNewVersionWithOptions}
            />

            {versionMetas && versionMetas.length > 0 && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center w-full mb-2">
                  <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 collapsible-closed:rotate-90" />
                  <h3 className="text-lg font-medium ml-2">Versionsübersicht</h3>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <VersionTable
                    versions={versionMetas}
                    selectedVersion={selectedVersion ?? null}
                    onSelectVersion={handleVersionChange}
                    onPublishVersion={async (version) => await publishVersion(version)}
                    onArchiveVersion={async (version) => await archiveVersion(version)}
                    onDeleteVersion={handleDeleteVersion}
                    onDuplicateVersion={handleDuplicateVersion}
                    onCompareVersion={handleToggleVersionCompare}
                    compareVersions={compareVersions}
                    onCreateNewVersion={handleCreateNewVersion}
                    dateRange={dateRange}
                    isLoading={isLoadingVersions || isLoadingSchedule}
                    hasError={isError && !!error && !data}
                    onRetry={handleRetryFetch}
                    versionStatuses={data?.version_statuses ?? {}}
                    currentVersion={data?.current_version}
                    versionMeta={data?.version_meta}
                    schedules={convertedSchedules}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            {!isLoading && !isError && convertedSchedules.length > 0 && dateRange?.from && dateRange?.to && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center w-full mb-2">
                  <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 collapsible-closed:rotate-90" />
                  <h3 className="text-lg font-medium ml-2">Statistiken</h3>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScheduleStatistics
                    schedules={convertedSchedules}
                    employees={employees || []}
                    startDate={format(dateRange.from, 'yyyy-MM-dd')}
                    endDate={format(dateRange.to, 'yyyy-MM-dd')}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            {compareVersions && previousVersionForCompare && selectedVersion && (
              <VersionCompare
                currentVersion={convertedSchedules}
                previousVersion={(data?.schedules || [])
                  .filter(s => s.version === previousVersionForCompare)
                  .map(s => convertSchedule(s))}
              />
            )}

            <div className="flex justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleGenerateSchedule}
                  disabled={isGenerating || !selectedVersion}
                  className="flex items-center"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generiere...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generieren
                    </>
                  )}
                </Button>

                {settingsQuery.data && (
                  <ScheduleGenerationSettings
                    settings={settingsQuery.data}
                    onUpdate={handleSettingsUpdate}
                    isGenerating={isGenerationPending}
                  />
                )}

                <Separator orientation="vertical" className="h-6" />

                <Button
                  onClick={handleAddScheduleClick}
                  disabled={!selectedVersion || isLoadingSchedule || isLoadingVersions || isGenerationPending}
                  variant="outline"
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>

                <Button
                  onClick={handleDeleteSchedule}
                  disabled={!selectedVersion || convertedSchedules.length === 0 || isLoadingSchedule || isLoadingVersions || isGenerationPending}
                  variant="outline"
                  size="icon"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 border rounded-md p-1">
                <Button
                  variant={activeView === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewChange('table')}
                  className="text-xs"
                >
                  T1 (Page)
                </Button>
                <Button
                  variant={activeView === 'schedule-table' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewChange('schedule-table')}
                  className="text-xs"
                >
                  T2 (Schedule)
                </Button>
                <Button
                  variant={activeView === 'table-overview' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewChange('table-overview')}
                  className="text-xs"
                >
                  T3 (Overview)
                </Button>
                <Button
                  variant={activeView === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewChange('grid')}
                  className="text-xs"
                >
                  Raster
                </Button>
              </div>
            </div>

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
                    <ScheduleManager
                      schedules={convertedSchedules}
                      dateRange={dateRange}
                      onDrop={handleShiftDrop}
                      onUpdate={handleShiftUpdate}
                      isLoading={isLoadingSchedule}
                      employeeAbsences={employeeAbsences}
                      absenceTypes={settingsData?.employee_groups?.absence_types || []}
                      activeView={activeView}
                    />
                  </div>
                )}
              </>
            )}

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

            {isAddScheduleDialogOpen && selectedVersion && (
              <AddScheduleDialog
                isOpen={isAddScheduleDialogOpen}
                onClose={() => setIsAddScheduleDialogOpen(false)}
                onAddSchedule={async (scheduleData) => {
                  await handleCreateSchedule(scheduleData);
                  setIsAddScheduleDialogOpen(false);
                }}
                version={selectedVersion}
                defaultDate={dateRange?.from}
              />
            )}

            {isQuickShiftModalOpen && quickShiftSchedule && (
              <ShiftModal
                isOpen={isQuickShiftModalOpen}
                onClose={() => {
                  setIsQuickShiftModalOpen(false);
                  setQuickShiftSchedule(null);
                }}
                schedule={quickShiftSchedule}
                onSave={handleQuickShiftSave}
                title="Schnellbearbeitung der Schicht"
              />
            )}

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

            {/* Original table view */}
            {activeView === 'table' && (
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
                />
              </div>
            )}

            {/* T2: Schedule Table from components/Schedule/ScheduleTable.tsx */}
            {activeView === 'schedule-table' && (
              <ScheduleTableV2
                schedules={convertedSchedules}
                dateRange={dateRange}
                onDrop={handleShiftDrop}
                onUpdate={handleShiftUpdate}
                isLoading={isLoadingSchedule}
                employeeAbsences={employeeAbsences}
                absenceTypes={settingsData?.employee_groups?.absence_types}
              />
            )}

            {/* T3: Table Overview from components/Schedule/Table/ScheduleTable.tsx */}
            {activeView === 'table-overview' && (
              <ScheduleTableV3
                schedules={convertedSchedules}
                dateRange={dateRange}
                onDrop={handleShiftDrop}
                onUpdate={handleShiftUpdate}
                isLoading={isLoadingSchedule}
                employeeAbsences={employeeAbsences}
                absenceTypes={settingsData?.employee_groups?.absence_types}
                settings={settingsData}
              />
            )}

            {/* Grid view */}
            {activeView === 'grid' && (
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
                />
              </div>
            )}
          </div>
        </Dashboard>
      </div>
    </DndProvider>
  );
} 