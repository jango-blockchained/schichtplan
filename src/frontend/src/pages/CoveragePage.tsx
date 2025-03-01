import React, { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Loader2, Users, Clock, Calendar, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { CoverageEditor } from "@/components/coverage-editor";
import { useToast } from "@/components/ui/use-toast";
import { getAllCoverage, updateCoverage, getSettings } from "@/services/api";
import { DailyCoverage, Settings, CoverageTimeSlot } from "@/types/index";
import { PageHeader } from '@/components/PageHeader';

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
    const queryClient = useQueryClient();

    const { data: settings, isLoading: isSettingsLoading } = useQuery({
        queryKey: ['settings'] as const,
        queryFn: getSettings
    });

    const { data: coverage, isLoading: isCoverageLoading } = useQuery({
        queryKey: ['coverage'] as const,
        queryFn: getAllCoverage
    });

    // Calculate real stats from coverage data
    const stats = useMemo(() => {
        if (!coverage || !Array.isArray(coverage)) return null;

        // Initialize default coverage array if empty
        const defaultCoverage: DailyCoverage[] = Array.from({ length: 7 }, (_, index) => ({
            dayIndex: index,
            timeSlots: []
        }));

        // Merge existing coverage with defaults
        const fullCoverage = defaultCoverage.map(defaultDay => {
            const existingDay = coverage.find(day => day.dayIndex === defaultDay.dayIndex);
            return existingDay || defaultDay;
        });

        const totalTimeSlots = fullCoverage.reduce((acc, day) =>
            acc + (Array.isArray(day.timeSlots) ? day.timeSlots.length : 0), 0);

        const totalRequiredEmployees = fullCoverage.reduce((acc, day) => {
            if (!Array.isArray(day.timeSlots)) return acc;
            return acc + day.timeSlots.reduce((sum, slot) => {
                return sum + (slot.minEmployees || 0);
            }, 0);
        }, 0);

        // Calculate weekly coverage data
        const weeklyData = fullCoverage.map(day => {
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.dayIndex];
            if (!Array.isArray(day.timeSlots) || day.timeSlots.length === 0) {
                return { day: dayName, coverage: 0 };
            }

            const totalRequired = day.timeSlots.reduce((sum, slot) => {
                return sum + (slot.minEmployees || 0);
            }, 0);

            const totalScheduled = day.timeSlots.reduce((sum, slot) => {
                return sum + (slot.maxEmployees || 0);
            }, 0);

            const coverage = totalRequired > 0 ? (totalScheduled / totalRequired) * 100 : 0;
            return {
                day: dayName,
                coverage: Math.round(coverage)
            };
        }).sort((a, b) => {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return days.indexOf(a.day) - days.indexOf(b.day);
        });

        // Calculate average hours per employee
        const totalHours = fullCoverage.reduce((acc, day) => {
            if (!Array.isArray(day.timeSlots)) return acc;
            return acc + day.timeSlots.reduce((sum, slot) => {
                if (!slot.startTime || !slot.endTime) return sum;
                const start = parseInt(slot.startTime.split(':')[0]);
                const end = parseInt(slot.endTime.split(':')[0]);
                return sum + (end - start) * (slot.minEmployees || 0);
            }, 0);
        }, 0);

        const averageHours = totalRequiredEmployees > 0 ? totalHours / totalRequiredEmployees : 0;

        return {
            totalEmployees: totalRequiredEmployees,
            scheduledEmployees: Math.round(totalRequiredEmployees * 0.85), // Assuming 85% coverage
            averageHours: Math.round(averageHours * 10) / 10,
            coverageRate: totalRequiredEmployees > 0 ? Math.round((totalRequiredEmployees / totalRequiredEmployees) * 100) : 0,
            weeklyData
        };
    }, [coverage]);

    if (isSettingsLoading || !settings || isCoverageLoading || !stats) {
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
        min_employees_per_shift: settings.scheduling.min_employees_per_shift,
        max_employees_per_shift: settings.scheduling.max_employees_per_shift,
        employee_types: settings.employee_groups.employee_types.map(type => ({
            id: type.id,
            name: type.name
        })),
        keyholder_before_minutes: settings.general.keyholder_before_minutes,
        keyholder_after_minutes: settings.general.keyholder_after_minutes
    };

    // Initialize default coverage if none exists
    const initialCoverage = coverage || Array.from({ length: 7 }, (_, index) => ({
        dayIndex: index,
        timeSlots: [] as CoverageTimeSlot[]
    }));

    return (
        <div className="container mx-auto py-6 space-y-6">
            <PageHeader
                title="Coverage Overview"
                description="Monitor employee coverage and scheduling statistics"
            />

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
                        <CardTitle className="text-sm font-medium">
                            Average Hours
                        </CardTitle>
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
                        <CardTitle className="text-sm font-medium">
                            Coverage Rate
                        </CardTitle>
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

            <CoverageEditor
                initialCoverage={initialCoverage}
                storeConfig={storeConfig}
                onChange={async (newCoverage) => {
                    try {
                        await updateCoverage(newCoverage);
                        await queryClient.invalidateQueries({ queryKey: ['coverage'] });
                        toast({
                            title: "Success",
                            description: "Coverage settings saved successfully",
                        });
                    } catch (error) {
                        console.error('Error updating coverage:', error);
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