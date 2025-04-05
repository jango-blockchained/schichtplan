import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSettings, getEmployees } from '@/services/api';
import { addDays, format } from 'date-fns';
import { Employee, Schedule } from '@/types';
import { DateRange } from 'react-day-picker';
import { parseTime, formatMinutesToTime } from '@/components/schedule/utils/scheduleUtils';

/**
 * Custom hook for fetching and managing schedule time grid data
 */
export function useScheduleTimeGrid(dateRange: DateRange | undefined) {
  // Fetch settings
  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  // Fetch employees data
  const { data: employeesData, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  // Create employee lookup for quick access
  const employeeLookup = useMemo(() => {
    if (!employeesData) return {};
    return employeesData.reduce((acc: Record<number, Employee>, employee: Employee) => {
      acc[employee.id] = employee;
      return acc;
    }, {});
  }, [employeesData]);

  // Generate days from date range, filtered by opening days
  const days = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || !settings) return [];
    const days = [];
    let currentDate = dateRange.from;

    while (currentDate <= dateRange.to) {
      const dayIndex = currentDate.getDay().toString();
      const isOpeningDay = settings.general?.opening_days?.[dayIndex];

      // Include only days marked as opening days
      if (isOpeningDay) {
        days.push(currentDate);
      }
      currentDate = addDays(currentDate, 1);
    }

    return days;
  }, [dateRange, settings]);

  // Generate time slots in 15-minute intervals based on opening hours
  const timeSlots = useMemo(() => {
    if (!settings || !settings.general) {
      // Default time slots if settings are not available
      const slots = [];
      for (let i = 8 * 60; i < 22 * 60; i += 15) { // From 8:00 to 22:00 in 15-min intervals
        slots.push({
          start: i,
          end: i + 15,
          label: `${formatMinutesToTime(i)}`
        });
      }
      return slots;
    }

    // Parse opening hours from settings - use store_opening and store_closing
    const slots = [];
    const increment = 15; // 15-minute time slots

    // Use store_opening and store_closing from general settings
    const startMinutes = parseTime(settings.general.store_opening || "09:00");
    const endMinutes = parseTime(settings.general.store_closing || "21:00");

    for (let time = startMinutes; time < endMinutes; time += increment) {
      slots.push({
        start: time,
        end: time + increment,
        label: `${formatMinutesToTime(time)}`
      });
    }

    return slots;
  }, [settings]);

  // Helper function to get overlapping schedules for a specific day and time slot
  const getOverlappingSchedules = (schedules: Schedule[], day: Date, timeSlot: { start: number; end: number }) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    
    return schedules.filter(schedule => {
      if (!schedule.date || schedule.date !== dayStr) return false;
      
      const shiftStart = schedule.shift_start ? parseTime(schedule.shift_start) : 0;
      const shiftEnd = schedule.shift_end ? parseTime(schedule.shift_end) : 0;
      
      // Check if schedule overlaps with this time slot
      return (
        (shiftStart <= timeSlot.start && shiftEnd > timeSlot.start) || 
        (shiftStart >= timeSlot.start && shiftStart < timeSlot.end)
      );
    });
  };

  return {
    settings,
    employeesData,
    employeeLookup,
    days,
    timeSlots,
    getOverlappingSchedules,
    isLoading: isSettingsLoading || isEmployeesLoading,
    hasDateRange: Boolean(dateRange?.from && dateRange?.to),
    hasOpeningDays: Boolean(days.length > 0)
  };
} 