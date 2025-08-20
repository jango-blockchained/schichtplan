import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getEmployees, getShifts } from "@/services/api";
import { Employee, Schedule, Shift } from "@/types";
import type { WeekVersionMeta } from "@/types/weekVersion";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, format, startOfDay } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  History,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useDrag } from "react-dnd";

interface ActionDockProps {
  currentVersion?: number;
  selectedDate?: Date;
  dateRange?: DateRange;
  versionMeta?: WeekVersionMeta;
  versionStatus?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  schedules?: Schedule[]; // Add schedules prop for weekly hour calculation
  onClose?: () => void;
  onDrop?: (employeeId: number, date: Date, shiftId: number) => Promise<void>;
  onAIPrompt?: (prompt: string) => Promise<void>;
}

interface DragItem {
  type: "SCHEDULE";
  scheduleId?: number;
  employeeId: number;
  shiftId: number | null;
  date: string;
  shift_type_id?: string;
  isDockItem?: boolean;
}

interface DraggableEmployeeProps {
  employee: Employee;
  selectedDate?: Date;
  currentVersion?: number;
}

interface DraggableShiftProps {
  shift: Shift;
  selectedDate?: Date;
  currentVersion?: number;
}

const QUICK_PROMPT_TEMPLATES = [
  {
    id: "optimize",
    label: "Aktuellen Plan optimieren",
    prompt: "Optimiere den aktuellen Schichtplan für bessere Arbeitsbelastungsverteilung und Mitarbeiterzufriedenheit.",
    icon: Sparkles,
  },
  {
    id: "fill-empty",
    label: "Leere Schichten füllen",
    prompt: "Fülle alle leeren Schichten mit verfügbaren Mitarbeitern unter Berücksichtigung ihrer Präferenzen.",
    icon: Users,
  },
  {
    id: "balance-workload",
    label: "Arbeitsbelastung ausgleichen",
    prompt: "Gleiche die Arbeitsbelastung zwischen allen Mitarbeitern aus, um faire Stundenverteilung zu gewährleisten.",
    icon: RotateCcw,
  },
  {
    id: "respect-preferences",
    label: "Präferenzen respektieren",
    prompt: "Reorganisiere den Plan um die Mitarbeiterpräferenzen bestmöglich zu respektieren, ohne kritische Abdeckung zu gefährden.",
    icon: Users,
  },
];

