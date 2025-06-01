import { useState, useCallback } from "react";
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
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  const addGenerationLog = useCallback((
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
  }, []);

  const clearGenerationLogs = useCallback(() => {
    setGenerationLogs([]);
  }, []);

  const resetGenerationState = useCallback(() => {
    setGenerationSteps([]);
    setShowGenerationOverlay(false);
  }, []);

  const updateGenerationStep = useCallback((
    stepId: string,
    status: GenerationStep["status"],
    message?: string,
  ) => {
    setGenerationSteps((steps) =>
      steps.map((step) =>
        step.id === stepId ? { ...step, status, message } : step,
      ),
    );
  }, []);

  // Debounced query invalidation to prevent rapid updates
  const invalidateQueriesDebounced = useCallback(() => {
    // Use a timeout to batch multiple invalidations
    const timeoutId = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [queryClient]);

  // Generation mutation with optimized flow
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
        await new Promise((resolve) => setTimeout(resolve, 300)); // Reduced delay
        updateGenerationStep("init", "completed");

        // Validate
        updateGenerationStep("validate", "in-progress");
        addGenerationLog("info", "Validiere Eingabedaten");
        await new Promise((resolve) => setTimeout(resolve, 200)); // Reduced delay
        updateGenerationStep("validate", "completed");

        // Process
        updateGenerationStep("process", "in-progress");
        addGenerationLog("info", "Starte Verarbeitung");

        // Call API to generate schedule
        const fromStr = format(dateRange.from, "yyyy-MM-dd");
        const toStr = format(dateRange.to, "yyyy-MM-dd");

        console.log("🚀 Calling generateSchedule API with:", {
          fromStr,
          toStr,
          createEmptySchedules,
          selectedVersion,
          enableDiagnostics,
        });

        const result = await generateSchedule(
          fromStr,
          toStr,
          createEmptySchedules,
          selectedVersion,
          enableDiagnostics,
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
            const logType = log.includes("ERROR")
              ? "error"
              : log.includes("WARNING")
                ? "warning"
                : "info";

            addGenerationLog(logType, log);
          });
        }
        
        // Store session ID if available
        if (result.session_id) {
          setLastSessionId(result.session_id);
          addGenerationLog("info", `Generation Session ID: ${result.session_id}`);
        }

        updateGenerationStep("process", "completed");

        // Assign shifts
        updateGenerationStep("assign", "in-progress");
        addGenerationLog("info", "Weise Schichten zu");
        await new Promise((resolve) => setTimeout(resolve, 200)); // Reduced delay
        updateGenerationStep("assign", "completed");

        // Finalize
        updateGenerationStep("finalize", "in-progress");
        addGenerationLog("info", "Finalisiere Schichtplan");

        // Only run fix operations if there are actual issues detected
        const hasDisplayIssues = result.schedules?.some(
          (s) => s.shift_id !== null && (!s.shift_start || !s.shift_end),
        );

        if (hasDisplayIssues) {
          addGenerationLog("info", "Korrigiere Anzeige-Probleme");
          try {
            // Run both fix operations in parallel to reduce time
            const [fixDurationResult, fixDisplayResult] = await Promise.allSettled([
              fixShiftDurations(),
              selectedVersion && dateRange.from && dateRange.to
                ? fixScheduleDisplay(fromStr, toStr, selectedVersion)
                : Promise.resolve({ days_fixed: [] })
            ]);

            if (fixDurationResult.status === "fulfilled") {
              addGenerationLog("info", "Schichtdauern korrigiert");
            } else {
              addGenerationLog(
                "warning",
                "Problem beim Korrigieren der Schichtdauern",
                String(fixDurationResult.reason),
              );
            }

            if (fixDisplayResult.status === "fulfilled") {
              const result = fixDisplayResult.value;
              if (result.days_fixed && result.days_fixed.length > 0) {
                addGenerationLog(
                  "info",
                  `Anzeige optimiert: ${result.days_fixed.length} Tage aktualisiert`,
                );
              }
            } else {
              addGenerationLog(
                "warning",
                "Problem bei der Anzeige-Optimierung",
                String(fixDisplayResult.reason),
              );
            }
          } catch (error) {
            addGenerationLog(
              "warning",
              "Problem beim Korrigieren der Anzeige",
              String(error instanceof Error ? error.message : error),
            );
          }
        } else {
          addGenerationLog("info", "Keine Anzeige-Probleme gefunden");
        }

        await new Promise((resolve) => setTimeout(resolve, 200)); // Reduced delay
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
        }, 1000); // Reduced from 1500ms
      }

      // Use debounced invalidation to prevent rapid updates
      invalidateQueriesDebounced();

      // Call onSuccess callback if provided (but delay it slightly to avoid conflicts)
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 150);
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
    lastSessionId,
  };
}

export default useScheduleGeneration;
