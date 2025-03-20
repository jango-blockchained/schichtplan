// This file re-exports the modular shifts-editor component for backward compatibility
// and simpler migration path for existing code that uses ShiftTable

import { ShiftTable as ModularShiftTable } from './shifts-editor/components/ShiftTable';
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

export const ShiftTable = (props: ShiftTableProps) => {
  return (
    <ModularShiftTable
      weekStart={props.weekStart}
      weekEnd={props.weekEnd}
      isLoading={props.isLoading}
      error={props.error}
      data={props.data}
      onShiftUpdate={props.onShiftUpdate}
      onBreakNotesUpdate={props.onBreakNotesUpdate}
    />
  );
};