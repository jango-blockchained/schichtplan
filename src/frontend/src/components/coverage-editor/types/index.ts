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

// New interface for identifying a specific coverage block
export interface BlockIdentifier {
  dayIndex: number;
  slotIndex: number;
}

// New interface for bulk editing operations
export interface BulkEditData {
  minEmployees?: number;
  maxEmployees?: number;
  employeeTypes?: string[];
  requiresKeyholder?: boolean;
}

export interface BulkEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBlocks: BlockIdentifier[];
  coverage: DailyCoverage[];
  onBulkUpdate: (updates: BulkEditData) => void;
  storeConfig: StoreConfigProps;
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
  slotIndex: number;
  onUpdate: (updates: Partial<CoverageTimeSlot>) => void;
  onDelete: () => void;
  isEditing: boolean;
  gridWidth: number;
  storeConfig: StoreConfigProps;
  hours: string[];
  gridStartMinutes: number;
  totalGridMinutes: number;
  // New selection-related props
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  selectionMode: boolean;
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
  // New selection-related props
  selectedBlocks: Set<string>;
  onBlockSelect: (dayIndex: number, slotIndex: number, selected: boolean) => void;
  selectionMode: boolean;
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
