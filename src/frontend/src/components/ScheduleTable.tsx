import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AbsenceInfo,
  checkEmployeeAvailabilityForDate,
  createSchedule,
  getEmployees,
  getSettings,
} from "@/services/api";
import { Employee, Schedule, ScheduleUpdate } from "@/types";
import { WeekInfo } from "@/utils/weekUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isWithinInterval, parseISO } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Edit2,
  GripVertical,
  Info,
  Key,
  Maximize2,
  Minimize2,
  Plus,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDrag, useDrop } from "react-dnd";
import { AddScheduleDialog } from "./Schedule/AddScheduleDialog";
import { ShiftEditModal } from "./ShiftEditModal";

// Define proper types for absences
interface AbsenceRecord {
  id: number;
  employee_id: number;
  absence_type_id: string;
  start_date: string;
  end_date: string;
  note?: string;
}

interface ScheduleTableProps {
  schedules: Schedule[];
  dateRange: DateRange | undefined;
  onDrop: (
    scheduleId: number,
    newEmployeeId: number,
    newDate: Date,
    newShiftId: number,
  ) => Promise<void>;
  onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
  isLoading: boolean;
  employeeAbsences?: Record<number, AbsenceRecord[]>;
  absenceTypes?: Array<{
    id: string;
    name: string;
    color: string;
    type: "absence";
  }>;
  currentVersion?: number;
  openingDays: number[];
  // Week navigation props for fullscreen mode
  weekInfo?: WeekInfo;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  weekNavigationSettings?: {
    weekendStart?: number;
    monthBoundaryMode?: string;
  };
}

interface DragItem {
  type: "SCHEDULE";
  scheduleId?: number;
  employeeId: number;
  shiftId: number | null;
  date: string;
  shift_type_id?: string; // EARLY, MIDDLE, LATE
  isDockItem?: boolean; // Flag to indicate this is from the dock
}

// Helper function to determine if a schedule is empty (no shift assigned)
const isEmptySchedule = (schedule: Schedule | undefined) => {
  return !schedule || schedule.shift_id === null;
};

// === CENTRALIZED TIME CALCULATION FUNCTIONS (GLOBAL SCOPE) ===

// Convert time string to minutes
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

// Convert minutes to time string
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Add minutes to a time string
const addMinutes = (timeStr: string, minutes: number): string => {
  const totalMinutes = timeToMinutes(timeStr) + minutes;
  return minutesToTime(totalMinutes % (24 * 60)); // Handle day overflow
};

// Subtract minutes from a time string
const subtractMinutes = (timeStr: string, minutes: number): string => {
  const totalMinutes = timeToMinutes(timeStr) - minutes;
  return minutesToTime(totalMinutes >= 0 ? totalMinutes : totalMinutes + (24 * 60)); // Handle day underflow
};

// Core duration calculation function
const calculateBaseDuration = (startTime: string, endTime: string): number => {
  try {
    const startMinutes = timeToMinutes(startTime);
    let endMinutes = timeToMinutes(endTime);
    
    // Handle overnight shifts
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    
    return (endMinutes - startMinutes) / 60; // Return in hours
  } catch {
    return 0;
  }
};

// Calculate break duration with auto 30min rule for >6h shifts
const calculateBreakDuration = (schedule: Schedule, employee?: Employee, settings?: unknown): number => {
  try {
    // Priority 1: Manual break times
    if (schedule.break_start && schedule.break_end) {
      return calculateBaseDuration(schedule.break_start, schedule.break_end);
    }
    
    // Priority 2: Stored break_duration (convert from minutes to hours)
    if (schedule.break_duration && schedule.break_duration > 0) {
      return schedule.break_duration / 60;
    }
    
    // Priority 3: Auto-calculate based on shift duration (30min for >6h)
    // For keyholders, the extra opening/closing time counts as additional break time
    let shiftDuration: number;
    if (schedule.shift_start && schedule.shift_end) {
      shiftDuration = calculateBaseDuration(schedule.shift_start, schedule.shift_end);
    } else {
      return 0;
    }
    
    // Base break calculation: 30min for >6h shifts
    let baseBreak = shiftDuration > 6 ? 0.5 : 0;
    
    // For keyholders, add the extra time as additional break
    if (employee && settings && employee.is_keyholder && schedule.shift_start && schedule.shift_end) {
      const { startTime, endTime } = getKeyholderAdjustedTimes(schedule, employee, settings);
      const totalDuration = calculateBaseDuration(startTime, endTime);
      const extraTime = totalDuration - shiftDuration;
      
      // Add keyholder extra time as break time
      baseBreak += extraTime;
    }
    
    return baseBreak;
  } catch {
    return 0;
  }
};

// Get keyholder-adjusted times for a schedule
const getKeyholderAdjustedTimes = (
  schedule: Schedule, 
  employee: Employee | undefined, 
  settings?: unknown
): { startTime: string, endTime: string } => {
  
  if (!employee?.is_keyholder || !schedule.shift_start || !schedule.shift_end || !(settings as any)?.general) {
    return { startTime: schedule.shift_start || "", endTime: schedule.shift_end || "" };
  }
  
  const { keyholder_before_minutes = 5, keyholder_after_minutes = 10, store_opening, store_closing } = (settings as any).general;
  
  let adjustedStart = schedule.shift_start;
  let adjustedEnd = schedule.shift_end;
  
  // Early shift adjustment (EARLY type or starts at/before store opening)
  if (schedule.shift_type_id === 'EARLY' || 
      (store_opening && schedule.shift_start <= store_opening)) {
    adjustedStart = subtractMinutes(schedule.shift_start, keyholder_before_minutes);
  }
  
  // Late shift adjustment (LATE type or ends at/after store closing)
  if (schedule.shift_type_id === 'LATE' || 
      (store_closing && schedule.shift_end >= store_closing)) {
    adjustedEnd = addMinutes(schedule.shift_end, keyholder_after_minutes);
  }
  
  return { startTime: adjustedStart, endTime: adjustedEnd };
};

// Calculate final working time with all adjustments
const calculateWorkingTime = (
  schedule: Schedule, 
  employee: Employee | undefined, 
  settings?: unknown
): { totalTime: number, breakTime: number, workingTime: number } => {
  
  if (!schedule.shift_start || !schedule.shift_end) {
    return { totalTime: 0, breakTime: 0, workingTime: 0 };
  }
  
  const { startTime, endTime } = getKeyholderAdjustedTimes(schedule, employee, settings);
  
  const totalTime = calculateBaseDuration(startTime, endTime);
  const breakTime = calculateBreakDuration(schedule, employee, settings);
  const workingTime = Math.max(0, totalTime - breakTime);
  
  return { totalTime, breakTime, workingTime };
};

// Format duration for display in HH:MM format
const formatTimeHourMin = (hours: number): string => {
  if (hours === 0) return "0:00";
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  // Handle case where minutes rounds to 60 or more
  if (minutes >= 60) {
    return `${wholeHours + Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, '0')}`;
  }
  
  return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
};

// === END CENTRALIZED TIME CALCULATION FUNCTIONS ===

// TimeSlotDisplay Component
interface TimeSlotDisplayProps {
  startTime: string;
  endTime: string;
  shiftType: string;
  settings?: unknown;
  schedule: Schedule;
  employee: Employee | undefined;
}

