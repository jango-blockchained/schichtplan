import React, { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Clock, Calendar, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { CoverageEditor } from "@/components/coverage-editor";
import { useToast } from "@/components/ui/use-toast";
import { getAllCoverage, updateCoverage, getSettings } from "@/services/api";
import { DailyCoverage, Settings, CoverageTimeSlot, Coverage } from "@/types/index";
import { PageHeader } from "@/components/layout";
import { StoreConfigProps } from "@/components/coverage-editor/types";

const CustomTooltip = ({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Coverage
            </span>
            <span className="font-bold text-muted-foreground">
              {payload[0].value}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function CoveragePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch coverage data
  const { data: coverageData, isLoading: isCoverageLoading } = useQuery<Coverage[]>({
    queryKey: ["coverage"],
    queryFn: getAllCoverage,
  });

  // Fetch settings
  const { data: settings, isLoading: isSettingsLoading } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Prepare initial coverage data
  const initialCoverage = useMemo(() => {
    if (!coverageData || !Array.isArray(coverageData)) return undefined;
    
    // Group entries by day index
    const groupedByDay = coverageData.reduce((acc, entry) => {
      const daySlots = acc[entry.day_index] || [];
      // Transform the entry into a time slot
      const timeSlot: CoverageTimeSlot = {
        startTime: entry.start_time,
        endTime: entry.end_time,
        minEmployees: entry.min_employees,
        maxEmployees: entry.max_employees,
        employeeTypes: [],  // Coverage type doesn't have employee_types
        requiresKeyholder: entry.requires_keyholder || false,
        keyholderBeforeMinutes: entry.keyholder_before_minutes || 0,
        keyholderAfterMinutes: entry.keyholder_after_minutes || 0,
      };
      daySlots.push(timeSlot);
      acc[entry.day_index] = daySlots;
      return acc;
    }, {} as Record<number, CoverageTimeSlot[]>);

    // Convert to array format expected by CoverageEditor
    return Object.entries(groupedByDay).map(([dayIndex, timeSlots]) => ({
      dayIndex: parseInt(dayIndex),
      timeSlots: timeSlots.sort((a, b) => a.startTime.localeCompare(b.startTime)), // Sort by start time
    }));
  }, [coverageData]);

  // Prepare store config from settings
  const storeConfig = useMemo(() => {
    const defaultConfig: StoreConfigProps = {
      store_opening: "09:00",
      store_closing: "20:00",
      opening_days: {
        "0": false,
        "1": true,
        "2": true,
        "3": true,
        "4": true,
        "5": true,
        "6": true,
      },
      min_employees_per_shift: 1,
      max_employees_per_shift: 3,
      employee_types: [],
      keyholder_before_minutes: 30,
      keyholder_after_minutes: 30,
    };

    if (!settings) return defaultConfig;
    
    const opening_days = Object.keys(settings.opening_days || {}).length === 0 
      ? defaultConfig.opening_days 
      : settings.opening_days;
    
    return {
      store_opening: settings.store_opening || defaultConfig.store_opening,
      store_closing: settings.store_closing || defaultConfig.store_closing,
      opening_days,
      min_employees_per_shift: settings.min_employees_per_shift || defaultConfig.min_employees_per_shift,
      max_employees_per_shift: settings.max_employees_per_shift || defaultConfig.max_employees_per_shift,
      employee_types: Array.isArray(settings.employee_types) 
        ? settings.employee_types.map(type => ({
            id: type.id,
            name: type.name,
            min_hours: type.min_hours || 0,
            max_hours: type.max_hours || 40,
            type: "employee" as const,
            abbr: type.name.substring(0, 3)
          }))
        : defaultConfig.employee_types,
      keyholder_before_minutes: settings.keyholder_before_minutes || defaultConfig.keyholder_before_minutes,
      keyholder_after_minutes: settings.keyholder_after_minutes || defaultConfig.keyholder_after_minutes,
    };
  }, [settings]);

  // Calculate real stats from coverage data
  const stats = useMemo(() => {
    if (!coverageData || !Array.isArray(coverageData)) return null;

    // Initialize default coverage array if empty
    const defaultCoverage: DailyCoverage[] = Array.from(
      { length: 7 },
      (_, index) => ({
        dayIndex: index,
        timeSlots: [],
      }),
    );

    // Merge existing coverage with defaults
    const fullCoverage = defaultCoverage.map((defaultDay) => {
      const existingDay = coverageData.find(
        (day) => day.day_index === defaultDay.dayIndex,
      );
      // Ensure timeSlots is always an array
      return {
        dayIndex: existingDay?.day_index ?? defaultDay.dayIndex,
        timeSlots: Array.isArray(existingDay?.timeSlots) ? existingDay.timeSlots : [],
      };
    });

    const totalTimeSlots = fullCoverage.reduce(
      (acc, day) =>
        acc + (Array.isArray(day.timeSlots) ? day.timeSlots.length : 0),
      0,
    );

    const totalRequiredEmployees = fullCoverage.reduce((acc, day) => {
      // Ensure timeSlots is an array before reducing
      const timeSlots = Array.isArray(day.timeSlots) ? day.timeSlots : [];
      return (
        acc +
        timeSlots.reduce((sum, slot) => {
          return sum + (slot.minEmployees || 0);
        }, 0)
      );
    }, 0);

    // Calculate weekly coverage data
    const weeklyData = fullCoverage
      .map((day) => {
        const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
          day.dayIndex
        ];
        const timeSlots = Array.isArray(day.timeSlots) ? day.timeSlots : [];
        
        const totalRequired = timeSlots.reduce((sum, slot) => sum + (slot.minEmployees || 0), 0);
        const totalScheduled = timeSlots.reduce((sum, slot) => sum + (slot.maxEmployees || 0), 0);
        
        const coverage = totalRequired > 0 ? (totalScheduled / totalRequired) * 100 : 0;
        
        return {
          day: dayName,
          coverage: Math.round(coverage),
          required: totalRequired,
          scheduled: totalScheduled
        };
      })
      .sort((a, b) => {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return days.indexOf(a.day) - days.indexOf(b.day);
      });

    // Calculate average hours per employee
    const totalHours = fullCoverage.reduce((acc, day) => {
      // Ensure timeSlots is an array before reducing
      const timeSlots = Array.isArray(day.timeSlots) ? day.timeSlots : [];
      return (
        acc +
        timeSlots.reduce((sum, slot) => {
          if (!slot.startTime || !slot.endTime) return sum;
          const start = parseInt(slot.startTime.split(":")[0]);
          const end = parseInt(slot.endTime.split(":")[0]);
          return sum + (end - start) * (slot.minEmployees || 0);
        }, 0)
      );
    }, 0);

    const averageHours =
      totalRequiredEmployees > 0 ? totalHours / totalRequiredEmployees : 0;

    const totalScheduledEmployees = fullCoverage.reduce((acc, day) => {
      const timeSlots = Array.isArray(day.timeSlots) ? day.timeSlots : [];
      return acc + timeSlots.reduce((sum, slot) => sum + (slot.maxEmployees || 0), 0);
    }, 0);

    // Calculate daily and weekly hour ranges
    const dailyHours = fullCoverage.map(day => {
      const timeSlots = Array.isArray(day.timeSlots) ? day.timeSlots : [];
      return timeSlots.reduce((sum, slot) => {
        if (!slot.startTime || !slot.endTime) return sum;
        const start = parseInt(slot.startTime.split(":")[0]);
        const end = parseInt(slot.endTime.split(":")[0]);
        return sum + (end - start) * (slot.minEmployees || 0);
      }, 0);
    });

    const minDailyHours = Math.min(...dailyHours.filter(hours => hours > 0));
    const maxDailyHours = Math.max(...dailyHours);
    const totalWeeklyHours = dailyHours.reduce((sum, hours) => sum + hours, 0);

    return {
      totalEmployees: totalRequiredEmployees,
      scheduledEmployees: totalScheduledEmployees,
      averageHours: Math.round(averageHours * 10) / 10,
      coverageRate: Math.round((totalTimeSlots > 0 ? (totalRequiredEmployees / totalTimeSlots) * 100 : 0)),
      weeklyData,
      minDailyHours: Math.round(minDailyHours * 10) / 10,
      maxDailyHours: Math.round(maxDailyHours * 10) / 10,
      totalWeeklyHours: Math.round(totalWeeklyHours * 10) / 10,
    };
  }, [coverageData]);

  // Remove the first loading check and keep only the comprehensive one
  if (isSettingsLoading || !settings || isCoverageLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Coverage Overview"
        description="Monitor employee coverage and scheduling statistics"
      />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-5">
        {/* Total Employees Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Required Employees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              {stats.scheduledEmployees} currently scheduled
            </p>
          </CardContent>
        </Card>

        {/* Average Hours Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageHours}h</div>
            <p className="text-xs text-muted-foreground">
              Per employee per week
            </p>
          </CardContent>
        </Card>

        {/* Hour Ranges Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hour Ranges</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.minDailyHours}-{stats.maxDailyHours}h</div>
            <p className="text-xs text-muted-foreground">
              Daily range ({stats.totalWeeklyHours}h/week)
            </p>
          </CardContent>
        </Card>

        {/* Coverage Rate Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.coverageRate}%</div>
            <p className="text-xs text-muted-foreground">
              Of required positions filled
            </p>
          </CardContent>
        </Card>

        {/* Weekly Trend Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.weeklyData}>
                  <Line
                    type="monotone"
                    dataKey="coverage"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={false}
                  />
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={[60, 100]} />
                  <Tooltip content={CustomTooltip} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <CoverageEditor
        initialCoverage={initialCoverage}
        storeConfig={storeConfig}
        onChange={async (newCoverage) => {
          try {
            await updateCoverage(newCoverage);
            await queryClient.invalidateQueries({ queryKey: ["coverage"] });
            toast({
              title: "Success",
              description: "Coverage settings saved successfully",
            });
          } catch (error) {
            console.error("Error updating coverage:", error);
            toast({
              title: "Error",
              description: "Failed to save coverage settings",
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
}
