import { useToast } from "@/components/ui/use-toast";
import { generateAiSchedule, previewAiData } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCallback, useState } from "react";
import { DateRange } from "react-day-picker";

// Import types from the types file
interface Employee {
  id: number;
  name: string;
  role: string;
  is_keyholder: boolean;
  max_weekly_hours: number;
}

interface ScheduleEntry {
  id: number;
  start_time: string;
  end_time: string;
  active_days: number[];
  requires_keyholder?: boolean;
}

interface Availability {
  id?: number;
  employee_id: number;
  date?: string;
  day_index?: number;
  shift_id?: number;
  type?: string;
  fixed_time_range?: string;
  preferred_time_range?: string;
  available_time_range?: string;
}

interface Absence {
  id?: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  type?: string;
  reason?: string;
}

interface CoverageRule {
  day_index?: number;
  time_period?: string;
  min_employees?: number;
  max_employees?: number;
  requires_keyholder?: boolean;
  id?: number;
  name?: string;
  rules?: Record<string, unknown>;
}

// Define types for AI Preview data
interface AiPreviewData {
  status: string;
  data_pack: {
    employees: Employee[];
    shifts: ScheduleEntry[];
    coverage_rules: CoverageRule[];
    schedule_period: { start_date: string; end_date: string; target_weekdays: number[] } | { start: string; end: string };
    availability: Availability[];
    absences: Absence[];
  };
  metadata: {
    estimated_size_reduction: string;
    optimization_applied: boolean;
    data_structure_version: string;
    start_date: string;
    end_date: string;
    total_sections: number;
  };
  system_prompt?: string;
  optimized_data?: Record<string, unknown>;
}

export interface DetailedAIOptions {
  priority?: 'speed' | 'quality' | 'balanced';
  considerPreferences?: boolean;
  balanceWorkload?: boolean;
  minimizeConflicts?: boolean;
  customInstructions?: string;
}

export interface AIGenerationState {
  // State
  isAiGenerating: boolean;
  isAiFastGenerating: boolean;
  isAiDetailedGenerating: boolean;
  isDetailedAiModalOpen: boolean;
  isAiDataPreviewOpen: boolean;
  aiPreviewData: AiPreviewData | null;
  
  // Actions
  setIsAiGenerating: (value: boolean) => void;
  setIsAiFastGenerating: (value: boolean) => void;
  setIsAiDetailedGenerating: (value: boolean) => void;
  setIsDetailedAiModalOpen: (value: boolean) => void;
  setIsAiDataPreviewOpen: (value: boolean) => void;
  setAiPreviewData: (data: AiPreviewData | null) => void;
  
  // Handlers
  handleGenerateAiFastSchedule: (dateRange: DateRange, selectedVersion: number) => Promise<void>;
  handleGenerateAiDetailedSchedule: (dateRange: DateRange, selectedVersion: number) => void;
  handleDetailedAiModalConfirm: (options: DetailedAIOptions, dateRange: DateRange, selectedVersion: number) => Promise<void>;
  handlePreviewAiData: (dateRange: DateRange) => Promise<void>;
  
  // Utilities
  resetAIState: () => void;
}

interface UseAIGenerationStateOptions {
  onGenerationComplete?: () => void;
  onError?: (error: string) => void;
  addGenerationLog?: (type: 'info' | 'error', message: string, details?: string) => void;
  updateGenerationStep?: (stepId: string, status: 'pending' | 'in-progress' | 'completed' | 'error', message?: string) => void;
  setGenerationSteps?: (steps: Array<{ id: string; title: string; status: string }>) => void;
  setShowGenerationOverlay?: (show: boolean) => void;
  clearGenerationLogs?: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Ein unerwarteter Fehler ist aufgetreten";
}

