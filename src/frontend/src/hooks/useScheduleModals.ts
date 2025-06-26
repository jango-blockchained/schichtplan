import { useState } from "react";

interface ScheduleModalsState {
  isGenerationSettingsOpen: boolean;
  isAddScheduleDialogOpen: boolean;
  isAddAvailabilityDialogOpen: boolean;
  isStatisticsModalOpen: boolean;
  isDetailedAiModalOpen: boolean;
  isAiDataPreviewOpen: boolean;
  isDiagnosticsOpen: boolean;
}

interface ConfirmDeleteMessage {
  title: string;
  message: string;
  details?: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function useScheduleModals() {
  const [modalsState, setModalsState] = useState<ScheduleModalsState>({
    isGenerationSettingsOpen: false,
    isAddScheduleDialogOpen: false,
    isAddAvailabilityDialogOpen: false,
    isStatisticsModalOpen: false,
    isDetailedAiModalOpen: false,
    isAiDataPreviewOpen: false,
    isDiagnosticsOpen: false,
  });

  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<ConfirmDeleteMessage | null>(null);
  
  const [aiPreviewData, setAiPreviewData] = useState<{
    status: string;
    data_pack: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    optimized_data?: Record<string, unknown>;
    system_prompt?: string;
  } | null>(null);

  // Helper functions to update specific modal states
  const updateModalState = (key: keyof ScheduleModalsState, value: boolean) => {
    setModalsState(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const openModal = (modalName: keyof ScheduleModalsState) => {
    updateModalState(modalName, true);
  };

  const closeModal = (modalName: keyof ScheduleModalsState) => {
    updateModalState(modalName, false);
  };

  const closeAllModals = () => {
    setModalsState({
      isGenerationSettingsOpen: false,
      isAddScheduleDialogOpen: false,
      isAddAvailabilityDialogOpen: false,
      isStatisticsModalOpen: false,
      isDetailedAiModalOpen: false,
      isAiDataPreviewOpen: false,
      isDiagnosticsOpen: false,
    });
  };

  return {
    // State
    modalsState,
    confirmDeleteMessage,
    aiPreviewData,
    
    // Actions
    openModal,
    closeModal,
    closeAllModals,
    updateModalState,
    setConfirmDeleteMessage,
    setAiPreviewData,
    
    // Individual modal controls (for backward compatibility)
    isGenerationSettingsOpen: modalsState.isGenerationSettingsOpen,
    setIsGenerationSettingsOpen: (value: boolean) => updateModalState('isGenerationSettingsOpen', value),
    
    isAddScheduleDialogOpen: modalsState.isAddScheduleDialogOpen,
    setIsAddScheduleDialogOpen: (value: boolean) => updateModalState('isAddScheduleDialogOpen', value),
    
    isAddAvailabilityDialogOpen: modalsState.isAddAvailabilityDialogOpen,
    setIsAddAvailabilityDialogOpen: (value: boolean) => updateModalState('isAddAvailabilityDialogOpen', value),
    
    isStatisticsModalOpen: modalsState.isStatisticsModalOpen,
    setIsStatisticsModalOpen: (value: boolean) => updateModalState('isStatisticsModalOpen', value),
    
    isDetailedAiModalOpen: modalsState.isDetailedAiModalOpen,
    setIsDetailedAiModalOpen: (value: boolean) => updateModalState('isDetailedAiModalOpen', value),
    
    isAiDataPreviewOpen: modalsState.isAiDataPreviewOpen,
    setIsAiDataPreviewOpen: (value: boolean) => updateModalState('isAiDataPreviewOpen', value),
    
    isDiagnosticsOpen: modalsState.isDiagnosticsOpen,
    setIsDiagnosticsOpen: (value: boolean) => updateModalState('isDiagnosticsOpen', value),
  };
}
