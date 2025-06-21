// MEP PDF Configuration Interface matching backend schema

export interface MEPStoreField {
  label: string;
  value: string;
}

export interface MEPPeriodField {
  label: string;
  value: string;
}

export interface MEPPeriodFields {
  month_year: MEPPeriodField;
  week_from: MEPPeriodField;
  week_to: MEPPeriodField;
}

export interface MEPStorageNote {
  text: string;
  position: string;
}

export interface MEPHeader {
  title: string;
  store_field: MEPStoreField;
  period_fields: MEPPeriodFields;
  storage_note: MEPStorageNote;
}

export interface MEPEmployeeColumn {
  label: string;
  width: number;
}

export interface MEPEmployeeColumns {
  name: MEPEmployeeColumn;
  function: MEPEmployeeColumn;
  plan_week: MEPEmployeeColumn;
}

export interface MEPDayColumns {
  enabled_days: string[];
  day_labels: Record<string, string>;
  day_width: number;
}

export interface MEPSummaryColumn {
  label: string;
  width: number;
}

export interface MEPSummaryColumns {
  week_total: MEPSummaryColumn;
  month_total: MEPSummaryColumn;
}

export interface MEPRow {
  label: string;
  enabled: boolean;
}

export interface MEPRowStructure {
  date_row: MEPRow;
  active_row: MEPRow;
  start_row: MEPRow;
  break_row: MEPRow;
  end_row: MEPRow;
  total_row: MEPRow;
}

export interface MEPTable {
  employee_columns: MEPEmployeeColumns;
  day_columns: MEPDayColumns;
  summary_columns: MEPSummaryColumns;
  row_structure: MEPRowStructure;
}

export interface MEPBreakRules {
  enabled: boolean;
  text: string;
}

export interface MEPAbsenceType {
  code: string;
  label: string;
}

export interface MEPAbsenceTypes {
  enabled: boolean;
  title: string;
  types: MEPAbsenceType[];
}

export interface MEPInstructions {
  enabled: boolean;
  text: string;
}

export interface MEPDateStamp {
  enabled: boolean;
  text: string;
}

export interface MEPFooter {
  break_rules: MEPBreakRules;
  absence_types: MEPAbsenceTypes;
  instructions: MEPInstructions;
  date_stamp: MEPDateStamp;
}

export interface MEPFonts {
  header_font: string;
  header_size: number;
  table_font: string;
  table_size: number;
  footer_font: string;
  footer_size: number;
}

export interface MEPColors {
  header_bg: string;
  header_text: string;
  table_border: string;
  table_bg: string;
  table_text: string;
}

export interface MEPSpacing {
  page_margin: number;
  section_spacing: number;
  row_height: number;
}

export interface MEPTableStyle {
  border_width: number;
  grid_style: string;
  cell_padding: number;
}

export interface MEPStyling {
  fonts: MEPFonts;
  colors: MEPColors;
  spacing: MEPSpacing;
  table_style: MEPTableStyle;
}

export interface SimplifiedPDFConfig {
  header: MEPHeader;
  table: MEPTable;
  footer: MEPFooter;
  styling: MEPStyling;
}

export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  config: Partial<SimplifiedPDFConfig>;
}

export interface PreviewState {
  isLoading: boolean;
  error?: string;
  selectedElement?: string;
  zoomLevel: number;
  showMarginGuides: boolean;
  showGridLines: boolean;
}

export interface LayoutAction {
  type: 'UPDATE_CONFIG' | 'APPLY_PRESET' | 'RESET' | 'UNDO' | 'REDO';
  payload?: unknown;
}

export interface LayoutState {
  config: SimplifiedPDFConfig;
  history: SimplifiedPDFConfig[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  lastSaved?: Date;
}

export function validateConfig(config: Partial<SimplifiedPDFConfig>): string[] {
  const errors: string[] = [];
  
  if (config.styling?.fonts) {
    const { header_size, table_size, footer_size } = config.styling.fonts;
    if (header_size && (header_size < 6 || header_size > 20)) {
      errors.push('Header font size must be between 6 and 20');
    }
    if (table_size && (table_size < 6 || table_size > 18)) {
      errors.push('Table font size must be between 6 and 18');
    }
    if (footer_size && (footer_size < 5 || footer_size > 15)) {
      errors.push('Footer font size must be between 5 and 15');
    }
  }

  if (config.styling?.spacing) {
    const { page_margin, section_spacing, row_height } = config.styling.spacing;
    if (page_margin && (page_margin < 5 || page_margin > 50)) {
      errors.push('Page margin must be between 5 and 50mm');
    }
    if (section_spacing && (section_spacing < 0.5 || section_spacing > 10)) {
      errors.push('Section spacing must be between 0.5 and 10mm');
    }
    if (row_height && (row_height < 5 || row_height > 30)) {
      errors.push('Row height must be between 5 and 30mm');
    }
  }

  if (config.header?.store_field?.value && config.header.store_field.value.length > 100) {
    errors.push('Store name cannot exceed 100 characters');
  }
  
  return errors;
}
