import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getEmployees } from "@/services/api";
import { Schedule } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  differenceInHours,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { useMemo } from "react";

interface EmployeeStatisticsProps {
  employeeId: number;
  schedules: Schedule[];
  contractedHours?: number;
  employeeGroup?: string;
}

// Helper function to calculate shift duration in hours
const calculateShiftDuration = (schedule: Schedule): number => {
  if (!schedule.shift_start || !schedule.shift_end) return 0;

  try {
    // Parse the shift times (assuming format like "09:00")
    const [startHours, startMinutes] = schedule.shift_start
      .split(":")
      .map(Number);
    const [endHours, endMinutes] = schedule.shift_end.split(":").map(Number);

    // Calculate total minutes
    const startTotalMinutes = startHours * 60 + startMinutes;
    let endTotalMinutes = endHours * 60 + endMinutes;

    // Handle case where shift ends on the next day
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60; // Add 24 hours
    }

    // Calculate break duration
    let breakDuration = 0;
    if (schedule.break_start && schedule.break_end) {
      const [breakStartHours, breakStartMinutes] = schedule.break_start
        .split(":")
        .map(Number);
      const [breakEndHours, breakEndMinutes] = schedule.break_end
        .split(":")
        .map(Number);

      const breakStartTotalMinutes = breakStartHours * 60 + breakStartMinutes;
      let breakEndTotalMinutes = breakEndHours * 60 + breakEndMinutes;

      // Handle case where break ends on the next day
      if (breakEndTotalMinutes < breakStartTotalMinutes) {
        breakEndTotalMinutes += 24 * 60;
      }

      breakDuration = breakEndTotalMinutes - breakStartTotalMinutes;
    }

    // Total duration minus break in hours
    return (endTotalMinutes - startTotalMinutes - breakDuration) / 60;
  } catch (error) {
    console.error("Error calculating shift duration:", error);
    return 0;
  }
};

