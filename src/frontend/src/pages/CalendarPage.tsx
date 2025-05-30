import React, { useEffect, useState } from 'react';
import { Calendar, CalendarProps } from '@/components/ui/calendar';
import { useQuery } from '@tanstack/react-query';
import {
  getSchedules,
  ScheduleResponse,
  Schedule as APISchedule,
  getEmployees,
  getShifts as getShiftTemplatesApiService,
  Shift as APIShift,
} from '@/services/api';
import { Employee } from '@/types';
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';

const CalendarPage: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);

  const firstDayOfMonth = startOfMonth(currentMonth);
  const lastDayOfMonth = endOfMonth(currentMonth);

  // Fetch Schedules
  const { data: scheduleResponse, isLoading: isLoadingSchedules, error: schedulesError } = useQuery<ScheduleResponse, Error>({
    queryKey: [
      'schedules',
      format(firstDayOfMonth, 'yyyy-MM-dd'),
      format(lastDayOfMonth, 'yyyy-MM-dd'),
      selectedVersion,
    ],
    queryFn: () => 
      getSchedules(
        format(firstDayOfMonth, 'yyyy-MM-dd'),
        format(lastDayOfMonth, 'yyyy-MM-dd'),
        selectedVersion,
        true
      ),
    enabled: !!currentMonth,
  });

  // Effect to set initial version from scheduleResponse
  useEffect(() => {
    if (scheduleResponse?.versions && scheduleResponse.versions.length > 0 && selectedVersion === undefined) {
      setSelectedVersion(scheduleResponse.versions.sort((a, b) => b - a)[0]);
    }
  }, [scheduleResponse, selectedVersion]);

  // Fetch Employees
  const { data: employees, isLoading: isLoadingEmployees } = useQuery<Employee[], Error>({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  // Fetch Shift Templates (using APIShift as the fetched type)
  const { data: apiShiftTemplates, isLoading: isLoadingShiftTemplates } = useQuery<APIShift[], Error>({
    queryKey: ['apiShiftTemplates'],
    queryFn: getShiftTemplatesApiService,
  });

  const employeeMap = React.useMemo(() => {
    if (!employees) return new Map<number, string>();
    return new Map(employees.map(emp => [emp.id, `${emp.first_name} ${emp.last_name}`]));
  }, [employees]);

  const shiftTemplateMap = React.useMemo(() => {
    if (!apiShiftTemplates) return new Map<number, string>();
    return new Map(apiShiftTemplates.map(st => [st.id, st.shift_type_id?.toUpperCase() || `Shift ID: ${st.id}`]));
  }, [apiShiftTemplates]);

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
  };

  const schedulesForSelectedDate = React.useMemo(() => {
    if (!selectedDate || !scheduleResponse?.schedules) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return scheduleResponse.schedules.filter(
      (schedule: APISchedule) => schedule.date === dateStr && schedule.shift_id !== null
    );
  }, [selectedDate, scheduleResponse?.schedules]);

  const scheduledDays = React.useMemo(() => {
    if (!scheduleResponse?.schedules) return new Set<string>();
    const daysWithSchedules = new Set<string>();
    scheduleResponse.schedules.forEach(schedule => {
      if (schedule.shift_id !== null) {
        daysWithSchedules.add(schedule.date); 
      }
    });
    return daysWithSchedules;
  }, [scheduleResponse?.schedules]);

  const DayContent: CalendarProps['components'] = {
    Day: ({ date, displayMonth }) => {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const isCurrentDisplayMonth = displayMonth ? isSameDay(startOfMonth(displayMonth), firstDayOfMonth) : false;
      const hasSchedule = scheduledDays.has(formattedDate) && isCurrentDisplayMonth;
      
      return (
        // The Calendar component itself will render a button for each day.
        // We are providing the content *inside* that button.
        // The `day` className in `classNames` prop will style the button itself.
        <div className={cn("relative h-full w-full flex items-center justify-center")}>
          {format(date, "d")}
          {hasSchedule && (
            <Badge variant="destructive" className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 p-0 rounded-full" />
          )}
        </div>
      );
    },
  };

  // Helper: Go to today
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  // Helper: Go to previous/next month
  const goToPrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const isLoading = isLoadingSchedules || isLoadingEmployees || isLoadingShiftTemplates;

  let versionValueToDisplay: string | number | undefined; // Allow string or number
  if (selectedVersion !== undefined) {
    versionValueToDisplay = selectedVersion;
  } else if (scheduleResponse?.current_version !== undefined) {
    const cv = scheduleResponse.current_version;
    // Cast the current_version to a VersionMeta type if it's an object
    if (cv && typeof cv === 'object' && 'version' in cv) {
      versionValueToDisplay = cv.version;
    } else if (typeof cv === 'number') {
      versionValueToDisplay = cv;
    }
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">Calendar View
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" aria-label="Info about calendar" />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>Red dot = Day has at least one scheduled shift</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h1>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={goToToday} className="px-3 py-1 rounded bg-muted hover:bg-accent text-sm font-medium border border-border transition-colors" aria-label="Go to today">Today</button>
          <button onClick={goToPrevMonth} className="px-2 py-1 rounded bg-muted hover:bg-accent text-sm font-medium border border-border transition-colors" aria-label="Previous month">&lt;</button>
          <button onClick={goToNextMonth} className="px-2 py-1 rounded bg-muted hover:bg-accent text-sm font-medium border border-border transition-colors" aria-label="Next month">&gt;</button>
          {Array.isArray(scheduleResponse?.versions) && scheduleResponse.versions.length > 0 && (
            <Select
              value={selectedVersion?.toString()}
              onValueChange={(value) => setSelectedVersion(Number(value))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select Version" />
              </SelectTrigger>
              <SelectContent>
                {scheduleResponse.versions.map((ver: any) => {
                  const versionNumber = typeof ver === 'number' ? ver : ver.version;
                  // Extract current version number for comparison
                  let currentVersionNumber = scheduleResponse.current_version;
                  if (typeof currentVersionNumber === 'object' && currentVersionNumber !== null) {
                    currentVersionNumber = currentVersionNumber.version;
                  }
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
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-destructive" /> Scheduled day
        </span>
      </div>

      <Card className="overflow-hidden shadow-xl border border-border bg-background/80">
        <CardContent className="p-0 md:flex md:flex-row animate-fade-in">
          <div className="md:w-auto flex flex-col items-center mb-4 md:mb-0 p-3 md:p-4 border-b md:border-b-0 md:border-r bg-card/80">
            {isLoading ? (
              <div className="flex items-center justify-center h-[340px] w-[320px]">
                <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" aria-label="Loading calendar" />
              </div>
            ) : (
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="rounded-md p-0 min-w-[320px] min-h-[340px]"
                classNames={{
                  day: cn(
                    "relative h-10 w-10 p-0 text-center transition-colors duration-150",
                    "hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring rounded-md",
                    "group",
                  ),
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground border border-primary",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_outside: "text-muted-foreground opacity-50",
                }}
                components={{
                  Day: ({ date, displayMonth }) => {
                    const formattedDate = format(date, 'yyyy-MM-dd');
                    const isCurrentDisplayMonth = displayMonth ? isSameDay(startOfMonth(displayMonth), firstDayOfMonth) : false;
                    const hasSchedule = scheduledDays.has(formattedDate) && isCurrentDisplayMonth;
                    return (
                      <TooltipProvider>
                        <div className={cn("relative h-full w-full flex items-center justify-center group")}
                          aria-label={hasSchedule ? "Scheduled day" : undefined}
                        >
                          {format(date, "d")}
                          {hasSchedule && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Badge variant="destructive" className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 p-0 rounded-full group-hover:scale-125 transition-transform" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <span>Has scheduled shifts</span>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    );
                  }
                }}
                footer={versionValueToDisplay !== undefined ? <p className='text-center text-xs text-muted-foreground pt-2'>Displaying Version: {versionValueToDisplay}</p> : null}
              />
            )}
          </div>
          <div className="md:flex-1 p-4">
            <h2 className="text-xl font-semibold mb-3 border-b pb-2 flex items-center gap-2">
              Schedules for {selectedDate ? format(selectedDate, 'PPP') : 'N/A'}
              {schedulesForSelectedDate.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">({schedulesForSelectedDate.length} shift{(schedulesForSelectedDate.length !== 1) ? 's' : ''})</span>
              )}
            </h2>
            {isLoading && (
              <div className="space-y-3 mt-2">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            )}
            {schedulesError && <div className="flex flex-col items-center justify-center py-8"><Info className="w-8 h-8 text-destructive mb-2" /><p className="text-destructive font-medium">Error: {schedulesError.message}</p></div>}
            {!isLoading && !schedulesError && schedulesForSelectedDate.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground animate-fade-in">
                <Info className="w-8 h-8 mb-2" />
                <p>No schedules for this day.<br /><span className="text-xs">Try another date or version.</span></p>
              </div>
            )}
            {!isLoading && !schedulesError && schedulesForSelectedDate.length > 0 && (
              <ul className="space-y-2 mt-2 max-h-[calc(100vh-20rem)] md:max-h-[calc(100vh-18rem)] lg:max-h-[calc(100vh-16rem)] overflow-y-auto pr-1 animate-fade-in" role="list">
                {schedulesForSelectedDate.map((schedule: APISchedule) => (
                  <li key={schedule.id} className="p-3 border rounded-lg bg-card hover:bg-muted transition-colors shadow-sm" role="listitem">
                    <p className="font-semibold text-card-foreground">
                      {schedule.employee_id ? (employeeMap.get(schedule.employee_id) || `Employee ID: ${schedule.employee_id}`) : 'Unassigned'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Shift: {schedule.shift_id ? (shiftTemplateMap.get(schedule.shift_id) || `ID: ${schedule.shift_id}`) : 'N/A'}
                    </p>
                    {schedule.shift_start && schedule.shift_end && (
                      <p className="text-xs text-muted-foreground"><strong>Time:</strong> {schedule.shift_start.substring(0,5)} - {schedule.shift_end.substring(0,5)}</p>
                    )}
                    {schedule.notes && <p className="text-xs text-muted-foreground mt-1"><strong>Notes:</strong> {schedule.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarPage;
