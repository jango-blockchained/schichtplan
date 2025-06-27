import { AvailabilityContext, AvailabilityContextType } from '@/contexts/availabilityContext';
import { useContext } from 'react';

export function useAvailabilityContext(): AvailabilityContextType {
  const context = useContext(AvailabilityContext);
  if (!context) {
    throw new Error('useAvailabilityContext must be used within an AvailabilityProvider');
  }
  return context;
}

// Hook for easy access to employee availability
export function useEmployeeAvailability(employeeId: number, date: Date) {
  const { getEmployeeAvailability, isLoading } = useAvailabilityContext();
  
  const availability = getEmployeeAvailability(employeeId, date);
  
  return {
    isAvailable: availability?.is_available ?? true, // Default to available if no data
    absenceInfo: availability?.absence_info ?? null,
    status: availability?.status ?? 'Available',
    isLoading,
  };
}
