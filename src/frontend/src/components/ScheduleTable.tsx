import { useMemo, useState } from 'react';
import { format, addDays, parseISO, startOfWeek } from 'date-fns';
import { useDrag, useDrop } from 'react-dnd';
import { Schedule } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';
import { Edit2 } from 'lucide-react';
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
    onUpdate: (scheduleId: number, updates: Partial<Schedule>) => Promise<void>;
    isLoading: boolean;
}

interface DragItem {
    type: 'SCHEDULE';
    scheduleId: number;
    employeeId: number;
    shiftId: number;
    date: string;
}

const ScheduleCell = ({ schedule, onDrop, onUpdate }: {
    schedule: Schedule | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate: (scheduleId: number, updates: Partial<Schedule>) => Promise<void>;
}) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'SCHEDULE',
        item: schedule ? {
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
                    schedule.shift_id
                );
            }
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }), [schedule, onDrop]);

    if (!schedule) {
        return (
            <div className="h-full min-h-[100px] border border-dashed border-muted-foreground/20 rounded-md p-2">
                <div className="text-xs text-muted-foreground text-center">
                    Keine Schicht
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                ref={(node) => {
                    drag(drop(node));
                }}
                className={cn(
                    'p-2 rounded border transition-all duration-200 group min-h-[100px] relative',
                    isDragging && 'opacity-50 bg-primary/10',
                    isOver && 'ring-2 ring-primary/50',
                    'cursor-move hover:bg-primary/5'
                )}
            >
                <div className="flex flex-col space-y-1">
                    <Badge variant="secondary" className="text-xs w-fit">
                        {schedule.shift_start} - {schedule.shift_end}
                    </Badge>
                    {schedule.break_start && schedule.break_end && (
                        <div className="text-xs text-muted-foreground">
                            Pause: {schedule.break_start} - {schedule.break_end}
                        </div>
                    )}
                    {schedule.notes && (
                        <div className="text-xs text-muted-foreground italic">
                            {schedule.notes}
                        </div>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditModalOpen(true);
                    }}
                >
                    <Edit2 className="h-4 w-4" />
                </Button>
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
            const employeeA = a[1][0];
            const employeeB = b[1][0];

            // Extract employee type from employee_name (assuming format "Name (Type)")
            const typeA = employeeA.employee_name.match(/\((.*?)\)/)?.[1] || '';
            const typeB = employeeB.employee_name.match(/\((.*?)\)/)?.[1] || '';

            return (employeeTypeOrder[typeA] ?? 99) - (employeeTypeOrder[typeB] ?? 99);
        });

        // Group by employee type
        sortedEmployees.forEach(([_, employeeSchedules]) => {
            const type = employeeSchedules[0].employee_name.match(/\((.*?)\)/)?.[1] || 'Other';
            if (!groups.has(type)) {
                groups.set(type, []);
            }
            groups.get(type)?.push(...employeeSchedules);
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
        <Card>
            <CardHeader>
                <CardTitle>Schichtplan</CardTitle>
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
                                            {format(day, 'EEEE')}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {format(day, 'dd.MM.yyyy')}
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
                                    const employeeName = employeeSchedules[0]?.employee_name.split(' (')[0];

                                    return (
                                        <TableRow key={employeeId}>
                                            <TableCell className="font-medium">
                                                <div>{employeeName}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    ({type})
                                                </div>
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
    );
} 