export interface SimplifiedPDFConfig {
  // Quick preset selection
  preset: 'mep_standard' | 'mep_compact' | 'mep_detailed' | 'custom';
  
  // MEP Header Information
  mepHeader: {
    title: string; // "Mitarbeiter-Einsatz-Planung (MEP)"
    filiale: string; // Branch/Store name
    monthYear: string; // "Monat/Jahr"
    weekFrom: string; // "Woche vom:"
    weekTo: string; // "bis:"
    storageNote: string; // "Aufbewahrung in der Filiale: 2 Jahre"
  };
  
  // Page Setup Section
  pageSetup: {
    size: 'A4';
    orientation: 'landscape';
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  
  // MEP Table Structure
  tableStructure: {
    // Employee info columns
    nameColumn: {
      width: number;
      label: string; // "Name, Vorname"
    };
    positionColumn: {
      width: number;
      label: string; // "Funktion"
    };
    planWeekColumn: {
      width: number;
      label: string; // "Plan/Woche"
    };
    
    // Day columns
    dayColumns: {
      monday: { width: number; label: string; subLabels: string[] };
      tuesday: { width: number; label: string; subLabels: string[] };
      wednesday: { width: number; label: string; subLabels: string[] };
      thursday: { width: number; label: string; subLabels: string[] };
      friday: { width: number; label: string; subLabels: string[] };
      saturday: { width: number; label: string; subLabels: string[] };
      sunday: { width: number; label: string; subLabels: string[] };
    };
    
    // Summary columns
    summaryWeekColumn: {
      width: number;
      label: string; // "Summe/Woche"
    };
    summaryMonthColumn: {
      width: number;
      label: string; // "Summe/Monat"
    };
    
    // Row structure for each employee
    employeeRowStructure: {
      // Each employee has 4 rows
      beginRow: { label: string; height: number }; // "Beginn"
      pauseRow: { label: string; height: number }; // "Pause"
      endRow: { label: string; height: number }; // "Ende"
      summaryRow: { label: string; height: number }; // "Summe/Tag"
    };
  };
  
  // MEP Footer Information
  mepFooter: {
    breakRules: {
      title: string; // "Pausenzeiten:"
      sixHourRule: string; // "bis 6 Stunden: keine Pause"
      overSixHourRule: string; // "mehr als 6 Stunden: 60 Minuten"
    };
    absenceTypes: {
      title: string; // "Abwesenheiten:"
      holiday: string; // "Feiertag"
      illness: string; // "Krank (AU-Bescheinigung)"
      vacation: string; // "Schule (Führungsnachwuchskraft)"
      leave: string; // "Urlaub"
    };
    instructions: {
      title: string; // "Anwesenheiten:"
      text: string; // "Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen. Am Ende der Woche: wöchentliche und monatliche Summe eintragen."
    };
    dateStamp: {
      text: string; // "Stand: Oktober 2014"
      position: 'left' | 'center' | 'right';
    };
  };
  
  // Styling Section
  styling: {
    fontFamily: 'Helvetica' | 'Times-Roman' | 'Arial';
    fontSize: {
      headerTitle: number; // Main title
      columnHeaders: number; // Day headers
      subHeaders: number; // Date/Wochentag headers
      tableContent: number; // Cell content
      footer: number; // Footer text
    };
    colors: {
      tableBorder: string;
      headerBackground: string;
      headerText: string;
      cellBackground: string;
      cellText: string;
      alternateRowBackground: string;
    };
    spacing: {
      cellPadding: number;
      rowHeight: number;
      borderWidth: number;
      headerSpacing: number;
    };
    tableStyle: {
      showBorders: boolean;
      alternateRowColors: boolean;
      boldHeaders: boolean;
    };
  };
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

// Default configurations
export const DEFAULT_CONFIG: SimplifiedPDFConfig = {
  preset: 'mep_standard',
  mepHeader: {
    title: 'Mitarbeiter-Einsatz-Planung (MEP)',
    filiale: '',
    monthYear: '',
    weekFrom: '',
    weekTo: '',
    storageNote: 'Aufbewahrung in der Filiale: 2 Jahre',
  },
  pageSetup: {
    size: 'A4',
    orientation: 'landscape',
    margins: {
      top: 15,
      right: 15,
      bottom: 25,
      left: 15,
    },
  },
  tableStructure: {
    nameColumn: {
      width: 80,
      label: 'Name, Vorname',
    },
    positionColumn: {
      width: 60,
      label: 'Funktion',
    },
    planWeekColumn: {
      width: 50,
      label: 'Plan/Woche',
    },
    dayColumns: {
      monday: { 
        width: 70, 
        label: 'Montag', 
        subLabels: ['Wochentag', 'Datum', 'Werkstatt'] 
      },
      tuesday: { 
        width: 70, 
        label: 'Dienstag', 
        subLabels: ['Wochentag', 'Datum', 'Werkstatt'] 
      },
      wednesday: { 
        width: 70, 
        label: 'Mittwoch', 
        subLabels: ['Wochentag', 'Datum', 'Werkstatt'] 
      },
      thursday: { 
        width: 70, 
        label: 'Donnerstag', 
        subLabels: ['Wochentag', 'Datum', 'Werkstatt'] 
      },
      friday: { 
        width: 70, 
        label: 'Freitag', 
        subLabels: ['Wochentag', 'Datum', 'Werkstatt'] 
      },
      saturday: { 
        width: 70, 
        label: 'Samstag', 
        subLabels: ['Wochentag', 'Datum', 'Werkstatt'] 
      },
      sunday: { 
        width: 70, 
        label: 'Sonntag', 
        subLabels: ['Wochentag', 'Datum', 'Werkstatt'] 
      },
    },
    summaryWeekColumn: {
      width: 50,
      label: 'Summe/Woche',
    },
    summaryMonthColumn: {
      width: 50,
      label: 'Summe/Monat',
    },
    employeeRowStructure: {
      beginRow: { label: 'Beginn', height: 12 },
      pauseRow: { label: 'Pause', height: 12 },
      endRow: { label: 'Ende', height: 12 },
      summaryRow: { label: 'Summe/Tag', height: 12 },
    },
  },
  mepFooter: {
    breakRules: {
      title: 'Pausenzeiten:',
      sixHourRule: 'bis 6 Stunden: keine Pause',
      overSixHourRule: 'mehr als 6 Stunden: 60 Minuten',
    },
    absenceTypes: {
      title: 'Abwesenheiten:',
      holiday: 'Feiertag',
      illness: 'Krank (AU-Bescheinigung)',
      vacation: 'Schule (Führungsnachwuchskraft)',
      leave: 'Urlaub',
    },
    instructions: {
      title: 'Anwesenheiten:',
      text: 'Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen. Am Ende der Woche: wöchentliche und monatliche Summe eintragen.',
    },
    dateStamp: {
      text: 'Stand: Oktober 2014',
      position: 'right',
    },
  },
  styling: {
    fontFamily: 'Helvetica',
    fontSize: {
      headerTitle: 11,
      columnHeaders: 9,
      subHeaders: 8,
      tableContent: 7,
      footer: 6,
    },
    colors: {
      tableBorder: '#000000',
      headerBackground: '#ffffff',
      headerText: '#000000',
      cellBackground: '#ffffff',
      cellText: '#000000',
      alternateRowBackground: '#f8f9fa',
    },
    spacing: {
      cellPadding: 2,
      rowHeight: 12,
      borderWidth: 0.5,
      headerSpacing: 6,
    },
    tableStyle: {
      showBorders: true,
      alternateRowColors: false,
      boldHeaders: true,
    },
  },
};

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'mep_standard',
    name: 'MEP Standard',
    description: 'Standardformat der deutschen Mitarbeiter-Einsatz-Planung',
    icon: '�',
    config: {
      preset: 'mep_standard',
      styling: {
        fontFamily: 'Helvetica',
        fontSize: {
          headerTitle: 11,
          columnHeaders: 9,
          subHeaders: 8,
          tableContent: 7,
          footer: 6,
        },
        colors: {
          tableBorder: '#000000',
          headerBackground: '#ffffff',
          headerText: '#000000',
          cellBackground: '#ffffff',
          cellText: '#000000',
          alternateRowBackground: '#f8f9fa',
        },
        spacing: {
          cellPadding: 2,
          rowHeight: 12,
          borderWidth: 0.5,
          headerSpacing: 6,
        },
        tableStyle: {
          showBorders: true,
          alternateRowColors: false,
          boldHeaders: true,
        },
      },
    },
  },
  {
    id: 'mep_compact',
    name: 'MEP Kompakt',
    description: 'Platzsparende Version für mehr Mitarbeiter pro Seite',
    icon: '📊',
    config: {
      preset: 'mep_compact',
      pageSetup: {
        size: 'A4',
        orientation: 'landscape',
        margins: {
          top: 10,
          right: 10,
          bottom: 15,
          left: 10,
        },
      },
      styling: {
        fontFamily: 'Helvetica',
        fontSize: {
          headerTitle: 10,
          columnHeaders: 8,
          subHeaders: 7,
          tableContent: 6,
          footer: 5,
        },
        colors: {
          tableBorder: '#666666',
          headerBackground: '#f0f0f0',
          headerText: '#000000',
          cellBackground: '#ffffff',
          cellText: '#000000',
          alternateRowBackground: '#fafafa',
        },
        spacing: {
          cellPadding: 1,
          rowHeight: 10,
          borderWidth: 0.3,
          headerSpacing: 4,
        },
        tableStyle: {
          showBorders: true,
          alternateRowColors: true,
          boldHeaders: true,
        },
      },
    },
  },
  {
    id: 'mep_detailed',
    name: 'MEP Detailliert',
    description: 'Erweiterte Version mit zusätzlichen Informationen',
    icon: '�',
    config: {
      preset: 'mep_detailed',
      pageSetup: {
        size: 'A4',
        orientation: 'landscape',
        margins: {
          top: 20,
          right: 20,
          bottom: 30,
          left: 20,
        },
      },
      styling: {
        fontFamily: 'Arial',
        fontSize: {
          headerTitle: 12,
          columnHeaders: 10,
          subHeaders: 9,
          tableContent: 8,
          footer: 7,
        },
        colors: {
          tableBorder: '#2563eb',
          headerBackground: '#e6f3ff',
          headerText: '#1e40af',
          cellBackground: '#ffffff',
          cellText: '#374151',
          alternateRowBackground: '#f8fafc',
        },
        spacing: {
          cellPadding: 3,
          rowHeight: 14,
          borderWidth: 0.7,
          headerSpacing: 8,
        },
        tableStyle: {
          showBorders: true,
          alternateRowColors: true,
          boldHeaders: true,
        },
      },
    },
  },
  {
    id: 'custom',
    name: 'Benutzerdefiniert',
    description: 'Vollständig anpassbares Layout für spezielle Anforderungen',
    icon: '⚙️',
    config: {
      preset: 'custom',
    },
  },
];

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

export function validateConfig(config: Partial<SimplifiedPDFConfig>): string[] {
  const errors: string[] = [];
  
  if (config.pageSetup?.margins) {
    const { top, right, bottom, left } = config.pageSetup.margins;
    if (top < 0 || right < 0 || bottom < 0 || left < 0) {
      errors.push('Margins must be non-negative');
    }
    if (top > 50 || right > 50 || bottom > 50 || left > 50) {
      errors.push('Margins cannot exceed 50mm');
    }
  }
  
  if (config.styling?.fontSize) {
    const { headerTitle, columnHeaders, tableContent } = config.styling.fontSize;
    if (headerTitle && (headerTitle < 6 || headerTitle > 20)) {
      errors.push('Header title font size must be between 6 and 20');
    }
    if (columnHeaders && (columnHeaders < 6 || columnHeaders > 18)) {
      errors.push('Column header font size must be between 6 and 18');
    }
    if (tableContent && (tableContent < 5 || tableContent > 15)) {
      errors.push('Table content font size must be between 5 and 15');
    }
  }
  
  if (config.mepHeader?.filiale && config.mepHeader.filiale.length > 100) {
    errors.push('Filiale name cannot exceed 100 characters');
  }
  
  return errors;
}
