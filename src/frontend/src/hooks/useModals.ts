/**
 * Custom hook for managing modal/dialog states
 * Consolidates all modal open/close state management
 */

import { useCallback, useState } from 'react';

interface ModalState {
  [key: string]: boolean;
}

interface UseModalsReturn {
  /** Current state of all modals */
  modals: ModalState;
  
  /** Open a specific modal */
  openModal: (modalName: string) => void;
  
  /** Close a specific modal */
  closeModal: (modalName: string) => void;
  
  /** Toggle a specific modal */
  toggleModal: (modalName: string) => void;
  
  /** Check if a specific modal is open */
  isOpen: (modalName: string) => boolean;
  
  /** Close all modals */
  closeAll: () => void;
}

/**
 * Hook for managing multiple modal/dialog states
 * 
 * @param initialModals - Object with modal names and initial states
 * @returns Modal management functions
 * 
 * @example
 * ```typescript
 * const { modals, openModal, closeModal, isOpen } = useModals({
 *   addSchedule: false,
 *   addAvailability: false,
 *   statistics: false,
 *   aiGeneration: false,
 * });
 * 
 * // Check if modal is open
 * if (isOpen('addSchedule')) { ... }
 * 
 * // Open modal
 * openModal('addSchedule');
 * 
 * // Close modal
 * closeModal('addSchedule');
 * 
 * // Use in JSX
 * <Dialog open={isOpen('addSchedule')} onOpenChange={() => closeModal('addSchedule')}>
 * ```
 */
export function useModals(initialModals: ModalState = {}): UseModalsReturn {
  const [modals, setModals] = useState<ModalState>(initialModals);

  const openModal = useCallback((modalName: string) => {
    setModals(prev => ({ ...prev, [modalName]: true }));
  }, []);

  const closeModal = useCallback((modalName: string) => {
    setModals(prev => ({ ...prev, [modalName]: false }));
  }, []);

  const toggleModal = useCallback((modalName: string) => {
    setModals(prev => ({ ...prev, [modalName]: !prev[modalName] }));
  }, []);

  const isOpen = useCallback((modalName: string) => {
    return modals[modalName] || false;
  }, [modals]);

  const closeAll = useCallback(() => {
    setModals(Object.keys(modals).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {} as ModalState));
  }, [modals]);

  return {
    modals,
    openModal,
    closeModal,
    toggleModal,
    isOpen,
    closeAll,
  };
}

/**
 * Simpler hook for managing a single modal state
 * 
 * @param initialState - Initial open/closed state
 * @returns [isOpen, open, close, toggle]
 * 
 * @example
 * ```typescript
 * const [isAddScheduleOpen, openAddSchedule, closeAddSchedule] = useModal();
 * 
 * // Use in JSX
 * <Dialog open={isAddScheduleOpen} onOpenChange={closeAddSchedule}>
 *   <Button onClick={openAddSchedule}>Add Schedule</Button>
 * </Dialog>
 * ```
 */
export function useModal(initialState = false): [
  boolean,
  () => void,
  () => void,
  () => void
] {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return [isOpen, open, close, toggle];
}