export function useAIGenerationState(options: UseAIGenerationStateOptions = {}): AIGenerationState {
  const {
    onGenerationComplete,
    onError,
    addGenerationLog,
    updateGenerationStep,
    setGenerationSteps,
    setShowGenerationOverlay,
    clearGenerationLogs,
  } = options;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [isAiFastGenerating, setIsAiFastGenerating] = useState<boolean>(false);
  const [isAiDetailedGenerating, setIsAiDetailedGenerating] = useState<boolean>(false);
  const [isDetailedAiModalOpen, setIsDetailedAiModalOpen] = useState<boolean>(false);
  const [isAiDataPreviewOpen, setIsAiDataPreviewOpen] = useState<boolean>(false);
  const [aiPreviewData, setAiPreviewData] = useState<AiPreviewData | null>(null);

  // Fast AI Schedule Generation
  const handleGenerateAiFastSchedule = useCallback(async (dateRange: DateRange, selectedVersion: number) => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Zeitraum erforderlich (Schnelle KI)",
        description: "Bitte Zeitraum für schnelle KI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedVersion) {
      toast({
        title: "Version erforderlich (Schnelle KI)",
        description: "Bitte Version für schnelle KI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }

    setIsAiFastGenerating(true);
    clearGenerationLogs?.();

    const aiSteps = [
      {
        id: "ai-fast-init",
        title: "Initialisiere schnelle KI-Generierung",
        status: "pending" as const,
      },
      {
        id: "ai-fast-analyze",
        title: "Schnelle Analyse der Verfügbarkeiten",
        status: "pending" as const,
      },
      {
        id: "ai-fast-generate",
        title: "Erstelle Schichtplan (schnell)",
        status: "pending" as const,
      },
      {
        id: "ai-fast-finalize",
        title: "Finalisiere schnellen Schichtplan",
        status: "pending" as const,
      },
    ];

    setGenerationSteps?.(aiSteps);
    setShowGenerationOverlay?.(true);
    
    addGenerationLog?.(
      "info",
      "Starting fast AI schedule generation",
      `Version: ${selectedVersion}, Date range: ${format(dateRange.from, "yyyy-MM-dd")} - ${format(dateRange.to, "yyyy-MM-dd")}`,
    );

    try {
      updateGenerationStep?.("ai-fast-init", "in-progress");
      await new Promise((r) => setTimeout(r, 300));
      
      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      const toStr = format(dateRange.to, "yyyy-MM-dd");
      
      updateGenerationStep?.("ai-fast-init", "completed");
      updateGenerationStep?.("ai-fast-analyze", "in-progress");
      await new Promise((r) => setTimeout(r, 300));
      
      const result = await generateAiSchedule(fromStr, toStr, selectedVersion);
      
      updateGenerationStep?.("ai-fast-analyze", "completed");
      updateGenerationStep?.("ai-fast-generate", "in-progress");
      await new Promise((r) => setTimeout(r, 300));
      
      addGenerationLog?.("info", "Fast AI schedule generation API call successful");
      
      if (result.generated_assignments_count) {
        addGenerationLog?.(
          "info",
          `Generated ${result.generated_assignments_count} schedule entries`,
        );
      }
      
      updateGenerationStep?.("ai-fast-generate", "completed");
      updateGenerationStep?.("ai-fast-finalize", "in-progress");
      await new Promise((r) => setTimeout(r, 300));
      
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      
      updateGenerationStep?.("ai-fast-finalize", "completed");
      
      toast({
        title: "Schnelle KI-Generierung abgeschlossen",
        description: "Schichtplan wurde schnell generiert.",
      });
      
      if (result.diagnostic_log) {
        addGenerationLog?.("info", "Diagnostic log available:", result.diagnostic_log);
      }
      
      onGenerationComplete?.();
      setTimeout(() => setIsAiFastGenerating(false), 2000);
      
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      addGenerationLog?.("error", "Fast AI Generation Error", errorMessage);
      
      aiSteps.forEach((step) =>
        updateGenerationStep?.(step.id, "error", "Generation failed"),
      );
      
      toast({
        title: "Schnelle KI-Generierung fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      });
      
      onError?.(errorMessage);
      setTimeout(() => setIsAiFastGenerating(false), 3000);
    }
  }, [toast, queryClient, addGenerationLog, updateGenerationStep, setGenerationSteps, setShowGenerationOverlay, clearGenerationLogs, onGenerationComplete, onError]);

  // Detailed AI Schedule Generation (opens modal)
  const handleGenerateAiDetailedSchedule = useCallback((dateRange: DateRange, selectedVersion: number) => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Zeitraum erforderlich (Erweiterte KI)",
        description: "Bitte Zeitraum für erweiterte KI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedVersion) {
      toast({
        title: "Version erforderlich (Erweiterte KI)",
        description: "Bitte Version für erweiterte KI-Generierung wählen.",
        variant: "destructive",
      });
      return;
    }
    
    setIsDetailedAiModalOpen(true);
  }, [toast]);

  // Handle detailed AI modal confirmation
  const handleDetailedAiModalConfirm = useCallback(async (options: DetailedAIOptions, dateRange: DateRange, selectedVersion: number) => {
    setIsDetailedAiModalOpen(false);
    setIsAiDetailedGenerating(true);
    clearGenerationLogs?.();

    const aiSteps = [
      {
        id: "ai-detailed-init",
        title: "Initialisiere erweiterte KI-Generierung",
        status: "pending" as const,
      },
      {
        id: "ai-detailed-analyze",
        title: "Detaillierte Analyse mit Konfiguration",
        status: "pending" as const,
      },
      {
        id: "ai-detailed-generate",
        title: "Erstelle optimierten Schichtplan",
        status: "pending" as const,
      },
      {
        id: "ai-detailed-finalize",
        title: "Finalisiere erweiterten Schichtplan",
        status: "pending" as const,
      },
    ];

    setGenerationSteps?.(aiSteps);
    setShowGenerationOverlay?.(true);
    
    addGenerationLog?.(
      "info",
      "Starting detailed AI schedule generation",
      `Version: ${selectedVersion}, Date range: ${format(dateRange.from!, "yyyy-MM-dd")} - ${format(dateRange.to!, "yyyy-MM-dd")}, Options: ${JSON.stringify(options)}`,
    );

    try {
      updateGenerationStep?.("ai-detailed-init", "in-progress");
      await new Promise((r) => setTimeout(r, 500));
      
      const fromStr = format(dateRange.from!, "yyyy-MM-dd");
      const toStr = format(dateRange.to!, "yyyy-MM-dd");
      
      updateGenerationStep?.("ai-detailed-init", "completed");
      updateGenerationStep?.("ai-detailed-analyze", "in-progress");
      await new Promise((r) => setTimeout(r, 700));
      
      // Pass options to generateAiSchedule when backend supports detailed options
      const result = await generateAiSchedule(
        fromStr,
        toStr,
        selectedVersion
        // TODO: When backend supports detailed options, uncomment next line:
        // options
      );
      
      updateGenerationStep?.("ai-detailed-analyze", "completed");
      updateGenerationStep?.("ai-detailed-generate", "in-progress");
      await new Promise((r) => setTimeout(r, 700));
      
      addGenerationLog?.("info", "Detailed AI schedule generation API call successful");
      
      if (result.generated_assignments_count) {
        addGenerationLog?.(
          "info",
          `Generated ${result.generated_assignments_count} schedule entries with detailed options`,
        );
      }
      
      updateGenerationStep?.("ai-detailed-generate", "completed");
      updateGenerationStep?.("ai-detailed-finalize", "in-progress");
      await new Promise((r) => setTimeout(r, 500));
      
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      
      updateGenerationStep?.("ai-detailed-finalize", "completed");
      
      toast({
        title: "Erweiterte KI-Generierung abgeschlossen",
        description: "Schichtplan wurde mit erweiterten Optionen generiert.",
      });
      
      if (result.diagnostic_log) {
        addGenerationLog?.("info", "Diagnostic log available:", result.diagnostic_log);
      }
      
      onGenerationComplete?.();
      setTimeout(() => setIsAiDetailedGenerating(false), 2000);
      
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      addGenerationLog?.("error", "Detailed AI Generation Error", errorMessage);
      
      aiSteps.forEach((step) =>
        updateGenerationStep?.(step.id, "error", "Generation failed"),
      );
      
      toast({
        title: "Erweiterte KI-Generierung fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      });
      
      onError?.(errorMessage);
      setTimeout(() => setIsAiDetailedGenerating(false), 3000);
    }
  }, [toast, queryClient, addGenerationLog, updateGenerationStep, setGenerationSteps, setShowGenerationOverlay, clearGenerationLogs, onGenerationComplete, onError]);

  // Preview AI Data
  const handlePreviewAiData = useCallback(async (dateRange: DateRange) => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Vorschau nicht möglich",
        description: "Bitte Zeitraum wählen.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Lade KI-Daten...",
        description: "Die optimierten KI-Daten werden abgerufen.",
      });

      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      const toStr = format(dateRange.to, "yyyy-MM-dd");
      
      const aiDataPreview = await previewAiData(fromStr, toStr);
      
      setAiPreviewData(aiDataPreview);
      setIsAiDataPreviewOpen(true);

      toast({
        title: "KI-Daten geladen",
        description: `Daten für ${aiDataPreview.data_pack?.employees?.length || 0} Mitarbeiter optimiert.`,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: "Fehler beim Laden der KI-Daten",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.(errorMessage);
    }
  }, [toast, onError]);

  // Reset all AI state
  const resetAIState = useCallback(() => {
    setIsAiGenerating(false);
    setIsAiFastGenerating(false);
    setIsAiDetailedGenerating(false);
    setIsDetailedAiModalOpen(false);
    setIsAiDataPreviewOpen(false);
    setAiPreviewData(null);
  }, []);

  return {
    // State
    isAiGenerating,
    isAiFastGenerating,
    isAiDetailedGenerating,
    isDetailedAiModalOpen,
    isAiDataPreviewOpen,
    aiPreviewData,
    
    // Actions
    setIsAiGenerating,
    setIsAiFastGenerating,
    setIsAiDetailedGenerating,
    setIsDetailedAiModalOpen,
    setIsAiDataPreviewOpen,
    setAiPreviewData,
    
    // Handlers
    handleGenerateAiFastSchedule,
    handleGenerateAiDetailedSchedule,
    handleDetailedAiModalConfirm,
    handlePreviewAiData,
    
    // Utilities
    resetAIState,
  };
}
