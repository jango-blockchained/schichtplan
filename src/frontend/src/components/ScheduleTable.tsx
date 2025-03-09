import { useMemo, useState } from 'react';
import { format, addDays, parseISO, startOfWeek } from 'date-fns';
import { useDrag, useDrop } from 'react-dnd';
import { Schedule, Employee, ScheduleUpdate } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { getSettings, getEmployees } from '@/services/api';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShiftEditModal } from './ShiftEditModal';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface ScheduleTableProps {
    schedules: Schedule[];
    dateRange: DateRange | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
    isLoading: boolean;
}

interface DragItem {
    type: 'SCHEDULE';
    scheduleId: number;
    employeeId: number;
    shiftId: number;
    date: string;
}

// Define an extended type for Schedule that includes the break duration
type ExtendedSchedule = Schedule & {
    break_duration?: number | null;
    notes?: string | null;
};

const isEmptySchedule = (schedule: Schedule | undefined) => {
    return !schedule || !schedule.shift_id;
};

const ScheduleCell = ({ schedule, onDrop, onUpdate }: {
    schedule: Schedule | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
}) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showActions, setShowActions] = useState(false);

    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'SCHEDULE',
        item: schedule && !isEmptySchedule(schedule) ? {
            type: 'SCHEDULE',
            scheduleId: schedule.id,
            employeeId: schedule.employee_id,
            shiftId: schedule.shift_id,
            date: schedule.date,
        } : undefined,
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }), [schedule]);

    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'SCHEDULE',
        drop: (item: DragItem) => {
            if (schedule) {
                onDrop(
                    item.scheduleId,
                    schedule.employee_id,
                    parseISO(schedule.date),
                    item.shiftId
                );
            }
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }), [schedule, onDrop]);

    const handleDelete = async () => {
        if (!schedule) return;
        try {
            await onUpdate(schedule.id, { shift_id: undefined });
        } catch (error) {
            console.error('Error deleting shift:', error);
        }
    };

    const handleAdd = () => {
        setIsEditModalOpen(true);
    };

    if (!schedule || isEmptySchedule(schedule)) {
        // Create empty schedule object with safe defaults
        const emptySchedule: Schedule = {
            id: 0,
            employee_id: schedule?.employee_id ?? 0,
            // Remove the employee_name field since it's not in the Schedule type
            shift_id: null, // Use null instead of undefined to match the type
            shift_start: null, // Use null instead of undefined to match the type
            shift_end: null, // Use null instead of undefined to match the type
            date: schedule?.date ?? new Date().toISOString().split('T')[0],
            version: schedule?.version ?? 1,
            is_empty: true,
            status: 'DRAFT'
        };

        return (
            <div
                ref={drop}
                className={cn(
                    'h-full w-full flex items-center justify-center text-muted-foreground relative min-h-[100px]',
                    'border border-dashed border-muted-foreground/20 rounded-md',
                    'hover:border-primary/50 transition-colors duration-200',
                    isOver && 'border-primary border-solid'
                )}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                {showActions ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleAdd}
                        className="absolute inset-0 w-full h-full flex items-center justify-center rounded-none"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                ) : (
                    <span className="text-sm">-</span>
                )}
                {isEditModalOpen && (
                    <ShiftEditModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        schedule={emptySchedule}
                        onSave={async (_, updates) => {
                            try {
                                console.log('🟣 ScheduleTable empty cell onSave called with:', { updates });

                                if (!emptySchedule.employee_id || !emptySchedule.date) {
                                    throw new Error('Missing required fields: employee_id or date');
                                }

                                console.log('🟣 About to call onUpdate with:', {
                                    scheduleId: 0,
                                    updates: {
                                        ...updates,
                                        employee_id: emptySchedule.employee_id,
                                        date: emptySchedule.date,
                                    }
                                });

                                // Create a new schedule instead of updating
                                // Don't close the modal until we're sure the update succeeded
                                await onUpdate(0, {
                                    ...updates,
                                    employee_id: emptySchedule.employee_id,
                                    date: emptySchedule.date,
                                });

                                console.log('🟣 onUpdate completed successfully');

                                // Only close modal after successful save
                                setIsEditModalOpen(false);
                            } catch (error) {
                                console.error('🟣 Error in empty cell onSave:', error);
                                // Don't close the modal if there's an error
                            }
                        }}
                    />
                )}
            </div>
        );
    }

    // Cast the schedule to ExtendedSchedule to access the additional properties
    const extendedSchedule = schedule as ExtendedSchedule;

    return (
        <>
            <div
                ref={(node) => drag(drop(node))}
                className={cn(
                    'p-2 rounded border transition-all duration-200 group min-h-[100px] relative',
                    isDragging && 'opacity-50 bg-primary/10',
                    isOver && 'ring-2 ring-primary/50',
                    'hover:bg-primary/5'
                )}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                <div className="flex flex-col space-y-1">
                    <Badge variant="secondary" className="text-xs w-fit">
                        {schedule.shift_start} - {schedule.shift_end}
                    </Badge>
                    {extendedSchedule.break_duration && extendedSchedule.break_duration > 0 && (
                        <div className="text-xs text-muted-foreground">
                            Pause: {extendedSchedule.break_duration} min
                        </div>
                    )}
                    {extendedSchedule.notes && (
                        <div className="text-xs text-muted-foreground italic">
                            {extendedSchedule.notes}
                        </div>
                    )}
                </div>
                {showActions && (
                    <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditModalOpen(true);
                            }}
                            className="h-6 w-6"
                        >
                            <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete();
                            }}
                            className="h-6 w-6 hover:text-destructive"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                )}
                <div className="absolute inset-0 cursor-move pointer-events-none" />
            </div>
            {isEditModalOpen && (
                <ShiftEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    schedule={schedule}
                    onSave={onUpdate}
                />
            )}
        </>
    );
};

