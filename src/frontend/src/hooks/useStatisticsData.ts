import { getEmployees, getSettings } from "@/services/api";
import { Employee, Schedule } from "@/types";
import {
    calculateShiftDuration,
    createEmployeeLookup,
    getSchedulesForDate,
    getShiftType,
    getValidSchedules,
    isDayOpen,
} from "@/utils/statisticsUtils";
import { getWeekStartsOn } from "@/utils/weekStart";
import { useQuery } from "@tanstack/react-query";
import { eachWeekOfInterval, endOfWeek, format, parseISO } from "date-fns";
import { useMemo } from "react";
import { DateRange } from "react-day-picker";

interface UseStatisticsDataProps {
  schedules: Schedule[];
  dateRange?: DateRange;
  employees?: Employee[];
  openingDays?: number[];
  version?: number;
}

export const useStatisticsData = ({
  schedules,
  dateRange,
  employees: propEmployees,
  openingDays = [0, 1, 2, 3, 4, 5, 6],
  version,
}: UseStatisticsDataProps) => {
  // Fetch employees if not provided
  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
    enabled: !propEmployees,
  });

  const employees = useMemo(() => {
    return propEmployees || employeesData || [];
  }, [propEmployees, employeesData]);

  // Filter and validate schedules
  const validSchedules = useMemo(() => {
    return getValidSchedules(schedules, version);
  }, [schedules, version]);

  // Employee lookup
  const employeeLookup = useMemo(() => {
    return createEmployeeLookup(employees);
  }, [employees]);

  // Basic statistics
  const basicStats = useMemo(() => {
    const totalSchedules = validSchedules.length;
    const totalEmployees = new Set(validSchedules.map(s => s.employee_id)).size;
    const totalHours = validSchedules.reduce((sum, s) => sum + calculateShiftDuration(s), 0);
    const avgHoursPerShift = totalSchedules > 0 ? totalHours / totalSchedules : 0;
    
    const shiftsWithBreaks = validSchedules.filter(s => s.break_start && s.break_end).length;
    const breakCoverage = totalSchedules > 0 ? (shiftsWithBreaks / totalSchedules) * 100 : 0;

    return {
      totalSchedules,
      totalEmployees,
      totalHours,
      avgHoursPerShift,
      shiftsWithBreaks,
      breakCoverage,
    };
  }, [validSchedules]);

  // Shift type distribution
  const shiftTypeStats = useMemo(() => {
    const distribution = { early: 0, mid: 0, late: 0 };
    
    validSchedules.forEach(schedule => {
      const type = getShiftType(schedule.shift_start!);
      distribution[type]++;
    });

    return distribution;
  }, [validSchedules]);

  // Daily coverage statistics
  const dailyCoverageStats = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return { avgCoverage: 0, coverageByDay: [], minCoverage: 0, maxCoverage: 0 };
    }

    const coverageByDay: { date: Date; coverage: number; dayName: string }[] = [];
    const currentDate = new Date(dateRange.from);
    
    while (currentDate <= dateRange.to) {
      if (isDayOpen(currentDate, openingDays)) {
        const daySchedules = getSchedulesForDate(validSchedules, currentDate);
        
        coverageByDay.push({
          date: new Date(currentDate),
          coverage: daySchedules.length,
          dayName: format(currentDate, 'EEEE'),
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const coverageValues = coverageByDay.map(d => d.coverage);
    const avgCoverage = coverageValues.length > 0 
      ? coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length 
      : 0;
    const minCoverage = coverageValues.length > 0 ? Math.min(...coverageValues) : 0;
    const maxCoverage = coverageValues.length > 0 ? Math.max(...coverageValues) : 0;

    return { avgCoverage, coverageByDay, minCoverage, maxCoverage };
  }, [validSchedules, dateRange, openingDays]);

  // Employee workload distribution
  const workloadStats = useMemo(() => {
    const employeeWorkload: Record<number, { 
      hours: number; 
      shifts: number; 
      name: string; 
      group: string; 
      isKeyholder: boolean;
    }> = {};
    
    validSchedules.forEach(schedule => {
      if (!employeeWorkload[schedule.employee_id]) {
        const employee = employeeLookup[schedule.employee_id];
        employeeWorkload[schedule.employee_id] = {
          hours: 0,
          shifts: 0,
          name: employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown',
          group: employee?.employee_group || 'Unknown',
          isKeyholder: employee?.is_keyholder || false,
        };
      }
      
      employeeWorkload[schedule.employee_id].hours += calculateShiftDuration(schedule);
      employeeWorkload[schedule.employee_id].shifts += 1;
    });

    const workloadArray = Object.entries(employeeWorkload).map(([id, data]) => ({
      employeeId: parseInt(id),
      ...data,
    }));

    // Calculate distribution metrics
    const hoursArray = workloadArray.map(w => w.hours);
    const avgHours = hoursArray.length > 0 ? hoursArray.reduce((a, b) => a + b, 0) / hoursArray.length : 0;
    const minHours = hoursArray.length > 0 ? Math.min(...hoursArray) : 0;
    const maxHours = hoursArray.length > 0 ? Math.max(...hoursArray) : 0;

    // Find under and over-worked employees
    const underWorked = workloadArray.filter(w => w.hours < avgHours * 0.8);
    const overWorked = workloadArray.filter(w => w.hours > avgHours * 1.2);
    
    // Keyholder statistics
    const keyholders = workloadArray.filter(w => w.isKeyholder);
    const keyholderCoverage = keyholders.length > 0 
      ? (keyholders.length / workloadArray.length) * 100 
      : 0;

    return {
      employees: workloadArray,
      avgHours,
      minHours,
      maxHours,
      underWorked,
      overWorked,
      keyholders,
      keyholderCoverage,
    };
  }, [validSchedules, employeeLookup]);

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings, staleTime: 300_000 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weekStartsOn = getWeekStartsOn(settings as any);
  // Weekly breakdown
  const weeklyBreakdown = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || validSchedules.length === 0) {
      return [];
    }

    const weeks = eachWeekOfInterval(
      { start: dateRange.from, end: dateRange.to },
      { weekStartsOn } // dynamic
    );

    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn });
      let weekHours = 0;
      let weekShifts = 0;
      const uniqueEmployees = new Set<number>();

      validSchedules.forEach(schedule => {
        if (schedule.date) {
          const scheduleDate = parseISO(schedule.date);
          if (scheduleDate >= weekStart && scheduleDate <= weekEnd) {
            weekHours += calculateShiftDuration(schedule);
            weekShifts += 1;
            uniqueEmployees.add(schedule.employee_id);
          }
        }
      });

      return {
        weekStart,
        weekEnd,
        weekNumber: format(weekStart, 'I'),
        hours: weekHours,
        shifts: weekShifts,
        employees: uniqueEmployees.size,
      };
    });
  }, [validSchedules, dateRange, weekStartsOn]);

  return {
    employees,
    validSchedules,
    employeeLookup,
    basicStats,
    shiftTypeStats,
    dailyCoverageStats,
    workloadStats,
    weeklyBreakdown,
    isLoading: loadingEmployees,
  };
};
