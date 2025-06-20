import { useToast } from "@/components/ui/use-toast";
import {
    createSchedule,
    exportSchedule,
    fixScheduleDisplay,
    importAiScheduleResponse,
    updateSchedule
} from "@/services/api";
import { AiImportResponse } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCallback } from "react";
import { DateRange } from "react-day-picker";

// Types for schedule operations
interface ScheduleData {
  id: number;
  employee_id: number;
  shift_id: number | null;
  version: number;
  date: string;
}

interface NewScheduleData {
  employee_id: number;
  date: string;
  shift_id: number;
  version: number;
}

interface ScheduleUpdate {
  id: number;
  shift_id: number | null;
  version: number;
}

export interface ScheduleOperationsState {
  // CRUD Operations
  handleCreateSchedule: (newScheduleData: NewScheduleData) => Promise<void>;
  handleDeleteSchedule: (scheduleData: ScheduleData[], selectedVersion: number, dateRange: DateRange) => void;
  handleUpdateSchedule: (updates: ScheduleUpdate[], selectedVersion: number) => Promise<void>;
  
  // Utility Operations
  handleFixDisplay: (dateRange: DateRange, selectedVersion?: number) => Promise<void>;
  handleExportSchedule: (format: 'standard' | 'mep' | 'mep-html', dateRange: DateRange, filiale?: string) => Promise<void>;
  handleImportAiResponse: (selectedVersion: number, dateRange: DateRange) => void;
  
  // Mutation states
  isCreating: boolean;
  isUpdating: boolean;
  isExporting: boolean;
  isImporting: boolean;
  
  // Error states
  createError: string | null;
  updateError: string | null;
  exportError: string | null;
  importError: string | null;
}

interface UseScheduleOperationsOptions {
  onOperationComplete?: (operation: string) => void;
  onError?: (operation: string, error: string) => void;
  addGenerationLog?: (type: 'info' | 'error', message: string, details?: string) => void;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Ein unerwarteter Fehler ist aufgetreten";
}

