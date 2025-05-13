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
import { addDays, startOfWeek, endOfWeek, addWeeks, format, getWeek, isBefore, differenceInCalendarWeeks, differenceInDays, parseISO } from 'date-fns';
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

// Add a utility function outside of the component to extract error messages safely
const getErrorMessage = (error: any): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    return error.message;
  }
  return "Ein unerwarteter Fehler ist aufgetreten";
};

export function SchedulePage() {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(today, { weekStartsOn: 1 }), // Start on Monday of current week
    to: endOfWeek(today, { weekStartsOn: 1 }), // End on Sunday of current week
  });
  const [weekAmount, setWeekAmount] = useState<number>(1);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(true);
  const [createEmptySchedules, setCreateEmptySchedules] = useState(true);
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [isGenerationSettingsOpen, setIsGenerationSettingsOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddScheduleDialogOpen, setIsAddScheduleDialogOpen] = useState(false);
  const [employeeAbsences, setEmployeeAbsences] = useState<Record<number, any[]>>({});
  const [enableDiagnostics, setEnableDiagnostics] = useState<boolean>(false);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false); // MODIFIED: Added for AI generation loading state

  // First, move the useVersionControl hook before useScheduleData and other hooks that depend on it
  const settingsQuery = useQuery<Settings, Error>({
    queryKey: ['settings'] as const,
    queryFn: async () => {
      const response = await getSettings();
      return response;
    },
    retry: 3,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Use our version control hook - MOVED UP to be defined before dependent hooks
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
    initialVersion: undefined, // Don't set an initial version, let auto-selection work
    onVersionSelected: (version) => {
      console.log('🔄 SchedulePage: Version selected callback triggered with version:', version);
      // When a version is selected via the version control, we need to refetch data
      refetchScheduleData();
      // Also make sure our local state is in sync
      setSelectedVersion(version);
    }
  });

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
  
  // Extract schedule data with proper types - NOW versionControlSelectedVersion is defined
  const { scheduleData, errors: scheduleErrors, loading: isLoadingSchedule, error: scheduleError, refetch: refetchScheduleData } = useScheduleData(
    dateRange?.from ?? new Date(),
    dateRange?.to ?? new Date(),
    versionControlSelectedVersion,
    includeEmpty
  );

  // Use only schedule errors from the useScheduleData hook
  const errors = scheduleErrors || [];

  // Log fetch errors
  useEffect(() => {
    if (scheduleError) {
      console.error('Schedule fetch error:', scheduleError);
      addGenerationLog('error', 'Error fetching schedule data',
        getErrorMessage(scheduleError));
    }
  }, [scheduleError]);

  // Use our schedule generation hook (for standard generation)
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
    setShowGenerationOverlay
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

  // Add a retry mechanism for failed data fetches
  const handleRetryFetch = () => {
    console.log('Retrying data fetch...');
    // Clear any existing errors
    clearGenerationLogs();
    // Force refetch
    refetchScheduleData();
  };

  // Export mutation for PDF generation
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

  // Function to handle exporting the schedule
  const handleExportSchedule = () => {
    exportMutation.mutate();
  };

  // Show loading skeleton for initial data fetch
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

  // Handle scheduleError if present
  if (scheduleError) {
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
            <div>Failed to fetch schedules: {getErrorMessage(scheduleError)}</div>
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
      </div>
    );
  }

  // Show loading overlay for subsequent data fetches
  const isUpdating = isLoadingVersions || isPending || exportMutation.isPending || isAiGenerating; // MODIFIED: Added isAiGenerating

  // Function to handle the STANDARD generate action
  const handleGenerateStandardSchedule = () => {
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

      generate(); // Use the original variable name from useScheduleGeneration
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

  // MODIFIED: Replace AI generation using mutation pattern with direct function
  const handleGenerateAiSchedule = async () => {
    console.log("🔍 handleGenerateAiSchedule triggered");
    
    if (!dateRange?.from || !dateRange?.to) {
      console.warn("Missing date range for AI generation");
      toast({
        title: "Zeitraum erforderlich (AI)",
        description: "Bitte wählen Sie einen Zeitraum für die AI-Generierung aus.",
        variant: "destructive"
      });
      return;
    }
    if (!versionControlSelectedVersion) {
      console.warn("Missing version for AI generation");
      toast({
        title: "Version erforderlich (AI)",
        description: "Bitte wählen Sie eine Version für die AI-Generierung aus.",
        variant: "destructive"
      });
      return;
    }

    console.log("🚀 Starting AI generation for:", {
      dateRange: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString()
      },
      version: versionControlSelectedVersion
    });

    setIsAiGenerating(true);
    
    // First clear the existing steps and logs but don't reset the overlay completely
    clearGenerationLogs();
    
    // Set up our own steps for AI generation
    const aiSteps = [
      { id: "ai-init", title: "Initialisiere KI-Generierung", status: "pending" as const },
      { id: "ai-analyze", title: "Analysiere Verfügbarkeiten", status: "pending" as const },
      { id: "ai-generate", title: "Erstelle Schichtplan", status: "pending" as const },
      { id: "ai-finalize", title: "Finalisiere KI-Schichtplan", status: "pending" as const },
    ];

    // Clear previous steps and set new ones manually to avoid triggering resetGenerationState
    setGenerationSteps(aiSteps);
    
    // Force show the overlay
    setShowGenerationOverlay(true);
    
    // Log the start of generation
    addGenerationLog('info', 'Starting AI schedule generation',
      `Version: ${versionControlSelectedVersion}, Date range: ${format(dateRange.from, 'yyyy-MM-dd')} - ${format(dateRange.to, 'yyyy-MM-dd')}`);
    
    try {
      // Update first step to in-progress
      updateGenerationStep("ai-init", "in-progress");
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UI update
      
      const fromStr = format(dateRange.from, 'yyyy-MM-dd');
      const toStr = format(dateRange.to, 'yyyy-MM-dd');
      
      console.log("Calling generateAiSchedule API with:", { fromStr, toStr, versionControlSelectedVersion });
      
      // Complete first step and start next
      updateGenerationStep("ai-init", "completed");
      updateGenerationStep("ai-analyze", "in-progress");
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UI update
      
      const result = await generateAiSchedule(fromStr, toStr, versionControlSelectedVersion);
      
      // Continue updating steps
      updateGenerationStep("ai-analyze", "completed");
      updateGenerationStep("ai-generate", "in-progress");
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UI update
      
      console.log("AI Generation Result received:", result);
      addGenerationLog('info', 'AI schedule generation API call successful');

      // More detailed logging of result
      if (result.schedules) {
        console.log(`Generated ${result.schedules.length} schedule entries`);
        addGenerationLog('info', `Generated ${result.schedules.length} schedule entries`);
      }
      
      // Update steps
      updateGenerationStep("ai-generate", "completed");
      updateGenerationStep("ai-finalize", "in-progress");
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UI update
      
      await refetchScheduleData();
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      
      updateGenerationStep("ai-finalize", "completed");
      
      toast({
        title: "AI Generation Complete",
        description: "The AI schedule has been generated successfully.",
      });

      // Add logging for any errors or logs returned in the response
      if (result.logs && result.logs.length > 0) { 
        console.log("AI Generation Logs:", result.logs);
        result.logs.forEach(log => addGenerationLog('info', 'AI Log:', log));
      }
      
      if (result.errors && result.errors.length > 0) {
        console.warn("AI Generation Errors:", result.errors);
        result.errors.forEach(err => addGenerationLog('error', 'AI Error:', err.message || JSON.stringify(err)));
        toast({
          title: "AI Generation Warnings",
          description: `AI generation completed with ${result.errors.length} issues.`,
          variant: "destructive"
        });
      }
      
      // Keep the overlay open for a moment so the user can see the completion
      setTimeout(() => {
        setIsAiGenerating(false);
      }, 2000);
      
    } catch (err: unknown) {
      console.error("AI Generation error (detailed):", err);
      
      // Handle error case
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred during AI generation";
      
      toast({
        title: "AI Generation Error",
        description: errorMessage,
        variant: "destructive"
      });
      
      // Log the error in the overlay
      addGenerationLog('error', 'AI Generation Error', errorMessage);
      
      // Mark any in-progress steps as error
      aiSteps.forEach(step => {
        updateGenerationStep(step.id, "error", "Generation failed");
      });
      
      // Keep the overlay visible so the user can see the error
      setTimeout(() => {
        setIsAiGenerating(false);
      }, 3000);
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

    if (scheduleData.length === 0) {
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
      message: `Sie sind dabei, alle ${scheduleData.length} Schichtpläne der Version ${versionControlSelectedVersion} zu löschen. Diese Aktion betrifft:`,
      details: [
        `• ${new Set(scheduleData.map(s => s.employee_id)).size} Mitarbeiter`,
        `• Zeitraum: ${format(dateRange?.from || new Date(), 'dd.MM.yyyy')} - ${format(dateRange?.to || new Date(), 'dd.MM.yyyy')}`,
        `• ${scheduleData.filter(s => s.shift_id !== null).length} zugewiesene Schichten`
      ],
      onConfirm: async () => {
        try {
          console.log('🗑️ BULK DELETE: Starting deletion of all schedules');
          
          // Only delete schedules that actually have a shift assigned
          const schedulesToDelete = scheduleData.filter(s => s.shift_id !== null);
          
          if (schedulesToDelete.length === 0) {
            console.log('🗑️ BULK DELETE: No schedules with shifts to delete');
            toast({
              title: "Keine Schichten zum Löschen",
              description: "Es wurden keine zugewiesenen Schichten gefunden.",
              variant: "destructive"
            });
            setConfirmDeleteMessage(null);
            return;
          }
          
          console.log(`🗑️ BULK DELETE: Will delete ${schedulesToDelete.length} schedules with version ${versionControlSelectedVersion}`);
          
          const deletePromises = schedulesToDelete.map(schedule => {
            console.log(`🗑️ BULK DELETE: Deleting schedule ID ${schedule.id} with shift ID ${schedule.shift_id}`);
            return updateSchedule(schedule.id, { 
              shift_id: null, 
              version: versionControlSelectedVersion,
              // Add employee_id to ensure proper identification
              employee_id: schedule.employee_id
            });
          });
          
          // Process in smaller batches to avoid overwhelming the server
          const batchSize = 10;
          const results = [];
          
          for (let i = 0; i < deletePromises.length; i += batchSize) {
            const batch = deletePromises.slice(i, i + batchSize);
            console.log(`🗑️ BULK DELETE: Processing batch ${i/batchSize + 1} of ${Math.ceil(deletePromises.length/batchSize)}`);
            
            try {
              const batchResults = await Promise.all(batch);
              results.push(...batchResults);
              console.log(`🗑️ BULK DELETE: Batch ${i/batchSize + 1} completed successfully`);
            } catch (batchError) {
              console.error(`🗑️ BULK DELETE: Error in batch ${i/batchSize + 1}:`, batchError);
            }
          }
          
          console.log(`🗑️ BULK DELETE: Completed with ${results.length} successful deletions`);
          
          // Force invalidate query cache to ensure fresh data
          queryClient.invalidateQueries({ queryKey: ['schedules'] });
          
          // Then refetch
          await refetchScheduleData();

          toast({
            title: "Schichtpläne gelöscht",
            description: `${results.length} Schichten wurden entfernt.`,
          });
        } catch (error) {
          console.error('🗑️ BULK DELETE ERROR:', error);
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
    console.log('🆕 SchedulePage: Creating new version from dialog with options:', options);

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
      versionControlCreateWithOptions({
        dateRange: options.dateRange,
        weekAmount: newCalculatedWeekAmount,
        isUserInitiated: true // Explicitly mark as user-initiated
      });
    } else {
      toast({
        title: "Fehler",
        description: "Ungültiger Zeitraum für neue Version ausgewählt.",
        variant: "destructive",
      });
    }
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

  // Check and fix missing time data in schedules
  const checkAndFixMissingTimeData = async () => {
    if (!versionControlSelectedVersion || !dateRange?.from || !dateRange?.to) {
      console.log('Cannot fix missing time data: missing version or date range');
      toast({
        title: "Operation nicht möglich",
        description: "Version oder Datumsbereich fehlt",
        variant: "destructive"
      });
      return;
    }
    
    // Show a loading toast to indicate that the operation has started
    const { dismiss } = toast({
      title: "Prüfe Schichtdaten...",
      description: "Überprüfe und korrigiere fehlende Zeitdaten...",
    });
    const loadingToastId = dismiss; // Saving the dismiss function
    
    const schedulesWithShiftId = scheduleData.filter(s => s.shift_id !== null);
    const problemSchedules = schedulesWithShiftId.filter(s => !s.shift_start || !s.shift_end);
    
    if (problemSchedules.length > 0) {
      console.log(`🔧 Found ${problemSchedules.length} schedules with missing time data. Attempting to fix...`);
      
      try {
        const result = await fixScheduleDisplay(
          format(dateRange.from, 'yyyy-MM-dd'),
          format(dateRange.to, 'yyyy-MM-dd'),
          versionControlSelectedVersion
        );
        
        console.log('🔧 Schedule display fix completed:', result);
        
        // Dismiss the loading toast
        loadingToastId();
        
        // Show a more detailed success toast
        toast({
          title: "Schichtdaten repariert",
          description: `${result.total_schedules || 0} Schichten geprüft, 
            ${problemSchedules.length} Probleme gefunden, 
            ${result.empty_schedules_count || 0} Einträge aktualisiert.`,
          variant: "default",
        });
        
        // Refetch the data to show the fixed schedules
        await refetchScheduleData();
      } catch (error) {
        console.error('Failed to fix schedule time data:', error);
        
        // Dismiss the loading toast
        loadingToastId();
        
        toast({
          title: "Fehler bei der Korrektur",
          description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
          variant: "destructive"
        });
      }
    } else {
      // Dismiss the loading toast
      loadingToastId();
      
      // Let the user know there were no issues
      toast({
        title: "Keine Probleme gefunden",
        description: "Alle Schichtdaten sind vollständig.",
        variant: "default"
      });
    }
  };
  
  // Run fix check when data is loaded and we detect problems
  useEffect(() => {
    if (scheduleData.length > 0) {
      const schedulesWithShiftId = scheduleData.filter(s => s.shift_id !== null);
      const problemSchedules = schedulesWithShiftId.filter(s => !s.shift_start || !s.shift_end);
      
      if (problemSchedules.length > 0 && !isLoadingVersions && !isPending && !isAiGenerating) {
        console.log(`🚨 Auto-fixing: Found ${problemSchedules.length} schedules with missing time data`);
        checkAndFixMissingTimeData();
      }
    }
  }, [scheduleData, versionControlSelectedVersion, dateRange, isLoadingVersions, isPending, isAiGenerating]);

  // Add a useEffect to update enableDiagnostics when settings change
  useEffect(() => {
    if (settingsQuery.data?.scheduling?.enable_diagnostics !== undefined) {
      setEnableDiagnostics(settingsQuery.data.scheduling.enable_diagnostics);
    }
  }, [settingsQuery.data]);

  // Initialize date range with current week, always using Monday as start day
  useEffect(() => {
    if (!dateRange || !dateRange.from || !dateRange.to) {
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
      const from = startOfWeek(dateRange.from, { weekStartsOn: 1 });
      const to = addDays(from, 6 * duration);
      to.setHours(23, 59, 59, 999);
      setDateRange({ from, to });
    }
  };

  // Sync our internal state with the hook's state
  useEffect(() => {
    console.log('🔄 SchedulePage: versionControlSelectedVersion changed to:', versionControlSelectedVersion);
    if (versionControlSelectedVersion !== undefined && versionControlSelectedVersion !== selectedVersion) {
      console.log('🔄 SchedulePage: Updating local selectedVersion to match hook:', versionControlSelectedVersion);
      setSelectedVersion(versionControlSelectedVersion);
    }
  }, [versionControlSelectedVersion]);

  // Add effect to sync date range with selected version's date range
  useEffect(() => {
    if (versionControlSelectedVersion && versionMetas && versionMetas.length > 0) {
      const selectedVersionMeta = versionMetas.find(vm => vm.version === versionControlSelectedVersion);
      
      // Access the data using a type assertion to avoid TypeScript errors
      const metaAny = selectedVersionMeta as any;
      const dateRangeStart = selectedVersionMeta?.date_range?.start || 
                            (metaAny?.version_meta?.date_range?.start);
      const dateRangeEnd = selectedVersionMeta?.date_range?.end || 
                          (metaAny?.version_meta?.date_range?.end);
      
      if (dateRangeStart && dateRangeEnd) {
        // Get dates from version metadata
        const versionStartDate = parseISO(dateRangeStart);
        const versionEndDate = parseISO(dateRangeEnd);
        
        // Set time components
        versionStartDate.setHours(0, 0, 0, 0);
        versionEndDate.setHours(23, 59, 59, 999);
        
        // Calculate week amount
        const daysDiff = differenceInDays(versionEndDate, versionStartDate);
        const newWeekAmount = Math.ceil((daysDiff + 1) / 7);
        
        console.log('🔄 SchedulePage: Syncing date range with version', {
          version: versionControlSelectedVersion,
          dateRange: { from: versionStartDate, to: versionEndDate },
          weekAmount: newWeekAmount
        });
        
        // Update state
        setWeekAmount(newWeekAmount);
        setDateRange({ from: versionStartDate, to: versionEndDate });
      }
    }
  }, [versionControlSelectedVersion, versionMetas]);

  // Fix the scheduleError instanceof check to avoid type errors
  const getErrorMessage = (error: any): string => {
    if (error && typeof error === 'object' && 'message' in error) {
      return error.message;
    }
    return "Ein unerwarteter Fehler ist aufgetreten";
  };

  // Log fetch errors - updated to use getErrorMessage helper
  useEffect(() => {
    if (scheduleError) {
      console.error('Schedule fetch error:', scheduleError);
      addGenerationLog('error', 'Error fetching schedule data', getErrorMessage(scheduleError));
    }
  }, [scheduleError]);

  // Add missing handler functions for the ScheduleManager

  // Define the missing handleShiftDrop function
  const handleShiftDrop = async (update: ScheduleUpdate) => {
    try {
      console.log('Updating schedule with drop:', update);
      // Update the schedule
      await updateSchedule(update.id, {
        shift_id: update.shift_id,
        version: versionControlSelectedVersion,
        // Include employee_id to ensure proper identification
        employee_id: update.employee_id
      });
      // Refetch schedule data
      await refetchScheduleData();
      // Show success toast
      toast({
        title: "Schicht aktualisiert",
        description: "Die Schicht wurde erfolgreich verschoben.",
      });
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  // Define the missing handleShiftUpdate function
  const handleShiftUpdate = async (update: ScheduleUpdate) => {
    try {
      console.log('Updating schedule:', update);
      // Update the schedule
      await updateSchedule(update.id, {
        shift_id: update.shift_id,
        version: versionControlSelectedVersion,
        // Include employee_id to ensure proper identification
        employee_id: update.employee_id
      });
      // Refetch schedule data
      await refetchScheduleData();
      // Show success toast
      toast({
        title: "Schicht aktualisiert",
        description: "Die Schicht wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  // Add handler function for updating settings
  const handleSettingsUpdate = async (updatedSettings: Settings) => {
    try {
      console.log('Updating settings:', updatedSettings);
      // Update the settings
      await updateSettings(updatedSettings);
      // Refetch settings data
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      // Show success toast
      toast({
        title: "Einstellungen aktualisiert",
        description: "Die Einstellungen wurden erfolgreich aktualisiert.",
      });
      // Close settings dialog
      setIsGenerationSettingsOpen(false);
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto py-4 space-y-4">
      <div className="bg-red-200 p-4 text-xl font-bold text-center mb-4">
        DEBUG: SchedulePage is rendering with {scheduleData.length} schedules
      </div>
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
      {!isLoadingVersions && scheduleData.length > 0 && dateRange?.from && dateRange?.to && (
        <ScheduleStatistics
          schedules={scheduleData}
          employees={employees || []}
          startDate={format(dateRange.from, 'yyyy-MM-dd')}
          endDate={format(dateRange.to, 'yyyy-MM-dd')}
          version={versionControlSelectedVersion}
        />
      )}

      {/* Schedule Actions - Moved to the top */}
      <div className="flex justify-start mb-4">
        <ScheduleActions
          onAddSchedule={handleAddSchedule}
          onDeleteSchedule={handleDeleteSchedule}
          onGenerateStandardSchedule={handleGenerateStandardSchedule}
          onGenerateAiSchedule={handleGenerateAiSchedule}
          onOpenGenerationSettings={() => setIsGenerationSettingsOpen(true)}
          onFixDisplay={handleFixDisplay}
          onFixTimeData={checkAndFixMissingTimeData}
          isLoading={isLoadingSchedule || isLoadingVersions}
          isGenerating={isPending || isAiGenerating}
          canAdd={!!versionControlSelectedVersion}
          canDelete={!!versionControlSelectedVersion && scheduleData.length > 0}
          canGenerate={!!versionControlSelectedVersion && !(isPending || isAiGenerating)}
          canFix={!!versionControlSelectedVersion}
        />
      </div>
      
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

      {/* Schedule Content */}
      <DndProvider backend={HTML5Backend}>
        {isLoadingSchedule ? (
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : (
          <>
            {scheduleErrors.length > 0 && <ScheduleErrors errors={scheduleErrors} />}

            {scheduleData.length === 0 && !isLoadingSchedule ? (
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
                      onClick={handleGenerateStandardSchedule}
                      disabled={(isPending || isAiGenerating) || !versionControlSelectedVersion}
                      className="flex items-center gap-2"
                    >
                      {(isPending || isAiGenerating) ? (
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
                  schedules={scheduleData}
                  dateRange={dateRange}
                  onDrop={handleShiftDrop}
                  onUpdate={handleShiftUpdate}
                  isLoading={isLoadingSchedule}
                  employeeAbsences={employeeAbsences}
                  absenceTypes={settingsData?.employee_groups?.absence_types || []}
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
        showGenerationOverlay={showGenerationOverlay || isAiGenerating}
        isPending={isPending || isAiGenerating}
        resetGenerationState={() => {
          resetGenerationState();
          setIsAiGenerating(false);
        }}
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
              isGenerating={isPending || isAiGenerating} // MODIFIED
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
