import { Settings } from '@/types';
import { Shift } from '@/services/api';

export type ShiftType = {
  id: string;
  name: string;
  color: string;
  // ... other properties
};

export interface ShiftTemplateEditorProps {
  shifts: Shift[];
  settings: Settings;
  onAddShift?: () => void;
  onUpdateShift?: (shift: Shift) => void;
  onDeleteShift?: (id: number) => void;
  onEmployeeCountChange?: (shiftId: number, count: number) => void;
}

export interface ShiftTemplateFormProps {
  settings: Settings;
  shift: Shift;
  onSave: (data: Partial<Shift> & { 
    start_time: string;
    end_time: string;
    requires_break: boolean;
    active_days: { [key: string]: boolean };
    shift_type_id: string;
  }) => void;
  onDelete?: () => void;
} 