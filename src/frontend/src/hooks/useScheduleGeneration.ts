import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import {
  generateSchedule,
  fixShiftDurations,
  fixScheduleDisplay,
} from "@/services/api";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

// Types imported from GenerationOverlay
export interface GenerationStep {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed" | "error";
  message?: string;
}

export interface GenerationLog {
  type: "info" | "warning" | "error";
  timestamp: string;
  message: string;
  details?: string;
}

interface UseScheduleGenerationProps {
  dateRange: DateRange | undefined;
  selectedVersion?: number;
  createEmptySchedules: boolean;
  enableDiagnostics?: boolean;
  onSuccess?: () => void;
}

export function useScheduleGeneration({
  dateRange,
  selectedVersion,
  createEmptySchedules,
  enableDiagnostics = false,
  onSuccess,
}: UseScheduleGenerationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  const [generationLogs, setGenerationLogs] = useState<GenerationLog[]>([]);
  const [showGenerationOverlay, setShowGenerationOverlay] = useState(false);

  const addGenerationLog = (
    type: "info" | "warning" | "error",
    message: string,
    details?: string,
  ) => {
    setGenerationLogs((prev) => [
      ...prev,
      {
        timestamp: new Date().toISOString(),
        type,
        message,
        details,
      },
    ]);
  };

  const clearGenerationLogs = () => {
    setGenerationLogs([]);
  };

  const resetGenerationState = () => {
    setGenerationSteps([]);
    setShowGenerationOverlay(false);
  };

  const updateGenerationStep = (
    stepId: string,
    status: GenerationStep["status"],
    message?: string,
  ) => {
    setGenerationSteps((steps) =>
      steps.map((step) =>
        step.id === stepId ? { ...step, status, message } : step,
      ),
    );
  };

  // Generation mutation with timeout
  const generateMutation = useMutation({
    mutationFn: async () => {
      try {
        if (!dateRange?.from || !dateRange?.to) {
          throw new Error("Bitte wählen Sie einen Zeitraum aus");
        }

        if (!selectedVersion) {
          throw new Error("Bitte wählen Sie eine Version aus");
        }

        // Log the generation parameters
        console.log("🚀 Starting generation with:", {
          dateRange: {
            from: dateRange.from.toISOString(),
            to: dateRange.to.toISOString(),
          },
          selectedVersion,
          createEmptySchedules,
          enableDiagnostics,
        });

        // Set up steps
        const steps: GenerationStep[] = [
          { id: "init", title: "Initialisiere Generierung", status: "pending" },
          {
            id: "validate",
            title: "Validiere Eingabedaten",
            status: "pending",
          },
          { id: "process", title: "Verarbeite Schichtplan", status: "pending" },
          { id: "assign", title: "Weise Schichten zu", status: "pending" },
          {
            id: "finalize",
            title: "Finalisiere Schichtplan",
            status: "pending",
          },
        ];
        setGenerationSteps(steps);
        setShowGenerationOverlay(true);

        // Init
        updateGenerationStep("init", "in-progress");
        addGenerationLog(
          "info",
          "Initialisiere Generierung",
          `Version: ${selectedVersion}, Zeitraum: ${format(dateRange.from, "dd.MM.yyyy")} - ${format(dateRange.to, "dd.MM.yyyy")}`,
        );
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
        const fromStr = format(dateRange.from, "yyyy-MM-dd");
        const toStr = format(dateRange.to, "yyyy-MM-dd");

        // Always use the explicit selectedVersion, no fallback to 1
        console.log("🚀 Calling generateSchedule API with:", {
          fromStr,
          toStr,
          createEmptySchedules,
          selectedVersion,
          enableDiagnostics,
          "Request will include shift_type values": true,
        });

        // Make sure we have a valid version number
        if (!selectedVersion) {
          addGenerationLog(
            "error",
            "Fehlende Version. Bitte eine Version auswählen oder erstellen.",
          );
          throw new Error(
            "Missing version parameter. Please select or create a version.",
          );
        }

        const result = await generateSchedule(
          fromStr,
          toStr,
          createEmptySchedules,
          selectedVersion, // Use the selected version without fallback
          enableDiagnostics, // Pass the enableDiagnostics flag
        );

        // Log the response to help with debugging
        console.log("✅ GenerateSchedule API response:", {
          "Total schedules": result.schedules?.length || 0,
          "Schedules with shifts":
            result.schedules?.filter((s) => s.shift_id !== null)?.length || 0,
          "Unique employees": [
            ...new Set(result.schedules?.map((s) => s.employee_id) || []),
          ].length,
          "Has errors": result.errors && result.errors.length > 0,
          "Error count": result.errors?.length || 0,
          "First error": result.errors?.[0] || "No errors",
          "First schedule": result.schedules?.[0] || "No schedules",
          "Diagnostic logs": result.diagnostic_logs || [],
        });

        // If we have diagnostic logs and enableDiagnostics is true, add them to our logs
        if (
          enableDiagnostics &&
          result.diagnostic_logs &&
          result.diagnostic_logs.length > 0
        ) {
          result.diagnostic_logs.forEach((log) => {
            // Try to parse log entries in a useful way
            const logType = log.includes("ERROR")
              ? "error"
              : log.includes("WARNING")
                ? "warning"
                : "info";

            addGenerationLog(logType, log);
          });
        }

        updateGenerationStep("process", "completed");

        // Assign shifts
        updateGenerationStep("assign", "in-progress");
        addGenerationLog("info", "Weise Schichten zu");
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
        updateGenerationStep("assign", "completed");

        // Finalize
        updateGenerationStep("finalize", "in-progress");
        addGenerationLog("info", "Finalisiere Schichtplan");

        // Auto fix schedule display issues after generation
        if (
          result.schedules?.some(
            (s) => s.shift_id !== null && (!s.shift_start || !s.shift_end),
          )
        ) {
          addGenerationLog("info", "Korrigiere Anzeige-Probleme");
          try {
            await fixShiftDurations();
            addGenerationLog("info", "Anzeige-Probleme korrigiert");
          } catch (fixError) {
            addGenerationLog(
              "warning",
              "Problem beim Korrigieren der Anzeige",
              String(fixError instanceof Error ? fixError.message : fixError),
            );
          }
        }

        // Fix display issues with the schedule using separate API call
        try {
          addGenerationLog("info", "Optimiere Anzeige");
          if (selectedVersion && dateRange.from && dateRange.to) {
            const fromFixStr = format(dateRange.from, "yyyy-MM-dd");
            const toFixStr = format(dateRange.to, "yyyy-MM-dd");
            const fixResult = await fixScheduleDisplay(
              fromFixStr,
              toFixStr,
              selectedVersion,
            );
            addGenerationLog(
              "info",
              `Anzeige optimiert: ${fixResult.days_fixed.length} Tage aktualisiert`,
            );
          }
        } catch (displayError) {
          addGenerationLog(
            "warning",
            "Problem bei der Anzeige-Optimierung",
            String(
              displayError instanceof Error
                ? displayError.message
                : displayError,
            ),
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
        updateGenerationStep("finalize", "completed");

        return result;
      } catch (error) {
        console.error("Generation error:", error);
        if (error instanceof Error) {
          addGenerationLog(
            "error",
            "Fehler bei der Generierung",
            error.message,
          );
        } else {
          addGenerationLog("error", "Unbekannter Fehler", String(error));
        }

        // Mark any in-progress steps as error
        setGenerationSteps((prev) =>
          prev.map((step) =>
            step.status === "in-progress" ? { ...step, status: "error" } : step,
          ),
        );

        throw error;
      }
    },
    onSuccess: (data) => {
      // Check if we have any errors in the response
      if (data.errors && data.errors.length > 0) {
        // Add errors to logs
        data.errors.forEach((error) => {
          addGenerationLog("error", error.message, error.date || error.shift);
        });

        // Update UI to show errors
        updateGenerationStep("finalize", "error", "Fehler bei der Generierung");

        // Show error toast
        toast({
          variant: "destructive",
          title: "Generierung mit Warnungen",
          description: `Schichtplan wurde generiert, enthält aber ${data.errors.length} Fehler oder Warnungen.`,
        });
      } else {
        // Show success toast with accurate count
        const generatedCount = data.schedules
          ? data.schedules.filter((s) => s.shift_id !== null).length
          : 0;
        const totalEmployees =
          data.filtered_schedules || data.schedules?.length || 0;

        toast({
          title: "Generierung erfolgreich",
          description: `Schichtplan für ${totalEmployees} Mitarbeiter generiert mit ${generatedCount} zugewiesenen Schichten.`,
        });

        // Add success log
        addGenerationLog(
          "info",
          "Generierung erfolgreich abgeschlossen",
          `${generatedCount} Schichten wurden ${totalEmployees} Mitarbeitern zugewiesen.`,
        );

        // Allow time for UI update before hiding overlay
        setTimeout(() => {
          setShowGenerationOverlay(false);
        }, 1500);
      }

      // Invalidate queries to refresh data - fixed to invalidate all schedule queries
      queryClient.invalidateQueries({ queryKey: ["schedules"] });

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unbekannter Fehler";

      toast({
        variant: "destructive",
        title: "Fehler",
        description: `Fehler bei der Generierung: ${errorMessage}`,
      });

      // Don't auto-hide the overlay on error so user can see what happened
    },
  });

  return {
    generationSteps,
    generationLogs,
    showGenerationOverlay,
    isPending: generateMutation.isPending,
    isError: generateMutation.isError,
    generate: generateMutation.mutate,
    resetGenerationState,
    addGenerationLog,
    clearGenerationLogs,
    updateGenerationStep,
    setGenerationSteps,
    setShowGenerationOverlay,
  };
}

export default useScheduleGeneration;
