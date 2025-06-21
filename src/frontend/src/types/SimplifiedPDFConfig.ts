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
  pageSetup: MEPPageSetup;
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

// Utility functions
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key], source[key]!);
      } else {
        result[key] = source[key]!;
      }
    }
  }
  
  return result;
}

export function createConfigHash(config: SimplifiedPDFConfig): string {
  return btoa(JSON.stringify(config)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}

export const DEFAULT_CONFIG: SimplifiedPDFConfig = {
  header: {
    title: 'Mitarbeiter-Einsatz-Planung (MEP)',
    store_field: {
      label: 'Filiale:',
      value: ''
    },
    period_fields: {
      month_year: {
        label: 'Monat/Jahr',
        value: ''
      },
      week_from: {
        label: 'Woche vom:',
        value: ''
      },
      week_to: {
        label: 'bis:',
        value: ''
      }
    },
    storage_note: {
      text: 'Aufbewahrung in der Filiale: 2 Jahre',
      position: 'right'
    }
  },
  table: {
    employee_columns: {
      name: {
        label: 'Name',
        width: 120
      },
      function: {
        label: 'Funktion',
        width: 80
      },
      plan_week: {
        label: 'Plan KW',
        width: 60
      }
    },
    day_columns: {
      enabled_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      day_labels: {
        mon: 'Mo',
        tue: 'Di',
        wed: 'Mi',
        thu: 'Do',
        fri: 'Fr',
        sat: 'Sa',
        sun: 'So'
      },
      day_width: 45
    },
    summary_columns: {
      week_total: {
        label: 'Woche',
        width: 50
      },
      month_total: {
        label: 'Monat',
        width: 50
      }
    },
    row_structure: {
      date_row: {
        label: 'Datum',
        enabled: true
      },
      active_row: {
        label: 'Aktiv',
        enabled: true
      },
      start_row: {
        label: 'Beginn',
        enabled: true
      },
      break_row: {
        label: 'Pause',
        enabled: true
      },
      end_row: {
        label: 'Ende',
        enabled: true
      },
      total_row: {
        label: 'Stunden',
        enabled: true
      }
    }
  },
  footer: {
    break_rules: {
      enabled: true,
      text: 'Pausenregelung: 30 Min. nach 6 Std., 45 Min. nach 9 Std.'
    },
    absence_types: {
      enabled: true,
      title: 'Abwesenheitscodes:',
      types: [
        { code: 'U', label: 'Urlaub' },
        { code: 'K', label: 'Krank' },
        { code: 'F', label: 'Frei' }
      ]
    },
    instructions: {
      enabled: true,
      text: 'Bitte alle Änderungen deutlich markieren'
    },
    date_stamp: {
      enabled: true,
      text: 'Erstellt am:'
    }
  },
  styling: {
    fonts: {
      header_font: 'Helvetica',
      header_size: 11,
      table_font: 'Helvetica',
      table_size: 7,
      footer_font: 'Helvetica',
      footer_size: 6
    },
    colors: {
      header_bg: '#FFFFFF',
      header_text: '#000000',
      table_border: '#000000',
      table_bg: '#FFFFFF',
      table_text: '#000000'
    },
    spacing: {
      page_margin: 15,
      section_spacing: 6,
      row_height: 12
    },
    table_style: {
      border_width: 0.5,
      grid_style: 'solid',
      cell_padding: 2
    }
  },
  pageSetup: {
    size: 'A4',
    orientation: 'portrait',
    margins: {
      top: 15,
      right: 15,
      bottom: 15,
      left: 15
    }
  }
};

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'mep_standard',
    name: 'MEP Standard',
    description: 'Standardformat der deutschen Mitarbeiter-Einsatz-Planung',
    icon: '📋',
    config: {
      header: {
        title: 'Mitarbeiter-Einsatz-Planung (MEP)',
        store_field: {
          label: 'Filiale:',
          value: ''
        },
        period_fields: {
          month_year: {
            label: 'Monat/Jahr',
            value: ''
          },
          week_from: {
            label: 'Woche vom:',
            value: ''
          },
          week_to: {
            label: 'bis:',
            value: ''
          }
        },
        storage_note: {
          text: 'Aufbewahrung in der Filiale: 2 Jahre',
          position: 'right'
        }
      },
      styling: {
        fonts: {
          header_font: 'Helvetica',
          header_size: 11,
          table_font: 'Helvetica',
          table_size: 7,
          footer_font: 'Helvetica',
          footer_size: 6
        },
        colors: {
          header_bg: '#FFFFFF',
          header_text: '#000000',
          table_border: '#000000',
          table_bg: '#FFFFFF',
          table_text: '#000000'
        },
        spacing: {
          page_margin: 15,
          section_spacing: 6,
          row_height: 12
        },
        table_style: {
          border_width: 0.5,
          grid_style: 'solid',
          cell_padding: 2
        }
      }
    }
  },
  {
    id: 'mep_compact',
    name: 'MEP Kompakt',
    description: 'Platzsparende Version für mehr Mitarbeiter pro Seite',
    icon: '📊',
    config: {
      styling: {
        fonts: {
          header_font: 'Helvetica',
          header_size: 10,
          table_font: 'Helvetica',
          table_size: 6,
          footer_font: 'Helvetica',
          footer_size: 5
        },
        colors: {
          header_bg: '#F0F0F0',
          header_text: '#000000',
          table_border: '#666666',
          table_bg: '#FFFFFF',
          table_text: '#000000'
        },
        spacing: {
          page_margin: 10,
          section_spacing: 4,
          row_height: 10
        },
        table_style: {
          border_width: 0.3,
          grid_style: 'solid',
          cell_padding: 1
        }
      }
    }
  },
  {
    id: 'mep_detailed',
    name: 'MEP Detailliert',
    description: 'Erweiterte Version mit zusätzlichen Informationen',
    icon: '📝',
    config: {
      styling: {
        fonts: {
          header_font: 'Arial',
          header_size: 12,
          table_font: 'Arial',
          table_size: 8,
          footer_font: 'Arial',
          footer_size: 7
        },
        colors: {
          header_bg: '#E6F3FF',
          header_text: '#1E40AF',
          table_border: '#2563EB',
          table_bg: '#FFFFFF',
          table_text: '#374151'
        },
        spacing: {
          page_margin: 20,
          section_spacing: 8,
          row_height: 14
        },
        table_style: {
          border_width: 0.7,
          grid_style: 'solid',
          cell_padding: 3
        }
      }
    }
  },
  {
    id: 'custom',
    name: 'Benutzerdefiniert',
    description: 'Vollständig anpassbares Layout für spezielle Anforderungen',
    icon: '⚙️',
    config: {}
  }
];

export interface MEPMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MEPPageSetup {
  size: string;
  orientation: string;
  margins: MEPMargins;
}
