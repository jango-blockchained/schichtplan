import { useState } from "react";
import { checkAvailability, AvailabilityCheck } from "@/services/api";
import { format } from "date-fns";

interface UseAvailabilityCheckProps {
  employeeId: number;
}

export const useAvailabilityCheck = ({
  employeeId,
}: UseAvailabilityCheckProps) => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<AvailabilityCheck | null>(null);

  const checkEmployeeAvailability = async (
    date: Date,
    startTime?: string,
    endTime?: string,
  ): Promise<AvailabilityCheck> => {
    setIsChecking(true);
    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const result = await checkAvailability(
        employeeId,
        formattedDate,
        startTime,
        endTime,
      );
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
