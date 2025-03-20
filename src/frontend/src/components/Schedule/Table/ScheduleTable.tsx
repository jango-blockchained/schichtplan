import React, { useMemo, useState } from 'react';
import { format, addDays, parseISO, startOfWeek } from 'date-fns';
import { Schedule, Employee, Settings } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '@/services/api';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { EmployeeStatistics } from '../EmployeeStatistics';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScheduleCell } from './ScheduleCell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export interface ScheduleTableProps {
    schedules: Schedule[];
    dateRange: DateRange | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate: (scheduleId: number, updates: any) => Promise<void>;
    isLoading: boolean;
    employeeAbsences?: Record<number, any[]>;
    absenceTypes?: Array<{
        id: string;
        name: string;
        color: string;
        type: 'absence';
    }>;
    className?: string;
    settings?: Settings;
}

/**
 * ScheduleTable component displays a table of schedules with drag and drop functionality
 * 
 * @component
 * @example
 * ```tsx
 * <ScheduleTable
 *   schedules={schedules}
 *   dateRange={dateRange}
 *   onDrop={handleDrop}
 *   onUpdate={handleUpdate}
 *   isLoading={isLoading}
 *   employeeAbsences={absences}
 *   absenceTypes={absenceTypes}
 * />
 * ```
 */
export function ScheduleTable({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading,
    employeeAbsences,
    absenceTypes,
    className,
    settings
}: ScheduleTableProps) {
    const [expandedEmployees, setExpandedEmployees] = useState<number[]>([]);

    // Fetch employees for the table
    const { data: employees, isLoading: isLoadingEmployees, error: employeesError } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees,
    });

    // Calculate dates for the table header
    const dates = useMemo(() => {
        if (!dateRange?.from) return [];
        const result = [];
        let currentDate = startOfWeek(dateRange.from, { weekStartsOn: 1 });

        // Check settings to determine if we should show Sunday
        const showSunday = settings?.general?.opening_days?.['SU'];
        const daysToShow = showSunday ? 7 : 6;

        for (let i = 0; i < daysToShow; i++) {
            result.push(addDays(currentDate, i));
        }
        return result;
    }, [dateRange?.from, settings?.general?.opening_days]);

    // Group schedules by employee
    const schedulesByEmployee = useMemo(() => {
        const grouped: Record<number, Schedule[]> = {};
        schedules.forEach(schedule => {
            if (!grouped[schedule.employee_id]) {
                grouped[schedule.employee_id] = [];
            }
            grouped[schedule.employee_id].push(schedule);
        });
        return grouped;
    }, [schedules]);

    // Check for absences on a specific date
    const checkForAbsence = (employeeId: number, dateString: string) => {
        if (!employeeAbsences?.[employeeId]) return false;
        return employeeAbsences[employeeId].some(absence =>
            absence.date === dateString
        );
    };

    // Toggle employee expansion
    const toggleEmployeeExpansion = (employeeId: number) => {
        setExpandedEmployees(prev =>
            prev.includes(employeeId)
                ? prev.filter(id => id !== employeeId)
                : [...prev, employeeId]
        );
    };

    // Calculate employee statistics
    const getEmployeeStats = (employeeId: number) => {
        const employeeSchedules = schedulesByEmployee[employeeId] || [];
        return {
            totalShifts: employeeSchedules.length,
            filledShifts: employeeSchedules.filter(s => !s.is_empty).length,
            absences: employeeAbsences?.[employeeId]?.length || 0
        };
    };

    // Loading state
    if (isLoading || isLoadingEmployees) {
        return (
            <Card className={cn("w-full", className)}>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-8 w-48" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-20 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Error state
    if (employeesError) {
        return (
            <Alert variant="destructive" className={cn("w-full", className)}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    Failed to load employee data. Please try again later.
                    {employeesError instanceof Error && (
                        <p className="mt-2 text-sm">{employeesError.message}</p>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                        className="mt-4"
                    >
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    // No data state
    if (!employees?.length) {
        return (
            <Card className={cn("w-full", className)}>
                <CardContent className="pt-6">
                    <Alert>
                        <AlertTitle>No Employees</AlertTitle>
                        <AlertDescription>
                            No employees found. Please add employees to create schedules.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("w-full", className)}>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    Schedule Overview
                    <Badge variant="outline">
                        {format(dates[0], 'MMM d')} - {format(dates[dates.length - 1], 'MMM d, yyyy')}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px]">Employee</TableHead>
                                {dates.map(date => (
                                    <TableHead key={date.toISOString()} className="text-center min-w-[120px]">
                                        <div className="font-medium">{format(date, 'EEEE')}</div>
                                        <div className="text-muted-foreground">{format(date, 'MMM d')}</div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {employees.map((employee) => {
                                const isExpanded = expandedEmployees.includes(employee.id);
                                const stats = getEmployeeStats(employee.id);
                                const employeeName = `${employee.first_name} ${employee.last_name}`;

                                return (
                                    <React.Fragment key={employee.id}>
                                        <TableRow className="group">
                                            <TableCell>
                                                <div className="flex items-center space-x-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => toggleEmployeeExpansion(employee.id)}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                    <div>
                                                        <div className="font-medium">{employeeName}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {employee.employee_group ? `${employee.employee_group}` : ''}
                                                            {employee.contracted_hours > 0 ? ` • ${employee.contracted_hours}h` : ''}
                                                            {stats.absences > 0 && ` • ${stats.absences} absences`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            {dates.map(date => {
                                                const dateStr = format(date, 'yyyy-MM-dd');
                                                const schedule = schedulesByEmployee[employee.id]?.find(
                                                    s => s.date === dateStr
                                                );
                                                const hasAbsence = checkForAbsence(employee.id, dateStr);
                                                const absenceInfo = hasAbsence && employeeAbsences?.[employee.id]?.find(
                                                    absence => absence.date === dateStr
                                                );

                                                return (
                                                    <TableCell key={dateStr} className="p-0">
                                                        <ScheduleCell
                                                            schedule={schedule}
                                                            onDrop={onDrop}
                                                            onUpdate={onUpdate}
                                                            hasAbsence={hasAbsence}
                                                            absenceInfo={absenceInfo}
                                                            className={cn(
                                                                "min-h-[100px] w-full",
                                                                hasAbsence && "bg-red-50 border-red-200"
                                                            )}
                                                        />
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                        {isExpanded && (
                                            <TableRow>
                                                <TableCell colSpan={dates.length + 1} className="p-4 bg-muted/5">
                                                    <EmployeeStatistics
                                                        employeeId={employee.id}
                                                        schedules={schedulesByEmployee[employee.id] || []}
                                                        contractedHours={employee.contracted_hours}
                                                        employeeGroup={employee.employee_group}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
} 