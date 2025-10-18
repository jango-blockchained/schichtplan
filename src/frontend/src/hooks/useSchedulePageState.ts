import { useCallback, useState } from "react";

export function useSchedulePageState() {
  // Core schedule settings
  const [includeEmpty, setIncludeEmpty] = useState<boolean>(true);
  const [createEmptySchedules, setCreateEmptySchedules] = useState(true);
  const [enableDiagnostics, setEnableDiagnostics] = useState<boolean>(false);

  // AI generation states
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [isAiFastGenerating, setIsAiFastGenerating] = useState<boolean>(false);
  const [isAiDetailedGenerating, setIsAiDetailedGenerating] =
    useState<boolean>(false);

  // Employee absences state (for ScheduleTable/Manager compatibility)
  const [employeeAbsences, setEmployeeAbsences] = useState<
    Record<number, unknown[]>
  >({});

  // Reset all generation states
  const resetGenerationStates = useCallback(() => {
    setIsAiGenerating(false);
    setIsAiFastGenerating(false);
    setIsAiDetailedGenerating(false);
  }, []);

  // Batch update function for multiple states
  const updateStates = useCallback(
    (
      updates: Partial<{
        includeEmpty: boolean;
        createEmptySchedules: boolean;
        enableDiagnostics: boolean;
        isAiGenerating: boolean;
        isAiFastGenerating: boolean;
        isAiDetailedGenerating: boolean;
        employeeAbsences: Record<number, unknown[]>;
      }>,
    ) => {
      if (updates.includeEmpty !== undefined)
        setIncludeEmpty(updates.includeEmpty);
      if (updates.createEmptySchedules !== undefined)
        setCreateEmptySchedules(updates.createEmptySchedules);
      if (updates.enableDiagnostics !== undefined)
        setEnableDiagnostics(updates.enableDiagnostics);
      if (updates.isAiGenerating !== undefined)
        setIsAiGenerating(updates.isAiGenerating);
      if (updates.isAiFastGenerating !== undefined)
        setIsAiFastGenerating(updates.isAiFastGenerating);
      if (updates.isAiDetailedGenerating !== undefined)
        setIsAiDetailedGenerating(updates.isAiDetailedGenerating);
      if (updates.employeeAbsences !== undefined)
        setEmployeeAbsences(updates.employeeAbsences);
    },
    [],
  );

  return {
    // State values
    includeEmpty,
    createEmptySchedules,
    enableDiagnostics,
    isAiGenerating,
    isAiFastGenerating,
    isAiDetailedGenerating,
    employeeAbsences,

    // Individual setters
    setIncludeEmpty,
    setCreateEmptySchedules,
    setEnableDiagnostics,
    setIsAiGenerating,
    setIsAiFastGenerating,
    setIsAiDetailedGenerating,
    setEmployeeAbsences,

    // Batch operations
    resetGenerationStates,
    updateStates,

    // Computed values
    isAnyGenerationActive:
      isAiGenerating || isAiFastGenerating || isAiDetailedGenerating,
  };
}
