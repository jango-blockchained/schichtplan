import { AvailabilityContext, AvailabilityContextType } from '@/contexts/availabilityContext';
import { useContext } from 'react';

interface AbsenceInfo {
  absence_type_id: string;
  absence_type_name: string;
  absence_type_color: string;
  start_date: string;
  end_date: string;
  note?: string;
}

export function useAvailabilityContext(): AvailabilityContextType {
  const context = useContext(AvailabilityContext);
  if (!context) {
    throw new Error('useAvailabilityContext must be used within an AvailabilityProvider');
  }
  return context;
}

// Hook for easy access to employee availability
export function useEmployeeAvailability(employeeId: number, date: Date): {
  isAvailable: boolean | undefined;
  absenceInfo: AbsenceInfo | null;
  status: string;
  isLoading: boolean;
} {
  const { getEmployeeAvailability, isLoading } = useAvailabilityContext();
  
  const availability = getEmployeeAvailability(employeeId, date);
  
  // If still loading, don't make assumptions about availability
  if (isLoading) {
    return {
      isAvailable: undefined, // Explicitly undefined while loading
      absenceInfo: null,
      status: 'Loading',
      isLoading: true,
    };
  }
  
  // If data has loaded but no availability record exists for this employee/date,
  // they should be considered unavailable (no availability records = unavailable)
  if (!availability) {
    return {
      isAvailable: false, // No availability data = unavailable
      absenceInfo: null,
      status: 'Unavailable',
      isLoading: false,
    };
  }
  
  return {
    isAvailable: availability.is_available ?? false, // Default to unavailable if unclear
    absenceInfo: availability.absence_info ?? null,
    status: availability.status ?? 'Unavailable',
    isLoading: false,
  };
}
