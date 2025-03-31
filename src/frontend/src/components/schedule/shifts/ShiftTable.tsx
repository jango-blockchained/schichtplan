import React from 'react';
import { ShiftTable as CoreShiftTable } from '@/components/core/shifts';
import { WeeklySchedule } from '@/types';

interface ScheduleShiftTableProps {
  weekStart: Date;
  weekEnd: Date;
  isLoading?: boolean;
  error?: string | null;
  data: WeeklySchedule[];
  onShiftUpdate?: (employeeId: number, fromDay: number, toDay: number) => Promise<void>;
  onBreakNotesUpdate?: (employeeId: number, day: number, notes: string) => Promise<void>;
}

/**
 * ShiftTable component configured for schedule views
 */
export const ScheduleShiftTable = (props: ScheduleShiftTableProps) => {
  return (
    <CoreShiftTable
      {...props}
      compact={true}
      filterOpeningDays={true}
      showValidation={true}
    />
  );
};