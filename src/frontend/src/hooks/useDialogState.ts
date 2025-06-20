import { useCallback, useState } from "react";

export interface ConfirmDeleteMessage {
  title: string;
  message: string;
  details?: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export interface DialogState {
  // State
  isGenerationSettingsOpen: boolean;
  isAddScheduleDialogOpen: boolean;
  isStatisticsModalOpen: boolean;
  isDiagnosticsOpen: boolean;
  isAddAvailabilityShiftsDialogOpen: boolean;
  confirmDeleteMessage: ConfirmDeleteMessage | null;
  availabilityShiftType: 'FIXED' | 'UNAVAILABLE' | 'PREFERRED';
  
  // Actions
  setIsGenerationSettingsOpen: (value: boolean) => void;
  setIsAddScheduleDialogOpen: (value: boolean) => void;
  setIsStatisticsModalOpen: (value: boolean) => void;
  setIsDiagnosticsOpen: (value: boolean) => void;
  setIsAddAvailabilityShiftsDialogOpen: (value: boolean) => void;
  setConfirmDeleteMessage: (message: ConfirmDeleteMessage | null) => void;
  setAvailabilityShiftType: (type: 'FIXED' | 'UNAVAILABLE' | 'PREFERRED') => void;
  
  // Helper methods
  openGenerationSettings: () => void;
  closeGenerationSettings: () => void;
  openAddScheduleDialog: () => void;
  closeAddScheduleDialog: () => void;
  openStatisticsModal: () => void;
  closeStatisticsModal: () => void;
  openDiagnostics: () => void;
  closeDiagnostics: () => void;
  openAddAvailabilityShiftsDialog: (type: 'FIXED' | 'UNAVAILABLE' | 'PREFERRED') => void;
  closeAddAvailabilityShiftsDialog: () => void;
  showConfirmDelete: (message: ConfirmDeleteMessage) => void;
  hideConfirmDelete: () => void;
  
  // Utility methods
  closeAllDialogs: () => void;
  hasOpenDialogs: boolean;
}

interface UseDialogStateOptions {
  onDialogChange?: (dialogType: string, isOpen: boolean) => void;
}

export function useDialogState(options: UseDialogStateOptions = {}): DialogState {
  const { onDialogChange } = options;

  // State management
  const [isGenerationSettingsOpen, setIsGenerationSettingsOpen] = useState<boolean>(false);
  const [isAddScheduleDialogOpen, setIsAddScheduleDialogOpen] = useState<boolean>(false);
  const [isStatisticsModalOpen, setIsStatisticsModalOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isAddAvailabilityShiftsDialogOpen, setIsAddAvailabilityShiftsDialogOpen] = useState<boolean>(false);
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<ConfirmDeleteMessage | null>(null);
  const [availabilityShiftType, setAvailabilityShiftType] = useState<'FIXED' | 'UNAVAILABLE' | 'PREFERRED'>('FIXED');

  // Enhanced setters with callbacks
  const handleSetGenerationSettings = useCallback((value: boolean) => {
    setIsGenerationSettingsOpen(value);
    onDialogChange?.('generationSettings', value);
  }, [onDialogChange]);

  const handleSetAddScheduleDialog = useCallback((value: boolean) => {
    setIsAddScheduleDialogOpen(value);
    onDialogChange?.('addSchedule', value);
  }, [onDialogChange]);

  const handleSetStatisticsModal = useCallback((value: boolean) => {
    setIsStatisticsModalOpen(value);
    onDialogChange?.('statistics', value);
  }, [onDialogChange]);

  const handleSetDiagnostics = useCallback((value: boolean) => {
    setIsDiagnosticsOpen(value);
    onDialogChange?.('diagnostics', value);
  }, [onDialogChange]);

  const handleSetAddAvailabilityShiftsDialog = useCallback((value: boolean) => {
    setIsAddAvailabilityShiftsDialogOpen(value);
    onDialogChange?.('addAvailabilityShifts', value);
  }, [onDialogChange]);

  const handleSetConfirmDeleteMessage = useCallback((message: ConfirmDeleteMessage | null) => {
    setConfirmDeleteMessage(message);
    onDialogChange?.('confirmDelete', !!message);
  }, [onDialogChange]);

  // Helper methods for opening/closing specific dialogs
  const openGenerationSettings = useCallback(() => {
    handleSetGenerationSettings(true);
  }, [handleSetGenerationSettings]);

  const closeGenerationSettings = useCallback(() => {
    handleSetGenerationSettings(false);
  }, [handleSetGenerationSettings]);

  const openAddScheduleDialog = useCallback(() => {
    handleSetAddScheduleDialog(true);
  }, [handleSetAddScheduleDialog]);

  const closeAddScheduleDialog = useCallback(() => {
    handleSetAddScheduleDialog(false);
  }, [handleSetAddScheduleDialog]);

  const openStatisticsModal = useCallback(() => {
    handleSetStatisticsModal(true);
  }, [handleSetStatisticsModal]);

  const closeStatisticsModal = useCallback(() => {
    handleSetStatisticsModal(false);
  }, [handleSetStatisticsModal]);

  const openDiagnostics = useCallback(() => {
    handleSetDiagnostics(true);
  }, [handleSetDiagnostics]);

  const closeDiagnostics = useCallback(() => {
    handleSetDiagnostics(false);
  }, [handleSetDiagnostics]);

  const openAddAvailabilityShiftsDialog = useCallback((type: 'FIXED' | 'UNAVAILABLE' | 'PREFERRED') => {
    setAvailabilityShiftType(type);
    handleSetAddAvailabilityShiftsDialog(true);
  }, [handleSetAddAvailabilityShiftsDialog]);

  const closeAddAvailabilityShiftsDialog = useCallback(() => {
    handleSetAddAvailabilityShiftsDialog(false);
  }, [handleSetAddAvailabilityShiftsDialog]);

  const showConfirmDelete = useCallback((message: ConfirmDeleteMessage) => {
    handleSetConfirmDeleteMessage(message);
  }, [handleSetConfirmDeleteMessage]);

  const hideConfirmDelete = useCallback(() => {
    handleSetConfirmDeleteMessage(null);
  }, [handleSetConfirmDeleteMessage]);

  // Utility methods
  const closeAllDialogs = useCallback(() => {
    setIsGenerationSettingsOpen(false);
    setIsAddScheduleDialogOpen(false);
    setIsStatisticsModalOpen(false);
    setIsDiagnosticsOpen(false);
    setIsAddAvailabilityShiftsDialogOpen(false);
    setConfirmDeleteMessage(null);
    
    // Notify about all dialogs being closed
    onDialogChange?.('all', false);
  }, [onDialogChange]);

  // Computed property for checking if any dialog is open
  const hasOpenDialogs = 
    isGenerationSettingsOpen ||
    isAddScheduleDialogOpen ||
    isStatisticsModalOpen ||
    isDiagnosticsOpen ||
    isAddAvailabilityShiftsDialogOpen ||
    !!confirmDeleteMessage;

  return {
    // State
    isGenerationSettingsOpen,
    isAddScheduleDialogOpen,
    isStatisticsModalOpen,
    isDiagnosticsOpen,
    isAddAvailabilityShiftsDialogOpen,
    confirmDeleteMessage,
    availabilityShiftType,
    
    // Enhanced setters
    setIsGenerationSettingsOpen: handleSetGenerationSettings,
    setIsAddScheduleDialogOpen: handleSetAddScheduleDialog,
    setIsStatisticsModalOpen: handleSetStatisticsModal,
    setIsDiagnosticsOpen: handleSetDiagnostics,
    setIsAddAvailabilityShiftsDialogOpen: handleSetAddAvailabilityShiftsDialog,
    setConfirmDeleteMessage: handleSetConfirmDeleteMessage,
    setAvailabilityShiftType,
    
    // Helper methods
    openGenerationSettings,
    closeGenerationSettings,
    openAddScheduleDialog,
    closeAddScheduleDialog,
    openStatisticsModal,
    closeStatisticsModal,
    openDiagnostics,
    closeDiagnostics,
    openAddAvailabilityShiftsDialog,
    closeAddAvailabilityShiftsDialog,
    showConfirmDelete,
    hideConfirmDelete,
    
    // Utility methods
    closeAllDialogs,
    hasOpenDialogs,
  };
}
