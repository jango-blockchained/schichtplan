import { useToast } from "@/components/ui/use-toast";
import {
    createSchedule as apiCreateSchedule,
    fixScheduleDisplay as apiFixScheduleDisplay,
    generateAiSchedule as apiGenerateAiSchedule,
    updateSchedule as apiUpdateSchedule,
    exportSchedule,
    importAiScheduleResponse,
} from "@/services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import useScheduleGeneration from "./useScheduleGeneration";

function getErrorMessage(error: unknown): string {
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      return error.message;
    }
    return "Ein unerwarteter Fehler ist aufgetreten";
  }

export function useScheduleMutations({ queries, dialogs }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const aiGeneration = useScheduleGeneration({
    dateRange: queries.navigation.dateRange,
    selectedVersion: queries.effectiveSelectedVersion,
    createEmptySchedules: true, // This should probably be a setting
    enableDiagnostics: false, // This should probably be a setting
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      if (queries.navigation.useWeekBasedNavigation) {
        queryClient.invalidateQueries({ queryKey: ["week-version"] });
      }
    },
  });

  const exportMutation = useMutation({
    mutationFn: async ({ format: exportFormat, filiale }: { format: 'standard' | 'mep' | 'mep-html', filiale?: string }) => {
        if (!queries.navigation.dateRange?.from || !queries.navigation.dateRange?.to) {
            throw new Error("Bitte wählen Sie einen Zeitraum aus");
        }
        const response = await exportSchedule(
            format(queries.navigation.dateRange.from, "yyyy-MM-dd"),
            format(queries.navigation.dateRange.to, "yyyy-MM-dd"),
            undefined,
            exportFormat,
            filiale
        );
        const blob = new Blob([response], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const prefix = exportFormat === 'mep' ? 'MEP' : 'Schichtplan';
        const dateStr = `${format(queries.navigation.dateRange.from, "yyyy-MM-dd")}_${format(queries.navigation.dateRange.to, "yyyy-MM-dd")}`;
        a.download = `${prefix}_${dateStr}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return blob;
    },
    onError: (error) => {
      toast({ title: "Fehler beim Export", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const importAiResponseMutation = useMutation({
    mutationFn: importAiScheduleResponse,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      toast({ title: "Import erfolgreich", description: data.message || `Es wurden ${data.imported_count} Zuweisungen importiert.` });
    },
    onError: (error) => {
      toast({ title: "Import fehlgeschlagen", description: `Fehler: ${getErrorMessage(error)}`, variant: "destructive" });
    },
  });

  const createScheduleMutation = useMutation({
      mutationFn: apiCreateSchedule,
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["schedules"] });
          toast({ title: "Schichtplan erstellt" });
      },
      onError: (error) => {
        toast({ title: "Fehler beim Erstellen", description: getErrorMessage(error), variant: "destructive" });
      }
  });

  const updateScheduleMutation = useMutation({
      mutationFn: (updates: any) => apiUpdateSchedule(updates, queries.effectiveSelectedVersion),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
        toast({ title: "Plan aktualisiert" });
      },
      onError: (error) => {
        toast({ title: "Fehler beim Aktualisieren", description: getErrorMessage(error), variant: "destructive" });
      }
  });

  const deleteScheduleMutation = useMutation({
      mutationFn: async () => {
        const schedulesToDelete = queries.schedule.scheduleData.filter(s => s.shift_id !== null);
        if (schedulesToDelete.length === 0) {
            toast({ title: "Keine Schichten zum Löschen", variant: "destructive" });
            return;
        }
        const deletePromises = schedulesToDelete.map((s) =>
            apiUpdateSchedule([s.id], { shift_id: null, version: queries.effectiveSelectedVersion })
        );
        await Promise.all(deletePromises);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
        toast({ title: "Schichtpläne gelöscht" });
      },
      onError: (error) => {
        toast({ title: "Fehler beim Löschen", description: getErrorMessage(error), variant: "destructive" });
      }
  });

  const fixDisplayMutation = useMutation({
      mutationFn: () => apiFixScheduleDisplay(
          format(queries.navigation.dateRange.from, "yyyy-MM-dd"),
          format(queries.navigation.dateRange.to, "yyyy-MM-dd"),
          queries.effectiveSelectedVersion
      ),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
        toast({ title: "Anzeige repariert" });
      },
      onError: (error) => {
        toast({ title: "Fehler bei der Reparatur", description: getErrorMessage(error), variant: "destructive" });
      }
  });

  const generateAiScheduleMutation = useMutation({
      mutationFn: (options: any) => apiGenerateAiSchedule(
        format(queries.navigation.dateRange.from, "yyyy-MM-dd"),
        format(queries.navigation.dateRange.to, "yyyy-MM-dd"),
        queries.effectiveSelectedVersion,
        options
      ),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
        toast({ title: "KI-Generierung abgeschlossen" });
      },
      onError: (error) => {
        toast({ title: "KI-Generierung fehlgeschlagen", description: getErrorMessage(error), variant: "destructive" });
      }
  });


  return {
    exportMutation,
    importAiResponseMutation,
    createSchedule: createScheduleMutation,
    updateSchedule: updateScheduleMutation,
    deleteSchedule: deleteScheduleMutation,
    fixDisplay: fixDisplayMutation,
    generateAiSchedule: generateAiScheduleMutation,
    ai: aiGeneration,
  };
}
