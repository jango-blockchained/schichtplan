import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Schedule, Employee } from "@/types";
import { format, addDays, parseISO, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { InfoIcon, AlertCircle, Users, Clock, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface StatisticsViewProps {
  schedules: Schedule[];
  employees: Employee[];
  dateRange: { from: Date; to: Date } | undefined;
}

export function StatisticsView({
  schedules,
  employees,
  dateRange,
}: StatisticsViewProps) {
  const [activeTab, setActiveTab] = useState<string>("simple");
  const [isOpen, setIsOpen] = useState(true);

  if (!dateRange?.from || !dateRange?.to || schedules.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            No data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  // Schedule Statistics Data
  const scheduleStats = calculateScheduleStats(schedules);

  // Employee Statistics Data
  const employeeStats = calculateEmployeeStats(schedules, employees);

  // Calculate simple numeric statistics
  const numericStats = calculateNumericStats(schedules, employees, dateRange);

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
          <CardTitle>Statistiken</CardTitle>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple Stats</SelectItem>
              <SelectItem value="schedule">Schedule Charts</SelectItem>
              <SelectItem value="employees">Employee Charts</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="px-6 py-2 border-b bg-muted/20">
          <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors w-full text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Statistiken anzeigen</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? "" : "transform rotate-180"}`}
              />
            </div>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <CardContent>
            {activeTab === "simple" && (
              <SimpleStatisticsContent stats={numericStats} />
            )}

            {activeTab === "schedule" && (
              <div className="space-y-4">
                <ScheduleStatisticsContent stats={scheduleStats} />
              </div>
            )}

            {activeTab === "employees" && (
              <div className="space-y-4">
                <EmployeeStatisticsContent stats={employeeStats} />
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Simple numeric statistics component
function SimpleStatisticsContent({ stats }: { stats: any }) {
  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Schedule Overview
          </CardTitle>
          <CardDescription>
            {stats.dateRangeText} ({stats.daysDifference} days)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">{stats.totalShifts}</span>
              <span className="text-xs text-muted-foreground">Shifts</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">
                {stats.totalHours.toFixed(0)}
              </span>
              <span className="text-xs text-muted-foreground">Hours</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">
                {stats.scheduledEmployeesCount}/{stats.totalEmployeesCount}
              </span>
              <span className="text-xs text-muted-foreground">Employees</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Shift Distribution */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Shift Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Early Shifts</span>
                  <span>
                    {stats.earlyShifts} ({stats.earlyPercentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={stats.earlyPercentage} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Mid Shifts</span>
                  <span>
                    {stats.midShifts} ({stats.midPercentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={stats.midPercentage} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Late Shifts</span>
                  <span>
                    {stats.lateShifts} ({stats.latePercentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={stats.latePercentage} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee Utilization */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Employee Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Employee Coverage</span>
                <span>{stats.employeeCoverage.toFixed(0)}%</span>
              </div>
              <Progress value={stats.employeeCoverage} className="h-2" />
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span>Hours Utilization</span>
                <span>
                  {stats.hoursUtilization.toFixed(0)}% of contracted hours
                </span>
              </div>
              <Progress value={stats.hoursUtilization} className="h-2" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <p>
                Total Hours: {stats.totalHours.toFixed(1)} /{" "}
                {stats.contractedHoursForPeriod.toFixed(1)} contracted
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Schedule Statistics Content Component
function ScheduleStatisticsContent({ stats }: { stats: any }) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Distribution by Day</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.byDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="shifts" fill="#8884d8" name="Number of Shifts" />
            <Bar dataKey="hours" fill="#82ca9d" name="Total Hours" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">
          Distribution by Shift Type
        </h3>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-1/2">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.byType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {stats.byType.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.color ||
                        `#${Math.floor(Math.random() * 16777215).toString(16)}`
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full lg:w-1/2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stats.byType.map((type: any) => (
                <div
                  key={type.name}
                  className="flex items-center p-2 border rounded"
                >
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="flex-1">{type.name}</span>
                  <span className="font-semibold">{type.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Employee Statistics Content Component
function EmployeeStatisticsContent({ stats }: { stats: any }) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Hours by Employee</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={stats.employeeHours} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="hours" fill="#8884d8" name="Total Hours" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Shift Count by Employee</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={stats.employeeShifts} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="shifts" fill="#82ca9d" name="Number of Shifts" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Calculate simple numeric statistics
function calculateNumericStats(
  schedules: Schedule[],
  employees: Employee[],
  dateRange: { from: Date; to: Date },
) {
  // Filter out schedules with no shift assigned
  const validSchedules = schedules.filter((s) => s.shift_id !== null);

  // Calculate shift duration
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

  // Calculate date range info
  const start = dateRange.from;
  const end = dateRange.to;
  const daysDifference = differenceInDays(end, start) + 1;
  const weekCount = Math.ceil(daysDifference / 7);

  const formattedStartDate = format(start, "d. MMMM", { locale: de });
  const formattedEndDate = format(end, "d. MMMM yyyy", { locale: de });
  const dateRangeText = `${formattedStartDate} - ${formattedEndDate}`;

  // Calculate total contracted hours for employees
  const totalContractedHours = employees.reduce(
    (sum, emp) => sum + (emp.contracted_hours || 0),
    0,
  );
  const contractedHoursPerWeek = totalContractedHours;
  const contractedHoursForPeriod = contractedHoursPerWeek * weekCount;
  const hoursUtilization =
    contractedHoursForPeriod > 0
      ? (totalHours / contractedHoursForPeriod) * 100
      : 0;

  return {
    totalShifts,
    totalHours,
    scheduledEmployeesCount,
    totalEmployeesCount,
    employeeCoverage,
    earlyShifts,
    midShifts,
    lateShifts,
    earlyPercentage,
    midPercentage,
    latePercentage,
    daysDifference,
    dateRangeText,
    contractedHoursForPeriod,
    hoursUtilization,
  };
}

// Utility function to calculate schedule statistics
function calculateScheduleStats(schedules: Schedule[]) {
  // By day calculation
  const byDay = [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
    const daySchedules = schedules.filter((s) => {
      const date = new Date(s.date);
      return date.getDay() === dayIndex;
    });

    const totalHours = daySchedules.reduce((sum, s) => {
      if (s.shift_start && s.shift_end) {
        // Simple hour calculation for example purposes
        const hours = 8; // Simplified calculation
        return sum + hours;
      }
      return sum;
    }, 0);

    return {
      name: format(new Date(2023, 0, 1 + dayIndex), "EEEE", { locale: de }),
      shifts: daySchedules.length,
      hours: totalHours,
    };
  });

  // By type calculation
  const typeCount: Record<string, { count: number; color: string }> = {};

  schedules.forEach((s) => {
    const type = s.shift_type_id || "Unknown";
    if (!typeCount[type]) {
      typeCount[type] = { count: 0, color: getRandomColor(type) };
    }
    typeCount[type].count++;
  });

  const byType = Object.entries(typeCount).map(([name, data]) => ({
    name,
    value: data.count,
    color: data.color,
  }));

  return { byDay, byType };
}

// Utility function to calculate employee statistics
function calculateEmployeeStats(schedules: Schedule[], employees: Employee[]) {
  const employeeData: Record<
    number,
    { name: string; hours: number; shifts: number }
  > = {};

  // Initialize with all employees
  employees.forEach((e) => {
    employeeData[e.id] = {
      name: `${e.last_name}, ${e.first_name}`,
      hours: 0,
      shifts: 0,
    };
  });

  // Calculate statistics
  schedules.forEach((s) => {
    if (!s.employee_id || !employeeData[s.employee_id]) return;

    employeeData[s.employee_id].shifts++;

    if (s.shift_start && s.shift_end) {
      // Simple hour calculation for example purposes
      const hours = 8; // Simplified calculation
      employeeData[s.employee_id].hours += hours;
    }
  });

  // Convert to arrays for charts
  const employeeHours = Object.values(employeeData)
    .filter((e) => e.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const employeeShifts = Object.values(employeeData)
    .filter((e) => e.shifts > 0)
    .sort((a, b) => b.shifts - a.shifts);

  return { employeeHours, employeeShifts };
}

// Helper function to get a deterministic color based on string
function getRandomColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const c = (hash & 0x00ffffff).toString(16).toUpperCase().padStart(6, "0");

  return "#" + c;
}
