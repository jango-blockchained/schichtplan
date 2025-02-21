import { useMemo } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { useDrag, useDrop } from 'react-dnd';
import { Schedule } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ScheduleTableProps {
    schedules: Schedule[];
    dateRange: {
        from: Date;
        to: Date;
    } | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    isLoading: boolean;
}

interface DragItem {
    type: 'SCHEDULE';
    scheduleId: number;
    employeeId: number;
    shiftId: number;
    date: string;
}

const ScheduleCell = ({ schedule, onDrop }: {
    schedule: Schedule | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
}) => {
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

    if (!schedule) return null;

    return (
        <div
            ref={(node) => {
                drag(drop(node));
            }}
            className={cn(
                'p-2 rounded border transition-all duration-200 group',
                isDragging && 'opacity-50 bg-primary/10',
                isOver && 'ring-2 ring-primary/50',
                'cursor-move hover:bg-primary/5'
            )}
        >
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">{schedule.employee_name}</span>
                    <Badge variant="secondary" className="text-xs">
                        {schedule.shift_start} - {schedule.shift_end}
                    </Badge>
                </div>
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
        </div>
    );
};

export function ScheduleTable({ schedules, dateRange, onDrop, isLoading }: ScheduleTableProps) {
    const days = useMemo(() => {
        if (!dateRange?.from) return [];
        const days = [];
        let currentDate = dateRange.from;
        while (currentDate <= dateRange.to) {
            days.push(currentDate);
            currentDate = addDays(currentDate, 1);
        }
        return days;
    }, [dateRange]);

    const schedulesByDay = useMemo(() => {
        const byDay: { [key: string]: Schedule[] } = {};
        schedules.forEach(schedule => {
            const day = schedule.date;
            if (!byDay[day]) {
                byDay[day] = [];
            }
            byDay[day].push(schedule);
        });
        return byDay;
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
                <CardTitle>Schichtplan Details</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {days.map(day => (
                        <div key={day.toISOString()} className="border rounded-lg p-4">
                            <h3 className="text-lg font-semibold mb-3">
                                {format(day, 'EEEE, dd.MM.yyyy')}
                            </h3>
                            <div className="space-y-2">
                                {schedulesByDay[format(day, 'yyyy-MM-dd')]?.map(schedule => (
                                    <ScheduleCell
                                        key={schedule.id}
                                        schedule={schedule}
                                        onDrop={onDrop}
                                    />
                                ))}
                                {!schedulesByDay[format(day, 'yyyy-MM-dd')]?.length && (
                                    <div className="text-sm text-muted-foreground text-center py-4">
                                        Keine Schichten an diesem Tag
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
} 