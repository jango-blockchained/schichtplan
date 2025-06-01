import React, { useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { InfoIcon, AlertCircle, Users, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { parseISO, format, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { getEmployees, getSettings } from "@/services/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface ScheduleStatisticsProps {
  schedules: Schedule[];
  employees?: Employee[]; // Make this optional
  startDate: string;
  endDate: string;
  version?: number; // Add version parameter
}

// Define type for employee groups
type EmployeeGroupKey = "TL" | "VZ" | "TZ" | "GFB";
type EmployeeGroupData = {
  hours: number;
  employees: number;
  contractedHours: number;
};
type EmployeeGroups = Record<EmployeeGroupKey, EmployeeGroupData>;

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
    let startTotalMinutes = startHours * 60 + startMinutes;
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

export function ScheduleStatistics({
  schedules,
  employees: propEmployees,
  startDate,
  endDate,
  version,
}: ScheduleStatisticsProps) {
  const [isOpen, setIsOpen] = useState(true);
  // Validate inputs and provide defaults if needed
  const validatedSchedules = Array.isArray(schedules) ? schedules : [];
  const validatedStartDate =
    startDate || new Date().toISOString().split("T")[0];
  const validatedEndDate = endDate || new Date().toISOString().split("T")[0];
  // Enhanced debugging info with version analysis
  const versionCounts = validatedSchedules.reduce(
    (acc, s) => {
      if (s.version !== undefined) {
        acc[s.version] = (acc[s.version] || 0) + 1;
      } else {
        acc["undefined"] = (acc["undefined"] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log("ScheduleStatistics - component initialization:", {
    totalSchedules: validatedSchedules.length,
    requestedVersion: version,
    dateRange: { startDate: validatedStartDate, endDate: validatedEndDate },
    versionDistribution: versionCounts,
    scheduleTypes: {
      withShiftId: validatedSchedules.filter((s) => s.shift_id !== null).length,
      withoutShiftId: validatedSchedules.filter((s) => s.shift_id === null)
        .length,
      withValidTimes: validatedSchedules.filter(
        (s) => s.shift_id !== null && s.shift_start && s.shift_end,
      ).length,
      withoutValidTimes: validatedSchedules.filter(
        (s) => s.shift_id !== null && (!s.shift_start || !s.shift_end),
      ).length,
    },
    sampleSchedules: validatedSchedules.slice(0, 3).map((s) => ({
      id: s.id,
      version: s.version,
      shift_id: s.shift_id,
      employee_id: s.employee_id,
      date: s.date,
      times: `${s.shift_start || "none"}-${s.shift_end || "none"}`,
    })),
  });

  // Fetch employees if not passed in props
  const { data: fetchedEmployees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
    // Only fetch if not provided
    enabled: !propEmployees || propEmployees.length === 0,
  });

  // Use prop employees if available, otherwise use fetched employees
  const employees =
    propEmployees && propEmployees.length > 0
      ? propEmployees
      : fetchedEmployees || [];

  // Fetch settings to get total weekly working hours constraint
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Analyze schedule data for version integrity
  const schedulesWithVersion = validatedSchedules.filter(
    (s) => s.version !== undefined,
  );
  const schedulesWithoutVersion = validatedSchedules.filter(
    (s) => s.version === undefined,
  );

  // Log any schedules missing version info for debugging
  if (schedulesWithoutVersion.length > 0) {
    console.warn(
      "ScheduleStatistics - schedules missing version information:",
      schedulesWithoutVersion.length,
      schedulesWithoutVersion.slice(0, 3),
    );
  }

  // Get unique versions in the data
  const uniqueVersions = [
    ...new Set(schedulesWithVersion.map((s) => s.version)),
  ].sort();

  // IMPROVED: Filter schedules by version if specified - with validation
  let filteredSchedules = validatedSchedules;

  if (version !== undefined) {
    // First check if this version exists in our data
    const versionExists = uniqueVersions.includes(version);

    if (versionExists) {
      // Apply filtering only if the version exists in our data
      filteredSchedules = validatedSchedules.filter(
        (s) => s.version === version,
      );
    } else {
      // Log warning and fall back to all schedules if requested version doesn't exist
      console.warn(
        `ScheduleStatistics - requested version ${version} not found in data. Available versions:`,
        uniqueVersions,
      );
    }
  }

  // Extended version filtering debug info
  console.log("ScheduleStatistics - version filtering analysis:", {
    requestedVersion: version,
    availableVersions: uniqueVersions,
    totalSchedules: validatedSchedules.length,
    schedulesWithVersionInfo: schedulesWithVersion.length,
    schedulesWithoutVersionInfo: schedulesWithoutVersion.length,
    filteredCount: filteredSchedules.length,
    schedulesWithShifts: validatedSchedules.filter((s) => s.shift_id !== null)
      .length,
    filteredWithShifts: filteredSchedules.filter((s) => s.shift_id !== null)
      .length,
    versionDistribution: schedulesWithVersion.reduce(
      (acc, s) => {
        acc[s.version] = (acc[s.version] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    ),
    shiftVersionDistribution: validatedSchedules
      .filter((s) => s.shift_id !== null && s.version !== undefined)
      .reduce(
        (acc, s) => {
          acc[s.version] = (acc[s.version] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      ),
  });

  // Filter out schedules with no shift assigned, with improved validation
  const validSchedules = filteredSchedules.filter((s) => {
    // First ensure shift_id exists
    if (s.shift_id === null || s.shift_id === undefined) {
      return false;
    }

    // Validate basic scheduling data is present
    const hasRequiredData =
      s.employee_id !== undefined &&
      s.employee_id !== null &&
      s.date !== undefined &&
      s.date !== null;

    // Check shift times if we want to be strict
    const hasShiftTimes = s.shift_start && s.shift_end;

    // Return true if we have the basic required data
    // We don't strictly require shift times because some schedules might be missing them
    // but are otherwise valid
    return hasRequiredData;
  });

  // Basic statistics
  const totalShifts = validSchedules.length;
  const totalHours = validSchedules.reduce(
    (sum, s) => sum + calculateShiftDuration(s),
    0,
  );

  const uniqueEmployees = [
    ...new Set(validSchedules.map((s) => s.employee_id)),
  ];
  const scheduledEmployeesCount = uniqueEmployees.length;
  const totalEmployeesCount = employees.length;
  const employeeCoverage =
    totalEmployeesCount > 0
      ? (scheduledEmployeesCount / totalEmployeesCount) * 100
      : 0;

  // Calculate shift distribution
  const earlyShifts = validSchedules.filter(
    (s) => s.shift_start && s.shift_start < "10:00",
  ).length;
  const lateShifts = validSchedules.filter(
    (s) => s.shift_end && s.shift_end >= "18:00",
  ).length;
  const midShifts = totalShifts - earlyShifts - lateShifts;

  const earlyPercentage =
    totalShifts > 0 ? (earlyShifts / totalShifts) * 100 : 0;
  const midPercentage = totalShifts > 0 ? (midShifts / totalShifts) * 100 : 0;
  const latePercentage = totalShifts > 0 ? (lateShifts / totalShifts) * 100 : 0;

  // Calculate hours by employee group with proper typing
  const employeeGroups: EmployeeGroups = {
    TL: { hours: 0, employees: 0, contractedHours: 0 },
    VZ: { hours: 0, employees: 0, contractedHours: 0 },
    TZ: { hours: 0, employees: 0, contractedHours: 0 },
    GFB: { hours: 0, employees: 0, contractedHours: 0 },
  };

  // Calculate date range info
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const daysDifference = differenceInDays(end, start) + 1;
  const weekCount = Math.ceil(daysDifference / 7);

  const formattedStartDate = format(start, "d. MMMM", { locale: de });
  const formattedEndDate = format(end, "d. MMMM yyyy", { locale: de });
  const dateRangeText = `${formattedStartDate} - ${formattedEndDate}`;

  // Group schedules by employee
  employees.forEach((employee) => {
    const group = employee.employee_group || "VZ";
    // Make sure we're only counting for valid groups
    if (group === "TL" || group === "VZ" || group === "TZ" || group === "GFB") {
      employeeGroups[group].employees++;
      employeeGroups[group].contractedHours += employee.contracted_hours || 0;

      // Sum hours assigned to this employee
      const employeeSchedules = validSchedules.filter(
        (s) => s.employee_id === employee.id,
      );
      const employeeHours = employeeSchedules.reduce(
        (sum, s) => sum + calculateShiftDuration(s),
        0,
      );
      employeeGroups[group].hours += employeeHours;
    }
  });

  // Calculate total contracted hours and percentage filled
  const totalContractedHours = Object.values(employeeGroups).reduce(
    (sum, group) => sum + group.contractedHours,
    0,
  );
  const contractedHoursPerWeek = totalContractedHours;
  const contractedHoursForPeriod = contractedHoursPerWeek * weekCount;
  const hoursUtilization =
    contractedHoursForPeriod > 0
      ? (totalHours / contractedHoursForPeriod) * 100
      : 0;

  return (
    <Card className="shadow-sm border-border/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/30">
          <div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-0 hover:bg-muted/50">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <CardTitle className="text-lg font-medium">
                  Übersicht Schichtplan
                </CardTitle>
              </Button>
            </CollapsibleTrigger>
            <CardDescription className="text-muted-foreground">
              {dateRangeText} ({daysDifference} Tage)
            </CardDescription>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg border border-border/30">
              <span className="text-3xl font-medium text-primary">{totalShifts}</span>
              <span className="text-sm text-muted-foreground font-medium">Schichten</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg border border-border/30">
              <span className="text-3xl font-medium text-primary">
                {totalHours.toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground font-medium">Stunden</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg border border-border/30">
              <span className="text-3xl font-medium text-primary">
                {scheduledEmployeesCount}/{totalEmployeesCount}
              </span>
              <span className="text-sm text-muted-foreground font-medium">Mitarbeiter</span>
            </div>
          </div>

          {/* Total Weekly Working Hours Constraint */}
          {settings?.total_weekly_working_hours && (
            <div className="mt-6 pt-6 border-t border-border/30">
              <div className="p-4 bg-muted/20 rounded-lg border border-border/30">
                <h4 className="text-sm font-medium mb-3 text-foreground">Gesamtstunden-Constraint</h4>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {totalHours.toFixed(0)} / {(settings.total_weekly_working_hours * weekCount).toFixed(0)} h
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <InfoIcon className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Geplante Stunden vs. maximale Gesamtstunden-Constraint ({settings.total_weekly_working_hours}h/Woche)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Progress 
                  value={Math.min(100, (totalHours / (settings.total_weekly_working_hours * weekCount)) * 100)} 
                  className={`h-3 mt-2 ${
                    totalHours > (settings.total_weekly_working_hours * weekCount) ? "bg-red-200" : ""
                  }`}
                />
                <div className="flex justify-between mt-2 text-xs">
                  <span className={
                    totalHours > (settings.total_weekly_working_hours * weekCount) 
                      ? "text-red-400 font-medium" 
                      : "text-muted-foreground"
                  }>
                    {((totalHours / (settings.total_weekly_working_hours * weekCount)) * 100).toFixed(0)}%
                    {totalHours > (settings.total_weekly_working_hours * weekCount) && " (Überschritten)"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* NEW: Interval Coverage Stats */}
          <div className="mt-6 pt-6 border-t border-border/30">
            <div className="p-4 bg-muted/20 rounded-lg border border-border/30">
              <h4 className="text-sm font-medium mb-3 flex items-center text-foreground">
                <AlertCircle className="h-4 w-4 mr-2 text-orange-400" />{" "}
                Intervall-Abdeckung (Platzhalter)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Placeholder Value - Needs real data */}
                {/* MIN EMPLOYEE COVERAGE */}
                <div className="p-3 bg-background/50 rounded border border-border/30">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="text-left w-full">
                        <span className="text-xl font-medium text-primary">-- %</span>
                        <div className="text-xs text-muted-foreground mt-1">
                          Min. Besetzung
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Prozent der Zeitintervalle, die die Mindestbesetzung
                          erfüllen.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {/* KEYHOLDER COVERAGE */}
                <div className="p-3 bg-background/50 rounded border border-border/30">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="text-left w-full">
                        <span className="text-xl font-medium text-primary">-- %</span>
                        <div className="text-xs text-muted-foreground mt-1">
                          Schlüsselträger
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Prozent der Zeitintervalle, die einen benötigten
                          Schlüsselträger haben.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {/* TODO: Add more metrics like Understaffed Intervals, Missing Employee Type Intervals */}
              </div>
            </div>
          </div>

          {/* Existing: Shift Distribution */}
          <div className="mt-6 pt-6 border-t border-border/30">
            <div className="p-4 bg-muted/20 rounded-lg border border-border/30">
              <h4 className="text-sm font-medium mb-4 text-foreground">Schichtverteilung</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Frühschichten</span>
                    <span className="font-medium">
                      {earlyShifts} ({earlyPercentage.toFixed(0)}%)
                    </span>
                  </div>
                  <Progress value={earlyPercentage} className="h-3" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Mittelschichten</span>
                    <span className="font-medium">
                      {midShifts} ({midPercentage.toFixed(0)}%)
                    </span>
                  </div>
                  <Progress value={midPercentage} className="h-3" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Spätschichten</span>
                    <span className="font-medium">
                      {lateShifts} ({latePercentage.toFixed(0)}%)
                    </span>
                  </div>
                  <Progress value={latePercentage} className="h-3" />
                </div>
              </div>
            </div>
          </div>

          {/* Hours Utilization */}
          <div className="mt-6 pt-6 border-t border-border/30">
            <div className="p-4 bg-muted/20 rounded-lg border border-border/30">
              <h4 className="text-sm font-medium mb-3 text-foreground">Stundenabdeckung</h4>
              <CardDescription className="mb-3">
                {totalHours.toFixed(0)} / {contractedHoursForPeriod.toFixed(0)}{" "}
                Stunden
              </CardDescription>
              <Progress
                value={hoursUtilization > 100 ? 100 : hoursUtilization}
                className={`h-3 ${hoursUtilization > 100 ? "bg-amber-200" : ""}`}
              />
              <div className="flex justify-between mt-3 text-sm">
                <span
                  className={
                    hoursUtilization > 100 ? "text-amber-400 font-medium" : "font-medium"
                  }
                >
                  {hoursUtilization.toFixed(0)}% Auslastung
                  {hoursUtilization > 100 && " (Überbesetzt)"}
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Geplante Stunden im Verhältnis zu verfügbaren
                        Vertragsstunden
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 p-3 bg-background/50 rounded border border-border/30">
                {(
                  Object.entries(employeeGroups) as [
                    EmployeeGroupKey,
                    EmployeeGroupData,
                  ][]
                ).map(
                  ([group, data]) =>
                    data.employees > 0 && (
                      <div
                        key={group}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-medium">{group}:</span>
                        <span className="text-muted-foreground">
                          {data.hours.toFixed(0)} /{" "}
                          {(data.contractedHours * weekCount).toFixed(0)} h (
                          {data.contractedHours > 0
                            ? (
                                (data.hours /
                                  (data.contractedHours * weekCount)) *
                                100
                              ).toFixed(0)
                            : 0}
                          %)
                        </span>
                      </div>
                    ),
                )}
              </div>
            </div>
          </div>
        </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