export function EmployeeStatistics({
  employeeId,
  schedules,
  contractedHours,
  employeeGroup,
}: EmployeeStatisticsProps) {
  // Fetch employees if contractedHours or employeeGroup is not provided
  const needEmployeeData =
    contractedHours === undefined || employeeGroup === undefined;
  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
    enabled: needEmployeeData,
  });

  // Get the contractedHours and employeeGroup from fetched employees if not provided
  let effectiveContractedHours = contractedHours;
  let effectiveEmployeeGroup = employeeGroup;

  if (needEmployeeData && employees) {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      effectiveContractedHours =
        effectiveContractedHours ?? employee.contracted_hours ?? 40;
      effectiveEmployeeGroup =
        effectiveEmployeeGroup ?? employee.employee_group ?? "VZ";
    }
  }

  // Default values if still undefined
  effectiveContractedHours = effectiveContractedHours ?? 40;
  effectiveEmployeeGroup = effectiveEmployeeGroup ?? "VZ";

  // Filter schedules for this employee
  const employeeSchedules = schedules.filter(
    (s) => s.employee_id === employeeId && s.shift_id !== null,
  );

  // Calculate statistics
  const totalShifts = employeeSchedules.length;
  const totalHours = employeeSchedules.reduce((sum, s) => {
    // Skip schedules without shifts
    if (!s.shift_id || !s.shift_start || !s.shift_end) {
      return sum;
    }
    return sum + calculateShiftDuration(s);
  }, 0);
  const hoursCoverage =
    effectiveContractedHours > 0
      ? (totalHours / effectiveContractedHours) * 100
      : 0;

  // Calculate early, mid, and late shifts
  const earlyShifts = employeeSchedules.filter(
    (s) => s.shift_start && s.shift_start < "10:00",
  ).length;
  const lateShifts = employeeSchedules.filter(
    (s) => s.shift_end && s.shift_end >= "18:00",
  ).length;
  const midShifts = totalShifts - earlyShifts - lateShifts;

  // Calculate shifts with breaks
  const shiftsWithBreaks = employeeSchedules.filter(
    (s) => s.break_start && s.break_end,
  ).length;
  const breaksPercentage =
    totalShifts > 0 ? (shiftsWithBreaks / totalShifts) * 100 : 0;

  // Calculate consecutive workdays (most consecutive days in a row)
  let maxConsecutiveDays = 0;
  let currentConsecutiveDays = 0;
  let previousDate: Date | null = null;

  // Sort dates chronologically
  const sortedDates = employeeSchedules
    .map((s) => (s.date ? parseISO(s.date) : null))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  sortedDates.forEach((currentDate) => {
    if (currentDate && previousDate) {
      const diffDays = Math.round(
        differenceInHours(currentDate, previousDate) / 24,
      );
      if (diffDays === 1) {
        currentConsecutiveDays++;
      } else {
        maxConsecutiveDays = Math.max(
          maxConsecutiveDays,
          currentConsecutiveDays,
        );
        currentConsecutiveDays = 1;
      }
    } else {
      currentConsecutiveDays = 1;
    }
    previousDate = currentDate;
  });

  maxConsecutiveDays = Math.max(maxConsecutiveDays, currentConsecutiveDays);

  // Calculate weekly and monthly hours breakdown
  const weeklyHoursBreakdown = useMemo(() => {
    const breakdown: { week: string; hours: number; percentage: number }[] = [];
    
    if (employeeSchedules.length === 0) return breakdown;
    
    // Get date range from schedules
    const dates = employeeSchedules
      .map(s => s.date ? parseISO(s.date) : null)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (dates.length === 0) return breakdown;
    
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    
    // Get all weeks in the range
    const weeks = eachWeekOfInterval(
      { start: firstDate, end: lastDate },
      { weekStartsOn: 1 } // Monday
    );
    
    weeks.forEach(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      let weekHours = 0;
      
      employeeSchedules.forEach(schedule => {
        if (!schedule.date || !schedule.shift_start || !schedule.shift_end) return;
        
        const scheduleDate = parseISO(schedule.date);
        if (isWithinInterval(scheduleDate, { start: weekStart, end: weekEnd })) {
          weekHours += calculateShiftDuration(schedule);
        }
      });
      
      breakdown.push({
        week: format(weekStart, "dd.MM"),
        hours: weekHours,
        percentage: effectiveContractedHours > 0 ? (weekHours / effectiveContractedHours) * 100 : 0
      });
    });
    
    return breakdown;
  }, [employeeSchedules, effectiveContractedHours]);

  // Calculate cumulative monthly hours
  const monthlyHoursCumulative = useMemo(() => {
    const cumulative: { month: string; hours: number; cumulative: number }[] = [];
    
    if (employeeSchedules.length === 0) return cumulative;
    
    // Get date range from schedules
    const dates = employeeSchedules
      .map(s => s.date ? parseISO(s.date) : null)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (dates.length === 0) return cumulative;
    
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    
    // Get all months in the range
    const months = eachMonthOfInterval({ start: firstDate, end: lastDate });
    
    let cumulativeTotal = 0;
    
    months.forEach(monthStart => {
      const monthEnd = endOfMonth(monthStart);
      let monthHours = 0;
      
      employeeSchedules.forEach(schedule => {
        if (!schedule.date || !schedule.shift_start || !schedule.shift_end) return;
        
        const scheduleDate = parseISO(schedule.date);
        if (isWithinInterval(scheduleDate, { start: monthStart, end: monthEnd })) {
          monthHours += calculateShiftDuration(schedule);
        }
      });
      
      cumulativeTotal += monthHours;
      
      cumulative.push({
        month: format(monthStart, "MMM yyyy"),
        hours: monthHours,
        cumulative: cumulativeTotal
      });
    });
    
    return cumulative;
  }, [employeeSchedules]);

  return (
    <div className="bg-card dark:bg-card p-6 rounded-lg border border-border dark:border-border min-h-[300px]">
      <Card className="shadow-none border-none bg-transparent">
        <CardContent className="p-0 space-y-3">
          {/* Summary Row */}
          <div className="flex items-center justify-between pb-2 border-b border-border dark:border-border">
            <div>
              <div className="text-sm font-medium text-foreground dark:text-foreground">Gesamtstunden</div>
              <div className="text-2xl font-bold text-foreground dark:text-foreground">{totalHours.toFixed(1)}h</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">von {effectiveContractedHours}h</div>
              <Progress value={hoursCoverage} className="h-2 w-20" />
              <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">{hoursCoverage.toFixed(0)}%</div>
            </div>
          </div>

          {/* Shift Distribution */}
          <div>
            <div className="text-sm font-medium text-foreground dark:text-foreground mb-2">Schichtverteilung</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-yellow-50 dark:bg-yellow-950/50 rounded p-2 border border-yellow-200 dark:border-yellow-800">
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">Früh</div>
                <div className="font-semibold text-foreground dark:text-foreground">{earlyShifts}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/50 rounded p-2 border border-blue-200 dark:border-blue-800">
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">Mitte</div>
                <div className="font-semibold text-foreground dark:text-foreground">{midShifts}</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/50 rounded p-2 border border-purple-200 dark:border-purple-800">
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">Spät</div>
                <div className="font-semibold text-foreground dark:text-foreground">{lateShifts}</div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-muted-foreground dark:text-muted-foreground">Pausen</span>
              <span className="text-sm font-medium text-foreground dark:text-foreground">{breaksPercentage.toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-muted-foreground dark:text-muted-foreground">Max. Folgetage</span>
              <Badge
                variant={maxConsecutiveDays > 6 ? "destructive" : "secondary"}
                className="text-xs"
              >
                {maxConsecutiveDays}
              </Badge>
            </div>
          </div>

          {/* Weekly Hours - Compact View */}
          {weeklyHoursBreakdown.length > 0 && weeklyHoursBreakdown.length <= 4 && (
            <div>
              <div className="text-sm font-medium text-foreground dark:text-foreground mb-2">Wochenstunden</div>
              <div className="space-y-1">
                {weeklyHoursBreakdown.map((week, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground dark:text-muted-foreground">KW {week.week}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground dark:text-foreground">{week.hours.toFixed(1)}h</span>
                      <span className={cn(
                        "font-medium",
                        week.percentage > 100 ? "text-red-600 dark:text-red-400" : 
                        week.percentage < 90 ? "text-amber-600 dark:text-amber-400" : 
                        "text-green-600 dark:text-green-400"
                      )}>
                        ({week.percentage.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Summary - Only show if we have data */}
          {monthlyHoursCumulative.length > 0 && monthlyHoursCumulative.length <= 2 && (
            <div className="pt-2 border-t border-border dark:border-border">
              <div className="text-sm font-medium text-foreground dark:text-foreground mb-1">Monatssumme</div>
              {monthlyHoursCumulative.map((month, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground dark:text-muted-foreground">{month.month}</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {month.cumulative.toFixed(1)}h
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
