import { EmployeeAvailabilityStatus } from "@/types";
import { createContext } from "react";

interface AbsenceInfo {
  absence_type_id: string;
  absence_type_name: string;
  absence_type_color: string;
  start_date: string;
  end_date: string;
  note?: string;
}

interface ExtendedEmployeeAvailabilityStatus
  extends EmployeeAvailabilityStatus {
  is_available?: boolean;
  absence_info?: AbsenceInfo | null;
}

export interface AvailabilityContextType {
  getEmployeeAvailability: (
    employeeId: number,
    date: Date,
  ) => ExtendedEmployeeAvailabilityStatus | null;
  isLoading: boolean;
  error: Error | null;
  hasError: boolean;
  refetch: () => void;
}

export const AvailabilityContext =
  createContext<AvailabilityContextType | null>(null);
