import React from 'react';
import { Schedule, Employee } from '@/types';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { InfoIcon, Clock, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { differenceInHours, parseISO, format, startOfWeek, endOfWeek, differenceInMinutes } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '@/services/api';

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
        const [startHours, startMinutes] = schedule.shift_start.split(':').map(Number);
        const [endHours, endMinutes] = schedule.shift_end.split(':').map(Number);

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
            const [breakStartHours, breakStartMinutes] = schedule.break_start.split(':').map(Number);
            const [breakEndHours, breakEndMinutes] = schedule.break_end.split(':').map(Number);

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
        console.error('Error calculating shift duration:', error);
        return 0;
    }
};

export function EmployeeStatistics({ employeeId, schedules, contractedHours, employeeGroup }: EmployeeStatisticsProps) {
    // Fetch employees if contractedHours or employeeGroup is not provided
    const needEmployeeData = contractedHours === undefined || employeeGroup === undefined;
    const { data: employees, isLoading } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees,
        enabled: needEmployeeData,
    });

    // Get the contractedHours and employeeGroup from fetched employees if not provided
    let effectiveContractedHours = contractedHours;
    let effectiveEmployeeGroup = employeeGroup;

    if (needEmployeeData && employees) {
        const employee = employees.find(e => e.id === employeeId);
        if (employee) {
            effectiveContractedHours = effectiveContractedHours ?? employee.contracted_hours ?? 40;
            effectiveEmployeeGroup = effectiveEmployeeGroup ?? employee.employee_group ?? 'VZ';
        }
    }

    // Default values if still undefined
    effectiveContractedHours = effectiveContractedHours ?? 40;
    effectiveEmployeeGroup = effectiveEmployeeGroup ?? 'VZ';

    // Filter schedules for this employee
    const employeeSchedules = schedules.filter(s => s.employee_id === employeeId && s.shift_id !== null);

    // Calculate statistics
    const totalShifts = employeeSchedules.length;
    const totalHours = employeeSchedules.reduce((sum, s) => {
        // Skip schedules without shifts
        if (!s.shift_id || !s.shift_start || !s.shift_end) {
            return sum;
        }
        return sum + calculateShiftDuration(s);
    }, 0);
    const hoursCoverage = effectiveContractedHours > 0 ? (totalHours / effectiveContractedHours) * 100 : 0;

    // Calculate early, mid, and late shifts
    const earlyShifts = employeeSchedules.filter(s => s.shift_start && s.shift_start < '10:00').length;
    const lateShifts = employeeSchedules.filter(s => s.shift_end && s.shift_end >= '18:00').length;
    const midShifts = totalShifts - earlyShifts - lateShifts;

    // Calculate shifts with breaks
    const shiftsWithBreaks = employeeSchedules.filter(s => s.break_start && s.break_end).length;
    const breaksPercentage = totalShifts > 0 ? (shiftsWithBreaks / totalShifts) * 100 : 0;

    // Calculate consecutive workdays (most consecutive days in a row)
    let maxConsecutiveDays = 0;
    let currentConsecutiveDays = 0;
    let previousDate: Date | null = null;

    // Sort dates chronologically
    const sortedDates = employeeSchedules
        .map(s => s.date ? parseISO(s.date) : null)
        .filter((date): date is Date => date !== null)
        .sort((a, b) => a.getTime() - b.getTime());

    sortedDates.forEach(currentDate => {
        if (currentDate && previousDate) {
            const diffDays = Math.round(differenceInHours(currentDate, previousDate) / 24);
            if (diffDays === 1) {
                currentConsecutiveDays++;
            } else {
                maxConsecutiveDays = Math.max(maxConsecutiveDays, currentConsecutiveDays);
                currentConsecutiveDays = 1;
            }
        } else {
            currentConsecutiveDays = 1;
        }
        previousDate = currentDate;
    });

    maxConsecutiveDays = Math.max(maxConsecutiveDays, currentConsecutiveDays);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Stunden</CardTitle>
                        <CardDescription>
                            {totalHours.toFixed(1)} / {effectiveContractedHours} h
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Progress value={hoursCoverage} className="h-2" />
                        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                            <span>{hoursCoverage.toFixed(0)}%</span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <InfoIcon className="h-3 w-3" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Geplante Stunden im Verhältnis zu Vertragsstunden</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Schichten</CardTitle>
                        <CardDescription>
                            {totalShifts} Schichten gesamt
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-center">
                            <div className="space-y-1">
                                <Badge variant="outline" className="bg-yellow-50">
                                    <span className="mr-1">F</span> {earlyShifts}
                                </Badge>
                            </div>
                            <div className="space-y-1">
                                <Badge variant="outline" className="bg-blue-50">
                                    <span className="mr-1">M</span> {midShifts}
                                </Badge>
                            </div>
                            <div className="space-y-1">
                                <Badge variant="outline" className="bg-purple-50">
                                    <span className="mr-1">S</span> {lateShifts}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Pausen</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">{shiftsWithBreaks} von {totalShifts}</span>
                            <span className="text-sm text-muted-foreground">
                                {breaksPercentage.toFixed(0)}%
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Arbeitstage</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <Badge variant={maxConsecutiveDays > 6 ? "destructive" : "outline"}>
                                {maxConsecutiveDays > 6 ? <AlertCircle className="h-3 w-3 mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                Max. {maxConsecutiveDays} in Folge
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
} 