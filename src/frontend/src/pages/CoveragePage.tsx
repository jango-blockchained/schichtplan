import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Users, Clock, Calendar, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { CoverageEditor } from "@/components/CoverageEditor";
import { useToast } from "@/components/ui/use-toast";
import { getAllCoverage, updateCoverage, getSettings } from "@/services/api";
import { DailyCoverage, Settings } from "@/types/index";

interface CoverageStats {
    totalEmployees: number;
    scheduledEmployees: number;
    averageHours: number;
    coverageRate: number;
    weeklyData: Array<{
        day: string;
        coverage: number;
    }>;
}

// Temporary mock data - replace with actual API call
const mockStats: CoverageStats = {
    totalEmployees: 45,
    scheduledEmployees: 38,
    averageHours: 32.5,
    coverageRate: 84.4,
    weeklyData: [
        { day: 'Mon', coverage: 85 },
        { day: 'Tue', coverage: 88 },
        { day: 'Wed', coverage: 82 },
        { day: 'Thu', coverage: 91 },
        { day: 'Fri', coverage: 84 },
        { day: 'Sat', coverage: 76 },
        { day: 'Sun', coverage: 79 },
    ]
};

const CustomTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
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

    const { data: settings, isLoading: isSettingsLoading } = useQuery<Settings>({
        queryKey: ['settings'],
        queryFn: getSettings
    });

    const { data: coverage, isLoading: isCoverageLoading } = useQuery(
        ['coverage'],
        getAllCoverage
    );

    const { data: stats, isLoading: isStatsLoading, error } = useQuery<CoverageStats>({
        queryKey: ["coverage-stats"],
        queryFn: () => Promise.resolve(mockStats),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    if (isSettingsLoading || !settings || isCoverageLoading || isStatsLoading || !stats) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertDescription>Failed to load coverage data</AlertDescription>
            </Alert>
        );
    }

    // Convert settings to the format expected by CoverageEditor
    const storeConfig = {
        store_opening: settings.general.store_opening,
        store_closing: settings.general.store_closing,
        opening_days: settings.general.opening_days,
        min_employees_per_shift: settings.scheduling.min_employees_per_shift,
        max_employees_per_shift: settings.scheduling.max_employees_per_shift,
        employee_types: settings.employee_groups.employee_types.map(type => ({
            id: type.id,
            name: type.name
        }))
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Coverage Overview</h1>
                    <p className="text-muted-foreground">
                        Monitor employee coverage and scheduling statistics
                    </p>
                </div>
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
                {/* Total Employees Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Employees
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
                        <CardTitle className="text-sm font-medium">
                            Average Hours
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.averageHours}h</div>
                        <p className="text-xs text-muted-foreground">
                            Per employee this week
                        </p>
                    </CardContent>
                </Card>

                {/* Coverage Rate Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Coverage Rate
                        </CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.coverageRate}%</div>
                        <p className="text-xs text-muted-foreground">
                            Of required shifts filled
                        </p>
                    </CardContent>
                </Card>

                {/* Weekly Trend Chart */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Weekly Trend
                        </CardTitle>
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
                                    <XAxis
                                        dataKey="day"
                                        hide
                                    />
                                    <YAxis hide domain={[60, 100]} />
                                    <Tooltip content={CustomTooltip} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-6">
                    <Tabs defaultValue="daily" className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="daily">Daily View</TabsTrigger>
                            <TabsTrigger value="weekly">Weekly View</TabsTrigger>
                            <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                        </TabsList>

                        <TabsContent value="daily" className="space-y-4">
                            <CoverageEditor
                                initialCoverage={coverage}
                                storeConfig={storeConfig}
                                onChange={async (newCoverage) => {
                                    try {
                                        await updateCoverage(newCoverage);
                                        toast({
                                            title: "Success",
                                            description: "Coverage settings saved successfully",
                                        });
                                    } catch (error) {
                                        toast({
                                            title: "Error",
                                            description: "Failed to save coverage settings",
                                            variant: "destructive",
                                        });
                                    }
                                }}
                            />
                        </TabsContent>

                        <TabsContent value="weekly" className="space-y-4">
                            {/* Add weekly coverage content here */}
                        </TabsContent>

                        <TabsContent value="monthly" className="space-y-4">
                            {/* Add monthly coverage content here */}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
} 