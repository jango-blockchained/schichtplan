export interface SimplifiedPDFConfig {
  // Quick preset selection
  preset: 'classic' | 'modern' | 'compact' | 'custom';
  
  // Page Setup Section
  pageSetup: {
    size: 'A4' | 'Letter' | 'Legal';
    orientation: 'portrait' | 'landscape';
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  
  // Content Layout Section
  contentLayout: {
    showEmployeeId: boolean;
    showPosition: boolean;
    showBreaks: boolean;
    showTotalHours: boolean;
    columnLayout: 'single' | 'multi';
    headerFooter: {
      showHeader: boolean;
      showFooter: boolean;
      headerText?: string;
      footerText?: string;
    };
    pageNumbering: {
      enabled: boolean;
      position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
      format: 'page-of-total' | 'page-only' | 'custom';
    };
  };
  
  // Styling Section
  styling: {
    fontFamily: 'Helvetica' | 'Times-Roman' | 'Arial' | 'Courier';
    fontSize: {
      base: number;
      header: number;
      title: number;
    };
    colors: {
      primary: string;
      secondary: string;
      background: string;
      text: string;
      border: string;
      headerBackground: string;
      headerText: string;
    };
    spacing: {
      cellPadding: number;
      rowHeight: number;
      borderWidth: number;
    };
    tableStyle: {
      alternateRows: boolean;
      gridLines: boolean;
      headerStyle: 'bold' | 'normal';
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
  preset: 'classic',
  pageSetup: {
    size: 'A4',
    orientation: 'landscape',
    margins: {
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
    },
  },
  contentLayout: {
    showEmployeeId: true,
    showPosition: true,
    showBreaks: true,
    showTotalHours: true,
    columnLayout: 'multi',
    headerFooter: {
      showHeader: true,
      showFooter: true,
      headerText: 'Schedule',
      footerText: 'Generated on {date}',
    },
    pageNumbering: {
      enabled: true,
      position: 'bottom-center',
      format: 'page-of-total',
    },
  },
  styling: {
    fontFamily: 'Helvetica',
    fontSize: {
      base: 10,
      header: 12,
      title: 16,
    },
    colors: {
      primary: '#000000',
      secondary: '#666666',
      background: '#ffffff',
      text: '#000000',
      border: '#cccccc',
      headerBackground: '#f4f4f5',
      headerText: '#000000',
    },
    spacing: {
      cellPadding: 8,
      rowHeight: 24,
      borderWidth: 1,
    },
    tableStyle: {
      alternateRows: true,
      gridLines: true,
      headerStyle: 'bold',
    },
  },
};

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional layout with clear borders and standard formatting',
    icon: '📄',
    config: {
      preset: 'classic',
      styling: {
        fontFamily: 'Helvetica',
        fontSize: {
          base: 10,
          header: 12,
          title: 16,
        },
        colors: {
          primary: '#000000',
          secondary: '#666666',
          background: '#ffffff',
          text: '#000000',
          border: '#000000',
          headerBackground: '#f4f4f5',
          headerText: '#000000',
        },
        spacing: {
          cellPadding: 8,
          rowHeight: 24,
          borderWidth: 1.5,
        },
        tableStyle: {
          alternateRows: false,
          gridLines: true,
          headerStyle: 'bold',
        },
      },
    },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, contemporary design with subtle colors and spacing',
    icon: '🎨',
    config: {
      preset: 'modern',
      styling: {
        fontFamily: 'Arial',
        fontSize: {
          base: 10,
          header: 12,
          title: 16,
        },
        colors: {
          primary: '#2563eb',
          secondary: '#64748b',
          background: '#ffffff',
          text: '#1e293b',
          border: '#e2e8f0',
          headerBackground: '#3b82f6',
          headerText: '#ffffff',
        },
        spacing: {
          cellPadding: 12,
          rowHeight: 28,
          borderWidth: 1,
        },
        tableStyle: {
          alternateRows: true,
          gridLines: true,
          headerStyle: 'bold',
        },
      },
    },
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Space-efficient layout perfect for dense schedules',
    icon: '📊',
    config: {
      preset: 'compact',
      pageSetup: {
        size: 'A4',
        orientation: 'landscape',
        margins: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10,
        },
      },
      styling: {
        fontFamily: 'Courier',
        fontSize: {
          base: 8,
          header: 10,
          title: 12,
        },
        colors: {
          primary: '#000000',
          secondary: '#666666',
          background: '#ffffff',
          text: '#000000',
          border: '#999999',
          headerBackground: '#e5e7eb',
          headerText: '#000000',
        },
        spacing: {
          cellPadding: 4,
          rowHeight: 18,
          borderWidth: 0.5,
        },
        tableStyle: {
          alternateRows: true,
          gridLines: true,
          headerStyle: 'bold',
        },
      },
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Fully customizable layout with all options available',
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
    const { base, header, title } = config.styling.fontSize;
    if (base && (base < 6 || base > 20)) {
      errors.push('Base font size must be between 6 and 20');
    }
    if (header && (header < 8 || header > 24)) {
      errors.push('Header font size must be between 8 and 24');
    }
    if (title && (title < 12 || title > 36)) {
      errors.push('Title font size must be between 12 and 36');
    }
  }
  
  return errors;
}
