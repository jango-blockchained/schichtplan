import React, { useMemo, useState, useEffect, Fragment } from "react";
import { format, addDays, parseISO, startOfWeek } from "date-fns";
import { useDrag, useDrop } from "react-dnd";
import { Schedule, Employee, ScheduleUpdate } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { getSettings, getEmployees } from "@/services/api";
import {
  Edit2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftEditModal } from "@/components/ShiftEditModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeeStatistics } from "@/components/Schedule/EmployeeStatistics";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  employeeAbsences?: Record<number, any[]>;
  absenceTypes?: Array<{
    id: string;
    name: string;
    color: string;
    type: "absence";
  }>;
}

interface DragItem {
  type: "SCHEDULE";
  scheduleId: number;
  employeeId: number;
  shiftId: number | null;
  date: string;
  shift_type_id?: string; // EARLY, MIDDLE, LATE
}

// Define an extended type for Schedule that includes the break duration
type ExtendedSchedule = Schedule & {
  break_duration?: number | null;
  notes?: string | null;
  additional_slots?: TimeSlot[];
};

interface TimeSlot {
  start: string;
  end: string;
}

const isEmptySchedule = (schedule: Schedule | undefined) => {
  return !schedule || !schedule.shift_id;
};

// Add this component above the ScheduleCell component
interface TimeSlotDisplayProps {
  startTime: string;
  endTime: string;
  shiftType?: string;
  settings?: any;
  schedule?: Schedule;
}

const TimeSlotDisplay = ({
  startTime,
  endTime,
  shiftType,
  settings,
  schedule,
}: TimeSlotDisplayProps) => {
  // This function determines the background color of the time slot pill
  // Based on shift type (EARLY, MIDDLE, LATE)
  const getBackgroundColor = () => {
    if (typeof shiftType === "string") {
      // First check if we have a valid shift type
      if (["EARLY", "MIDDLE", "LATE"].includes(shiftType)) {
        switch (shiftType) {
          case "EARLY":
            return "#3b82f6"; // Blue for early shifts
          case "MIDDLE":
            return "#22c55e"; // Green for middle shifts
          case "LATE":
            return "#f59e0b"; // Amber for late shifts
        }
      }
    }

    // Fallback to using the time slot to determine the shift type
    const timeSlot = `${startTime}-${endTime}`;
    if (timeSlot === "09:00-14:00") return "#3b82f6"; // Early shift (blue)
    if (timeSlot === "15:00-20:00") return "#f59e0b"; // Late shift (amber)
    if (timeSlot === "12:00-16:00") return "#22c55e"; // Mid shift (green)

    return "#64748b"; // Default slate gray
  };

  // Helper function to get a formatted display name for the shift type
  const getShiftTypeDisplay = () => {
    if (schedule?.shift_type_name) {
      return schedule.shift_type_name;
    }

    if (typeof shiftType === "string") {
      // Map shift types to display names
      switch (shiftType) {
        case "EARLY":
          return "Früh";
        case "LATE":
          return "Spät";
        case "MIDDLE":
          return "Mitte";
        default:
          return shiftType;
      }
    }
    return null;
  };

  const bgColor = getBackgroundColor();
  const shiftTypeDisplay = getShiftTypeDisplay();

  return (
    <div className="flex flex-col items-center">
      <div
        className="px-4 py-1 rounded-full text-sm font-medium text-white w-fit"
        style={{ backgroundColor: bgColor }}
      >
        {startTime} - {endTime}
      </div>
      {shiftTypeDisplay && (
        <div className="text-xs mt-1 font-medium" style={{ color: bgColor }}>
          {shiftTypeDisplay}
        </div>
      )}
    </div>
  );
};

