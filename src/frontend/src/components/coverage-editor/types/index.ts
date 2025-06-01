export interface StoreConfig {
    store_opening: string;
    store_closing: string;
    opening_days: { [key: string]: boolean };
    min_employees_per_shift: number;
    max_employees_per_shift: number;
    employee_types: Array<{ id: string; name: string }>;
    keyholder_before_minutes?: number;
    keyholder_after_minutes?: number;
}

export interface StoreConfigProps {
  store_opening: string;
  store_closing: string;
  opening_days: { [key: string]: boolean };
  employee_types: Array<{
    id: string;
    name: string;
    abbr?: string;
  }>;
  keyholder_before_minutes: number;
  keyholder_after_minutes: number;
  min_employees_per_shift: number;
  max_employees_per_shift: number;
}

export interface CoverageTimeSlot {
  startTime: string;
  endTime: string;
  minEmployees: number;
  maxEmployees: number;
  employeeTypes: string[];
  requiresKeyholder: boolean;
  keyholderBeforeMinutes: number;
  keyholderAfterMinutes: number;
}

export interface DailyCoverage {
  dayIndex: number;
  timeSlots: CoverageTimeSlot[];
}

export interface BlockEditorProps {
  slot: CoverageTimeSlot;
  onSave: (updates: CoverageTimeSlot) => void;
  onCancel: () => void;
  storeConfig: StoreConfigProps;
}

export interface CoverageBlockProps {
  slot: CoverageTimeSlot;
  dayIndex: number;
  onUpdate: (updates: Partial<CoverageTimeSlot>) => void;
  onDelete: () => void;
  isEditing: boolean;
  gridWidth: number;
  storeConfig: StoreConfigProps;
  hours: string[];
  gridStartMinutes: number;
  totalGridMinutes: number;
}

export interface DayRowProps {
  dayName: string;
  dayIndex: number;
  slots: CoverageTimeSlot[];
  hours: string[];
  onAddSlot: (hourIndex: number) => void;
  onUpdateSlot: (slotIndex: number, updates: Partial<CoverageTimeSlot>) => void;
  onDeleteSlot: (slotIndex: number) => void;
  isEditing: boolean;
  gridWidth: number;
  storeConfig: StoreConfigProps;
}

export interface TimeGridCellProps {
  hour: string;
  cellIndex: number;
  dayIndex: number;
  slots: CoverageTimeSlot[];
  onAddSlot: () => void;
  isEditing: boolean;
  onDropBlock?: (block: CoverageTimeSlot, newStartIndex: number) => void;
  minuteWidth: number;
  gridStartMinutes: number;
}

export interface CoverageEditorProps {
  initialCoverage?: DailyCoverage[];
  storeConfig: StoreConfigProps;
  onChange?: (coverage: DailyCoverage[]) => void;
}