export function ScheduleTable({ schedules, dateRange, onDrop, onUpdate, isLoading }: ScheduleTableProps) {
    // Fetch settings
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
    });

    // Test function to directly test the onUpdate function
    const testAddShift = async () => {
        console.log('🔵 Test: Directly calling onUpdate');
        try {
            // Get the first employee ID from the schedules
            const firstSchedule = schedules[0];
            if (!firstSchedule) {
                console.error('🔵 No schedules available for testing');
                return;
            }

            // Use default values to handle potential undefined values
            const employeeId = firstSchedule.employee_id ?? 0;
            const date = firstSchedule.date ?? '';

            console.log('🔵 Test: Using employee_id and date:', { employeeId, date });

            // Call onUpdate with test data
            const updateData: ScheduleUpdate = {
                employee_id: employeeId,
                date: date,
                shift_id: 1, // Assuming shift ID 1 exists
                break_duration: 30, // 30 minute break
                notes: 'Test shift'
            };

            await onUpdate(0, updateData);

            console.log('🔵 Test: onUpdate completed successfully');
        } catch (error) {
            console.error('🔵 Test: Error calling onUpdate:', error);
        }
    };

    // Fetch employee data to display names properly
    const { data: employees, isLoading: loadingEmployees } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees,
    });

    // Employee lookup for quick access
    const employeeLookup = useMemo(() => {
        if (!employees) return {};

        return employees.reduce((acc, employee) => {
            acc[employee.id] = employee;
            return acc;
        }, {} as Record<number, Employee>);
    }, [employees]);

    const formatEmployeeName = (employeeId: number | undefined) => {
        // Handle undefined employee ID
        if (!employeeId || !employeeLookup[employeeId]) return '-';

        const employee = employeeLookup[employeeId];
        const firstName = employee.first_name;
        const lastName = employee.last_name;
        const type = employee.employee_group;

        // Create abbreviation from first letters of first and last name
        const abbr = (firstName[0] + lastName[0] + lastName[1]).toUpperCase();

        return (
            <>
                {`${lastName}, ${firstName}`}
                <br />
                {`(${abbr})`}
            </>
        );
    };

    const days = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to || !settings) return [];
        const days = [];
        let currentDate = dateRange.from;

        while (currentDate <= dateRange.to) {
            const dayIndex = currentDate.getDay().toString();
            const isSunday = dayIndex === '0';
            const isWeekday = dayIndex !== '0';  // Monday-Saturday
            const isOpeningDay = settings.general.opening_days[dayIndex];

            // Include the day if:
            // 1. It's marked as an opening day, OR
            // 2. It's Sunday and show_sunday is true, OR
            // 3. It's a weekday and show_weekdays is true
            if (isOpeningDay ||
                (isSunday && settings.display.show_sunday) ||
                (isWeekday && settings.display.show_weekdays)) {
                days.push(currentDate);
            }
            currentDate = addDays(currentDate, 1);
        }

        // Sort days based on start_of_week setting
        return days.sort((a, b) => {
            // Convert settings.display.start_of_week to 0 | 1 | 2 | 3 | 4 | 5 | 6
            const weekStart = (settings.display.start_of_week % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
            const startOfWeekA = startOfWeek(a, { weekStartsOn: weekStart });
            const startOfWeekB = startOfWeek(b, { weekStartsOn: weekStart });
            const dayDiffA = a.getTime() - startOfWeekA.getTime();
            const dayDiffB = b.getTime() - startOfWeekB.getTime();
            return dayDiffA - dayDiffB;
        });
    }, [dateRange, settings]);

    // Map for German weekday abbreviations
    const weekdayAbbr: { [key: string]: string } = {
        'Monday': 'Mo',
        'Tuesday': 'Di',
        'Wednesday': 'Mi',
        'Thursday': 'Do',
        'Friday': 'Fr',
        'Saturday': 'Sa',
        'Sunday': 'So'
    };

    const employeeGroups = useMemo(() => {
        const groups = new Map<string, Schedule[]>();
        const employeeSchedules = new Map<number, Schedule[]>();

        // Group schedules by employee
        schedules.forEach(schedule => {
            if (!employeeSchedules.has(schedule.employee_id)) {
                employeeSchedules.set(schedule.employee_id, []);
            }
            employeeSchedules.get(schedule.employee_id)?.push(schedule);
        });

        // Sort employees by type (VZ/TL -> TZ -> GFB)
        const employeeTypeOrder: Record<string, number> = {
            'VZ': 0,
            'TL': 0,
            'TZ': 1,
            'GFB': 2
        };
        const sortedEmployees = Array.from(employeeSchedules.entries()).sort((a, b) => {
            // Sort by employee ID as a fallback if we can't extract type
            return a[0] - b[0];
        });

        // Group by employee type or just use "Other" if we can't determine type
        sortedEmployees.forEach(([employeeId, employeeSchedules]) => {
            if (!employeeSchedules || employeeSchedules.length === 0) return;

            // Just add all schedules to 'Other' group
            if (!groups.has('Other')) {
                groups.set('Other', []);
            }
            groups.get('Other')?.push(...employeeSchedules);
        });

        return groups;
    }, [schedules]);

    if (isLoading) {
        return <Skeleton className="w-full h-[400px]" />;
    }

    if (!dateRange?.from || !dateRange?.to) {
        return (
            <div className="text-center text-muted-foreground py-8">
                Bitte wählen Sie einen Zeitraum aus
            </div>
        );
    }

    return (
        <div className="schedule-table-container">
            {/* Test button for debugging */}
            <button
                onClick={testAddShift}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    zIndex: 1000,
                    padding: '10px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px'
                }}
            >
                Test Add Shift
            </button>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Schichtplan</CardTitle>
                        {dateRange?.from && dateRange?.to && (
                            <div className="text-sm text-muted-foreground mt-1">
                                {format(dateRange.from, 'dd.MM.yyyy')} - {format(dateRange.to, 'dd.MM.yyyy')}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Mitarbeiter</TableHead>
                                    {days.map(day => (
                                        <TableHead key={day.toISOString()} className="min-w-[150px]">
                                            <div className="font-semibold">
                                                {weekdayAbbr[format(day, 'EEEE')]}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {format(day, 'dd.MM')}
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from(employeeGroups.entries()).map(([type, groupSchedules]) => {
                                    const uniqueEmployees = new Set(groupSchedules.map(s => s.employee_id));
                                    return Array.from(uniqueEmployees).map(employeeId => {
                                        const employeeSchedules = groupSchedules.filter(s => s.employee_id === employeeId);
                                        const firstSchedule = employeeSchedules[0];
                                        return (
                                            <TableRow key={employeeId}>
                                                <TableCell className="font-medium">
                                                    {formatEmployeeName(employeeId)}
                                                </TableCell>
                                                {days.map(day => {
                                                    const daySchedule = employeeSchedules.find(
                                                        s => s.date === format(day, 'yyyy-MM-dd')
                                                    );
                                                    return (
                                                        <TableCell key={day.toISOString()}>
                                                            <ScheduleCell
                                                                schedule={daySchedule}
                                                                onDrop={onDrop}
                                                                onUpdate={onUpdate}
                                                            />
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        );
                                    });
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 