import React, { useMemo, useState, useEffect, Fragment } from "react";
import { format, addDays, parseISO, startOfWeek, endOfWeek, differenceInMinutes, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useDrag, useDrop } from "react-dnd";
import { Schedule, Employee, ScheduleUpdate, ShiftType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSettings,
  getEmployees,
  createSchedule,
  getShifts,
  Shift,
} from "@/services/api";
import {
  Edit2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftEditModal } from "./ShiftEditModal";
import { AddScheduleDialog } from "./Schedule/AddScheduleDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeeStatistics } from "./Schedule/EmployeeStatistics";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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
  currentVersion?: number;
  openingDays: number[];
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

// Helper function to determine if a schedule is empty (no shift assigned)
const isEmptySchedule = (schedule: Schedule | undefined) => {
  return !schedule || schedule.shift_id === null;
};

// Add this component above the ScheduleCell component
interface TimeSlotDisplayProps {
  startTime?: string | null;
  endTime?: string | null;
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
  // Add a more visible diagnostic indicator for missing time data
  const hasMissingTimeData = (!startTime || !endTime) && schedule?.shift_id;

  // Enhanced debug logging for time slot display
  useEffect(() => {
    if (hasMissingTimeData) {
      console.log("🚨 TimeSlotDisplay: Missing time data for shift:", {
        scheduleId: schedule?.id,
        shiftId: schedule?.shift_id,
        date: schedule?.date,
        startTime,
        endTime,
        shiftType,
        shift_type_name: schedule?.shift_type_name,
      });
    }
  }, [hasMissingTimeData, schedule, startTime, endTime, shiftType]);

  // Handle missing time data by using default placeholder times
  const displayStartTime = startTime || "??:??";
  const displayEndTime = endTime || "??:??";

  // Handle the case where we have a schedule with ID but no time data
  if (hasMissingTimeData) {
    // Try to extract more information from the shift type
    const shiftTypeName =
      schedule?.shift_type_name ||
      (shiftType === "EARLY"
        ? "Früh"
        : shiftType === "MIDDLE"
          ? "Mitte"
          : shiftType === "LATE"
            ? "Spät"
            : `Schicht #${schedule?.shift_id}`);

    return (
      <div className="flex flex-col items-center gap-1">
        <div className="px-4 py-2 rounded-full text-sm font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 w-fit shadow-sm">
          {shiftTypeName}
        </div>
        <div className="text-xs text-amber-400 font-medium">
          ID: {schedule?.shift_id} (Zeiten fehlen)
        </div>
      </div>
    );
  }

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
    const timeSlot = `${displayStartTime}-${displayEndTime}`;
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
        className="px-4 py-2 rounded-full text-sm font-medium text-white w-fit shadow-sm border border-white/20"
        style={{ backgroundColor: bgColor }}
      >
        {displayStartTime} - {displayEndTime}
      </div>
      {shiftTypeDisplay && (
        <div className="text-xs mt-1 font-medium" style={{ color: bgColor }}>
          {shiftTypeDisplay}
        </div>
      )}
      {schedule?.shift_id && (
        <div className="text-xs mt-1 text-muted-foreground font-medium">
          ID: {schedule.shift_id}
        </div>
      )}
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Log debug info for all schedules to diagnose rendering issues
  useEffect(() => {
    if (schedule) {
      console.log(
        `📊 ScheduleCell: ${schedule.employee_id} @ ${date.toLocaleDateString()}`,
        {
          id: schedule.id,
          shift_id: schedule.shift_id,
          employee_id: schedule.employee_id,
          date: schedule.date,
          shift_start: schedule.shift_start,
          shift_end: schedule.shift_end,
          shift_type_id: schedule.shift_type_id,
          shift_type_name: schedule.shift_type_name,
        },
      );
    }
  }, [schedule, date]);