export function useScheduleOperations(options: UseScheduleOperationsOptions = {}): ScheduleOperationsState {
  const { onOperationComplete, onError, addGenerationLog } = options;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create Schedule Mutation
  const createMutation = useMutation<unknown, Error, NewScheduleData>({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast({
        title: "Schichtplan erstellt",
        description: "Neuer Schichtplan erfolgreich erstellt.",
      });
      onOperationComplete?.("create");
    },
    onError: (error) => {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Fehler beim Erstellen",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.("create", errorMessage);
    },
  });

  // Update Schedule Mutation
  const updateMutation = useMutation<void, Error, { updates: ScheduleUpdate[]; version: number }>({
    mutationFn: async ({ updates, version }) => {
      const updatePromises = updates.map((update) =>
        updateSchedule(update.id, {
          shift_id: update.shift_id,
          version,
        })
      );
      await Promise.all(updatePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast({
        title: "Schichtplan aktualisiert",
        description: "Änderungen wurden erfolgreich gespeichert.",
      });
      onOperationComplete?.("update");
    },
    onError: (error) => {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.("update", errorMessage);
    },
  });

  // Export Schedule Mutation
  const exportMutation = useMutation<Blob, Error, { format: 'standard' | 'mep' | 'mep-html', dateRange: DateRange, filiale?: string }>({
    mutationFn: async ({ format: exportFormat, dateRange, filiale }) => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Bitte wählen Sie einen Zeitraum aus");
      }
      
      const exportType = exportFormat === 'mep' ? 'MEP' : 'Standard';
      addGenerationLog?.("info", `Starting ${exportType} PDF export`);
      
      const response = await exportSchedule(
        format(dateRange.from, "yyyy-MM-dd"),
        format(dateRange.to, "yyyy-MM-dd"),
        undefined, // layoutConfig
        exportFormat,
        filiale
      );
      
      addGenerationLog?.("info", `${exportType} PDF export completed`);
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
      return blob;
    },
    onSuccess: () => {
      onOperationComplete?.("export");
    },
    onError: (error) => {
      const errorMessage = getErrorMessage(error);
      addGenerationLog?.("error", "PDF export failed", errorMessage);
      toast({
        title: "Fehler beim Export",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.("export", errorMessage);
    },
  });

  // Import AI Response Mutation
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
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
        queryClient.invalidateQueries({ queryKey: ['versions'] });
      }, 100);
      
      toast({
        title: "Import erfolgreich",
        description: data.message || `Es wurden ${data.imported_count} Zuweisungen importiert.`,
        variant: "default",
      });
      onOperationComplete?.("import");
    },
    onError: (error) => {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Import fehlgeschlagen",
        description: `Fehler: ${errorMessage}`,
        variant: "destructive",
      });
      onError?.("import", errorMessage);
    },
  });

  // Handler functions
  const handleCreateSchedule = useCallback(async (newScheduleData: NewScheduleData) => {
    await createMutation.mutateAsync(newScheduleData);
  }, [createMutation]);

  const handleDeleteSchedule = useCallback((scheduleData: ScheduleData[], selectedVersion: number, dateRange: DateRange) => {
    if (!selectedVersion) {
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

    // Create delete confirmation logic here or return data for confirmation dialog
    const schedulesToDelete = scheduleData.filter((s) => s.shift_id !== null);
    
    if (schedulesToDelete.length === 0) {
      toast({
        title: "Keine Schichten zum Löschen",
        variant: "destructive",
      });
      return;
    }

    // This could be enhanced to show a confirmation dialog
    const confirmDelete = window.confirm(
      `Alle ${scheduleData.length} Schichtpläne der Version ${selectedVersion} löschen?\n` +
      `Betrifft: ${new Set(scheduleData.map((s) => s.employee_id)).size} Mitarbeiter\n` +
      `Zeitraum: ${format(dateRange?.from || new Date(), "dd.MM.yyyy")} - ${format(dateRange?.to || new Date(), "dd.MM.yyyy")}\n` +
      `${scheduleData.filter((s) => s.shift_id !== null).length} zugewiesene Schichten`
    );

    if (confirmDelete) {
      const updates: ScheduleUpdate[] = schedulesToDelete.map((s) => ({
        id: s.id,
        shift_id: null,
        version: selectedVersion,
      }));
      
      updateMutation.mutate({ updates, version: selectedVersion });
    }
  }, [toast, updateMutation]);

  const handleUpdateSchedule = useCallback(async (updates: ScheduleUpdate[], selectedVersion: number) => {
    await updateMutation.mutateAsync({ updates, version: selectedVersion });
  }, [updateMutation]);

  const handleFixDisplay = useCallback(async (dateRange: DateRange, selectedVersion?: number) => {
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
        selectedVersion
      );
      toast({
        title: "Anzeige repariert",
        description: "Die Anzeige der Schichtdaten wurde erfolgreich repariert.",
      });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      onOperationComplete?.("fix");
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Fehler bei der Reparatur",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.("fix", errorMessage);
    }
  }, [toast, queryClient, onOperationComplete, onError]);

  const handleExportSchedule = useCallback(async (format: 'standard' | 'mep' | 'mep-html', dateRange: DateRange, filiale?: string) => {
    await exportMutation.mutateAsync({ format, dateRange, filiale });
  }, [exportMutation]);

  const handleImportAiResponse = useCallback((selectedVersion: number, dateRange: DateRange) => {
    if (!selectedVersion || !dateRange?.from || !dateRange?.to) {
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
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const file = files[0];

        const formData = new FormData();
        formData.append('file', file);
        formData.append('version_id', selectedVersion.toString());
        formData.append('start_date', format(dateRange.from!, 'yyyy-MM-dd'));
        formData.append('end_date', format(dateRange.to!, 'yyyy-MM-dd'));

        importAiResponseMutation.mutate(formData);
      }

      // Clean up the file input element
      document.body.removeChild(fileInput);
    };

    // Trigger the file picker
    fileInput.click();
  }, [toast, importAiResponseMutation]);

  return {
    // CRUD Operations
    handleCreateSchedule,
    handleDeleteSchedule,
    handleUpdateSchedule,
    
    // Utility Operations
    handleFixDisplay,
    handleExportSchedule,
    handleImportAiResponse,
    
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isExporting: exportMutation.isPending,
    isImporting: importAiResponseMutation.isPending,
    
    // Error states
    createError: createMutation.error ? getErrorMessage(createMutation.error) : null,
    updateError: updateMutation.error ? getErrorMessage(updateMutation.error) : null,
    exportError: exportMutation.error ? getErrorMessage(exportMutation.error) : null,
    importError: importAiResponseMutation.error ? getErrorMessage(importAiResponseMutation.error) : null,
  };
}