const DraggableEmployee: React.FC<DraggableEmployeeProps> = ({
  employee,
  selectedDate,
  currentVersion
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: "SCHEDULE",
    item: (): DragItem => ({
      type: "SCHEDULE",
      employeeId: employee.id,
      shiftId: null,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      isDockItem: true,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const getEmployeeGroupColor = (group: string) => {
    switch (group) {
      case "VZ": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "TZ": return "bg-green-500/20 text-green-300 border-green-500/30";
      case "GFB": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "TL": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      default: return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <div
      ref={drag}
      className={cn(
        "flex flex-col items-center p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-all cursor-move min-w-[120px] select-none",
        isDragging && "opacity-50 scale-95",
        !isDragging && "hover:scale-105"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground mb-1" />
      <div className="text-sm font-medium text-center mb-2">
        {employee.first_name} {employee.last_name}
      </div>
      <div className="flex flex-col gap-1 items-center">
        <Badge
          variant="secondary"
          className={cn("text-xs", getEmployeeGroupColor(employee.employee_group))}
        >
          {employee.employee_group}
        </Badge>
        {employee.is_keyholder && (
          <Badge variant="outline" className="text-xs">
            🔑 Keyholder
          </Badge>
        )}
        <div className="text-xs text-muted-foreground">
          {employee.contracted_hours}h/week
        </div>
      </div>
    </div>
  );
};

const DraggableShift: React.FC<DraggableShiftProps> = ({
  shift,
  selectedDate,
  currentVersion
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: "SCHEDULE",
    item: (): DragItem => ({
      type: "SCHEDULE",
      employeeId: 0,
      shiftId: shift.id,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      shift_type_id: shift.shift_type_id,
      isDockItem: true,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const getShiftTypeColor = (shiftType?: string) => {
    switch (shiftType) {
      case "EARLY": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "MIDDLE": return "bg-green-500/20 text-green-300 border-green-500/30";
      case "LATE": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      default: return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  const getShiftTypeName = (shiftType?: string) => {
    switch (shiftType) {
      case "EARLY": return "Früh";
      case "MIDDLE": return "Mitte";
      case "LATE": return "Spät";
      case "NO_WORK": return "Kein Dienst";
      case "UNAVAILABLE": return "Nicht verfügbar";
      default: return "Schicht";
    }
  };

  return (
    <div
      ref={drag}
      className={cn(
        "flex flex-col items-center p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-all cursor-move min-w-[120px] select-none",
        isDragging && "opacity-50 scale-95",
        !isDragging && "hover:scale-105"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground mb-1" />
      <div className="text-sm font-medium text-center mb-2">
        {shift.start_time} - {shift.end_time}
      </div>
      <div className="flex flex-col gap-1 items-center">
        {shift.shift_type_id && (
          <Badge
            variant="secondary"
            className={cn("text-xs", getShiftTypeColor(shift.shift_type_id))}
          >
            {getShiftTypeName(shift.shift_type_id)}
          </Badge>
        )}
        <div className="text-xs text-muted-foreground">
          {shift.duration_hours}h
        </div>
        {shift.requires_break && (
          <Badge variant="outline" className="text-xs">
            ☕ Break
          </Badge>
        )}
      </div>
    </div>
  );
};

// === CENTRALIZED TIME CALCULATION FUNCTIONS (COPIED FROM SCHEDLETABLE) ===

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
const calculateBreakDuration = (schedule: Schedule, employee?: Employee, settings?: { general?: { keyholder_before_minutes?: number; keyholder_after_minutes?: number; store_opening?: string; store_closing?: string } }): number => {
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
  settings?: { general?: { keyholder_before_minutes?: number; keyholder_after_minutes?: number; store_opening?: string; store_closing?: string } }
): { startTime: string, endTime: string } => {

  if (!employee?.is_keyholder || !schedule.shift_start || !schedule.shift_end || !settings?.general) {
    return { startTime: schedule.shift_start || "", endTime: schedule.shift_end || "" };
  }

  const { keyholder_before_minutes = 5, keyholder_after_minutes = 10, store_opening, store_closing } = settings.general;

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

// Calculate final working time with all adjustments for ActionDock
const calculateWorkingTimeForDock = (
  schedule: Schedule,
  employee: Employee | undefined,
  settings?: { general?: { keyholder_before_minutes?: number; keyholder_after_minutes?: number; store_opening?: string; store_closing?: string } }
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

// === END CENTRALIZED TIME CALCULATION FUNCTIONS ===

export const ActionDock: React.FC<ActionDockProps> = ({
  currentVersion,
  selectedDate,
  dateRange,
  versionMeta,
  versionStatus,
  schedules = [],
  onClose,
  onDrop,
  onAIPrompt,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("drag-drop");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiPromptSending, setIsAiPromptSending] = useState(false);
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
  });

  const activeEmployees = useMemo(() =>
    employees.filter(emp => emp.is_active),
    [employees]
  );

  const availableShifts = useMemo(() => {
    if (!selectedDate) return shifts;

    const dayOfWeek = selectedDate.getDay();
    const backendDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    return shifts.filter(shift => {
      if (!shift.active_days) return true;

      if (Array.isArray(shift.active_days)) {
        return shift.active_days.includes(backendDayIndex);
      } else if (typeof shift.active_days === 'object') {
        return shift.active_days[backendDayIndex.toString()] === true;
      }

      return true;
    });
  }, [shifts, selectedDate]);

  // Get employees and settings data for proper hour calculation
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { getSettings } = await import("@/services/api");
      return getSettings();
    },
  });

  // Calculate total weekly hours with deduplication and placeholder filtering
  const totalWeeklyHours = useMemo(() => {
    if (!schedules.length || !dateRange?.from || !dateRange?.to || !employees.length) return 0;

    console.log('DEBUG: Weekly hours calculation', {
      totalSchedules: schedules.length,
      dateRange: {
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString()
      }
    });

    // Log schedules by day to understand what we're getting
    const schedulesByDay: { [day: string]: number } = {};
    schedules.forEach(s => {
      try {
        const d = typeof s.date === 'string' ? new Date(s.date) : (s.date as unknown as Date);
        const dayName = d.toLocaleDateString('en', { weekday: 'long' });
        schedulesByDay[dayName] = (schedulesByDay[dayName] || 0) + 1;
      } catch { }
    });
    console.log('DEBUG: Input schedules by day:', schedulesByDay);

    // Normalize range to local day boundaries to avoid timezone drift (e.g., dropping Mondays)
    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);

    // Filter to assigned schedules in range and exclude placeholder 00:00-00:00
    const inRangeAssigned = schedules.filter((s) => {
      if (s.is_empty || s.shift_id === null) return false;
      if (!s.shift_start || !s.shift_end) return false;
      if (s.shift_start === '00:00' && s.shift_end === '00:00') return false;
      try {
        // Parse schedule date in a timezone-safe way by constructing a local date from parts
        let scheduleDate: Date;
        if (typeof s.date === 'string') {
          const iso = s.date.includes('T') ? s.date.split('T')[0] : s.date;
          const [y, m, d] = iso.split('-').map(Number);
          scheduleDate = new Date(y, (m || 1) - 1, d || 1);
        } else {
          const dObj = s.date as unknown as Date;
          scheduleDate = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
        }

        const inRange = scheduleDate >= rangeStart && scheduleDate <= rangeEnd;
        const dayOfWeek = scheduleDate.getDay(); // 0=Sunday, 1=Monday, etc.

        // Debug logging for Monday schedules (dayOfWeek === 1)
        if (dayOfWeek === 1) {
          console.log('DEBUG: Monday schedule', {
            originalDate: d.toISOString(),
            normalizedScheduleDate: scheduleDate.toISOString(),
            normalizedRangeStart: rangeStart.toISOString(),
            normalizedRangeEnd: rangeEnd.toISOString(),
            inRange,
            employee_id: s.employee_id,
            shift_start: s.shift_start,
            shift_end: s.shift_end
          });
        }

        return inRange;
      } catch { return false; }
    });

    // Deduplicate by employee per day, prefer entries with real times (already filtered)
    const bestByEmployeeDate = new Map<string, Schedule>();
    inRangeAssigned.forEach((s) => {
      const dateKey = (typeof s.date === 'string' ? s.date.split('T')[0] : format(s.date as unknown as Date, 'yyyy-MM-dd'));
      const key = `${s.employee_id}:${dateKey}`;
      if (!bestByEmployeeDate.has(key)) bestByEmployeeDate.set(key, s);
      else {
        // If both exist, keep existing; times already valid, so no extra scoring needed
      }
    });

    let total = 0;
    const dailyTotals: { [day: string]: number } = {};

    bestByEmployeeDate.forEach((schedule) => {
      try {
        const employee = employees.find(emp => emp.id === schedule.employee_id);
        const timeCalc = calculateWorkingTimeForDock(schedule, employee, settings);
        total += timeCalc.workingTime;

        // Track by day for debugging
        const scheduleDate = typeof schedule.date === 'string' ? schedule.date.split('T')[0] : format(schedule.date as unknown as Date, 'yyyy-MM-dd');
        const dayOfWeek = new Date(scheduleDate).toLocaleDateString('en', { weekday: 'long' });
        dailyTotals[dayOfWeek] = (dailyTotals[dayOfWeek] || 0) + timeCalc.workingTime;
      } catch (error) {
        console.error('Error calculating hours for schedule:', schedule, error);
      }
    });

    console.log('DEBUG: Daily totals breakdown', dailyTotals);
    console.log('DEBUG: Final weekly total', total);

    return total;
  }, [schedules, dateRange, employees, settings]);

  const handleQuickPrompt = (template: typeof QUICK_PROMPT_TEMPLATES[0]) => {
    setAiPrompt(template.prompt);
    setActiveTab("ai-assistant");
  };

  const handleSendPrompt = async () => {
    if (!aiPrompt.trim()) return;

    setIsAiPromptSending(true);
    try {
      await onAIPrompt?.(aiPrompt);

      // Add to recent prompts (max 5)
      setRecentPrompts(prev => {
        const updated = [aiPrompt, ...prev.filter(p => p !== aiPrompt)];
        return updated.slice(0, 5);
      });

      setAiPrompt("");
    } catch (error) {
      console.error("AI prompt error:", error);
    } finally {
      setIsAiPromptSending(false);
    }
  };

  const handleRecentPrompt = (prompt: string) => {
    setAiPrompt(prompt);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-t border-border">
      {/* Dock Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <span className="font-medium">Action Dock</span>
            <Badge variant="secondary" className="ml-2">
              {activeTab === "drag-drop"
                ? availableShifts.length
                : activeTab === "ai-assistant" ? "AI" : "Tools"
              }
            </Badge>
          </Button>
          {!isExpanded && (
            <div className="text-xs text-muted-foreground hidden sm:block">
              💡 Erweitern für Drag & Drop, KI-Assistent und Quick Actions
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Enhanced Date Badge with Version, Date Range, and Status */}
          {(selectedDate || dateRange || currentVersion || versionStatus || totalWeeklyHours > 0) && (
            <div className="flex items-center gap-1">
              {/* Weekly Hours Counter Badge */}
              {totalWeeklyHours > 0 && (
                <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">
                  <Clock className="h-3 w-3 mr-1" />
                  {totalWeeklyHours.toFixed(1)}h
                </Badge>
              )}

              {/* Version Badge */}
              {currentVersion && (
                <Badge variant="secondary" className="text-xs font-mono">
                  v{currentVersion}
                </Badge>
              )}

              {/* Date Range Badge */}
              {dateRange?.from && dateRange?.to ? (
                <Badge variant="outline" className="text-xs">
                  {format(dateRange.from, "dd.MM")} - {format(dateRange.to, "dd.MM.yyyy")}
                </Badge>
              ) : selectedDate ? (
                <Badge variant="outline" className="text-xs">
                  {format(selectedDate, "dd.MM.yyyy")}
                </Badge>
              ) : null}

              {/* Status Badge */}
              {(versionStatus || versionMeta?.status) && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    (versionStatus || versionMeta?.status) === "PUBLISHED" && "bg-green-500/20 text-green-300 border-green-500/30",
                    (versionStatus || versionMeta?.status) === "DRAFT" && "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                    (versionStatus || versionMeta?.status) === "ARCHIVED" && "bg-gray-500/20 text-gray-300 border-gray-500/30"
                  )}
                >
                  {(versionStatus || versionMeta?.status)?.toLowerCase()}
                </Badge>
              )}
            </div>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Dock Content */}
      {isExpanded && (
        <div className="max-h-80 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-4 py-2 border-b border-border">
              <TabsList className="grid w-fit grid-cols-3">
                <TabsTrigger value="drag-drop" className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4" />
                  Drag & Drop
                </TabsTrigger>
                <TabsTrigger value="ai-assistant" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  KI-Assistent
                </TabsTrigger>
                <TabsTrigger value="quick-actions" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Quick Actions
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="drag-drop" className="mt-0">
              <Tabs defaultValue="employees" className="w-full">
                <div className="px-4 py-2">
                  <TabsList className="grid w-fit grid-cols-2">
                    <TabsTrigger value="employees" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Mitarbeiter
                    </TabsTrigger>
                    <TabsTrigger value="shifts" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Schichten
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="employees" className="mt-0">
                  <ScrollArea className="h-64">
                    <div className="p-4">
                      {activeEmployees.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-muted-foreground">
                          <div className="text-center">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Keine aktiven Mitarbeiter verfügbar</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-auto-fit-120 gap-3">
                          {activeEmployees.map((employee) => (
                            <DraggableEmployee
                              key={employee.id}
                              employee={employee}
                              selectedDate={selectedDate}
                              currentVersion={currentVersion}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="shifts" className="mt-0">
                  <ScrollArea className="h-64">
                    <div className="p-4">
                      {availableShifts.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-muted-foreground">
                          <div className="text-center">
                            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Keine Schichten für dieses Datum verfügbar</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-auto-fit-120 gap-3">
                          {availableShifts.map((shift) => (
                            <DraggableShift
                              key={shift.id}
                              shift={shift}
                              selectedDate={selectedDate}
                              currentVersion={currentVersion}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="ai-assistant" className="mt-0">
              <ScrollArea className="h-64">
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-prompt">KI-Anweisung</Label>
                    <Textarea
                      id="ai-prompt"
                      placeholder="Beschreiben Sie, wie der Schichtplan optimiert werden soll..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="min-h-20 resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendPrompt}
                      disabled={!aiPrompt.trim() || isAiPromptSending}
                      className="flex-1"
                    >
                      {isAiPromptSending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Sende...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Senden
                        </>
                      )}
                    </Button>

                    {recentPrompts.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <History className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-80">
                          {recentPrompts.map((prompt, index) => (
                            <DropdownMenuItem
                              key={index}
                              onClick={() => handleRecentPrompt(prompt)}
                              className="text-left whitespace-normal"
                            >
                              <div className="truncate">{prompt}</div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Schnell-Vorlagen</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {QUICK_PROMPT_TEMPLATES.map((template) => (
                        <Button
                          key={template.id}
                          variant="outline"
                          className="justify-start h-auto p-3 text-left"
                          onClick={() => handleQuickPrompt(template)}
                        >
                          <template.icon className="h-4 w-4 mr-2 flex-shrink-0" />
                          <div>
                            <div className="font-medium">{template.label}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {template.prompt}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="quick-actions" className="mt-0">
              <ScrollArea className="h-64">
                <div className="p-4">
                  <div className="text-center text-muted-foreground">
                    <Zap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Quick Actions</p>
                    <p className="text-sm">Coming soon...</p>
                    <p className="text-xs mt-2">
                      Bulk-Operationen, Vorlagen und Konfliktlösung
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};