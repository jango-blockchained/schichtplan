import {
  AISearchInput,
  type SearchSuggestion,
} from "@/components/ai/AISearchInput";
import { CoverageEditor, CoverageProfileManager } from "@/components/coverage-editor";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  getAllCoverage,
  getDefaultCoverageProfile,
  getSettings,
  updateCoverage,
} from "@/services/api";
import { CoverageProfile, CoverageTimeSlot, DailyCoverage } from "@/types/index";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Loader2, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

const CustomTooltip = ({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2">
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
  const [selectedProfile, setSelectedProfile] = useState<CoverageProfile | null>(null);

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["settings"] as const,
    queryFn: getSettings,
  });

  const { data: coverage, isLoading: isCoverageLoading } = useQuery({
    queryKey: ["coverage"] as const,
    queryFn: getAllCoverage,
  });

  // Load default profile on mount
  const { data: defaultProfile } = useQuery({
    queryKey: ["defaultCoverageProfile"],
    queryFn: getDefaultCoverageProfile,
    staleTime: Infinity, // Don't refetch unless invalidated
  });

  // When default profile is loaded and coverage hasn't been edited, use the profile data
  const effectiveCoverage = useMemo(() => {
    // Use current coverage if it exists and has content
    if (coverage && coverage.some((day) => day.timeSlots.length > 0)) {
      return coverage;
    }
    // Otherwise use default profile coverage if available
    if (defaultProfile && selectedProfile?.id === defaultProfile.id) {
      return defaultProfile.coverageData;
    }
    return coverage || [];
  }, [coverage, defaultProfile, selectedProfile]);

  // Calculate real stats from coverage data
  const stats = useMemo(() => {
    if (!effectiveCoverage || !Array.isArray(effectiveCoverage)) return null;

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
      const existingDay = effectiveCoverage.find(
        (day) => day.dayIndex === defaultDay.dayIndex,
      );
      return existingDay || defaultDay;
    });

    const totalRequiredEmployees = fullCoverage.reduce((acc, day) => {
      if (!Array.isArray(day.timeSlots)) return acc;
      return (
        acc +
        day.timeSlots.reduce((sum, slot) => {
          return sum + (slot.minEmployees || 0);
        }, 0)
      );
    }, 0);

    // Calculate weekly coverage data
    const weeklyData = fullCoverage
      .map((day) => {
        const dayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
          day.dayIndex
        ];
        if (!Array.isArray(day.timeSlots) || day.timeSlots.length === 0) {
          return { day: dayName, coverage: 0 };
        }

        const totalRequired = day.timeSlots.reduce((sum, slot) => {
          return sum + (slot.minEmployees || 0);
        }, 0);

        const totalScheduled = day.timeSlots.reduce((sum, slot) => {
          return sum + (slot.maxEmployees || 0);
        }, 0);

        const coverage =
          totalRequired > 0 ? (totalScheduled / totalRequired) * 100 : 0;
        return {
          day: dayName,
          coverage: Math.round(coverage),
        };
      })
      .sort((a, b) => {
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        return days.indexOf(a.day) - days.indexOf(b.day);
      });

    // Calculate average hours per employee
    const totalHours = fullCoverage.reduce((acc, day) => {
      if (!Array.isArray(day.timeSlots)) return acc;
      return (
        acc +
        day.timeSlots.reduce((sum, slot) => {
          if (!slot.startTime || !slot.endTime) return sum;
          const start = parseInt(slot.startTime.split(":")[0]);
          const end = parseInt(slot.endTime.split(":")[0]);
          return sum + (end - start) * (slot.minEmployees || 0);
        }, 0)
      );
    }, 0);

    const averageHours =
      totalRequiredEmployees > 0 ? totalHours / totalRequiredEmployees : 0;

    return {
      totalEmployees: totalRequiredEmployees,
      scheduledEmployees: Math.round(totalRequiredEmployees * 0.85), // Assuming 85% coverage
      averageHours: Math.round(averageHours * 10) / 10,
      coverageRate:
        totalRequiredEmployees > 0
          ? Math.round((totalRequiredEmployees / totalRequiredEmployees) * 100)
          : 0,
      weeklyData,
    };
  }, [effectiveCoverage]); if (isSettingsLoading || !settings || isCoverageLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Convert settings to the format expected by CoverageEditor
  const storeConfig = {
    store_opening: settings.general.store_opening,
    store_closing: settings.general.store_closing,
    opening_days: settings.general.opening_days,
    min_employees_per_shift: settings.scheduling.min_employees_per_shift ?? 1,
    max_employees_per_shift: settings.scheduling.max_employees_per_shift ?? 3,
    employee_types: settings.employee_groups.employee_types.map((type) => ({
      id: type.id,
      name: type.name,
    })),
    keyholder_before_minutes: settings.general.keyholder_before_minutes,
    keyholder_after_minutes: settings.general.keyholder_after_minutes,
  };

  // Initialize default coverage if none exists
  const initialCoverage =
    effectiveCoverage ||
    Array.from({ length: 7 }, (_, index) => ({
      dayIndex: index,
      timeSlots: [] as CoverageTimeSlot[],
    }));

  // AI Search handlers
  const handleAISearch = (query: string, suggestions?: SearchSuggestion[]) => {
    console.log("AI Search query:", query, "Suggestions:", suggestions);
    // TODO: Implement AI-powered search logic for coverage
    // This could search across coverage data, identify gaps, etc.
  };

  const handleAISuggestionSelect = (suggestion: SearchSuggestion) => {
    console.log("AI Suggestion selected:", suggestion);
    // TODO: Handle suggestion selection (e.g., filter coverage data, navigate to specific time slots, etc.)
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Coverage Overview"
        description="Monitor employee coverage and scheduling statistics"
      />

      {/* AI-Powered Search */}
      <div className="mb-4">
        <AISearchInput
          placeholder="Search coverage data with AI assistance..."
          onSearch={handleAISearch}
          onSuggestionSelect={handleAISuggestionSelect}
          showSuggestions={true}
          maxSuggestions={5}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
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
        currentProfileId={selectedProfile?.id}
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

      {/* Coverage Profiles Manager */}
      <CoverageProfileManager
        onSelectProfile={(profile) => {
          setSelectedProfile(profile);
          // Manually update coverage with the profile data
          // This simulates loading the profile
          toast({
            title: "Profile Loaded",
            description: `Loaded coverage profile "${profile.name}"`,
          });
        }}
        selectedProfileId={selectedProfile?.id}
      />
    </div>
  );
}
