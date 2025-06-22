import { checkEmployeeAvailabilityForDate, EmployeeAvailabilityForDate } from "@/services/api";
import { format } from "date-fns";
import { useState } from "react";

interface UseEmployeeAvailabilityCheckProps {
  employeeId: number;
}

export const useEmployeeAvailabilityCheck = ({
  employeeId,
}: UseEmployeeAvailabilityCheckProps) => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<EmployeeAvailabilityForDate | null>(null);

  const checkEmployeeAvailability = async (
    date: Date,
  ): Promise<EmployeeAvailabilityForDate> => {
    setIsChecking(true);
    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const result = await checkEmployeeAvailabilityForDate(employeeId, formattedDate);
      setLastCheck(result);
      return result;
    } finally {
      setIsChecking(false);
    }
  };

  return {
    checkEmployeeAvailability,
    isChecking,
    lastCheck,
  };
};
