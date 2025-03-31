import React from 'react';
import { ShiftTable as CoreShiftTable } from '@/components/shifts/core';
import { WeeklySchedule } from '@/types';

interface ShiftTableProps {
  weekStart: Date;
  weekEnd: Date;
  isLoading?: boolean;
  error?: string | null;
  data: WeeklySchedule[];
  onShiftUpdate?: (employeeId: number, fromDay: number, toDay: number) => Promise<void>;
  onBreakNotesUpdate?: (employeeId: number, day: number, notes: string) => Promise<void>;
}

/**
 * ShiftTable component for the shifts module
 * This is a wrapper around the core ShiftTable component with shifts-specific defaults
 */
export const ShiftTable = (props: ShiftTableProps) => {
  return (
    <CoreShiftTable
      {...props}
      compact={false}
      filterOpeningDays={false}
      showValidation={true}
    />
  );
};