const ScheduleCell = ({
  schedule,
  onDrop,
  onUpdate,
  hasAbsence,
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
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Add debug logging to help understand when cells are empty
  useEffect(() => {
    if (schedule && schedule.shift_id !== null && schedule.shift_start) {
      console.log(
        `ScheduleCell: Valid shift found for date ${schedule.date} - ${schedule.shift_start} to ${schedule.shift_end}`,
      );
    }
  }, [schedule]);

  const [{ isDragging }, drag] = useDrag({
    type: "SCHEDULE",
    item: schedule
      ? {
          type: "SCHEDULE",
          scheduleId: schedule.id,
          employeeId: schedule.employee_id,
          shiftId: schedule.shift_id || null,
          date: schedule.date,
          shift_type_id: schedule.shift_type_id,
        }
      : undefined,
    canDrag: !!schedule && !hasAbsence,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: "SCHEDULE",
    drop: (item: DragItem) => {
      if (!schedule) return;
      onDrop(
        item.scheduleId,
        schedule.employee_id,
        new Date(schedule.date),
        item.shiftId || 0,
      );
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
    canDrop: () => !!schedule && !hasAbsence,
  });

  // Fetch settings to get availability type colors
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const handleDelete = async () => {
    if (!schedule) return;
    try {
      console.log("🗑️ Deleting shift for schedule:", schedule.id);
      // Set shift_id to null explicitly instead of undefined
      await onUpdate(schedule.id, { shift_id: null });
      console.log("🗑️ Delete operation completed successfully");
    } catch (error) {
      console.error("🗑️ Error deleting shift:", error);
    }
  };

  const handleAdd = () => {
    if (hasAbsence) return; // Prevent adding if there's an absence
    setIsEditModalOpen(true);
  };

  if (!schedule || isEmptySchedule(schedule)) {
    return (
      <div
        ref={(node) => drag(drop(node))}
        style={{ width: "100%", height: "100%" }}
        className={cn(
          "p-2 rounded-md border border-dashed border-gray-300 transition-all duration-200",
          "flex flex-col items-center justify-center",
          isDragging && "opacity-50 bg-primary/10",
          isOver && "ring-2 ring-primary/50",
          "hover:bg-primary/5",
          hasAbsence && "opacity-0", // Hide completely if absence
        )}
      >
        <div className="text-sm text-muted-foreground">
          {hasAbsence ? "Absence" : "No shift assigned"}
        </div>
      </div>
    );
  }

  // Cast the schedule to ExtendedSchedule to access the additional properties
  const extendedSchedule = schedule as ExtendedSchedule;
  const shiftType = determineShiftType(schedule);
  const shiftTypeColor = getShiftTypeColor(shiftType, settings?.shift_types);

  // Get availability type color from settings
  const getAvailabilityTypeColor = (availabilityType: string) => {
    if (!settings?.availability_types?.types) return "#22c55e"; // Default green

    const typeInfo = settings.availability_types.types.find(
      (type: any) => type.id === availabilityType,
    );

    return typeInfo?.color || "#22c55e"; // Default to green if not found
  };

  // Get the availability type from the schedule
  // If not provided, use a default based on the shift type
  const getDefaultAvailabilityType = (
    schedule: Schedule,
    shiftType: string,
  ): string => {
    // First check if the schedule has an explicit availability_type
    if (schedule.availability_type) {
      return schedule.availability_type;
    }

    // If the shift_type_id is explicitly set, use that to determine availability_type
    if (schedule.shift_type_id) {
      return schedule.shift_type_id;
    }

    // Check notes for keywords that might indicate fixed shifts
    if (schedule.notes) {
      const notes = schedule.notes.toLowerCase();
      if (notes.includes("fix") || notes.includes("fest")) {
        return "FIX";
      }
      if (
        notes.includes("wunsch") ||
        notes.includes("promised") ||
        notes.includes("pref")
      ) {
        return "PRM";
      }
    }

    // Check for specific time patterns that might indicate fixed shifts
    // This is a temporary solution until the backend properly provides availability_type
    if (schedule.shift_start && schedule.shift_end) {
      // Example: Consider specific shift patterns as fixed
      if (schedule.shift_start === "12:00" && schedule.shift_end === "16:00") {
        return "FIX"; // Consider afternoon shifts as fixed
      }
    }

    // Default based on shift type as a last resort
    return shiftType;
  };

  const availabilityType = getDefaultAvailabilityType(schedule, shiftType);
  const availabilityColor = getAvailabilityTypeColor(availabilityType);

  return (
    <>
      <div
        ref={(node) => drag(drop(node))}
        style={{ width: "100%", height: "100%" }}
        className={cn(
          "p-2 rounded-md border transition-all duration-200 group relative",
          "flex flex-col gap-2 items-center justify-center",
          isDragging && "opacity-50 bg-primary/10",
          isOver && "ring-2 ring-primary/50",
          "hover:bg-primary/5",
          hasAbsence && "opacity-0", // Hide completely if absence
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Top colored line - using availability type color */}
        <div
          className="absolute top-0 left-0 right-0 h-2 rounded-t"
          style={{
            backgroundColor: availabilityColor, // Uses the availability type color
          }}
          title={`Availability type: ${availabilityType}`}
        />

        <div className="flex flex-col w-full space-y-2 items-center mt-2">
          {/* Time display - uses shift type color */}
          <TimeSlotDisplay
            startTime={schedule.shift_start || "00:00"}
            endTime={schedule.shift_end || "00:00"}
            shiftType={shiftType} // Pass the shift type for color
            settings={settings}
            schedule={schedule}
          />

          {/* Add additional time slots if needed */}
          {(extendedSchedule.additional_slots || []).map(
            (slot: TimeSlot, index: number) => (
              <TimeSlotDisplay
                key={index}
                startTime={slot.start}
                endTime={slot.end}
                shiftType={shiftType}
                settings={settings}
                schedule={schedule}
              />
            ),
          )}

          {extendedSchedule.break_duration &&
            extendedSchedule.break_duration > 0 && (
              <div className="text-xs text-muted-foreground">
                Pause: {extendedSchedule.break_duration} min
              </div>
            )}
          {extendedSchedule.notes && (
            <div className="text-xs text-muted-foreground italic text-center max-w-full truncate">
              {extendedSchedule.notes}
            </div>
          )}
        </div>

        {showActions && !hasAbsence && (
          <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditModalOpen(true);
              }}
              className="h-6 w-6"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="h-6 w-6 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
        <div className="absolute inset-0 cursor-move pointer-events-none" />
      </div>
      {isEditModalOpen && !hasAbsence && (
        <ShiftEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          schedule={schedule}
          onSave={onUpdate}
        />
      )}
    </>
  );
};

// Helper function to determine shift type based on properties
const determineShiftType = (schedule: Schedule): ShiftType => {
  if (schedule.shift_type_id) {
    return schedule.shift_type_id;
  }

  const startTime = schedule.shift_start;
  if (!startTime) return "EARLY";

  const hour = parseInt(startTime.split(":")[0]);
  if (hour < 10) return "EARLY";
  if (hour < 14) return "MIDDLE";
  return "LATE";
};

const getShiftTypeDisplay = (shiftType: ShiftType): string => {
  switch (shiftType) {
    case "EARLY":
      return "Früh";
    case "MIDDLE":
      return "Mitte";
    case "LATE":
      return "Spät";
    default:
      return "Früh";
  }
};

const getShiftTypeColor = (
  shiftType: ShiftType,
  settings?: Settings,
): string => {
  const shiftTypeInfo = settings?.shift_types?.find(
    (type) => type.id === shiftType,
  );
  if (shiftTypeInfo?.color) return shiftTypeInfo.color;

  switch (shiftType) {
    case "EARLY":
      return "#22c55e";
    case "MIDDLE":
      return "#3b82f6";
    case "LATE":
      return "#f59e0b";
    default:
      return "#64748b";
  }
};

// Function to get direct CSS color values based on shift type
const getShiftTypeRGBColor = (
  type: string,
  schedule?: Schedule,
  settingsData?: any,
): { bg: string; text: string } => {
  // First try to get color from settings based on the shift_type_id
  if (settingsData && schedule?.shift_type_id) {
    const shiftTypeData = settingsData.find(
      (t: any) => t.id === schedule.shift_type_id,
    );

    if (shiftTypeData?.color) {
      // Convert hex color to rgba for background with transparency
      const hex = shiftTypeData.color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return {
        bg: `rgba(${r}, ${g}, ${b}, 0.2)`,
        text: shiftTypeData.color,
      };
    }
  }

  // Fall back to default colors based on shift type
  switch (type) {
    case "EARLY":
      return {
        bg: "rgba(59, 130, 246, 0.2)",
        text: "rgb(37, 99, 235)",
      };
    case "MIDDLE":
      return {
        bg: "rgba(34, 197, 94, 0.2)",
        text: "rgb(22, 163, 74)",
      };
    case "LATE":
      return {
        bg: "rgba(245, 158, 11, 0.2)",
        text: "rgb(217, 119, 6)",
      };
    default:
      return {
        bg: "rgba(203, 213, 225, 0.2)",
        text: "rgb(100, 116, 139)",
      };
  }
};

// Helper function to check if an employee has an absence for a given date
const checkForAbsence = (
  employeeId: number,
  dateString: string,
  employeeAbsences?: Record<number, any[]>,
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

export function ScheduleTable({
  schedules,
  dateRange,
  onDrop,
  onUpdate,
  isLoading,
  employeeAbsences,
  absenceTypes,
}: ScheduleTableProps) {
  const [expandedEmployees, setExpandedEmployees] = useState<number[]>([]);

  const toggleEmployeeExpand = (employeeId: number) => {
    setExpandedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId],
    );
  };

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Fetch employee data to display names properly
  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
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

  const formatEmployeeName = (employeeId: number | undefined) => {
    // Handle undefined employee ID
    if (!employeeId || !employeeLookup[employeeId]) return "-";

    const employee = employeeLookup[employeeId];
    const firstName = employee.first_name;
    const lastName = employee.last_name;
    const type = employee.employee_group;

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

  const days = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || !settings) return [];
    const days = [];
    let currentDate = dateRange.from;

    while (currentDate <= dateRange.to) {
      const dayIndex = currentDate.getDay().toString();
      const isSunday = dayIndex === "0";
      const isWeekday = dayIndex !== "0"; // Monday-Saturday
      const isOpeningDay = settings.general.opening_days[dayIndex];

      // Include the day if:
      // 1. It's marked as an opening day, OR
      // 2. It's Sunday and show_sunday is true, OR
      // 3. It's a weekday and show_weekdays is true
      if (
        isOpeningDay ||
        (isSunday && settings.display.show_sunday) ||
        (isWeekday && settings.display.show_weekdays)
      ) {
        days.push(currentDate);
      }
      currentDate = addDays(currentDate, 1);
    }

    // Sort days based on start_of_week setting
    return days.sort((a, b) => {
      // Convert settings.display.start_of_week to 0 | 1 | 2 | 3 | 4 | 5 | 6
      const weekStart = (settings.display.start_of_week % 7) as
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6;
      const startOfWeekA = startOfWeek(a, { weekStartsOn: weekStart });
      const startOfWeekB = startOfWeek(b, { weekStartsOn: weekStart });
      const dayDiffA = a.getTime() - startOfWeekA.getTime();
      const dayDiffB = b.getTime() - startOfWeekB.getTime();
      return dayDiffA - dayDiffB;
    });
  }, [dateRange, settings]);

  // Map for German weekday abbreviations
  const weekdayAbbr: { [key: string]: string } = {
    Monday: "Mo",
    Tuesday: "Di",
    Wednesday: "Mi",
    Thursday: "Do",
    Friday: "Fr",
    Saturday: "Sa",
    Sunday: "So",
  };

  // SIMPLIFIED APPROACH: Create a direct lookup map from employee_id and date to schedule
  const scheduleMap = useMemo(() => {
    const map: Record<number, Record<string, Schedule>> = {};

    // Process all schedules into the map for quick lookup
    schedules.forEach((schedule) => {
      const employeeId = schedule.employee_id;

      // Normalize the date format by stripping any time component
      const dateStr = schedule.date.split("T")[0];

      // Initialize the employee map if it doesn't exist
      if (!map[employeeId]) {
        map[employeeId] = {};
      }

      // Store the schedule by date
      map[employeeId][dateStr] = schedule;
    });

    // Log some debugging info about our map
    console.log("🗺️ Schedule map created with:", {
      totalEmployees: Object.keys(map).length,
      sampleEmployee: Object.keys(map)[0] ? Object.keys(map)[0] : "None",
      totalSchedules: schedules.length,
      schedulesWithShifts: schedules.filter((s) => s.shift_id !== null).length,
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
        grouped[employeeId][dateKey] = schedule;

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Schichtplan</CardTitle>
          {dateRange?.from && dateRange?.to && (
            <div className="text-sm text-muted-foreground mt-1">
              {format(dateRange.from, "dd.MM.yyyy")} -{" "}
              {format(dateRange.to, "dd.MM.yyyy")}
            </div>
          )}
        </div>

        {/* Add shift type legend and absence type legend */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-sm">
            {settings?.shift_types ? (
              // Use colors from settings if available
              settings.shift_types.map((type: any) => (
                <div key={type.id} className="flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: type.color }}
                  ></div>
                  <span>{type.name}</span>
                </div>
              ))
            ) : (
              // Fallback to hardcoded colors
              <>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-blue-500"></div>
                  <span>Fest</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span>Wunsch</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-amber-500"></div>
                  <span>Verfügbarkeit</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-gray-300"></div>
                  <span>Standard</span>
                </div>
              </>
            )}
          </div>

          {/* Absence type legend */}
          {absenceTypes && absenceTypes.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground mr-1">Absenz:</span>
              {absenceTypes.map((type) => (
                <div key={type.id} className="flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: type.color }}
                  ></div>
                  <span>{type.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full overflow-x-auto" style={{ maxWidth: "100%" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="w-[220px] sticky left-0 z-20 bg-background text-left p-4 font-medium text-muted-foreground">
                  Mitarbeiter
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className="w-[160px] text-center p-4 font-medium text-muted-foreground"
                  >
                    <div className="font-semibold text-base">
                      {weekdayAbbr[format(day, "EEEE")]}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(day, "dd.MM")}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uniqueEmployeeIds.map((employeeId) => {
                const employeeSchedules = groupedSchedules[employeeId] || {};
                const { contractedHours, employeeGroup } =
                  getEmployeeDetails(employeeId);
                const isExpanded = expandedEmployees.includes(employeeId);

                return (
                  <React.Fragment key={employeeId}>
                    <tr className="hover:bg-muted/40 border-b">
                      <td className="font-medium sticky left-0 z-10 bg-background w-[220px] p-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleEmployeeExpand(employeeId)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </Button>
                          <span className="truncate max-w-[180px]">
                            {formatEmployeeName(employeeId)}
                          </span>
                        </div>
                      </td>
                      {days.map((day) => {
                        const dateString = format(day, "yyyy-MM-dd");
                        const daySchedule = employeeSchedules[dateString];
                        // Check for absence
                        const absenceInfo = checkForAbsence(
                          employeeId,
                          dateString,
                          employeeAbsences,
                          absenceTypes,
                        );

                        const cellStyle = absenceInfo
                          ? {
                              backgroundColor: `${absenceInfo.type.color}15`, // 15 is hex for 10% opacity
                              position: "relative" as const,
                            }
                          : {};

                        return (
                          <td
                            key={`${employeeId}-${dateString}`}
                            className={cn(
                              "text-center p-0 w-[160px] h-[130px]", // Fixed height for consistency
                              absenceInfo ? "relative" : "",
                            )}
                            style={{
                              ...cellStyle,
                              borderColor: absenceInfo
                                ? `${absenceInfo.type.color}`
                                : undefined,
                            }}
                            title={
                              absenceInfo
                                ? `${absenceInfo.type.name}`
                                : undefined
                            }
                          >
                            {absenceInfo && (
                              <>
                                <div
                                  className="absolute top-0 left-0 right-0 px-2 py-1 text-base font-semibold z-10 text-center"
                                  style={{
                                    backgroundColor: absenceInfo.type.color,
                                    color: "#fff",
                                    borderTopLeftRadius: "0.25rem",
                                    borderTopRightRadius: "0.25rem",
                                  }}
                                >
                                  {absenceInfo.type.name}
                                </div>
                                <div className="absolute inset-0 mt-8 flex flex-col items-center justify-center space-y-2 pt-4">
                                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                                  <span className="text-xs text-muted-foreground font-medium text-center px-2">
                                    No shifts allowed
                                    <br />
                                    during absence
                                  </span>
                                </div>
                              </>
                            )}
                            <ScheduleCell
                              schedule={daySchedule}
                              onDrop={onDrop}
                              onUpdate={onUpdate}
                              hasAbsence={!!absenceInfo}
                            />
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={days.length + 1}
                          className="bg-slate-50 p-4"
                        >
                          <EmployeeStatistics
                            employeeId={employeeId}
                            schedules={schedules}
                            contractedHours={contractedHours}
                            employeeGroup={employeeGroup}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export { ScheduleTable as OriginalScheduleTable };