  // Check if this is an empty schedule (no shift assigned)
  if (isEmptySchedule(schedule)) {
    // Render empty cell with + button on hover
    return (
      <div
        className="relative h-full min-h-[80px] p-2"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {showActions && (
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

                console.log("Creating new schedule with data:", newScheduleData);
                
                // Create schedule via API
                const createdSchedule = await createSchedule(newScheduleData);
                console.log("Schedule created successfully:", createdSchedule);
                
                // Invalidate the schedules cache to trigger a refetch
                await queryClient.invalidateQueries({ queryKey: ['schedules'] });
                console.log("Schedule cache invalidated, data should refresh automatically");
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

  // Handle the case where we have a schedule with a shift_id but no times
  const hasShiftIdOnly =
    schedule &&
    schedule.shift_id !== null &&
    (!schedule.shift_start || !schedule.shift_end);

  return (
    <div
      className="relative h-full min-h-[80px] p-2"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {hasShiftIdOnly ? (
        // Display a clear indicator when we have a shift ID but no time data
        <div className="flex flex-col items-center justify-center h-full">
          <div className="px-4 py-2 rounded-lg text-sm font-medium bg-muted/30 text-foreground w-fit border border-border/30 shadow-sm">
            Schicht #{schedule.shift_id}
          </div>
          {schedule.shift_type_name && (
            <div className="text-xs mt-2 text-muted-foreground font-medium">
              {schedule.shift_type_name}
            </div>
          )}
          {!schedule.shift_type_name && schedule.shift_type_id && (
            <div className="text-xs mt-2 text-muted-foreground font-medium">
              {schedule.shift_type_id === "EARLY"
                ? "Früh"
                : schedule.shift_type_id === "MIDDLE"
                  ? "Mitte"
                  : schedule.shift_type_id === "LATE"
                    ? "Spät"
                    : "Unbekannt"}
            </div>
          )}
        </div>
      ) : (
        // Normal display for schedules with time data
        <div className="flex flex-col items-center justify-center h-full">
          <TimeSlotDisplay
            startTime={schedule?.shift_start}
            endTime={schedule?.shift_end}
            shiftType={schedule?.shift_type_id}
            schedule={schedule}
          />
        </div>
      )}

      {/* Actions buttons on hover */}
      {showActions && (
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
        onUpdate={async (updates) => {
          // Need null/undefined check for schedule.id here as schedule might be undefined
          if (schedule?.id) {
            await onUpdate(schedule.id, updates);
            setIsEditModalOpen(false);
          } else {
            console.error("Attempted to update schedule with undefined ID");
            setIsEditModalOpen(false); // Close modal even on error
          }
        }}
        currentVersion={currentVersion!}
      />
    </div>
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

// Define a local interface for settings if it's not in types
interface Settings {
  shift_types?: Array<{
    id: string;
    color: string;
  }>;
  // Add other properties as needed
}

// Fix the getShiftTypeColor function
const getShiftTypeColor = (
  shiftType: ShiftType,
  settings?: Settings,
): string => {
  const shiftTypeInfo = settings?.shift_types?.find(
    (type: { id: string; color: string }) => type.id === shiftType,
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

// Define ShiftAddModal component to replace the incorrect one
function ShiftAddModal({
  isOpen,
  onClose,
  employeeId,
  date,
  version,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  employeeId: number;
  date: Date;
  version: number;
  onSave: (shiftId: number) => Promise<void>;
}) {
  const { data: shifts } = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
  });

  const [selectedShiftId, setSelectedShiftId] = useState<string>("");

  const handleSave = async () => {
    if (!selectedShiftId) return;
    try {
      await onSave(parseInt(selectedShiftId));
    } catch (error) {
      console.error("Error saving shift:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Schicht hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="shift">Schicht</Label>
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="Schicht auswählen" />
              </SelectTrigger>
              <SelectContent>
                {shifts?.map((shift: Shift) => (
                  <SelectItem key={shift.id} value={shift.id.toString()}>
                    {shift.start_time} - {shift.end_time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!selectedShiftId}>
            Speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add this helper function after the existing helper functions
const calculateEmployeeHours = (
  employeeId: number,
  schedules: Schedule[],
  dateRange: DateRange | undefined
) => {
  if (!dateRange?.from || !dateRange?.to) {
    return { weeklyHours: 0, monthlyHours: 0, totalHours: 0 };
  }

  const employeeSchedules = schedules.filter(
    (s) => s.employee_id === employeeId && s.shift_id !== null
  );

  let weeklyHours = 0;
  let monthlyHours = 0;
  let totalHours = 0;

  // Get the current week and month based on the selected date range
  const weekStart = startOfWeek(dateRange.from, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(dateRange.from, { weekStartsOn: 1 });
  const monthStart = startOfMonth(dateRange.from);
  const monthEnd = endOfMonth(dateRange.from);

  employeeSchedules.forEach((schedule) => {
    if (!schedule.shift_start || !schedule.shift_end || !schedule.date) return;

    try {
      const scheduleDate = parseISO(schedule.date);
      
      // Calculate shift duration
      const [startHours, startMinutes] = schedule.shift_start.split(":").map(Number);
      const [endHours, endMinutes] = schedule.shift_end.split(":").map(Number);
      
      let startTotalMinutes = startHours * 60 + startMinutes;
      let endTotalMinutes = endHours * 60 + endMinutes;
      
      // Handle overnight shifts
      if (endTotalMinutes < startTotalMinutes) {
        endTotalMinutes += 24 * 60;
      }
      
      const durationHours = (endTotalMinutes - startTotalMinutes) / 60;
      
      // Add to total hours if within date range
      if (isWithinInterval(scheduleDate, { start: dateRange.from, end: dateRange.to })) {
        totalHours += durationHours;
      }
      
      // Add to weekly hours if within current week
      if (isWithinInterval(scheduleDate, { start: weekStart, end: weekEnd })) {
        weeklyHours += durationHours;
      }
      
      // Add to monthly hours if within current month
      if (isWithinInterval(scheduleDate, { start: monthStart, end: monthEnd })) {
        monthlyHours += durationHours;
      }
    } catch (error) {
      console.error("Error calculating hours for schedule:", error);
    }
  });

  return { weeklyHours, monthlyHours, totalHours };
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
}: ScheduleTableProps) {
  const queryClient = useQueryClient();
  
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
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/30">
        <div>
          <CardTitle className="text-xl font-medium">Schichtplan</CardTitle>
          {dateRange?.from && dateRange?.to && (
            <div className="text-sm text-muted-foreground mt-1 font-medium">
              {format(dateRange.from, "dd.MM.yyyy")} -{" "}
              {format(dateRange.to, "dd.MM.yyyy")}
            </div>
          )}
        </div>

        {/* Add shift type legend and absence type legend */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 text-sm">
            {(settings && settings.employee_groups && settings.employee_groups.shift_types && settings.employee_groups.shift_types.length > 0) ? (
              settings.employee_groups.shift_types.map((type) => (
                <div key={type.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border border-border/30"
                    style={{ backgroundColor: type.color }}
                  ></div>
                  <span className="font-medium">{type.name}</span>
                </div>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Shift types not loaded or empty</span>
            )}
          </div>
          {/* Absence Type Legend (similar logic) */}
          <div className="flex items-center gap-4 text-sm">
            {(settings && settings.employee_groups && settings.employee_groups.absence_types && settings.employee_groups.absence_types.length > 0) ? (
              settings.employee_groups.absence_types.map((type) => (
                <div key={type.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border border-border/30"
                    style={{ backgroundColor: type.color }}
                  ></div>
                  <span className="font-medium">{type.name}</span>
                </div>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Absence types not loaded or empty</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {isLoading ? (
          <Skeleton className="w-full h-[400px]" />
        ) : (
          <div className="w-full overflow-x-auto" style={{ maxWidth: "100%" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="w-[220px] sticky left-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 text-left p-4 font-medium text-foreground border-r border-border/30">
                    Mitarbeiter
                  </th>
                  {daysToDisplay.map((date) => (
                    <th
                      key={date.toISOString()}
                      className="w-[160px] text-center p-4 font-medium text-foreground border-r border-border/30 last:border-r-0"
                    >
                      <div className="font-medium text-base">
                        {weekdayAbbr[format(date, "EEEE")]}
                      </div>
                      <div className="text-sm text-muted-foreground font-medium">
                        {format(date, "dd.MM")}
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

                  return (
                    <tr key={employeeId} className="hover:bg-muted/20 border-b border-border/30 transition-colors">
                      <td className="font-medium sticky left-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 w-[220px] p-3 border-r border-border/30">
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
                            <span className="truncate max-w-[180px] block font-medium">
                              {formatEmployeeName(employeeId)}
                            </span>
                            {/* Add hours display */}
                            <div className="text-xs text-muted-foreground mt-2 space-y-1 p-2 bg-muted/20 rounded border border-border/30">
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
                        // Find the schedule entry for this employee and date
                        const schedule = employeeSchedules[dateString];

                        // Check for absence on this specific date
                        const hasAbsence = checkForAbsence(
                          employeeId,
                          dateString,
                          employeeAbsences,
                          absenceTypes,
                        );

                        const cellStyle = hasAbsence
                          ? {
                              backgroundColor: `${hasAbsence.type.color}15`, // 15 is hex for 10% opacity
                              position: "relative" as const,
                            }
                          : {};

                        return (
                          <td
                            key={`${employeeId}-${dateString}`}
                            className={cn(
                              "text-center p-0 w-[160px] h-[130px] border-r border-border/30 last:border-r-0 transition-colors", // Fixed height for consistency
                              hasAbsence ? "relative" : "",
                            )}
                            style={{
                              ...cellStyle,
                              borderColor: hasAbsence
                                ? `${hasAbsence.type.color}`
                                : undefined,
                            }}
                            title={
                              hasAbsence
                                ? `${hasAbsence.type.name}`
                                : undefined
                            }
                          >
                            {hasAbsence && (
                              <>
                                <div
                                  className="absolute top-0 left-0 right-0 px-2 py-1 text-sm font-bold z-10 text-center"
                                  style={{
                                    backgroundColor: hasAbsence.type.color,
                                    color: "#fff",
                                    borderTopLeftRadius: "0.25rem",
                                    borderTopRightRadius: "0.25rem",
                                  }}
                                >
                                  {hasAbsence.type.name}
                                </div>
                                <div className="absolute inset-0 mt-8 flex flex-col items-center justify-center space-y-2 pt-4">
                                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                                  <span className="text-xs text-muted-foreground font-medium text-center px-2">
                                    No shifts allowed
                                    <br />
                                    during absence
                                  </span>
                                </div>
                              </>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