const TimeSlotDisplay = ({
  startTime,
  endTime,
  shiftType,
  settings,
  schedule,
  employee,
}: TimeSlotDisplayProps) => {
  // Calculate duration from start and end times if not provided
  const calculateDuration = (start: string, end: string): number => {
    try {
      const [startHours, startMinutes] = start.split(":").map(Number);
      const [endHours, endMinutes] = end.split(":").map(Number);
      
      const startTotalMinutes = startHours * 60 + startMinutes;
      let endTotalMinutes = endHours * 60 + endMinutes;
      
      // Handle overnight shifts
      if (endTotalMinutes < startTotalMinutes) {
        endTotalMinutes += 24 * 60;
      }
      
      return (endTotalMinutes - startTotalMinutes) / 60;
    } catch {
      return 0;
    }
  };

  // Check if this is a keyholder shift
  const isKeyholderShift = employee?.is_keyholder && schedule?.shift_id;
  
  // Calculate adjusted times for keyholder shifts
  const getAdjustedTimes = () => {
    if (!isKeyholderShift || !startTime || !endTime || !(settings as any)?.general) {
      return { adjustedStartTime: startTime, adjustedEndTime: endTime };
    }

    const keyholderBeforeMinutes = (settings as any).general.keyholder_before_minutes || 5;
    const keyholderAfterMinutes = (settings as any).general.keyholder_after_minutes || 10;
    const storeOpening = (settings as any).general.store_opening;
    const storeClosing = (settings as any).general.store_closing;

    let adjustedStartTime = startTime;
    let adjustedEndTime = endTime;

    // Check if this is an opening shift (starts at store opening time)
    if (startTime === storeOpening) {
      const [hours, minutes] = startTime.split(":").map(Number);
      const adjustedMinutes = hours * 60 + minutes - keyholderBeforeMinutes;
      const newHours = Math.floor(adjustedMinutes / 60);
      const newMinutes = adjustedMinutes % 60;
      adjustedStartTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    }

    // Check if this is a closing shift (ends at store closing time)
    if (endTime === storeClosing) {
      const [hours, minutes] = endTime.split(":").map(Number);
      const adjustedMinutes = hours * 60 + minutes + keyholderAfterMinutes;
      const newHours = Math.floor(adjustedMinutes / 60);
      const newMinutes = adjustedMinutes % 60;
      adjustedEndTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    }

    return { adjustedStartTime, adjustedEndTime };
  };

  const getDuration = () => {
    const { adjustedStartTime, adjustedEndTime } = getAdjustedTimes();
    if (!adjustedStartTime || !adjustedEndTime) return 0;
    return calculateDuration(adjustedStartTime, adjustedEndTime);
  };

  // Determine shift type from multiple sources with enhanced logic
  const getEffectiveShiftType = (): string => {
    // Priority: explicit shiftType > schedule.shift_type_id > calculated from times
    if (shiftType) return shiftType;
    if (schedule?.shift_type_id) return schedule.shift_type_id;
    
    // Calculate from shift_type_name
    if (schedule?.shift_type_name) {
      const name = schedule.shift_type_name.toLowerCase();
      if (name.includes("früh") || name.includes("early")) return "EARLY";
      if (name.includes("spät") || name.includes("late")) return "LATE";
      if (name.includes("mitte") || name.includes("middle")) return "MIDDLE";
    }
    
    // Calculate from start and end times using user rules:
    // EARLY: if start time is 09:00 or 10:00
    // LATE: if end time is 19:00 or 20:00
    // MIDDLE: for any shift that is neither EARLY nor LATE
    if (startTime && endTime) {
      const [startHours] = startTime.split(":").map(Number);
      const [endHours] = endTime.split(":").map(Number);
      
      // Check for EARLY shift (start time is 09:00 or 10:00)
      if (startHours === 9 || startHours === 10) {
        return "EARLY";
      }
      
      // Check for LATE shift (end time is 19:00 or 20:00)
      if (endHours === 19 || endHours === 20) {
        return "LATE";
      }
      
      // Everything else is MIDDLE
      return "MIDDLE";
    }
    
    return "MIDDLE"; // Default fallback
  };

  // Add a more visible diagnostic indicator for missing time data
  const hasMissingTimeData = (!startTime || !endTime) && schedule?.shift_id;

  // Enhanced debug logging for time slot display
  // Remove debug logging for production

  // Get adjusted times for display
  const { adjustedStartTime, adjustedEndTime } = getAdjustedTimes();
  
  // Handle missing time data by using default placeholder times
  const displayStartTime = adjustedStartTime || startTime || "??:??";
  const displayEndTime = adjustedEndTime || endTime || "??:??";
  const effectiveShiftType = getEffectiveShiftType();
  const duration = getDuration();

  // Get shift type color matching dock items
  const getShiftTypeColor = (shiftType: string) => {
    switch (shiftType) {
      case "EARLY": return "bg-blue-500/20 text-blue-700 border-blue-500/30";
      case "MIDDLE": return "bg-green-500/20 text-green-700 border-green-500/30";
      case "LATE": return "bg-amber-500/20 text-amber-700 border-amber-500/30";
      default: return "bg-slate-500/20 text-slate-700 border-slate-500/30";
    }
  };

  const getShiftTypeName = (shiftType: string) => {
    switch (shiftType) {
      case "EARLY": return "Früh";
      case "MIDDLE": return "Mitte";
      case "LATE": return "Spät";
      case "NO_WORK": return "Kein Dienst";
      case "UNAVAILABLE": return "Nicht verfügbar";
      default: return "Schicht";
    }
  };

  // Format duration for display
  const formatDuration = (hours: number): string => {
    if (hours === 0) return "";
    if (hours === Math.floor(hours)) {
      return `${hours}h`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    if (minutes === 0) {
      return `${wholeHours}h`;
    }
    return `${wholeHours}h ${minutes}m`;
  };

  // Handle the case where we have a schedule with ID but no time data
  if (hasMissingTimeData) {
    const shiftTypeName = schedule?.shift_type_name || getShiftTypeName(effectiveShiftType);

    return (
      <div className="flex flex-col items-center p-3 rounded-lg border border-border bg-card min-w-[100px] select-none">
        <GripVertical className="h-4 w-4 text-muted-foreground mb-1" />
        <div className="text-sm font-medium text-center mb-2">
          {shiftTypeName}
        </div>
        <div className="flex flex-col gap-1 items-center">
          <Badge
            variant="secondary"
            className={cn("text-xs font-medium", getShiftTypeColor(effectiveShiftType))}
          >
            {getShiftTypeName(effectiveShiftType)}
          </Badge>
          <div className="text-xs text-muted-foreground">
            Zeiten fehlen
          </div>
          {duration > 0 && (
            <div className="text-xs text-muted-foreground font-medium">
              {formatDuration(duration)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-all min-w-[100px] select-none">
      <div className="flex items-center gap-1 mb-1">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        {isKeyholderShift && (
          <Key className="h-4 w-4 text-amber-600" />
        )}
      </div>
      <div className="text-sm font-medium text-center mb-2">
        {displayStartTime} - {displayEndTime}
      </div>
      <div className="flex flex-col gap-1 items-center">
        <Badge
          variant="secondary"
          className={cn(
            "text-xs font-medium", 
            getShiftTypeColor(effectiveShiftType)
          )}
        >
          {getShiftTypeName(effectiveShiftType)}
        </Badge>
        {duration > 0 && (
          <div className="text-xs text-muted-foreground font-medium">
            {(() => {
              if (schedule) {
                // Use the centralized function that handles keyholder adjustments properly
                const timeCalc = calculateWorkingTime(schedule, employee, settings);
                const workingTimeFormatted = formatTimeHourMin(timeCalc.workingTime);
                const breakTimeFormatted = formatTimeHourMin(timeCalc.breakTime);
                return `${workingTimeFormatted} / ${breakTimeFormatted}`;
              }
              return formatDuration(duration);
            })()}
          </div>
        )}
        {schedule?.break_start && schedule?.break_end && (
          <div className="text-xs text-muted-foreground">
            Pause: {schedule.break_start} - {schedule.break_end}
          </div>
        )}
      </div>
    </div>
  );
};

// ScheduleCell component with improved shift data handling
const ScheduleCell = ({
  schedule,
  onDrop,
  onUpdate,
  hasAbsence,
  employeeId,
  date,
  currentVersion,
}: {
  schedule: Schedule | undefined;
  onDrop: (
    scheduleId: number,
    newEmployeeId: number,
    newDate: Date,
    newShiftId: number,
  ) => Promise<void>;
  onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
  hasAbsence?: boolean;
  employeeId: number;
  date: Date;
  currentVersion?: number;
}) => {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC OR EARLY RETURNS
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [employeeAvailable, setEmployeeAvailable] = useState<boolean | null>(null);
  const [absenceInfo, setAbsenceInfo] = useState<AbsenceInfo | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const queryClient = useQueryClient();
  
  // Get employee data
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  // Get settings for keyholder calculations
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const employee = employees?.find(emp => emp.id === employeeId);
  
  // Add drag functionality for existing schedules
  const [{ isDragging }, drag] = useDrag({
    type: "SCHEDULE",
    item: (): DragItem | null => {
      if (!schedule || schedule.shift_id === null) return null;
      return {
        type: "SCHEDULE",
        scheduleId: schedule.id,
        employeeId: schedule.employee_id,
        shiftId: schedule.shift_id,
        date: schedule.date,
        shift_type_id: schedule.shift_type_id,
        isDockItem: false,
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: () => {
      // Don't allow dragging if schedule is empty or employee is unavailable
      return !isEmptySchedule(schedule) && employeeAvailable !== false;
    },
  });

  // Add drop zone functionality for dock items - ALWAYS call this hook second
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: "SCHEDULE",
    canDrop: () => {
      // Don't allow dropping if employee is unavailable
      return employeeAvailable !== false;
    },
    drop: (item: DragItem) => {
      // Check availability before allowing drop
      if (employeeAvailable === false) {
        // Employee is unavailable on this date
        return;
      }
      
      // Handle dock items differently than existing schedule items
      if (item.isDockItem) {
        // For dock items, we need to create a new schedule
        if (item.shiftId && item.shiftId > 0) {
          // This is a shift being dropped from the dock onto an employee cell
          
          // Call the dock drop handler through a global mechanism or context
          // For now, we'll use a custom event to communicate with the parent
          const dockDropEvent = new CustomEvent('dockDrop', {
            detail: { employeeId, date, shiftId: item.shiftId }
          });
          window.dispatchEvent(dockDropEvent);
        } else if (item.employeeId && item.employeeId > 0) {
          // This is an employee being dropped from the dock (not yet implemented)
          // Employee dock drop not yet implemented
        }
      } else {
        // Handle existing schedule items (original behavior)
        if (item.scheduleId) {
          onDrop(item.scheduleId, employeeId, date, item.shiftId || 0);
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Combine drag and drop refs
  const dragDropRef = (node: HTMLDivElement | null) => {
    drag(node);
    drop(node);
  };

  // Log debug info for all schedules to diagnose rendering issues
  useEffect(() => {
    if (schedule) {
      // Debug output for cell availability
      if (employee?.first_name === "Maike" && date.getDay() === 5) { // Friday is 5 in JS
        // Show debug info in the cell for Maike on Friday
        (window as { maikeFridayDebug?: object }).maikeFridayDebug = {
          employeeId,
          date: date.toLocaleDateString(),
          employeeAvailable,
        };
      }
    }
  }, [schedule, date, employeeAvailable, employee, employeeId]);

  
  useEffect(() => {
    const checkAvailability = async () => {
      setAvailabilityLoading(true);
      
      // Check cache first
      const cachedResult = getCachedAvailability(employeeId, date);
      if (cachedResult !== null) {
        setEmployeeAvailable(cachedResult);
        setAbsenceInfo(null); // Clear absence info for cached results
        setAvailabilityLoading(false);
        return;
      }
      
      try {
        const formattedDate = format(date, "yyyy-MM-dd");
        const result = await checkEmployeeAvailabilityForDate(employeeId, formattedDate);
        
        // The API returns an object with is_available property
        const isAvailable = result.is_available;
        setEmployeeAvailable(isAvailable);
        setAbsenceInfo(result.absence_info || null);
        setCachedAvailability(employeeId, date, isAvailable);
        
        
      } catch {
        // Default to available on error but log the issue
        setEmployeeAvailable(true);
      } finally {
        setAvailabilityLoading(false);
      }
    };
    
    checkAvailability();
  }, [employeeId, date]);

  // Check if this is an empty schedule (no shift assigned)
  if (isEmptySchedule(schedule)) {
    // Check if employee is unavailable or still loading
    const isUnavailable = employeeAvailable === false;
    const isLoading = availabilityLoading;
    
    // Render empty cell with loading state, unavailable indicator, or + button
    return (
      <div
        ref={isUnavailable ? undefined : drop}
        className={cn(
          "relative h-full min-h-[80px] p-2 transition-colors",
          isUnavailable ? "cursor-not-allowed" : "",
          !isUnavailable && !isLoading && isOver && canDrop && "bg-primary/10 border-primary/30",
          !isUnavailable && !isLoading && isOver && !canDrop && "bg-destructive/10 border-destructive/30"
        )}
        onMouseEnter={() => !isUnavailable && !isLoading && setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
            <span className="text-xs text-gray-500 mt-1">Checking...</span>
          </div>
        )}
        
        {!isLoading && isUnavailable && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {absenceInfo ? (
              <Badge 
                style={{ 
                  backgroundColor: absenceInfo.absence_type_color + '20', 
                  borderColor: absenceInfo.absence_type_color,
                  color: absenceInfo.absence_type_color 
                }}
                className="text-xs font-medium border"
              >
                {absenceInfo.absence_type_name}
              </Badge>
            ) : (
              <span className="text-xs text-red-700 px-2 py-1 rounded font-medium opacity-90">
                Nicht verfügbar
              </span>
            )}
            {/* Debug info for specific employee */}
            {employeeId === 9 && date.getDay() === 2 && (
              <span className="text-[10px] text-gray-400 mt-1">Debug: {String(employeeAvailable)}</span>
            )}
          </div>
        )}
        
        {!isLoading && !isUnavailable && hasAbsence && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-orange-700 px-2 py-1 rounded font-medium opacity-90">
              Abwesend
            </span>
          </div>
        )}
        
        {!isLoading && !isUnavailable && !hasAbsence && showActions && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsAddModalOpen(true)}
              aria-label="Add schedule"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* AddScheduleDialog is now always rendered, visibility controlled by isOpen prop */}
        <AddScheduleDialog
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAddSchedule={async (scheduleData) => {
            try {
              // If we have an existing schedule, update it
              if (schedule?.id) {
                await onUpdate(schedule.id, {
                  shift_id: scheduleData.shift_id,
                  version: scheduleData.version,
                });
              } else {
                // Otherwise, create a new schedule entry
                const newScheduleData = {
                  employee_id: employeeId,
                  date: format(date, "yyyy-MM-dd"),
                  shift_id: scheduleData.shift_id,
                  version: currentVersion || 1,
                };

                // Create schedule via API
                const createdSchedule = await createSchedule(newScheduleData);
                
                // Invalidate the schedules cache to trigger a refetch
                await queryClient.invalidateQueries({ queryKey: ['schedules'] });
              }
              // Close the modal after successful operation
              setIsAddModalOpen(false);
            } catch (error) {
              console.error("Failed to add/update schedule:", error);
              // Re-throw the error so the AddScheduleDialog can handle it properly
              throw error;
            }
          }}
          defaultEmployeeId={employeeId}
          defaultDate={date}
          version={currentVersion || 1}
        />
      </div>
    );
  }

  return (
    <div
      ref={dragDropRef}
      className={cn(
        "relative h-full min-h-[80px] p-2 transition-colors",
        isOver && canDrop && "bg-primary/10 border-primary/30",
        isOver && !canDrop && "bg-destructive/10 border-destructive/30",
        isDragging && "opacity-50 scale-95",
        !isEmptySchedule(schedule) && employeeAvailable !== false && "cursor-move",
        employeeAvailable === false && "opacity-60"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Show unavailability indicator if employee is unavailable */}
      {employeeAvailable === false && (
        <div className="absolute top-1 left-1 z-10">
          <span className="text-xs text-red-800 px-1 py-0.5 rounded font-medium opacity-75">
            N/V
          </span>
        </div>
      )}
      
      {/* Show absence indicator if employee has absence */}
      {hasAbsence && (
        <div className="absolute top-1 right-1 z-10">
          <span className="text-xs text-orange-800 px-1 py-0.5 rounded font-medium opacity-75">
            Abw
          </span>
        </div>
      )}
      
      {/* Show loading indicator while checking availability */}
      {availabilityLoading && (
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2 z-10">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
        </div>
      )}
      
      <div className="flex flex-col items-center justify-center h-full">
        <TimeSlotDisplay
          startTime={schedule?.shift_start}
          endTime={schedule?.shift_end}
          shiftType={schedule?.shift_type_id}
          schedule={schedule}
          employee={employee}
          settings={settings}
        />
      </div>

      {/* Actions buttons on hover - only show if employee is available */}
      {showActions && employeeAvailable !== false && !availabilityLoading && (
        <div className="absolute top-1 right-1 flex space-x-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={async () => {
              if (schedule?.id) {
                // Add confirmation before deletion
                if (
                  confirm(
                    `Sind Sie sicher, dass Sie diese Schicht löschen möchten?`,
                  )
                ) {
                  console.log("🗑️ Deleting shift with ID:", schedule.id);
                  try {
                    await onUpdate(schedule.id, {
                      shift_id: null,
                      // Make sure to pass the current version
                      ...(currentVersion ? { version: currentVersion } : {}),
                      // Add employee_id to ensure proper identification
                      employee_id: schedule.employee_id,
                    });
                    console.log(
                      "🗑️ Delete request sent successfully for shift ID:",
                      schedule.id,
                    );
                  } catch (error) {
                    console.error("❌ Error deleting shift:", error);
                    alert(
                      "Fehler beim Löschen der Schicht. Bitte versuchen Sie es erneut.",
                    );
                  }
                }
              }
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* ShiftEditModal is now always rendered, visibility controlled by isOpen prop */}
      {/* Ensure schedule and currentVersion are valid before allowing the modal to open */}
      <ShiftEditModal
        isOpen={isEditModalOpen && !!schedule && !!currentVersion}
        onClose={() => setIsEditModalOpen(false)}
        schedule={schedule!}
        currentVersion={currentVersion}
        onSave={async (scheduleId, updates) => {
          // Need null/undefined check for schedule.id here as schedule might be undefined
          if (schedule?.id) {
            await onUpdate(schedule.id, updates);
            setIsEditModalOpen(false);
          } else {
            console.error("Attempted to update schedule with undefined ID");
            setIsEditModalOpen(false); // Close modal even on error
          }
        }}
      />
    </div>
  );
};

// Employee Statistics Component for Hover Card
interface EmployeeStatisticsProps {
  employeeId: number;
  schedules: Schedule[];
  contractedHours: number;
  employeeGroup?: string;
}

function EmployeeStatistics({ employeeId, schedules, contractedHours, employeeGroup }: EmployeeStatisticsProps) {
  const hours = useMemo(() => {
    // Calculate hours for this employee across all schedules
    const employeeSchedules = schedules.filter(
      (s) => s.employee_id === employeeId && s.shift_id !== null && !s.is_empty
    );

    let totalHours = 0;

    employeeSchedules.forEach((schedule) => {
      if (!schedule.shift_start || !schedule.shift_end || !schedule.date) return;

      try {
        // Simple hour calculation without date range filtering for hover card
        const startTime = parseISO(`${schedule.date}T${schedule.shift_start}`);
        const endTime = parseISO(`${schedule.date}T${schedule.shift_end}`);
        const diffInHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        totalHours += diffInHours;
      } catch (error) {
        console.error("Error calculating hours for schedule:", error);
      }
    });

    return { 
      weeklyHours: totalHours, 
      monthlyHours: totalHours, 
      totalHours: totalHours 
    };
  }, [employeeId, schedules]);

  const shiftCount = useMemo(() => {
    return schedules.filter(s => s.employee_id === employeeId && s.shift_id !== null).length;
  }, [employeeId, schedules]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Mitarbeiter Statistiken</h4>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vertragsstunden:</span>
            <span className="font-medium">{contractedHours}h/Woche</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Geplante Stunden:</span>
            <span className="font-medium">{hours.weeklyHours.toFixed(1)}h</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auslastung:</span>
            <span className={cn(
              "font-medium px-2 py-1 rounded text-xs",
              hours.weeklyHours > contractedHours ? "text-red-700 bg-red-100" : 
              hours.weeklyHours < contractedHours * 0.9 ? "text-amber-700 bg-amber-100" : 
              "text-green-700 bg-green-100"
            )}>
              {((hours.weeklyHours / contractedHours) * 100).toFixed(0)}%
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Anzahl Schichten:</span>
            <span className="font-medium">{shiftCount}</span>
          </div>
          
          {employeeGroup && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gruppe:</span>
              <span className="font-medium">{employeeGroup}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to check if an employee has an absence for a given date
const checkForAbsence = (
  employeeId: number,
  dateString: string,
  employeeAbsences?: Record<number, AbsenceRecord[]>,
  absenceTypes?: Array<{
    id: string;
    name: string;
    color: string;
    type: string;
  }>,
) => {
  if (!employeeAbsences || !absenceTypes) return null;

  const absences = employeeAbsences[employeeId] || [];
  const matchingAbsence = absences.find((absence) => {
    const absenceStartDate = absence.start_date.split("T")[0];
    const absenceEndDate = absence.end_date.split("T")[0];
    const checkDate = dateString;

    return checkDate >= absenceStartDate && checkDate <= absenceEndDate;
  });

  if (matchingAbsence) {
    const absenceType = absenceTypes.find(
      (type) => type.id === matchingAbsence.absence_type_id,
    );
    if (absenceType) {
      return {
        absence: matchingAbsence,
        type: absenceType,
      };
    }
  }

  return null;
};

// Main ScheduleTable component
const calculateEmployeeHours = (
  employeeId: number,
  schedules: Schedule[],
  dateRange: DateRange | undefined,
  employees?: Employee[],
  settings?: { general?: { keyholder_before_minutes?: number; keyholder_after_minutes?: number; store_opening?: string; store_closing?: string } }
) => {
  if (!dateRange?.from || !dateRange?.to) {
    return { weeklyHours: 0, monthlyHours: 0, totalHours: 0 };
  }

  const employeeSchedules = schedules.filter(
    (s) => s.employee_id === employeeId && s.shift_id !== null && !s.is_empty
  );

  // Find the employee for keyholder calculations
  const employee = employees?.find(emp => emp.id === employeeId);

  let totalHours = 0;

  employeeSchedules.forEach((schedule) => {
    if (!schedule.shift_start || !schedule.shift_end || !schedule.date) return;

    try {
      const scheduleDate = parseISO(schedule.date);
      
      // Only include schedules within the actual displayed date range
      if (isWithinInterval(scheduleDate, { start: dateRange.from, end: dateRange.to })) {
        // Use the centralized calculateWorkingTime function that handles breaks and keyholder adjustments
        const timeCalc = calculateWorkingTime(schedule, employee, settings);
        const workingHours = timeCalc.workingTime;
        
        totalHours += workingHours;
      }
    } catch (error) {
      console.error("Error calculating hours for schedule:", error);
    }
  });

  // For weekly/monthly views, the total hours within the date range IS the weekly/monthly total
  return { 
    weeklyHours: totalHours, 
    monthlyHours: totalHours, 
    totalHours: totalHours 
  };
};

export function ScheduleTable({
  schedules,
  dateRange,
  onDrop,
  onUpdate,
  isLoading,
  employeeAbsences,
  absenceTypes,
  currentVersion,
  openingDays,
  // Week navigation props
  weekInfo,
  onNavigatePrevious,
  onNavigateNext,
  weekNavigationSettings,
}: ScheduleTableProps) {
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [currentDayOffset, setCurrentDayOffset] = useState(0);
  const [employeeSortBy, setEmployeeSortBy] = useState<"name" | "group" | "hours" | "alphabetical" | "keyholder" | "shifts" | "workload">("alphabetical");
  const [employeeSortOrder, setEmployeeSortOrder] = useState<"asc" | "desc">("asc");
  
  // Enhanced debugging for schedule data
  console.log("🔴 DEBUG: RENDERING ScheduleTable with:", {
    schedulesCount: schedules.length,
    dateRange,
    isLoading,
    employeeAbsencesCount: employeeAbsences
      ? Object.keys(employeeAbsences).length
      : 0,
    absenceTypesCount: absenceTypes ? absenceTypes.length : 0,
    currentVersion,
    firstFewSchedules: schedules.slice(0, 5),
  });

  // Debug log for detailed table structure with more specific counts
  const schedulesWithShiftId = schedules.filter((s) => s.shift_id !== null);
  const schedulesWithTimes = schedules.filter(
    (s) => s.shift_start !== null && s.shift_end !== null,
  );
  const problemSchedules = schedulesWithShiftId.filter(
    (s) => !s.shift_start || !s.shift_end,
  );

  console.log("🔴 DEBUG: Schedule Data Analysis:", {
    totalSchedules: schedules.length,
    withShiftId: schedulesWithShiftId.length,
    withTimes: schedulesWithTimes.length,
    problemSchedules: problemSchedules.length,
    exampleProblemSchedule:
      problemSchedules.length > 0 ? problemSchedules[0] : "None",
  });

  // If we have problem schedules, log them all for diagnosis
  if (problemSchedules.length > 0) {
    console.log(
      "🔴 Problem Schedules (up to 10):",
      problemSchedules.slice(0, 10),
    );
  }

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Fetch employee data to display names properly
  const { data: employeesData } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const employees = useMemo(() => {
    return employeesData || [];
  }, [employeesData]);

  // Employee lookup for quick access
  const employeeLookup = useMemo(() => {
    if (!employees) return {};

    return employees.reduce(
      (acc, employee) => {
        acc[employee.id] = employee;
        return acc;
      },
      {} as Record<number, Employee>,
    );
  }, [employees]);

  const daysToDisplay = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return [];
    }
    const start = dateRange.from;
    const end = dateRange.to;
    const days: Date[] = [];
    let currentDate = new Date(start);
    while (currentDate <= end) {
      // Check if the current day's index is in the openingDays array
      const dayIndex = currentDate.getDay(); // Sunday=0, Monday=1, ..., Saturday=6
      // Convert Sunday=0 to 6, Monday=1 to 0, ..., Saturday=6 to 5 to match openingDays
      const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      if (openingDays.includes(adjustedDayIndex)) {
        days.push(new Date(currentDate));
      }
      currentDate = addDays(currentDate, 1);
    }
    return days;
  }, [dateRange, openingDays]);

  // Calculate max days to show: always 7 for week view
  const maxDaysToShow = 7;

  // Calculate visible days for current page
  const visibleDaysToDisplay = useMemo(() => {
    return daysToDisplay.slice(currentDayOffset, currentDayOffset + maxDaysToShow);
  }, [daysToDisplay, currentDayOffset]);

  // Navigation handlers
  const handlePrevDays = () => {
    setCurrentDayOffset(Math.max(0, currentDayOffset - maxDaysToShow));
  };

  const handleNextDays = () => {
    const maxOffset = Math.max(0, daysToDisplay.length - maxDaysToShow);
    setCurrentDayOffset(Math.min(maxOffset, currentDayOffset + maxDaysToShow));
  };

  // Reset day offset when date range changes
  useEffect(() => {
    setCurrentDayOffset(0);
  }, [dateRange]);

  // Check if navigation is needed
  const showNavigation = daysToDisplay.length > maxDaysToShow;

  // Map for German weekday abbreviations
  const weekdayAbbr: { [key: string]: string } = {
    Monday: "Mo.",
    Tuesday: "Di.",
    Wednesday: "Mi.",
    Thursday: "Do.",
    Friday: "Fr.",
    Saturday: "Sa.",
    Sunday: "So.",
  };

  // SIMPLIFIED APPROACH: Create a direct lookup map from employee_id and date to schedule
  const scheduleMap = useMemo(() => {
    const map: Record<number, Record<string, Schedule>> = {};

    // Debug info - what are we working with?
    const shiftsWithId = schedules.filter((s) => s.shift_id !== null);
    const shiftsWithStartTime = schedules.filter(
      (s) => s.shift_start !== null && s.shift_start !== undefined,
    );

    console.log("🔍 ScheduleTable creating map with:", {
      totalSchedules: schedules.length,
      schedulesWithShiftId: shiftsWithId.length,
      schedulesWithStartTime: shiftsWithStartTime.length,
      firstShiftWithId: shiftsWithId.length > 0 ? shiftsWithId[0] : "None",
      firstShiftWithStartTime:
        shiftsWithStartTime.length > 0 ? shiftsWithStartTime[0] : "None",
    });

    // Process all schedules into the map for quick lookup
    schedules.forEach((schedule) => {
      const employeeId = schedule.employee_id;

      // Normalize the date format by stripping any time component
      const dateStr = schedule.date.split("T")[0];

      // Initialize the employee map if it doesn't exist
      if (!map[employeeId]) {
        map[employeeId] = {};
      }

      // Store the schedule by date - important: if an entry exists, replace it only if the new one has a shift_id and the old one doesn't
      const existingSchedule = map[employeeId][dateStr];
      if (
        !existingSchedule ||
        (schedule.shift_id !== null && existingSchedule.shift_id === null) ||
        (schedule.shift_start && !existingSchedule.shift_start)
      ) {
        map[employeeId][dateStr] = schedule;
      }
    });

    // Count of schedules with shift_id and shift_start
    const schedulesWithShifts = Object.values(map)
      .flatMap((empSchedules) => Object.values(empSchedules))
      .filter((s) => s.shift_id !== null);

    const schedulesWithStartTime = schedulesWithShifts.filter(
      (s) => s.shift_start !== null && s.shift_start !== undefined,
    );

    console.log("🗺️ Schedule map created with:", {
      totalEmployees: Object.keys(map).length,
      sampleEmployee: Object.keys(map)[0] ? Object.keys(map)[0] : "None",
      totalSchedules: schedules.length,
      schedulesWithShifts: schedulesWithShifts.length,
      schedulesWithStartTime: schedulesWithStartTime.length,
      sampleShift:
        schedulesWithShifts.length > 0 ? schedulesWithShifts[0] : "None",
    });

    return map;
  }, [schedules]);

  // Get unique employees from schedules
  const uniqueEmployees = useMemo(() => {
    const employeeSet = new Set<number>();
    schedules.forEach((schedule) => {
      employeeSet.add(schedule.employee_id);
    });
    return Array.from(employeeSet);
  }, [schedules]);

  const uniqueEmployeeIds = useMemo(() => {
    const ids = [...new Set(schedules.map((s) => s.employee_id))];
    return ids;
  }, [schedules]);

  const groupedSchedules = useMemo(() => {
    const grouped: Record<number, Record<string, Schedule>> = {};

    // Make sure we have valid schedules
    if (!schedules || schedules.length === 0) {
      console.log("Warning: No schedules provided to ScheduleTable");
      return grouped;
    }

    console.log(
      `ScheduleTable: Processing ${schedules.length} total schedules`,
    );

    // Count schedules with shift_id
    const schedulesWithShifts = schedules.filter((s) => s.shift_id !== null);
    console.log(
      `ScheduleTable: Found ${schedulesWithShifts.length} schedules with shift_id`,
    );

    // Group schedules by employee ID and then by date for quick lookup
    uniqueEmployeeIds.forEach((employeeId) => {
      const employeeSchedules = schedules.filter(
        (s) => s.employee_id === employeeId,
      );
      grouped[employeeId] = {};

      // Index each schedule by date for easy lookup
      employeeSchedules.forEach((schedule) => {
        // Normalize date format by removing time component
        const dateKey = schedule.date.split("T")[0];

        // Only add or replace if this is an improvement over the existing entry
        const existingSchedule = grouped[employeeId][dateKey];
        if (
          !existingSchedule ||
          (schedule.shift_id !== null &&
            (existingSchedule.shift_id === null ||
              (!existingSchedule.shift_start && schedule.shift_start)))
        ) {
          grouped[employeeId][dateKey] = schedule;
        }

        // Log the schedule date for debugging
        if (schedule.shift_id !== null) {
          console.log(
            `Employee ${employeeId} has shift on ${dateKey}: ${schedule.shift_start} - ${schedule.shift_end}`,
          );
        }
      });

      // Log schedules with shifts for this employee
      const shiftsForEmployee = employeeSchedules.filter(
        (s) => s.shift_id !== null,
      );
      if (shiftsForEmployee.length === 0) {
        console.log(`Note: No shifts assigned for employee ID ${employeeId}`);
      } else {
        console.log(
          `Found ${shiftsForEmployee.length} shifts for employee ID ${employeeId}`,
        );
      }
    });

    return grouped;
  }, [schedules, uniqueEmployeeIds]);

  // Improve the employee details lookup with fallbacks
  const getEmployeeDetails = (employeeId: number) => {
    // First try to find the employee in the employees data
    const employee = employees.find((e) => e.id === employeeId);

    // Use fallback values if employee not found
    if (!employee) {
      console.log(
        `Warning: Employee with ID ${employeeId} not found in employees data`,
      );
      return {
        contractedHours: 40,
        employeeGroup: "VZ",
      };
    }

    // Return actual values with fallbacks for missing fields
    return {
      contractedHours: employee.contracted_hours || 40,
      employeeGroup: employee.employee_group || "VZ",
    };
  };

  const calculateEmployeeHours = useCallback((employeeId: number, schedules: Schedule[], dateRange: DateRange | undefined) => {
    if (!dateRange?.from || !dateRange?.to) {
      return { weeklyHours: 0, monthlyHours: 0 };
    }

    const employeeSchedules = schedules.filter(s => s.employee_id === employeeId && s.shift_id !== null && !s.is_empty);
    
    // Find the employee for keyholder calculations
    const employee = employees?.find(emp => emp.id === employeeId);
    
    let totalHours = 0;

    employeeSchedules.forEach(schedule => {
      if (schedule.shift_start && schedule.shift_end && schedule.date) {
        try {
          const scheduleDate = parseISO(schedule.date);
          
          // Only include schedules within the actual displayed date range
          if (isWithinInterval(scheduleDate, { start: dateRange.from, end: dateRange.to })) {
            // Use the centralized calculateWorkingTime function that handles breaks and keyholder adjustments
            const timeCalc = calculateWorkingTime(schedule, employee, settings);
            totalHours += timeCalc.workingTime;
          }
        } catch (error) {
          console.error("Error calculating hours for schedule:", error);
        }
      }
    });

    return {
      weeklyHours: totalHours,
      monthlyHours: totalHours, // For weekly/monthly views, the total within date range IS the period total
    };
  }, [employees, settings]);

  // Keyboard shortcuts for sorting
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            setEmployeeSortBy("alphabetical");
            break;
          case '2':
            event.preventDefault();
            setEmployeeSortBy("group");
            break;
          case '3':
            event.preventDefault();
            setEmployeeSortBy("hours");
            break;
          case '4':
            event.preventDefault();
            setEmployeeSortBy("workload");
            break;
          case '5':
            event.preventDefault();
            setEmployeeSortBy("shifts");
            break;
          case '6':
            event.preventDefault();
            setEmployeeSortBy("keyholder");
            break;
          case 'r':
            event.preventDefault();
            setEmployeeSortOrder(employeeSortOrder === "asc" ? "desc" : "asc");
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [employeeSortOrder]);

  if (isLoading) {
    return <Skeleton className="w-full h-[400px]" />;
  }

  if (!dateRange?.from || !dateRange?.to) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Bitte wählen Sie einen Zeitraum aus
      </div>
    );
  }

  return (
    <div className={cn("w-full", isFullWidth && "fixed inset-0 z-[55] bg-background flex flex-col")}>
      <Card className={cn("border border-border", isFullWidth && "flex-1 flex flex-col h-full")}>
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 z-[35] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border flex-shrink-0">
          <div>
            <CardTitle className="text-xl font-medium">Schichtplan</CardTitle>
            {dateRange?.from && dateRange?.to && (
              <div className="text-sm text-muted-foreground mt-1 font-medium">
                {format(dateRange.from, "dd.MM.yyyy")} -{" "}
                {format(dateRange.to, "dd.MM.yyyy")}
              </div>
            )}
          </div>

          {/* Compact Week Navigation for Fullscreen Mode */}
          {isFullWidth && weekInfo && onNavigatePrevious && onNavigateNext && (
            <div className="flex items-center gap-4 mx-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNavigatePrevious}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Vorherige</span>
                </Button>
                
                <div className="text-center min-w-[120px]">
                  <div className="text-sm font-semibold">
                    KW {weekInfo.weekNumber}/{weekInfo.year}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(weekInfo.startDate, 'dd.MM.')} - {format(weekInfo.endDate, 'dd.MM.')}
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNavigateNext}
                  className="flex items-center gap-1"
                >
                  <span className="hidden sm:inline">Nächste</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Week settings badges */}
              {weekNavigationSettings && (
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {weekNavigationSettings.weekendStart === 0 ? 'So-Start' : 'Mo-Start'}
                  </Badge>
                  {weekInfo.spansMonths && (
                    <Badge variant="outline" className="text-xs text-amber-600">
                      Monatsgrenze
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Table Controls */}
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="employee-sort" className="text-sm whitespace-nowrap">
                      Sortierung:
                    </Label>
                    <Select value={employeeSortBy} onValueChange={(value: "name" | "group" | "hours" | "alphabetical" | "keyholder" | "shifts" | "workload") => setEmployeeSortBy(value)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alphabetical">📝 Alphabetisch</SelectItem>
                        <SelectItem value="group">👥 Arbeitsgruppe</SelectItem>
                        <SelectItem value="hours">📋 Vertragsstunden</SelectItem>
                        <SelectItem value="workload">⏰ Ist-Stunden</SelectItem>
                        <SelectItem value="shifts">📊 Schichtanzahl</SelectItem>
                        <SelectItem value="keyholder">🔑 Schlüsselinhaber</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEmployeeSortOrder(employeeSortOrder === "asc" ? "desc" : "asc")}
                      className="h-8 w-8 p-0"
                      title={`Sortierung ${employeeSortOrder === "asc" ? "aufsteigend" : "absteigend"}`}
                    >
                      {employeeSortOrder === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p>Mitarbeiter sortieren nach verschiedenen Kriterien</p>
                    <div className="text-xs text-muted-foreground">
                      Aktuell: {employeeSortBy === "alphabetical" ? "Alphabetisch" : 
                               employeeSortBy === "group" ? "Arbeitsgruppe" :
                               employeeSortBy === "hours" ? "Vertragsstunden" :
                               employeeSortBy === "workload" ? "Ist-Stunden" :
                               employeeSortBy === "shifts" ? "Schichtanzahl" :
                               employeeSortBy === "keyholder" ? "Schlüsselinhaber" : employeeSortBy} 
                      ({employeeSortOrder === "asc" ? "aufsteigend" : "absteigend"})
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFullWidth(!isFullWidth)}
                    className="gap-2"
                  >
                    {isFullWidth ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                    {isFullWidth ? "Minimieren" : "Vollbild"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFullWidth ? "Normale Ansicht" : "Vollbild-Ansicht für bessere Übersicht"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>

        <CardContent className={cn("p-0", isFullWidth ? "flex-1 overflow-auto" : "overflow-x-auto")}>
          {isLoading ? (
            <Skeleton className="w-full h-[400px]" />
          ) : (
            <div className={cn("w-full", isFullWidth ? "h-full overflow-auto" : "overflow-x-auto")} style={{ maxWidth: "100%" }}>
              <ScheduleTableNormal
                schedules={schedules}
                dateRange={dateRange}
                onDrop={onDrop}
                onUpdate={onUpdate}
                employeeAbsences={employeeAbsences}
                absenceTypes={absenceTypes}
                currentVersion={currentVersion}
                openingDays={openingDays}
                daysToDisplay={visibleDaysToDisplay}
                showNavigation={showNavigation}
                onPrevDays={handlePrevDays}
                onNextDays={handleNextDays}
                canNavigatePrev={currentDayOffset > 0}
                canNavigateNext={currentDayOffset + maxDaysToShow < daysToDisplay.length}
                isFullWidth={isFullWidth}
                employeeSortBy={employeeSortBy}
                employeeSortOrder={employeeSortOrder}
              />
            </div>
          )}
        </CardContent>

        {/* Color Legend - Moved to bottom */}
        <div className={cn("border-t border-border p-4 bg-muted/20", isFullWidth && "flex-shrink-0")}>
          <ScheduleColorLegend absenceTypes={absenceTypes} />
        </div>
      </Card>
    </div>
  );
}

// Normal table view (Employee rows, Date columns)
function ScheduleTableNormal({
  schedules,
  dateRange,
  onDrop,
  onUpdate,
  employeeAbsences,
  absenceTypes,
  currentVersion,
  openingDays,
  daysToDisplay,
  showNavigation,
  onPrevDays,
  onNextDays,
  canNavigatePrev,
  canNavigateNext,
  isFullWidth,
  employeeSortBy,
  employeeSortOrder,
}: Omit<ScheduleTableProps, 'isLoading'> & {
  daysToDisplay: Date[];
  showNavigation: boolean;
  onPrevDays: () => void;
  onNextDays: () => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  isFullWidth: boolean;
  employeeSortBy: "name" | "group" | "hours" | "alphabetical" | "keyholder" | "shifts" | "workload";
  employeeSortOrder: "asc" | "desc";
}) {
  const queryClient = useQueryClient();
  
  // Get employees data
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  // Get settings data
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Employee lookup for quick access
  const employeeLookup = useMemo(() => {
    if (!employees) return {};

    return employees.reduce(
      (acc, employee) => {
        acc[employee.id] = employee;
        return acc;
      },
      {} as Record<number, Employee>,
    );
  }, [employees]);

  const formatEmployeeName = (employeeId: number | undefined) => {
    // Handle undefined employee ID
    if (!employeeId || !employeeLookup[employeeId]) return "-";

    const employee = employeeLookup[employeeId];
    const firstName = employee.first_name;
    const lastName = employee.last_name;

    // Create abbreviation from first letters of first and last name
    const abbr = (firstName[0] + lastName[0] + lastName[1]).toUpperCase();

    return (
      <>
        {`${lastName}, ${firstName}`}
        <br />
        {`(${abbr})`}
      </>
    );
  };

  // Map for German weekday abbreviations
  const weekdayAbbr: { [key: string]: string } = {
    Monday: "Mo.",
    Tuesday: "Di.",
    Wednesday: "Mi.",
    Thursday: "Do.",
    Friday: "Fr.",
    Saturday: "Sa.",
    Sunday: "So.",
  };

  // Group schedules by employee ID and then by date for quick lookup
  const groupedSchedules = useMemo(() => {
    const grouped: Record<number, Record<string, Schedule>> = {};

    if (!schedules || schedules.length === 0) {
      return grouped;
    }

    const uniqueEmployeeIds = [...new Set(schedules.map((s) => s.employee_id))];

    uniqueEmployeeIds.forEach((employeeId) => {
      const employeeSchedules = schedules.filter(
        (s) => s.employee_id === employeeId,
      );
      grouped[employeeId] = {};

      // Index each schedule by date for easy lookup
      employeeSchedules.forEach((schedule) => {
        // Normalize date format by removing time component
        const dateKey = schedule.date.split("T")[0];

        // Only add or replace if this is an improvement over the existing entry
        const existingSchedule = grouped[employeeId][dateKey];
        if (
          !existingSchedule ||
          (schedule.shift_id !== null &&
            (existingSchedule.shift_id === null ||
              (!existingSchedule.shift_start && schedule.shift_start)))
        ) {
          grouped[employeeId][dateKey] = schedule;
        }
      });
    });

    return grouped;
  }, [schedules]);

  // Get unique employees from schedules with sorting
  const sortedEmployeeIds = useMemo(() => {
    const uniqueIds = [...new Set(schedules.map((s) => s.employee_id))];
    
    if (!employees) return uniqueIds;
    
    const sortedIds = uniqueIds.sort((a, b) => {
      const empA = employees.find(emp => emp.id === a);
      const empB = employees.find(emp => emp.id === b);
      
      if (!empA || !empB) return 0;
      
      let comparison = 0;
      
      switch (employeeSortBy) {
        case "alphabetical":
          comparison = `${empA.last_name}, ${empA.first_name}`.localeCompare(`${empB.last_name}, ${empB.first_name}`);
          break;
        case "group":
          comparison = (empA.employee_group || "").localeCompare(empB.employee_group || "");
          if (comparison === 0) {
            // Secondary sort by name
            comparison = `${empA.last_name}, ${empA.first_name}`.localeCompare(`${empB.last_name}, ${empB.first_name}`);
          }
          break;
        case "hours": {
          const contractedA = empA.contracted_hours || 0;
          const contractedB = empB.contracted_hours || 0;
          comparison = contractedA - contractedB;
          if (comparison === 0) {
            // Secondary sort by name
            comparison = `${empA.last_name}, ${empA.first_name}`.localeCompare(`${empB.last_name}, ${empB.first_name}`);
          }
          break;
        }
        case "workload": {
          const hoursA = calculateEmployeeHours(a, schedules, dateRange).weeklyHours;
          const hoursB = calculateEmployeeHours(b, schedules, dateRange).weeklyHours;
          comparison = hoursA - hoursB;
          if (comparison === 0) {
            // Secondary sort by name
            comparison = `${empA.last_name}, ${empA.first_name}`.localeCompare(`${empB.last_name}, ${empB.first_name}`);
          }
          break;
        }
        case "shifts": {
          const shiftsA = schedules.filter(s => s.employee_id === a && s.shift_id !== null).length;
          const shiftsB = schedules.filter(s => s.employee_id === b && s.shift_id !== null).length;
          comparison = shiftsA - shiftsB;
          if (comparison === 0) {
            // Secondary sort by name
            comparison = `${empA.last_name}, ${empA.first_name}`.localeCompare(`${empB.last_name}, ${empB.first_name}`);
          }
          break;
        }
        case "keyholder": {
          const keyholderA = empA.is_keyholder ? 1 : 0;
          const keyholderB = empB.is_keyholder ? 1 : 0;
          comparison = keyholderB - keyholderA; // Keyholders first
          if (comparison === 0) {
            // Secondary sort by name
            comparison = `${empA.last_name}, ${empA.first_name}`.localeCompare(`${empB.last_name}, ${empB.first_name}`);
          }
          break;
        }
        default:
          comparison = `${empA.last_name}, ${empA.first_name}`.localeCompare(`${empB.last_name}, ${empB.first_name}`);
      }
      
      return employeeSortOrder === "asc" ? comparison : -comparison;
    });
    
    return sortedIds;
  }, [schedules, employees, employeeSortBy, employeeSortOrder, dateRange]);

  // Get unique employees from schedules (keeping original for compatibility)
  const uniqueEmployeeIds = useMemo(() => {
    return sortedEmployeeIds;
  }, [sortedEmployeeIds]);

  // Improve the employee details lookup with fallbacks
  const getEmployeeDetails = (employeeId: number) => {
    const employee = employees?.find((e) => e.id === employeeId);

    if (!employee) {
      return {
        contractedHours: 40,
        employeeGroup: "VZ",
      };
    }

    return {
      contractedHours: employee.contracted_hours || 40,
      employeeGroup: employee.employee_group || "VZ",
    };
  };

  return (
    <table className="w-full border-collapse">
      <thead className="sticky top-0 z-[30] bg-background border-b-2 border-border">
        <tr className="border-b border-border">
          <th className="w-[220px] sticky left-0 z-[31] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 text-left p-4 font-medium text-foreground border-r border-border">
            <div className="flex items-center justify-between">
              <span>Mitarbeiter ({sortedEmployeeIds.length})</span>
              {showNavigation && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPrevDays}
                    disabled={!canNavigatePrev}
                    className="h-6 w-6 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNextDays}
                    disabled={!canNavigateNext}
                    className="h-6 w-6 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </th>
          {daysToDisplay.map((date) => {
            const dailyHours = calculateDailyHours(schedules, date, employees, settings);
            return (
              <th
                key={date.toISOString()}
                className="w-[160px] text-center p-4 font-medium text-foreground border-r border-border last:border-r-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
              >
                <div className="font-semibold text-base">
                  {weekdayAbbr[format(date, "EEEE")]}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  {format(date, "dd.MM.")}
                </div>
                <div className="text-xs text-blue-600 font-medium mt-1">
                  {formatTimeHourMin(dailyHours)}
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {uniqueEmployeeIds.map((employeeId) => {
          const employeeSchedules = groupedSchedules[employeeId] || {};
          const { contractedHours, employeeGroup } = getEmployeeDetails(employeeId);

          return (
            <tr key={employeeId} className="hover:bg-muted/20 border-b border-border transition-colors">
              <td className="font-medium sticky left-0 z-[15] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 w-[220px] p-3 border-r border-border">
                <div className="flex items-center gap-2">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-muted/50"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" align="start">
                      <EmployeeStatistics
                        employeeId={employeeId}
                        schedules={schedules}
                        contractedHours={contractedHours}
                        employeeGroup={employeeGroup}
                      />
                    </HoverCardContent>
                  </HoverCard>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[180px] block font-medium">
                        {formatEmployeeName(employeeId)}
                      </span>
                      {/* Sorting indicators */}
                      {(() => {
                        const employee = employeeLookup[employeeId];
                        if (!employee) return null;
                        
                        // Show relevant badge based on current sorting
                        switch (employeeSortBy) {
                          case "keyholder":
                            return employee.is_keyholder ? (
                              <div className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-1 py-0.5 rounded border border-amber-200">
                                <Key className="h-3 w-3" />
                                <span>Key</span>
                              </div>
                                                       ) : null;
                          case "group":
                            return (
                              <div className="text-xs bg-blue-50 text-blue-700 px-1 py-0.5 rounded border border-blue-200">
                                {employee.employee_group || "?"}
                              </div>
                            );
                          case "hours":
                            return (
                              <div className="text-xs bg-green-50 text-green-700 px-1 py-0.5 rounded border border-green-200">
                                {employee.contracted_hours || 0}h
                              </div>
                            );
                          case "shifts": {
                            const shiftCount = schedules.filter(s => s.employee_id === employeeId && s.shift_id !== null).length;
                            return (
                              <div className="text-xs bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-200">
                                {shiftCount} Schichten
                              </div>
                            );
                          }
                          case "workload": {
                            const hours = calculateEmployeeHours(employeeId, schedules, dateRange);
                            return (
                              <div className="text-xs bg-orange-50 text-orange-700 px-1 py-0.5 rounded">
                                {hours.weeklyHours.toFixed(1)}h
                              </div>
                            );
                          }
                          default:
                            return null;
                        }
                      })()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1 p-2 bg-muted/20 rounded border border-border">
                      {(() => {
                        const hours = calculateEmployeeHours(employeeId, schedules, dateRange);
                        const employee = employeeLookup[employeeId];
                        const contractedHours = employee?.contracted_hours || 40;
                        
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Vertrag: {contractedHours}h/Woche</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>Woche: {hours.weeklyHours.toFixed(1)}h</span>
                              <span className={cn(
                                "font-medium px-1 rounded",
                                hours.weeklyHours > contractedHours ? "text-red-400 bg-red-500/10" : 
                                hours.weeklyHours < contractedHours * 0.9 ? "text-amber-400 bg-amber-500/10" : 
                                "text-green-400 bg-green-500/10"
                              )}>
                                ({((hours.weeklyHours / contractedHours) * 100).toFixed(0)}%)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>Monat: {hours.monthlyHours.toFixed(1)}h</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </td>
              {daysToDisplay.map((date) => {
                const dateString = format(date, "yyyy-MM-dd");
                const schedule = employeeSchedules[dateString];

                const hasAbsence = checkForAbsence(
                  employeeId,
                  dateString,
                  employeeAbsences,
                  absenceTypes,
                );

                return (
                  <td
                    key={`${employeeId}-${dateString}`}
                    className={cn(
                      "text-center p-0 w-[160px] h-[130px] border-r border-border last:border-r-0 transition-colors",
                      hasAbsence ? "relative" : "",
                    )}
                    title={
                      hasAbsence
                        ? `${hasAbsence.type.name}`
                        : undefined
                    }
                  >
                    {hasAbsence && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs text-orange-700 font-medium px-2 py-1 rounded">
                          {hasAbsence.type.name}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          Abwesend
                        </span>
                      </div>
                    )}
                    <ScheduleCell
                      schedule={schedule}
                      onDrop={(scheduleId, newEmployeeId, newDate, newShiftId) =>
                        onDrop(scheduleId, newEmployeeId, newDate, newShiftId)
                      }
                      onUpdate={(scheduleId, updates) =>
                        onUpdate(scheduleId, updates)
                      }
                      hasAbsence={!!hasAbsence}
                      employeeId={employeeId}
                      date={date}
                      currentVersion={currentVersion}
                    />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Daily Statistics Component
interface DailyStatsProps {
  schedules: Schedule[];
  daysToDisplay: Date[];
  employees: Employee[];
  settings?: { general?: { keyholder_before_minutes?: number; keyholder_after_minutes?: number; store_opening?: string; store_closing?: string } };
}

function DailyStats({ schedules, daysToDisplay, employees, settings }: DailyStatsProps) {
  const dailyStats = useMemo(() => {
    return daysToDisplay.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const daySchedules = schedules.filter(schedule => 
        schedule.date === dateStr && !schedule.is_empty && schedule.shift_id
      );
      
      const totalEmployees = daySchedules.length;
      
      // Calculate total working hours (using the same function as the header)
      const totalHours = calculateDailyHours(schedules, date, employees, settings);
      
      // Count shift types
      const shiftTypes = daySchedules.reduce((acc, schedule) => {
        const shiftType = schedule.shift_type_id || 'UNKNOWN';
        acc[shiftType] = (acc[shiftType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Count keyholders
      const keyholders = daySchedules.filter(schedule => {
        const employee = employees.find(emp => emp.id === schedule.employee_id);
        return employee?.is_keyholder;
      }).length;
      
      return {
        date,
        dateStr,
        totalEmployees,
        totalHours,
        shiftTypes,
        keyholders
      };
    });
  }, [schedules, daysToDisplay, employees, settings]);

  if (daysToDisplay.length === 0) return null;

  return (
    <div className="border-t border-border p-4 bg-muted/10">
      <h4 className="text-sm font-medium text-foreground mb-3">Tägliche Statistiken</h4>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(daysToDisplay.length, 7)}, 1fr)` }}>
        {dailyStats.map(({ date, dateStr, totalEmployees, totalHours, shiftTypes, keyholders }) => (
          <div key={dateStr} className="text-center">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              {format(date, 'dd.MM.')}
            </div>
            <div className="text-xs text-muted-foreground mb-1">
              {['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][date.getDay()]}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs font-medium">{totalEmployees}</span>
                <span className="text-xs text-muted-foreground">MA</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs font-medium">{totalHours.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">h</span>
              </div>
              {keyholders > 0 && (
                <div className="flex items-center justify-center gap-1">
                  <Key className="h-3 w-3 text-yellow-600" />
                  <span className="text-xs font-medium">{keyholders}</span>
                </div>
              )}
              <div className="flex justify-center gap-1 flex-wrap">
                {Object.entries(shiftTypes).map(([type, count]) => {
                  if (count === 0) return null;
                  const colorClass = type === 'EARLY' ? 'bg-blue-500' : 
                                   type === 'MIDDLE' ? 'bg-green-500' : 
                                   type === 'LATE' ? 'bg-amber-500' : 'bg-gray-500';
                  return (
                    <div key={type} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
                      <span className="text-xs">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Color Legend Component
function ScheduleColorLegend({ 
  absenceTypes 
}: { 
  absenceTypes?: Array<{
    id: string;
    name: string;
    color: string;
    type: "absence";
  }>;
}) {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-foreground">Legende</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Shift Types Legend */}
        <div>
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Schichttypen</h5>
          <div className="flex flex-wrap gap-3 text-sm">
            {settings?.employee_groups?.shift_types?.map((type) => (
              <div key={type.id} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border border-border"
                  style={{ backgroundColor: type.color }}
                />
                <span className="text-sm">{type.name}</span>
              </div>
            )) || (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-border bg-blue-500" />
                  <span className="text-sm">Früh</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-border bg-green-500" />
                  <span className="text-sm">Mitte</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-border bg-amber-500" />
                  <span className="text-sm">Spät</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Absence Types Legend */}
        <div>
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Abwesenheitstypen</h5>
          <div className="flex flex-wrap gap-3 text-sm">
            {absenceTypes?.map((type) => (
              <div key={type.id} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border border-border"
                  style={{ backgroundColor: type.color }}
                />
                <span className="text-sm">{type.name}</span>
              </div>
            )) || (
              <span className="text-xs text-muted-foreground">Keine Abwesenheitstypen verfügbar</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Calculate daily working hours (excluding breaks) for a specific date
const calculateDailyHours = (schedules: Schedule[], date: Date, employees?: Employee[], settings?: { general?: { keyholder_before_minutes?: number; keyholder_after_minutes?: number; store_opening?: string; store_closing?: string } }): number => {
  const dateString = format(date, "yyyy-MM-dd");
  const daySchedules = schedules.filter(
    schedule => {
      // Handle both string dates and Date objects
      let scheduleDate: string = schedule.date;
      if (typeof scheduleDate === 'object' && scheduleDate !== null) {
        scheduleDate = format(scheduleDate as Date, "yyyy-MM-dd");
      }
      // Also handle ISO date strings that might include time
      if (typeof scheduleDate === 'string' && scheduleDate.includes('T')) {
        scheduleDate = scheduleDate.split('T')[0];
      }
      
      return scheduleDate === dateString && !schedule.is_empty && schedule.shift_id;
    }
  );
  
  return daySchedules.reduce((sum, schedule) => {
    if (schedule.shift_start && schedule.shift_end) {
      try {
        // Find the employee for this schedule
        const employee = employees?.find(emp => emp.id === schedule.employee_id);
        
        // Use the centralized calculateWorkingTime function that handles keyholder adjustments
        const timeCalc = calculateWorkingTime(schedule, employee, settings);
        
        return sum + timeCalc.workingTime;
      } catch (error) {
        console.error("Error calculating daily hours:", error);
        return sum;
      }
    }
    return sum;
  }, 0);
};

// Utility function to check if employee is available for a specific date
const checkEmployeeAvailabilityForDateSync = async (employeeId: number, date: Date): Promise<boolean> => {
  try {
    const formattedDate = format(date, "yyyy-MM-dd");
    const result = await checkEmployeeAvailabilityForDate(employeeId, formattedDate);
    console.log(`[AVAILABILITY DEBUG] Employee ${employeeId} on ${formattedDate}:`, result);
    return result.is_available;
  } catch (error) {
    console.error("Error checking employee availability:", error);
    // Return false as fallback to indicate potential unavailability  
    return false;
  }
};

// Cache for availability checks to avoid repeated API calls
const availabilityCache = new Map<string, { isAvailable: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedAvailability = (employeeId: number, date: Date): boolean | null => {
  const key = `${employeeId}-${format(date, "yyyy-MM-dd")}`;
  const cached = availabilityCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.isAvailable;
  }
  
  return null;
};

const setCachedAvailability = (employeeId: number, date: Date, isAvailable: boolean): void => {
  const key = `${employeeId}-${format(date, "yyyy-MM-dd")}`;
  availabilityCache.set(key, { isAvailable, timestamp: Date.now() });
};
