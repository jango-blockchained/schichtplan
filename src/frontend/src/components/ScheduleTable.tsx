import { useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { useDrag, useDrop } from 'react-dnd';
import { Schedule, DateRange } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ScheduleTableProps {
    schedules: Schedule[];
    dateRange: DateRange | undefined;
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
                    new Date(schedule.date),
                    schedule.shift_id
                );
            }
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }), [schedule, onDrop]);

    return (
        <div
            ref={(node) => {
                drag(drop(node));
            }}
            className={`p-2 rounded border ${isDragging ? 'opacity-50' : ''
                } ${isOver ? 'bg-primary/10' : ''
                } ${schedule ? 'cursor-move' : 'cursor-default'
                }`}
        >
            {schedule && (
                <div className="text-sm">
                    <div className="font-medium">{schedule.employee_name}</div>
                    <div className="text-muted-foreground">
                        {schedule.shift_start}-{schedule.shift_end}
                    </div>
                    {schedule.break_start && schedule.break_end && (
                        <div className="text-xs text-muted-foreground">
                            Pause: {schedule.break_start}-{schedule.break_end}
                        </div>
                    )}
                    {schedule.notes && (
                        <div className="text-xs text-muted-foreground mt-1">
                            {schedule.notes}
                        </div>
                    )}
                </div>
            )}
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
            <CardContent className="p-4">
                <div className="grid grid-cols-[auto_repeat(auto-fill,minmax(200px,1fr))] gap-4">
                    <div className="font-medium p-2">Datum</div>
                    {days.map(day => (
                        <div key={day.toISOString()} className="font-medium p-2">
                            {format(day, 'EEEE, dd.MM.yyyy')}
                        </div>
                    ))}

                    {Array.from({ length: 24 }).map((_, hour) => (
                        <>
                            <div key={`hour-${hour}`} className="p-2 font-medium">
                                {hour.toString().padStart(2, '0')}:00
                            </div>
                            {days.map(day => {
                                const daySchedules = schedulesByDay[format(day, 'yyyy-MM-dd')] || [];
                                const schedule = daySchedules.find(s => {
                                    const startHour = parseInt(s.shift_start.split(':')[0], 10);
                                    return startHour === hour;
                                });

                                return (
                                    <ScheduleCell
                                        key={`${day.toISOString()}-${hour}`}
                                        schedule={schedule}
                                        onDrop={onDrop}
                                    />
                                );
                            })}
                        </>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
} 