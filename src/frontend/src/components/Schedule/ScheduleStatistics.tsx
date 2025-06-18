import React, { useMemo, useState } from "react";
import { Schedule, Employee } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  BarChart3,
  PieChart,
  Activity,
  UserCheck,
  Coffee,
  Moon,
  Sun,
  Sunrise,
  Target,
  AlertCircle,
  Info,
  ChevronDown, 
  ChevronRight,
  Key,
  TrendingUp,
} from "lucide-react";
import {
  parseISO,
  format,
  endOfWeek,
  isWithinInterval,
  eachWeekOfInterval,
  isSameDay,
  getDay,
  differenceInDays,
} from "date-fns";
import { de } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { getEmployees } from "@/services/api";
import { DateRange } from "react-day-picker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface ScheduleStatisticsProps {
  schedules: Schedule[];
  dateRange?: DateRange;
  employees?: Employee[];
  openingDays?: number[];
  version?: number;
}

// Helper function to calculate shift duration in hours
const calculateShiftDuration = (schedule: Schedule): number => {
  if (!schedule.shift_start || !schedule.shift_end) return 0;

  try {
    const [startHours, startMinutes] = schedule.shift_start.split(":").map(Number);
    const [endHours, endMinutes] = schedule.shift_end.split(":").map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    let endTotalMinutes = endHours * 60 + endMinutes;

    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60;
    }

    let breakDuration = 0;
    if (schedule.break_start && schedule.break_end) {
      const [breakStartHours, breakStartMinutes] = schedule.break_start.split(":").map(Number);
      const [breakEndHours, breakEndMinutes] = schedule.break_end.split(":").map(Number);

      const breakStartTotalMinutes = breakStartHours * 60 + breakStartMinutes;
      let breakEndTotalMinutes = breakEndHours * 60 + breakEndMinutes;

      if (breakEndTotalMinutes < breakStartTotalMinutes) {
        breakEndTotalMinutes += 24 * 60;
      }

      breakDuration = breakEndTotalMinutes - breakStartTotalMinutes;
    }

    return (endTotalMinutes - startTotalMinutes - breakDuration) / 60;
  } catch (error) {
    console.error("Error calculating shift duration:", error);
    return 0;
  }
};

// Helper function to get shift type based on start time
const getShiftType = (shiftStart: string): "early" | "mid" | "late" => {
  if (!shiftStart) return "mid";
  const hour = parseInt(shiftStart.split(":")[0]);
  
  if (hour < 10) return "early";
  if (hour >= 18) return "late";
  return "mid";
};

