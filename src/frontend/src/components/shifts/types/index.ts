import { Settings } from "@/types";
import { Shift } from "@/services/api";
import { TimeRange } from "@/components/core/shifts/utils/timeCalculator";

// Re-export TimeRange from utils to avoid duplication
export type { TimeRange };

export interface ShiftDebugInfo {
  id: number;
  startTime: string;
  endTime: string;
  startX: number;
  width: number;
  day: number;
}

export interface PositioningDetails {
  x: number;
  width: number;
}

// Import and re-export EnhancedShift from views to avoid duplication
import { EnhancedShift as ViewsEnhancedShift } from "../views/types";
export type { ViewsEnhancedShift as EnhancedShift };

// Re-export ShiftEditorProps from shift-templates
export type { ShiftTemplateEditorProps } from "@/components/shift-templates";
