import React, { useEffect, useState } from 'react';
import { Calendar, CalendarProps } from '@/components/ui/calendar';
import { useQuery } from '@tanstack/react-query';
import {
  getSchedules,
  ScheduleResponse,
  Schedule as APISchedule,
  getEmployees,
  getShifts as getShiftTemplatesApiService,
  Shift as APIShift, // Type from API for shift templates
} from '@/services/api';
import { Employee } from '@/types'; // ShiftTemplate from types/index.ts is not used directly here anymore
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

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
    return new Map(apiShiftTemplates.map(st => [st.id, st.shift_type_id || `Shift ID: ${st.id}`])); // Use shift_type_id or fallback
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
      // Check if the date is in the current display month before showing badge
      const isCurrentDisplayMonth = displayMonth ? isSameDay(startOfMonth(displayMonth), firstDayOfMonth) : false;
      const hasSchedule = scheduledDays.has(formattedDate) && isCurrentDisplayMonth;
      
      return (
        <div className="relative flex items-center justify-center h-full w-full text-sm">
          {format(date, "d")}
          {hasSchedule && (
            <Badge variant="destructive" className="absolute bottom-1 right-1 w-2 h-2 p-0 leading-none rounded-full" />
          )}
        </div>
      );
    },
  };

  const isLoading = isLoadingSchedules || isLoadingEmployees || isLoadingShiftTemplates;
  const currentDisplayVersion = selectedVersion ?? scheduleResponse?.current_version;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Calendar View</h1>
        {scheduleResponse?.versions && scheduleResponse.versions.length > 0 && (
          <Select
            value={selectedVersion?.toString()}
            onValueChange={(value) => setSelectedVersion(Number(value))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Version" />
            </SelectTrigger>
            <SelectContent>
              {scheduleResponse.versions.sort((a, b) => b - a).map(version => (
                <SelectItem key={version} value={version.toString()}>
                  Version {version} {version === scheduleResponse?.current_version && "(Current)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 md:flex md:flex-row">
          <div className="md:w-auto flex justify-center mb-4 md:mb-0 p-3 md:p-4 border-b md:border-b-0 md:border-r md:shadow-sm">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentMonth}
              onMonthChange={handleMonthChange}
              className="rounded-md shadow-none border-none p-0"
              components={DayContent}
              footer={currentDisplayVersion ? <p className='text-center text-sm text-muted-foreground pt-2'>Displaying Version: {currentDisplayVersion}</p> : null}
            />
          </div>
          <div className="md:flex-1 p-4">
            <h2 className="text-xl font-semibold mb-3 border-b pb-2">
              Schedules for {selectedDate ? format(selectedDate, 'PPP') : 'N/A'}
            </h2>
            {isLoading && (
              <div className="space-y-3 mt-2">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            )}
            {schedulesError && <p className="text-red-600 mt-2 font-medium">Error loading schedules: {schedulesError.message}</p>}
            {!isLoading && !schedulesError && schedulesForSelectedDate.length === 0 && (
              <p className="text-muted-foreground mt-2 text-center py-8">No schedules for this day.</p>
            )}
            {!isLoading && !schedulesError && schedulesForSelectedDate.length > 0 && (
              <ul className="space-y-2 mt-2 max-h-[30rem] overflow-y-auto pr-1">
                {schedulesForSelectedDate.map((schedule: APISchedule) => (
                  <li key={schedule.id} className="p-3 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors shadow-sm">
                    <p className="font-semibold text-slate-800">
                      {schedule.employee_id ? (employeeMap.get(schedule.employee_id) || `Employee ID: ${schedule.employee_id}`) : 'Unassigned'}
                    </p>
                    <p className="text-sm text-slate-600">
                      Shift: {schedule.shift_id ? (shiftTemplateMap.get(schedule.shift_id) || `ID: ${schedule.shift_id}`) : 'N/A'}
                    </p>
                    {schedule.shift_start && schedule.shift_end && (
                      <p className="text-xs text-slate-500"><strong>Time:</strong> {schedule.shift_start.substring(0,5)} - {schedule.shift_end.substring(0,5)}</p>
                    )}
                    {schedule.notes && <p className="text-xs text-slate-500 mt-1"><strong>Notes:</strong> {schedule.notes}</p>}
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