export function ScheduleStatistics({
  schedules,
  dateRange,
  employees: propEmployees,
  openingDays = [0, 1, 2, 3, 4, 5, 6], // Default to all days
  version,
}: ScheduleStatisticsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [shiftDistributionOpen, setShiftDistributionOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [breakCoverageOpen, setBreakCoverageOpen] = useState(false);
  const [workloadOpen, setWorkloadOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);

  // Fetch employees if not provided
  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
    enabled: !propEmployees,
  });

  const employees = useMemo(() => {
    return propEmployees || employeesData || [];
  }, [propEmployees, employeesData]);

  // Filter schedules by version if specified
  const filteredSchedules = useMemo(() => {
    if (version !== undefined) {
      return schedules.filter(s => s.version === version);
    }
    return schedules;
  }, [schedules, version]);

  // Filter schedules with valid data only
  const validSchedules = useMemo(() => {
    return filteredSchedules.filter(s => 
      s.shift_id !== null && 
      s.shift_start && 
      s.shift_end && 
      s.date &&
      s.employee_id
    );
  }, [filteredSchedules]);

  // Employee lookup
  const employeeLookup = useMemo(() => {
    return employees.reduce((acc, emp) => {
      acc[emp.id] = emp;
      return acc;
    }, {} as Record<number, Employee>);
  }, [employees]);

  // Basic statistics
  const basicStats = useMemo(() => {
    const totalSchedules = validSchedules.length;
    const totalEmployees = new Set(validSchedules.map(s => s.employee_id)).size;
    const totalHours = validSchedules.reduce((sum, s) => sum + calculateShiftDuration(s), 0);
    const avgHoursPerShift = totalSchedules > 0 ? totalHours / totalSchedules : 0;
    
    // Calculate shifts with breaks
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
    if (!dateRange?.from || !dateRange?.to) return { avgCoverage: 0, coverageByDay: [], minCoverage: 0, maxCoverage: 0 };

    const coverageByDay: { date: Date; coverage: number; dayName: string }[] = [];
    const currentDate = new Date(dateRange.from);
    
    while (currentDate <= dateRange.to) {
      const dayIndex = getDay(currentDate);
      const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Convert to Monday=0 format
      
      if (openingDays.includes(adjustedDayIndex)) {
        const daySchedules = validSchedules.filter(s => 
          s.date && isSameDay(parseISO(s.date), currentDate)
        );
        
        coverageByDay.push({
          date: new Date(currentDate),
          coverage: daySchedules.length,
          dayName: format(currentDate, 'EEEE'),
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const coverageValues = coverageByDay.map(d => d.coverage);
    const avgCoverage = coverageValues.length > 0 ? coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length : 0;
    const minCoverage = coverageValues.length > 0 ? Math.min(...coverageValues) : 0;
    const maxCoverage = coverageValues.length > 0 ? Math.max(...coverageValues) : 0;

    return { avgCoverage, coverageByDay, minCoverage, maxCoverage };
  }, [validSchedules, dateRange, openingDays]);

  // Employee workload distribution
  const workloadStats = useMemo(() => {
    const employeeWorkload: Record<number, { hours: number; shifts: number; name: string; group: string; isKeyholder: boolean }> = {};
    
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
    const keyholderCoverage = keyholders.length > 0 ? (keyholders.length / workloadArray.length) * 100 : 0;

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

  // Weekly hours breakdown
  const weeklyBreakdown = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || validSchedules.length === 0) {
      return [];
    }

    const weeks = eachWeekOfInterval(
      { start: dateRange.from, end: dateRange.to },
      { weekStartsOn: 1 } // Monday
    );

    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      let weekHours = 0;
      let weekShifts = 0;

      validSchedules.forEach(schedule => {
        if (!schedule.date) return;
        const scheduleDate = parseISO(schedule.date);
        if (isWithinInterval(scheduleDate, { start: weekStart, end: weekEnd })) {
          weekHours += calculateShiftDuration(schedule);
          weekShifts += 1;
        }
      });

      return {
        week: format(weekStart, "dd.MM"),
        hours: weekHours,
        shifts: weekShifts,
        avgHoursPerShift: weekShifts > 0 ? weekHours / weekShifts : 0,
      };
    });
  }, [validSchedules, dateRange]);

  // Format date range for display
  const dateRangeText = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "Zeitraum nicht definiert";
    
    const start = dateRange.from;
    const end = dateRange.to;
    const daysDifference = differenceInDays(end, start) + 1;
    
    const formattedStartDate = format(start, "d. MMMM", { locale: de });
    const formattedEndDate = format(end, "d. MMMM yyyy", { locale: de });
    
    return `${formattedStartDate} - ${formattedEndDate} (${daysDifference} Tage)`;
  }, [dateRange]);

  if (loadingEmployees) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Schichtplan-Statistiken
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Lade Statistiken...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="bg-card dark:bg-card p-6 rounded-lg border border-border dark:border-border shadow-sm min-h-[300px]">
      <Card className="shadow-none border-none bg-transparent">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/30 dark:border-border/30 px-0">
            <div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-0 hover:bg-muted/50 dark:hover:bg-muted/50">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-foreground dark:text-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-foreground dark:text-foreground" />
                  )}
                  <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground dark:text-foreground">
                    <BarChart3 className="h-5 w-5" />
                    Schichtplan-Statistiken
                  </CardTitle>
                </Button>
              </CollapsibleTrigger>
              <CardDescription className="text-muted-foreground dark:text-muted-foreground">
                {dateRangeText}
                {version !== undefined && (
                  <span className="block text-xs mt-1">Version {version}</span>
                )}
              </CardDescription>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-0 pt-6 space-y-6">
            {/* Overview Section */}
            <Collapsible open={overviewOpen} onOpenChange={setOverviewOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center justify-between w-full p-2 hover:bg-muted/50 dark:hover:bg-muted/50">
                  <h4 className="text-sm font-medium text-foreground dark:text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Übersicht
                  </h4>
                  {overviewOpen ? (
                    <ChevronDown className="h-4 w-4 text-foreground dark:text-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-foreground dark:text-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
                    <Calendar className="h-5 w-5 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{basicStats.totalSchedules}</div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">Geplante Schichten</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/50 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
                    <Users className="h-5 w-5 mx-auto mb-2 text-green-600 dark:text-green-400" />
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">{basicStats.totalEmployees}</div>
                    <div className="text-xs text-green-700 dark:text-green-300">Aktive Mitarbeiter</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/50 rounded-lg p-3 text-center border border-purple-200 dark:border-purple-800">
                    <Clock className="h-5 w-5 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{basicStats.totalHours.toFixed(1)}h</div>
                    <div className="text-xs text-purple-700 dark:text-purple-300">Gesamtstunden</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/50 rounded-lg p-3 text-center border border-amber-200 dark:border-amber-800">
                    <Target className="h-5 w-5 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
                    <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{basicStats.avgHoursPerShift.toFixed(1)}h</div>
                    <div className="text-xs text-amber-700 dark:text-amber-300">⌀ Stunden/Schicht</div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Shift Distribution */}
            <Collapsible open={shiftDistributionOpen} onOpenChange={setShiftDistributionOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center justify-between w-full p-2 hover:bg-muted/50 dark:hover:bg-muted/50">
                  <h4 className="text-sm font-medium text-foreground dark:text-foreground flex items-center gap-2">
                    <PieChart className="h-4 w-4" />
                    Schichtverteilung
                  </h4>
                  {shiftDistributionOpen ? (
                    <ChevronDown className="h-4 w-4 text-foreground dark:text-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-foreground dark:text-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-yellow-50 dark:bg-yellow-950/50 rounded-lg p-3 text-center border border-yellow-200 dark:border-yellow-800">
                    <Sunrise className="h-5 w-5 mx-auto mb-2 text-yellow-600 dark:text-yellow-400" />
                    <div className="text-xl font-bold text-yellow-900 dark:text-yellow-100">{shiftTypeStats.early}</div>
                    <div className="text-xs text-yellow-700 dark:text-yellow-300">Frühschicht</div>
                    <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                      ({basicStats.totalSchedules > 0 ? ((shiftTypeStats.early / basicStats.totalSchedules) * 100).toFixed(0) : 0}%)
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
                    <Sun className="h-5 w-5 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                    <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{shiftTypeStats.mid}</div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">Tagschicht</div>
                    <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                      ({basicStats.totalSchedules > 0 ? ((shiftTypeStats.mid / basicStats.totalSchedules) * 100).toFixed(0) : 0}%)
                    </div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/50 rounded-lg p-3 text-center border border-purple-200 dark:border-purple-800">
                    <Moon className="h-5 w-5 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                    <div className="text-xl font-bold text-purple-900 dark:text-purple-100">{shiftTypeStats.late}</div>
                    <div className="text-xs text-purple-700 dark:text-purple-300">Spätschicht</div>
                    <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                      ({basicStats.totalSchedules > 0 ? ((shiftTypeStats.late / basicStats.totalSchedules) * 100).toFixed(0) : 0}%)
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Coverage Analysis */}
            <Collapsible open={coverageOpen} onOpenChange={setCoverageOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center justify-between w-full p-2 hover:bg-muted/50 dark:hover:bg-muted/50">
                  <h4 className="text-sm font-medium text-foreground dark:text-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Tagesbesetzung
                  </h4>
                  {coverageOpen ? (
                    <ChevronDown className="h-4 w-4 text-foreground dark:text-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-foreground dark:text-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 mt-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                      <div className="text-sm font-medium text-foreground dark:text-foreground">Durchschnittliche Besetzung</div>
                      <div className="text-xs text-muted-foreground dark:text-muted-foreground">Pro Öffnungstag</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{dailyCoverageStats.avgCoverage.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">
                        {dailyCoverageStats.minCoverage} - {dailyCoverageStats.maxCoverage} Mitarbeiter
                      </div>
                    </div>
                  </div>
                  
                  {/* Daily breakdown - show only if reasonable amount of days */}
                  {dailyCoverageStats.coverageByDay.length <= 7 && dailyCoverageStats.coverageByDay.length > 0 && (
                    <div className="space-y-2">
                      {dailyCoverageStats.coverageByDay.map((day, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {format(day.date, "dd.MM")} ({day.dayName.slice(0, 2)})
                          </span>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={(day.coverage / Math.max(dailyCoverageStats.maxCoverage, 1)) * 100} 
                              className="h-2 w-16" 
                            />
                            <span className="font-medium min-w-[2rem] text-right">{day.coverage}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Break Coverage */}
            <Collapsible open={breakCoverageOpen} onOpenChange={setBreakCoverageOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center justify-between w-full p-2 hover:bg-muted/50 dark:hover:bg-muted/50">
                  <h4 className="text-sm font-medium text-foreground dark:text-foreground flex items-center gap-2">
                    <Coffee className="h-4 w-4" />
                    Pausenabdeckung
                  </h4>
                  {breakCoverageOpen ? (
                    <ChevronDown className="h-4 w-4 text-foreground dark:text-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-foreground dark:text-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 mt-3">
                  <div>
                    <div className="text-sm font-medium text-foreground dark:text-foreground">Schichten mit Pausen</div>
                    <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                      {basicStats.shiftsWithBreaks} von {basicStats.totalSchedules} Schichten
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={basicStats.breakCoverage} className="h-2 w-20" />
                    <Badge 
                      variant={basicStats.breakCoverage > 80 ? "secondary" : basicStats.breakCoverage > 50 ? "outline" : "destructive"}
                      className="text-xs"
                    >
                      {basicStats.breakCoverage.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Workload Distribution */}
            <Collapsible open={workloadOpen} onOpenChange={setWorkloadOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center justify-between w-full p-2 hover:bg-muted/50 dark:hover:bg-muted/50">
                  <h4 className="text-sm font-medium text-foreground dark:text-foreground flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Arbeitsverteilung
                  </h4>
                  {workloadOpen ? (
                    <ChevronDown className="h-4 w-4 text-foreground dark:text-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-foreground dark:text-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 mt-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-medium text-foreground dark:text-foreground">{workloadStats.avgHours.toFixed(1)}h</div>
                    <div className="text-xs text-muted-foreground dark:text-muted-foreground">⌀ Stunden</div>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-medium text-foreground dark:text-foreground">{workloadStats.minHours.toFixed(1)}h</div>
                    <div className="text-xs text-muted-foreground dark:text-muted-foreground">Minimum</div>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-medium text-foreground dark:text-foreground">{workloadStats.maxHours.toFixed(1)}h</div>
                    <div className="text-xs text-muted-foreground dark:text-muted-foreground">Maximum</div>
                  </div>
                </div>

                {/* Keyholder coverage */}
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <div className="text-sm font-medium text-foreground dark:text-foreground">Schlüsselträger</div>
                      <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                        {workloadStats.keyholders.length} von {basicStats.totalEmployees} Mitarbeitern
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {workloadStats.keyholderCoverage.toFixed(0)}%
                  </Badge>
                </div>

                {/* Alert for unbalanced workload */}
                {(workloadStats.underWorked.length > 0 || workloadStats.overWorked.length > 0) && (
                  <div className="space-y-2">
                    {workloadStats.underWorked.length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/50 rounded cursor-help border border-amber-200 dark:border-amber-800">
                              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              <span className="text-sm text-amber-700 dark:text-amber-300">
                                {workloadStats.underWorked.length} Mitarbeiter unter Durchschnitt
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">Weniger als 80% des Durchschnitts:</p>
                              {workloadStats.underWorked.slice(0, 3).map(emp => (
                                <p key={emp.employeeId} className="text-xs">
                                  {emp.name.length > 20 ? emp.name.substring(0, 20) + '...' : emp.name}: {emp.hours.toFixed(1)}h
                                </p>
                              ))}
                              {workloadStats.underWorked.length > 3 && (
                                <p className="text-xs text-muted-foreground">
                                  +{workloadStats.underWorked.length - 3} weitere
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {workloadStats.overWorked.length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/50 rounded cursor-help border border-red-200 dark:border-red-800">
                              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                              <span className="text-sm text-red-700 dark:text-red-300">
                                {workloadStats.overWorked.length} Mitarbeiter über Durchschnitt
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">Mehr als 120% des Durchschnitts:</p>
                              {workloadStats.overWorked.slice(0, 3).map(emp => (
                                <p key={emp.employeeId} className="text-xs">
                                  {emp.name.length > 20 ? emp.name.substring(0, 20) + '...' : emp.name}: {emp.hours.toFixed(1)}h
                                </p>
                              ))}
                              {workloadStats.overWorked.length > 3 && (
                                <p className="text-xs text-muted-foreground">
                                  +{workloadStats.overWorked.length - 3} weitere
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Weekly Breakdown - Compact View */}
            {weeklyBreakdown.length > 0 && weeklyBreakdown.length <= 4 && (
              <Collapsible open={weeklyOpen} onOpenChange={setWeeklyOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="flex items-center justify-between w-full p-2 hover:bg-muted/50 dark:hover:bg-muted/50">
                    <h4 className="text-sm font-medium text-foreground dark:text-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Wochenübersicht
                    </h4>
                    {weeklyOpen ? (
                      <ChevronDown className="h-4 w-4 text-foreground dark:text-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-foreground dark:text-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-3">
                  {weeklyBreakdown.map((week, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-muted-foreground dark:text-muted-foreground">KW {week.week}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-foreground dark:text-foreground">{week.shifts} Schichten</span>
                        <span className="font-medium text-foreground dark:text-foreground">{week.hours.toFixed(1)}h</span>
                        <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                          (⌀ {week.avgHoursPerShift.toFixed(1)}h)
                        </span>
                      </div>
                    </div>
                  ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Quick Actions/Insights */}
            {(basicStats.breakCoverage < 50 || workloadStats.overWorked.length > 0 || dailyCoverageStats.minCoverage === 0) && (
              <Collapsible open={recommendationsOpen} onOpenChange={setRecommendationsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="flex items-center justify-between w-full p-2 hover:bg-muted/50 dark:hover:bg-muted/50 border-t border-border dark:border-border pt-4">
                    <h4 className="text-sm font-medium text-foreground dark:text-foreground flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Empfehlungen
                    </h4>
                    {recommendationsOpen ? (
                      <ChevronDown className="h-4 w-4 text-foreground dark:text-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-foreground dark:text-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-3">
                  {basicStats.breakCoverage < 50 && (
                    <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                      <Coffee className="h-4 w-4" />
                      <span>Niedrige Pausenabdeckung - mehr Pausen einplanen</span>
                    </div>
                  )}
                  {workloadStats.overWorked.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                      <AlertCircle className="h-4 w-4" />
                      <span>Arbeitsverteilung überprüfen - einige Mitarbeiter überarbeitet</span>
                    </div>
                  )}
                  {dailyCoverageStats.minCoverage === 0 && (
                    <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Tage ohne Besetzung gefunden - Abdeckung prüfen</span>
                    </div>
                  )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
    </div>
  );
}
