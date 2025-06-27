import { getEmployeeAvailabilityByDateRange } from "@/services/api";
import { EmployeeAvailabilityStatus } from "@/types";
import { useQuery } from "@tanstack/react-query";
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

interface UseBulkAvailabilityOptimizedProps {
  dateRange: { from: Date; to: Date } | undefined;
  enabled?: boolean;
}

export function useBulkAvailabilityOptimized({ dateRange, enabled = true }: UseBulkAvailabilityOptimizedProps) {
  // Generate date range strings for the API call
  const dateRangeStrings = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    
    return {
      startDate: format(dateRange.from, 'yyyy-MM-dd'),
      endDate: format(dateRange.to, 'yyyy-MM-dd')
    };
  }, [dateRange]);

  // Single API call for the entire date range
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bulk-availability-range', dateRangeStrings?.startDate, dateRangeStrings?.endDate] as const,
    queryFn: () => {
      if (!dateRangeStrings) throw new Error('Date range not available');
      return getEmployeeAvailabilityByDateRange(dateRangeStrings.startDate, dateRangeStrings.endDate);
    },
    enabled: enabled && !!dateRangeStrings,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Process the data into a lookup map
  const availabilityByDateAndEmployee = useMemo(() => {
    if (!data) return new Map<string, Map<number, ExtendedEmployeeAvailabilityStatus>>();
    
    const map = new Map<string, Map<number, ExtendedEmployeeAvailabilityStatus>>();
    
    Object.entries(data).forEach(([dateStr, employeeStatuses]) => {
      const employeeMap = new Map<number, ExtendedEmployeeAvailabilityStatus>();
      
      employeeStatuses.forEach((empStatus: EmployeeAvailabilityStatus) => {
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
    });
    
    return map;
  }, [data]);

  // Helper function to get availability for specific employee and date
  const getEmployeeAvailability = (employeeId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilityByDateAndEmployee.get(dateStr)?.get(employeeId) || null;
  };

  return {
    getEmployeeAvailability,
    availabilityByDateAndEmployee,
    isLoading,
    error,
    hasError: !!error,
    refetch,
  };
}
