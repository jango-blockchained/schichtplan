import AISchedulerPanel from '@/components/AISchedulerPanel';
import { AIConversationGenerationDialog } from '@/components/Schedule/AIConversationGenerationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import QuickActionsMenu from '@/components/ui/QuickActionsMenu';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Schedule as APISchedule,
  Shift as APIShift,
  createSchedule,
  exportSchedule,
  generateDemoData,
  getAbsencesByRange,
  getEmployeeAvailabilityByDate,
  getEmployees,
  getSchedules,
  getSettings,
  getShifts as getShiftTemplatesApiService,
  getSpecialDays,
  ScheduleResponse,
  updateSchedule,
} from '@/services/api';
import { Absence, Employee, EmployeeAvailabilityStatus, SpecialDay } from '@/types';
import { getWeekStartsOn } from '@/utils/weekStart';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, addWeeks, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek, subWeeks } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
  Users
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';

// Import AI components
import { LiveScheduleOptimizer } from "@/components/ai/LiveScheduleOptimizer";
import { RealTimeConflictDetector } from "@/components/ai/RealTimeConflictDetector";

type ViewMode = 'month' | 'week' | 'day';

interface ShiftTypeColor {
  [key: string]: string;
}

const shiftTypeColors: ShiftTypeColor = {
  'EARLY': 'bg-blue-500',
  'MIDDLE': 'bg-green-500',
  'LATE': 'bg-purple-500',
  'NIGHT': 'bg-indigo-500',
};

interface FilterOptions {
  employees: number[];
  shiftTypes: string[];
  showEmpty: boolean;
  showConflicts: boolean;
  showAvailability: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ScheduleAssignment {
  id: string;
  schedule: APISchedule;
  employee: Employee | null;
  shift: APIShift | null;
}

const CalendarPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State Management
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    employees: [],
    shiftTypes: [],
    showEmpty: true, // Include empty schedules by default like SchedulePage
    showConflicts: false,
    showAvailability: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<APISchedule | null>(null);
  const [isAIConversationOpen, setIsAIConversationOpen] = useState(false);
  const [isAISuggestionsOpen, setIsAISuggestionsOpen] = useState(false);
  // const [isDragging, setIsDragging] = useState(false); // (drag state currently unused)

