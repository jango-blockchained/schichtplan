import { useToast } from "@/components/ui/use-toast";
import {
  fixScheduleDisplay,
  fixShiftDurations,
  generateSchedule,
} from "@/services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCallback, useState } from "react";
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

// New generation options interface
export interface GenerationOptions {
  keepExistingAssignments: boolean;
  usePhase1FixedAssignments: boolean;
  usePhase2PreferredAvailability: boolean;
  usePhase3StandardGeneration: boolean;
}

interface UseScheduleGenerationProps {
  dateRange: DateRange | undefined;
  selectedVersion?: number;
  createEmptySchedules: boolean;
  enableDiagnostics?: boolean;
  generationOptions?: GenerationOptions;
  onSuccess?: () => void;
}

export function useScheduleGeneration({
  dateRange,
  selectedVersion,
  createEmptySchedules,
  enableDiagnostics = false,
  generationOptions = {
    keepExistingAssignments: false,
    usePhase1FixedAssignments: true,
    usePhase2PreferredAvailability: true,
    usePhase3StandardGeneration: true,
  },
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
    details?: string
  ) => {
    setGenerationLogs(prev => [...prev, {
      type,
      timestamp: new Date().toISOString(),
      message,
      details
    }]);
  }, []);

  const clearGenerationLogs = useCallback(() => {
    setGenerationLogs([]);
  }, []);

  const resetGenerationState = useCallback(() => {
    setGenerationSteps([]);
    setShowGenerationOverlay(false);
    setLastSessionId(null);
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

  // Generation mutation with phased approach
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
        console.log("🚀 Starting phased generation with:", {
          dateRange: {
            from: dateRange.from.toISOString(),
            to: dateRange.to.toISOString(),
          },
          selectedVersion,
          createEmptySchedules,
          enableDiagnostics,
          generationOptions,
        });

        // Set up phased generation steps
        const steps: GenerationStep[] = [
          { id: "init", title: "Initialisiere Generierung", status: "pending" },
          { id: "validate", title: "Validiere Eingabedaten", status: "pending" },
        ];

        // Add conditional phases based on options
        if (generationOptions.usePhase1FixedAssignments) {
          steps.push({ id: "phase1", title: "Phase 1: Feste Schichtzuweisungen", status: "pending" });
        }
        if (generationOptions.usePhase2PreferredAvailability) {
          steps.push({ id: "phase2", title: "Phase 2: Bevorzugte Verfügbarkeiten", status: "pending" });
        }
        if (generationOptions.usePhase3StandardGeneration) {
          steps.push({ id: "phase3", title: "Phase 3: Standard-Generierung", status: "pending" });
        }

        steps.push({ id: "finalize", title: "Finalisiere Schichtplan", status: "pending" });

        setGenerationSteps(steps);
        setShowGenerationOverlay(true);

        // Init
        updateGenerationStep("init", "in-progress");
        addGenerationLog(
          "info",
          "Initialisiere mehrstufige Generierung",
          `Version: ${selectedVersion}, Zeitraum: ${format(dateRange.from, "dd.MM.yyyy")} - ${format(dateRange.to, "dd.MM.yyyy")}`
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        updateGenerationStep("init", "completed");

        // Validate
        updateGenerationStep("validate", "in-progress");
        addGenerationLog("info", "Validiere Eingabedaten und Generierungsoptionen");
        await new Promise((resolve) => setTimeout(resolve, 200));
        updateGenerationStep("validate", "completed");

        const fromStr = format(dateRange.from, "yyyy-MM-dd");
        const toStr = format(dateRange.to, "yyyy-MM-dd");

        // Phase 1: Fixed Assignments
        if (generationOptions.usePhase1FixedAssignments) {
          updateGenerationStep("phase1", "in-progress");
          addGenerationLog("info", "Phase 1: Verarbeite feste Schichtzuweisungen");

          // Call API for fixed assignments phase
          const phase1Result = await generateSchedule(
            fromStr,
            toStr,
            createEmptySchedules,
            selectedVersion,
            enableDiagnostics,
            {
              ...generationOptions,
              phaseMode: "fixed_assignments",
              keepExistingAssignments: generationOptions.keepExistingAssignments,
            }
          );

          if (phase1Result.session_id) {
            setLastSessionId(phase1Result.session_id);
            addGenerationLog("info", `Phase 1 Session ID: ${phase1Result.session_id}`);
          }

          addGenerationLog("info", `Phase 1 abgeschlossen: ${phase1Result.schedules?.length || 0} feste Zuweisungen verarbeitet`);
          updateGenerationStep("phase1", "completed");
        }

        // Phase 2: Preferred Availability
        if (generationOptions.usePhase2PreferredAvailability) {
          updateGenerationStep("phase2", "in-progress");
          addGenerationLog("info", "Phase 2: Verarbeite bevorzugte Verfügbarkeiten");

          // Call API for preferred availability phase
          const phase2Result = await generateSchedule(
            fromStr,
            toStr,
            createEmptySchedules,
            selectedVersion,
            enableDiagnostics,
            {
              ...generationOptions,
              phaseMode: "preferred_availability",
              keepExistingAssignments: true, // Always keep existing in phase 2
            }
          );

          if (phase2Result.session_id) {
            setLastSessionId(phase2Result.session_id);
            addGenerationLog("info", `Phase 2 Session ID: ${phase2Result.session_id}`);
          }

          addGenerationLog("info", `Phase 2 abgeschlossen: ${phase2Result.schedules?.length || 0} bevorzugte Verfügbarkeiten verarbeitet`);
          updateGenerationStep("phase2", "completed");
        }

        // Phase 3: Standard Generation
        if (generationOptions.usePhase3StandardGeneration) {
          updateGenerationStep("phase3", "in-progress");
          addGenerationLog("info", "Phase 3: Standard-Generierung für verbleibende Schichten");

          // Call API for standard generation phase
          const phase3Result = await generateSchedule(
            fromStr,
            toStr,
            createEmptySchedules,
            selectedVersion,
            enableDiagnostics,
            {
              ...generationOptions,
              phaseMode: "standard_generation",
              keepExistingAssignments: true, // Always keep existing in phase 3
            }
          );

          if (phase3Result.session_id) {
            setLastSessionId(phase3Result.session_id);
            addGenerationLog("info", `Phase 3 Session ID: ${phase3Result.session_id}`);
          }

          // Handle diagnostic logs from the final phase
          if (enableDiagnostics && phase3Result.diagnostic_logs && phase3Result.diagnostic_logs.length > 0) {
            phase3Result.diagnostic_logs.forEach((log) => {
              const logType = log.includes("ERROR") ? "error" : log.includes("WARNING") ? "warning" : "info";
              addGenerationLog(logType, log);
            });
          }

          addGenerationLog("info", `Phase 3 abgeschlossen: ${phase3Result.schedules?.length || 0} Standard-Zuweisungen generiert`);
          updateGenerationStep("phase3", "completed");
        }

        // Finalize
        updateGenerationStep("finalize", "in-progress");
        addGenerationLog("info", "Finalisiere mehrstufigen Schichtplan");

        // Only run fix operations if there are actual issues detected
        // Note: We'll get the final result from the last phase that was executed
        let finalResult;
        if (generationOptions.usePhase3StandardGeneration) {
          finalResult = await generateSchedule(fromStr, toStr, createEmptySchedules, selectedVersion, enableDiagnostics, {
            ...generationOptions,
            phaseMode: "finalize",
            keepExistingAssignments: true,
          });
        } else {
          // If phase 3 wasn't used, create a minimal final result
          finalResult = { schedules: [], errors: [] };
        }

        const hasDisplayIssues = finalResult.schedules?.some(
          (s) => s.shift_id !== null && (!s.shift_start || !s.shift_end),
        );

        if (hasDisplayIssues) {
          addGenerationLog("info", "Korrigiere Anzeige-Probleme");
          try {
            const [fixDurationResult, fixDisplayResult] = await Promise.allSettled([
              fixShiftDurations(),
              selectedVersion && dateRange.from && dateRange.to
                ? fixScheduleDisplay(fromStr, toStr, selectedVersion)
                : Promise.resolve({ days_fixed: [] })
            ]);

            if (fixDurationResult.status === "fulfilled") {
              addGenerationLog("info", "Schichtdauern korrigiert");
            } else {
              addGenerationLog("warning", "Problem beim Korrigieren der Schichtdauern", String(fixDurationResult.reason));
            }

            if (fixDisplayResult.status === "fulfilled") {
              const result = fixDisplayResult.value;
              if (result.days_fixed && result.days_fixed.length > 0) {
                addGenerationLog("info", `Anzeige optimiert: ${result.days_fixed.length} Tage aktualisiert`);
              }
            } else {
              addGenerationLog("warning", "Problem bei der Anzeige-Optimierung", String(fixDisplayResult.reason));
            }
          } catch (error) {
            addGenerationLog("warning", "Problem beim Korrigieren der Anzeige", String(error instanceof Error ? error.message : error));
          }
        } else {
          addGenerationLog("info", "Keine Anzeige-Probleme gefunden");
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
        updateGenerationStep("finalize", "completed");

        return finalResult;
      } catch (error) {
        console.error("Generation error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        addGenerationLog("error", "Fehler bei der Generierung", errorMessage);

        // Mark current step as error
        const currentStep = generationSteps.find(step => step.status === "in-progress");
        if (currentStep) {
          updateGenerationStep(currentStep.id, "error", errorMessage);
        }

        throw error;
      }
    },
    onSuccess: () => {
      addGenerationLog("info", "Mehrstufige Generierung erfolgreich abgeschlossen");
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Generation failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: "Generierung fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  return {
    generateSchedule: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    generationSteps,
    generationLogs,
    showGenerationOverlay,
    lastSessionId,
    resetGenerationState,
    updateGenerationStep,
    addGenerationLog,
    clearGenerationLogs,
    invalidateQueriesDebounced,
  };
}

export default useScheduleGeneration;
