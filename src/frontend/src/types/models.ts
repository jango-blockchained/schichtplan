export interface Schedule {
  id?: number;
  version: number;
  status: "DRAFT" | "GENERATED" | "PUBLISHED" | "ARCHIVED";
  startDate: string;
  endDate: string;
  entries: ScheduleEntry[];
}

export interface ScheduleEntry {
  id?: number;
  employeeId: number;
  shiftId: number;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  status: "GENERATED" | "CONFIRMED" | "REJECTED";
  version: number;
  notes?: string;
  isPlaceholder?: boolean;
  fallbackAssigned?: boolean;
}