  // Settings for dynamic week start
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings, staleTime: 300_000 });
  const weekStartsOn = getWeekStartsOn(settings);

  // Date calculations
  const dateRange = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        };
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn }),
          end: endOfWeek(currentDate, { weekStartsOn })
        };
      case 'day':
        return {
          start: currentDate,
          end: currentDate
        };
    }
  }, [currentDate, viewMode, weekStartsOn]);

  // Fetch Special Days / Holidays
  const { data: specialDays } = useQuery<Record<string, SpecialDay>>({
    queryKey: ['specialDays'],
    queryFn: getSpecialDays,
    staleTime: 300_000,
  });

  // Fetch Absences for current date range
  const { data: absences } = useQuery<Absence[], Error>({
    queryKey: ['absences', format(dateRange.start, 'yyyy-MM-dd'), format(dateRange.end, 'yyyy-MM-dd')],
    queryFn: () => getAbsencesByRange(
      format(dateRange.start, 'yyyy-MM-dd'),
      format(dateRange.end, 'yyyy-MM-dd')
    ),
  });

  // Fetch Schedules
  // refetchSchedules omitted (unused)
  const { data: scheduleResponse, isLoading: isLoadingSchedules, error: schedulesError } = useQuery<ScheduleResponse, Error>({
    queryKey: [
      'schedules',
      format(dateRange.start, 'yyyy-MM-dd'),
      format(dateRange.end, 'yyyy-MM-dd'),
      selectedVersion,
      filterOptions.showEmpty,
    ],
    queryFn: () =>
      getSchedules(
        format(dateRange.start, 'yyyy-MM-dd'),
        format(dateRange.end, 'yyyy-MM-dd'),
        selectedVersion,
        filterOptions.showEmpty
      ),
  });

  // Set initial version
  useEffect(() => {
    if (scheduleResponse?.versions && scheduleResponse.versions.length > 0 && selectedVersion === undefined) {
      const sortedVersions = [...scheduleResponse.versions].sort((a, b) => b - a);
      setSelectedVersion(sortedVersions[0]);
    }
  }, [scheduleResponse, selectedVersion]);

  // Fetch Employees
  const { data: employees, isLoading: isLoadingEmployees } = useQuery<Employee[], Error>({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  // Fetch Shift Templates
  const { data: shiftTemplates, isLoading: isLoadingShiftTemplates } = useQuery<APIShift[], Error>({
    queryKey: ['shiftTemplates'],
    queryFn: getShiftTemplatesApiService,
  });

  // Fetch availability for selected date
  const { data: availabilityStatus } = useQuery<EmployeeAvailabilityStatus[], Error>({
    queryKey: ['availability', selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null],
    queryFn: () => getEmployeeAvailabilityByDate(format(selectedDate!, 'yyyy-MM-dd')),
    enabled: !!selectedDate && filterOptions.showAvailability,
  });

  // Create maps for quick lookups
  const employeeMap = useMemo(() => {
    if (!employees) return new Map<number, Employee>();
    return new Map(employees.map(emp => [emp.id, emp]));
  }, [employees]);

  const shiftTemplateMap = useMemo(() => {
    if (!shiftTemplates) return new Map<number, APIShift>();
    return new Map(shiftTemplates.map(st => [st.id, st]));
  }, [shiftTemplates]);

  // Filter schedules based on filter options
  const filteredSchedules = useMemo(() => {
    if (!scheduleResponse?.schedules) return [];

    return scheduleResponse.schedules.filter(schedule => {
      // Filter by employees
      if (filterOptions.employees.length > 0 && !filterOptions.employees.includes(schedule.employee_id)) {
        return false;
      }

      // Filter by shift types
      if (filterOptions.shiftTypes.length > 0 && schedule.shift_type_id && !filterOptions.shiftTypes.includes(schedule.shift_type_id)) {
        return false;
      }

      // Filter empty schedules
      if (!filterOptions.showEmpty && (!schedule.shift_id || schedule.is_empty)) {
        return false;
      }

      return true;
    });
  }, [scheduleResponse?.schedules, filterOptions]);

  // Group schedules by date
  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, APISchedule[]>();
    filteredSchedules.forEach(schedule => {
      // Handle both date formats: "2025-08-20" and "2025-08-20T00:00:00"
      const dateKey = schedule.date.split('T')[0]; // Extract just the date part
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(schedule);
    });
    return grouped;
  }, [filteredSchedules]);

  // Group absences by date (expand multi-day absences into daily buckets)
  const absencesByDate = useMemo(() => {
    const grouped = new Map<string, Absence[]>();
    if (!absences) return grouped;
    for (const a of absences) {
      let cursor = new Date(a.start_date);
      const end = new Date(a.end_date);
      // Normalize time to 00:00 to avoid DST issues
      cursor.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      while (cursor.getTime() <= end.getTime()) {
        const key = format(cursor, 'yyyy-MM-dd');
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(a);
        cursor = addDays(cursor, 1);
      }
    }
    return grouped;
  }, [absences]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const stats = {
      totalShifts: 0,
      filledShifts: 0,
      emptyShifts: 0,
      conflictCount: 0,
      employeeHours: new Map<number, number>(),
    };

    filteredSchedules.forEach(schedule => {
      if (schedule.shift_id) {
        stats.totalShifts++;
        if (schedule.employee_id) {
          stats.filledShifts++;
          const shift = shiftTemplateMap.get(schedule.shift_id);
          if (shift) {
            const current = stats.employeeHours.get(schedule.employee_id) || 0;
            stats.employeeHours.set(schedule.employee_id, current + shift.duration_hours);
          }
        } else {
          stats.emptyShifts++;
        }
      }
    });

    return stats;
  }, [filteredSchedules, shiftTemplateMap]);

  // Mutations
  const updateScheduleMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: ({ id, data }: { id: number; data: any }) => updateSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: "Schedule updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update schedule",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const createScheduleMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (data: any) => createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: "Schedule created successfully" });
      setIsScheduleDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to create schedule",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id: number) => updateSchedule(id, { shift_id: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: "Schedule cleared successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to clear schedule",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Navigation handlers
  const navigatePrevious = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        break;
      case 'week':
        setCurrentDate(prev => subWeeks(prev, 1));
        break;
      case 'day':
        setCurrentDate(prev => addDays(prev, -1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case 'day':
        setCurrentDate(prev => addDays(prev, 1));
        break;
    }
  };

  const navigateToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Export handler
  const handleExport = async () => {
    try {
      const blob = await exportSchedule(
        format(dateRange.start, 'yyyy-MM-dd'),
        format(dateRange.end, 'yyyy-MM-dd')
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule-${format(dateRange.start, 'yyyy-MM-dd')}-to-${format(dateRange.end, 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Schedule exported successfully" });
    } catch (error) {
      toast({
        title: "Failed to export schedule",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  // Drag and drop handler
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceId = result.draggableId;
    const parts = result.destination.droppableId.split('-');
    // Expect pattern: date-shiftId-employeeId; otherwise ignore
    if (parts.length < 3) return;
    const [targetDate, targetShiftId, targetEmployeeId] = parts;

    const schedule = filteredSchedules.find(s => s.id.toString() === sourceId);
    if (!schedule) return;

    updateScheduleMutation.mutate({
      id: schedule.id,
      data: {
        date: targetDate,
        shift_id: parseInt(targetShiftId),
        employee_id: targetEmployeeId === 'unassigned' ? null : parseInt(targetEmployeeId),
      }
    });
  };

  // Quick actions
  const handleCopyWeek = () => {
    toast({ title: "Copy week functionality coming soon" });
  };

  const handleClearDay = (date: string) => {
    const schedulesForDay = schedulesByDate.get(date) || [];
    schedulesForDay.forEach(schedule => {
      if (schedule.shift_id) {
        deleteScheduleMutation.mutate(schedule.id);
      }
    });
  };

  const handleGenerateDemoData = async () => {
    try {
      await generateDemoData('all', 10);
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: "Demo data generated successfully" });
    } catch (error) {
      toast({
        title: "Failed to generate demo data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const isLoading = isLoadingSchedules || isLoadingEmployees || isLoadingShiftTemplates;

  // Render functions
  const renderMonthView = () => (
    <div className="w-full">
      <CalendarComponent
        mode="single"
        selected={selectedDate}
        onSelect={setSelectedDate}
        month={currentDate}
        onMonthChange={setCurrentDate}
        className="rounded-md border w-full"
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-sm font-medium",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
            "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          row: "flex w-full mt-2",
          cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: cn(
            "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
            "inline-flex items-center justify-center rounded-md text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            "hover:bg-accent hover:text-accent-foreground"
          ),
          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside: "text-muted-foreground opacity-50",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
        }}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          Day: ({ date, displayMonth }) => {
            const formattedDate = format(date, 'yyyy-MM-dd');
            const daySchedules = schedulesByDate.get(formattedDate) || [];
            const hasSchedules = daySchedules.length > 0;
            const filledCount = daySchedules.filter(s => s.employee_id && s.shift_id).length;
            const totalCount = daySchedules.length; // Count ALL schedules, not just those with shift_id
            const shiftsCount = daySchedules.filter(s => s.shift_id).length;
            const holiday = specialDays && specialDays[formattedDate];
            const absencesCount = absencesByDate.get(formattedDate)?.length || 0;

            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative h-full w-full flex flex-col items-center justify-center group">
                      {holiday && (
                        <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-amber-500" />
                      )}
                      <span className="text-sm font-medium">{format(date, "d")}</span>
                      {hasSchedules && (
                        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-0.5 px-1">
                          {Array.from(new Set(daySchedules.filter(s => s.shift_type_id).map(s => s.shift_type_id))).map((shiftType, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                shiftTypeColors[shiftType as string] || 'bg-gray-500'
                              )}
                            />
                          ))}
                        </div>
                      )}
                      {shiftsCount > filledCount && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center"
                        >
                          {shiftsCount - filledCount}
                        </Badge>
                      )}
                      {absencesCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -bottom-1 -right-1 h-4 w-5 p-0 text-[10px] flex items-center justify-center"
                        >
                          A{absencesCount}
                        </Badge>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="text-xs">
                      <p className="font-semibold">{format(date, 'PPP')}</p>
                      {holiday && (
                        <p>Holiday: {holiday.description}{holiday.is_closed ? ' (Closed)' : ''}</p>
                      )}
                      {absencesCount > 0 && (
                        <p>Absences: {absencesCount}</p>
                      )}
                      {hasSchedules ? (
                        <>
                          <p>Total schedules: {totalCount}</p>
                          {shiftsCount > 0 && (
                            <>
                              <p>Shifts assigned: {shiftsCount}</p>
                              <p>Filled: {filledCount}</p>
                              <p>Empty: {shiftsCount - filledCount}</p>
                            </>
                          )}
                        </>
                      ) : (
                        <p>No schedules</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
        }}
      />
    </div>
  );

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <div className="grid grid-cols-8 gap-2">
        {/* Time column */}
        <div className="col-span-1">
          <div className="h-12 flex items-center justify-center font-semibold text-sm">Time</div>
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="h-20 flex items-center justify-center text-xs text-muted-foreground border-t">
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Days columns */}
        {weekDays.map((day) => {
          const formattedDate = format(day, 'yyyy-MM-dd');
          const daySchedules = schedulesByDate.get(formattedDate) || [];
          const holiday = specialDays && specialDays[formattedDate];
          const absencesCount = absencesByDate.get(formattedDate)?.length || 0;

          return (
            <div key={formattedDate} className="col-span-1">
              <div className={cn(
                "h-12 flex flex-col items-center justify-center font-semibold text-sm border rounded-t",
                isSameDay(day, new Date()) && "bg-primary text-primary-foreground",
                isSameDay(day, selectedDate || new Date()) && "ring-2 ring-primary"
              )}>
                <span>{format(day, 'EEE')}</span>
                <span className="text-xs">{format(day, 'd')}</span>
                <div className="flex gap-1 mt-0.5">
                  {holiday && <Badge variant="secondary" className="h-4 px-1 text-[10px]">Holiday</Badge>}
                  {absencesCount > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px]">A{absencesCount}</Badge>}
                </div>
              </div>

              <ScrollArea className="h-[500px] border-x border-b rounded-b">
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId={`${formattedDate}-week`}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="min-h-full"
                      >
                        {daySchedules.map((schedule, index) => {
                          const employee = employeeMap.get(schedule.employee_id);
                          const shift = shiftTemplateMap.get(schedule.shift_id!);

                          if (!shift) return null;

                          return (
                            <Draggable
                              key={schedule.id}
                              draggableId={schedule.id.toString()}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "p-1 m-1 rounded text-xs cursor-move",
                                    shiftTypeColors[schedule.shift_type_id || ''] || 'bg-gray-100',
                                    "text-white",
                                    snapshot.isDragging && "opacity-50"
                                  )}
                                  style={{
                                    ...provided.draggableProps.style,
                                  }}
                                >
                                  <p className="font-semibold truncate">
                                    {employee ? `${employee.first_name} ${employee.last_name}` : 'Unassigned'}
                                  </p>
                                  <p className="text-[10px]">
                                    {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                                  </p>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const formattedDate = format(currentDate, 'yyyy-MM-dd');
    const daySchedules = schedulesByDate.get(formattedDate) || [];
    const holiday = specialDays && specialDays[formattedDate];
    const absencesCount = absencesByDate.get(formattedDate)?.length || 0;
    const hourlySchedules = new Map<number, APISchedule[]>();

    // Group schedules by hour
    daySchedules.forEach(schedule => {
      const shift = shiftTemplateMap.get(schedule.shift_id!);
      if (!shift) return;

      const startHour = parseInt(shift.start_time.split(':')[0]);
      if (!hourlySchedules.has(startHour)) {
        hourlySchedules.set(startHour, []);
      }
      hourlySchedules.get(startHour)!.push(schedule);
    });

    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {format(currentDate, 'PPPP')}
            {holiday && <Badge variant="secondary">Holiday{holiday.is_closed ? ' (Closed)' : ''}</Badge>}
            {absencesCount > 0 && <Badge variant="outline">Absences: {absencesCount}</Badge>}
          </h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsScheduleDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Schedule
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleClearDay(formattedDate)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear Day
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            {Array.from({ length: 24 }, (_, hour) => {
              const schedules = hourlySchedules.get(hour) || [];

              return (
                <div key={hour} className="flex gap-4 p-2 border rounded">
                  <div className="w-16 text-sm font-medium text-muted-foreground">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  <div className="flex-1">
                    {schedules.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {schedules.map(schedule => {
                          const employee = employeeMap.get(schedule.employee_id);
                          const shift = shiftTemplateMap.get(schedule.shift_id!);

                          return (
                            <Card key={schedule.id} className="p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold text-sm">
                                    {employee ? `${employee.first_name} ${employee.last_name}` : 'Unassigned'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {shift?.start_time.substring(0, 5)} - {shift?.end_time.substring(0, 5)}
                                  </p>
                                  {schedule.shift_type_id && (
                                    <Badge
                                      className={cn(
                                        "mt-1",
                                        shiftTypeColors[schedule.shift_type_id] || 'bg-gray-500'
                                      )}
                                    >
                                      {schedule.shift_type_id}
                                    </Badge>
                                  )}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => {
                                      setEditingSchedule(schedule);
                                      setIsScheduleDialogOpen(true);
                                    }}>
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                                      className="text-destructive"
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No schedules</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderSelectedDateSchedules = () => {
    if (!selectedDate) return null;

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const daySchedules = schedulesByDate.get(formattedDate) || [];

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>{format(selectedDate, 'PPP')}</span>
            <Badge variant="secondary">{daySchedules.length} schedules</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filterOptions.showAvailability && availabilityStatus && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Employee Availability</h4>
              <div className="space-y-1">
                {availabilityStatus.map(status => (
                  <div key={status.employee_id} className="flex justify-between text-xs">
                    <span>{status.employee_name}</span>
                    <Badge variant={status.status === 'Available' ? 'default' : 'secondary'}>
                      {status.status}
                    </Badge>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
            </div>
          )}

          <ScrollArea className="h-[400px]">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId={`${formattedDate}-sidebar`}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {daySchedules.length > 0 ? (
                      daySchedules.map((schedule, index) => {
                        const employee = employeeMap.get(schedule.employee_id);
                        const shift = shiftTemplateMap.get(schedule.shift_id!);

                        return (
                          <Draggable
                            key={schedule.id}
                            draggableId={schedule.id.toString()}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "p-3 cursor-move",
                                  snapshot.isDragging && "opacity-50"
                                )}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <p className="font-semibold text-sm">
                                      {employee ? `${employee.first_name} ${employee.last_name}` : 'Unassigned'}
                                    </p>
                                    {shift && (
                                      <p className="text-xs text-muted-foreground">
                                        {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                                        {shift.duration_hours && ` (${shift.duration_hours}h)`}
                                      </p>
                                    )}
                                    {schedule.shift_type_id && (
                                      <Badge
                                        className={cn(
                                          "mt-1",
                                          shiftTypeColors[schedule.shift_type_id] || 'bg-gray-500'
                                        )}
                                        variant="secondary"
                                      >
                                        {schedule.shift_type_id}
                                      </Badge>
                                    )}
                                    {schedule.notes && (
                                      <p className="text-xs mt-1 text-muted-foreground">
                                        Note: {schedule.notes}
                                      </p>
                                    )}
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuItem onClick={() => {
                                        setEditingSchedule(schedule);
                                        setIsScheduleDialogOpen(true);
                                      }}>
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                                        className="text-destructive"
                                      >
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </Card>
                            )}
                          </Draggable>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Info className="h-8 w-8 mx-auto mb-2" />
                        <p>No schedules for this date</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => setIsScheduleDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Schedule
                        </Button>
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Calendar View
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <p>• Click on dates to view schedules</p>
                  <p>• Drag and drop to reassign shifts</p>
                  <p>• Use filters to customize view</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h1>

        <div className="flex flex-wrap gap-2 items-center">
          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="month">
                <Calendar className="h-4 w-4 mr-1" />
                Month
              </TabsTrigger>
              <TabsTrigger value="week">
                <CalendarDays className="h-4 w-4 mr-1" />
                Week
              </TabsTrigger>
              <TabsTrigger value="day">
                <CalendarRange className="h-4 w-4 mr-1" />
                Day
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={navigateToday}>
              Today
            </Button>
            <Button size="icon" variant="outline" onClick={navigatePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Version Selector */}
          {scheduleResponse?.versions && scheduleResponse.versions.length > 0 && (
            <Select
              value={selectedVersion?.toString()}
              onValueChange={(value) => setSelectedVersion(Number(value))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select Version" />
              </SelectTrigger>
              <SelectContent>
                {scheduleResponse.versions.map((ver: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                  const versionNumber = typeof ver === 'number' ? ver : ver.version;
                  let currentVersionNumber: number | null = (scheduleResponse.current_version as any); // eslint-disable-line @typescript-eslint/no-explicit-any
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  if (typeof currentVersionNumber === 'object' && currentVersionNumber !== null && 'version' in (currentVersionNumber as any)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    currentVersionNumber = (currentVersionNumber as any).version;
                  }
                  if (currentVersionNumber == null) currentVersionNumber = -1; // fallback sentinel
                  return (
                    <SelectItem key={versionNumber} value={versionNumber.toString()}>
                      Version {versionNumber}
                      {versionNumber === currentVersionNumber && ' (Current)'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          {/* Unified quick actions menu (navigation + AI + utilities) */}
          <QuickActionsMenu
            onPageUp={navigatePrevious}
            onPageDown={navigateNext}
            onOpenAIConversation={() => setIsAIConversationOpen(true)}
            onOpenAISuggestions={() => setIsAISuggestionsOpen(true)}
            onExport={handleExport}
            onCopyWeek={handleCopyWeek}
            onGenerateDemoData={handleGenerateDemoData}
            onToggleFilters={() => setShowFilters(!showFilters)}
          />
        </div>
      </div>

      {/* Statistics Bar */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Total Shifts:</span>
              <span>{statistics.totalShifts}</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">Filled:</span>
              <span>{statistics.filledShifts}</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="font-medium">Empty:</span>
              <span>{statistics.emptyShifts}</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Coverage:</span>
              <Progress
                value={(statistics.filledShifts / (statistics.totalShifts || 1)) * 100}
                className="w-24 h-2"
              />
              <span>{Math.round((statistics.filledShifts / (statistics.totalShifts || 1)) * 100)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <LiveScheduleOptimizer />
        <RealTimeConflictDetector />
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm">Employees</Label>
                <Select
                  value={filterOptions.employees.length > 0 ? "custom" : "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      setFilterOptions(prev => ({ ...prev, employees: [] }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees?.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Shift Types</Label>
                <Select
                  value={filterOptions.shiftTypes.length > 0 ? "custom" : "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      setFilterOptions(prev => ({ ...prev, shiftTypes: [] }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Shift Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shift Types</SelectItem>
                    <SelectItem value="EARLY">Early</SelectItem>
                    <SelectItem value="MIDDLE">Middle</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm">Options</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filterOptions.showEmpty}
                      onChange={(e) => setFilterOptions(prev => ({ ...prev, showEmpty: e.target.checked }))}
                      className="rounded"
                    />
                    Show empty shifts
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filterOptions.showConflicts}
                      onChange={(e) => setFilterOptions(prev => ({ ...prev, showConflicts: e.target.checked }))}
                      className="rounded"
                    />
                    Show conflicts only
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filterOptions.showAvailability}
                      onChange={(e) => setFilterOptions(prev => ({ ...prev, showAvailability: e.target.checked }))}
                      className="rounded"
                    />
                    Show availability
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="flex-1">
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-[500px]">
                <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
              </div>
            ) : schedulesError ? (
              <div className="flex flex-col items-center justify-center h-[500px]">
                <AlertCircle className="w-8 h-8 text-destructive mb-2" />
                <p className="text-destructive font-medium">Error: {schedulesError.message}</p>
              </div>
            ) : (
              <div className="animate-fade-in">
                {viewMode === 'month' && renderMonthView()}
                {viewMode === 'week' && renderWeekView()}
                {viewMode === 'day' && renderDayView()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar for selected date */}
        {viewMode === 'month' && (
          <div className="w-full lg:w-96">
            {renderSelectedDateSchedules()}
          </div>
        )}
      </div>

      {/* Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Edit Schedule' : 'Create Schedule'}
            </DialogTitle>
            <DialogDescription>
              {editingSchedule ? 'Update the schedule details below.' : 'Fill in the details to create a new schedule.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);

            if (editingSchedule) {
              // Update existing schedule
              updateScheduleMutation.mutate({
                id: editingSchedule.id,
                data: {
                  employee_id: formData.get('employee') === 'unassigned' ? null : Number(formData.get('employee')),
                  shift_id: Number(formData.get('shift')),
                  notes: formData.get('notes')?.toString() || null,
                }
              });
            } else {
              // Create new schedule
              createScheduleMutation.mutate({
                date: formData.get('date')?.toString() || format(selectedDate || new Date(), 'yyyy-MM-dd'),
                employee_id: formData.get('employee') === 'unassigned' ? null : Number(formData.get('employee')),
                shift_id: Number(formData.get('shift')),
                version: selectedVersion || 1,
                notes: formData.get('notes')?.toString() || null,
              });
            }

            setEditingSchedule(null);
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={editingSchedule?.date || (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '')}
                  disabled={!!editingSchedule}
                  required={!editingSchedule}
                />
              </div>

              <div>
                <Label htmlFor="employee">Employee</Label>
                <Select name="employee" defaultValue={editingSchedule?.employee_id?.toString() || 'unassigned'}>
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {employees?.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="shift">Shift</Label>
                <Select name="shift" defaultValue={editingSchedule?.shift_id?.toString()} required>
                  <SelectTrigger id="shift">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTemplates?.map(shift => (
                      <SelectItem key={shift.id} value={shift.id.toString()}>
                        {shift.shift_type_id} ({shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Add any notes..."
                  defaultValue={editingSchedule?.notes || ''}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => {
                setIsScheduleDialogOpen(false);
                setEditingSchedule(null);
              }}>
                Cancel
              </Button>
              <Button type="submit">
                {editingSchedule ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Conversation Dialog (unified menu opens this) */}
      <Dialog open={isAIConversationOpen} onOpenChange={(open) => setIsAIConversationOpen(open)}>
        <DialogContent>
          <AIConversationGenerationDialog
            isOpen={isAIConversationOpen}
            onClose={() => setIsAIConversationOpen(false)}
            startDate={format(dateRange.start, 'yyyy-MM-dd')}
            endDate={format(dateRange.end, 'yyyy-MM-dd')}
            versionId={selectedVersion}
            onComplete={() => {
              queryClient.invalidateQueries({ queryKey: ['schedules'] });
              setIsAIConversationOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* AI Suggestions Dialog */}
      <Dialog open={isAISuggestionsOpen} onOpenChange={(open) => setIsAISuggestionsOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Suggestions</DialogTitle>
          </DialogHeader>
          <AISchedulerPanel />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
