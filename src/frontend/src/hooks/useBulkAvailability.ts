import { getEmployeeAvailabilityByDate } from "@/services/api";
import { EmployeeAvailabilityStatus } from "@/types";
import { useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import { useMemo } from "react";

interface AbsenceInfo {
  absence_type_id: string;
  absence_type_name: string;
  absence_type_color: string;
  start_date: string;
  end_date: string;
  note?: string;
}

interface ExtendedEmployeeAvailabilityStatus extends EmployeeAvailabilityStatus {
  is_available?: boolean;
  absence_info?: AbsenceInfo | null;
}

interface UseBulkAvailabilityProps {
  dateRange: { from: Date; to: Date } | undefined;
  enabled?: boolean;
}

export function useBulkAvailability({ dateRange, enabled = true }: UseBulkAvailabilityProps) {
  // Generate array of dates to fetch
  const dates = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    
    const dates: Date[] = [];
    const current = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }, [dateRange]);

  // Fetch availability for each date using useQueries
  const results = useQueries({
    queries: dates.map(date => ({
      queryKey: ['bulk-availability', format(date, 'yyyy-MM-dd')] as const,
      queryFn: () => getEmployeeAvailabilityByDate(format(date, 'yyyy-MM-dd')),
      enabled: enabled && dates.length > 0,
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    }))
  });

  // Combine results into a lookup map
  const availabilityByDateAndEmployee = useMemo(() => {
    const map = new Map<string, Map<number, ExtendedEmployeeAvailabilityStatus>>();
    
    results.forEach((result, index) => {
      if (result.data && dates[index]) {
        const dateStr = format(dates[index], 'yyyy-MM-dd');
        const employeeMap = new Map<number, ExtendedEmployeeAvailabilityStatus>();
        
        result.data.forEach((empStatus: EmployeeAvailabilityStatus) => {
          // Parse the status to determine availability
          const isAvailable = empStatus.status === 'Available';
          const isOnAbsence = empStatus.status.startsWith('Absence:');
          
          employeeMap.set(empStatus.employee_id, {
            ...empStatus,
            is_available: isAvailable,
            absence_info: isOnAbsence ? (empStatus.details as AbsenceInfo) : null,
          });
        });
        
        map.set(dateStr, employeeMap);
      }
    });
    
    return map;
  }, [results, dates]);

  // Helper function to get availability for specific employee and date
  const getEmployeeAvailability = (employeeId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilityByDateAndEmployee.get(dateStr)?.get(employeeId) || null;
  };

  // Check if any queries are loading
  const isLoading = results.some(result => result.isLoading);
  
  // Check if any queries have errors
  const hasError = results.some(result => result.error);
  
  // Get the first error message
  const error = results.find(result => result.error)?.error;

  return {
    getEmployeeAvailability,
    availabilityByDateAndEmployee,
    isLoading,
    error,
    hasError,
    refetch: () => {
      results.forEach(result => result.refetch());
    },
  };
}
