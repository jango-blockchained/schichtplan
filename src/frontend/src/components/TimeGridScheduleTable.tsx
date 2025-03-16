import React, { useMemo, useState } from 'react';
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
import { Edit2, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShiftEditModal } from './ShiftEditModal';

interface TimeGridScheduleTableProps {
    schedules: Schedule[];
    dateRange: DateRange | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
    isLoading: boolean;
    employeeAbsences?: Record<number, any[]>;
    absenceTypes?: Array<{
        id: string;
        name: string;
        color: string;
        type: 'absence';
    }>;
}

interface DragItem {
    type: 'SCHEDULE';
    scheduleId: number;
    employeeId: number;
    shiftId: number;
    date: string;
    startTime: string;
    endTime: string;
}

// Helper functions
const formatTime = (time: string) => {
    return time || '00:00';
};

const parseTime = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
};

const formatMinutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Component for time slot cell that can contain employee shifts
const TimeSlotCell = ({
    day,
    timeSlot,
    schedules,
    onDrop,
    onUpdate,
    settings,
    employeeAbsences,
    absenceTypes,
    employeeLookup
}: {
    day: Date;
    timeSlot: { start: number; end: number };
    schedules: Schedule[];
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number, newStartTime: string, newEndTime: string) => Promise<void>;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
    settings: any;
    employeeAbsences?: Record<number, any[]>;
    absenceTypes?: Array<{ id: string; name: string; color: string; type: string; }>;
    employeeLookup: Record<number, Employee>;
}) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isAddingNewShift, setIsAddingNewShift] = useState(false);

    const dayStr = format(day, 'yyyy-MM-dd');
    const startTimeStr = formatMinutesToTime(timeSlot.start);
    const endTimeStr = formatMinutesToTime(timeSlot.end);

    // Filter schedules that overlap with this time slot
    const overlappingSchedules = schedules.filter(schedule => {
        if (!schedule.date) return false;

        // Handle case where shift_start or shift_end might be undefined
        const shiftStart = schedule.shift_start || '00:00';
        const shiftEnd = schedule.shift_end || '00:00';
        if (schedule.date !== dayStr) return false;

        const scheduleStart = parseTime(shiftStart);
        const scheduleEnd = parseTime(shiftEnd);

        // Check if there's any overlap
        return (
            (scheduleStart <= timeSlot.end && scheduleEnd >= timeSlot.start) ||
            (scheduleStart >= timeSlot.start && scheduleStart < timeSlot.end) ||
            (scheduleEnd > timeSlot.start && scheduleEnd <= timeSlot.end)
        );
    });

    const [{ isOver }, drop] = useDrop({
        accept: 'SCHEDULE',
        drop: (item: DragItem) => {
            // When dropping, update the schedule with the new time
            onDrop(
                item.scheduleId,
                item.employeeId,
                new Date(dayStr),
                item.shiftId,
                startTimeStr,
                endTimeStr
            );
        },
        collect: (monitor) => ({
            isOver: monitor.isOver()
        }),
        // Only allow dropping if this time slot is within opening hours
        canDrop: () => true // This would need to be updated with actual opening hours logic
    });

    const formatEmployeeName = (employee: Employee) => {
        if (!employee) return 'Unknown';
        return `${employee.last_name}, ${employee.first_name.charAt(0)}`;
    };

    // Handle clicking on an empty cell to add a new shift
    const handleAddNewShift = () => {
        // Create an empty schedule object with the current day and time slot
        const newSchedule: Schedule = {
            id: 0, // Use 0 to indicate it's a new schedule
            employee_id: 0, // Will be selected in the modal
            date: dayStr,
            shift_id: 0, // Will be selected in the modal
            shift_start: startTimeStr,
            shift_end: endTimeStr,
            version: 0, // Will be set by the backend
            status: 'DRAFT',
            is_empty: false
        };

        setSelectedSchedule(newSchedule);
        setIsAddingNewShift(true);
        setIsEditModalOpen(true);
    };

    return (
        <div
            ref={drop}
            className={cn(
                "border p-1 min-h-[60px] relative transition-colors duration-150",
                isOver && "bg-primary/10 ring-1 ring-primary",
                isHovered && "bg-slate-50",
                overlappingSchedules.length === 0 && "cursor-pointer hover:bg-blue-50/30"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => {
                // Only trigger add new shift when clicking on an empty cell
                if (overlappingSchedules.length === 0) {
                    handleAddNewShift();
                }
            }}
        >
            {overlappingSchedules.length > 0 ? (
                <div className="flex flex-col gap-1">
                    {overlappingSchedules.map(schedule => {
                        const employee = employeeLookup[schedule.employee_id];

                        // Check for absence
                        const hasAbsence = employeeAbsences && absenceTypes &&
                            employeeAbsences[schedule.employee_id]?.some(absence => {
                                const absenceStartDate = absence.start_date.split('T')[0];
                                const absenceEndDate = absence.end_date.split('T')[0];
                                return dayStr >= absenceStartDate && dayStr <= absenceEndDate;
                            });

                        const [{ isDragging }, drag] = useDrag({
                            type: 'SCHEDULE',
                            item: {
                                type: 'SCHEDULE',
                                scheduleId: schedule.id,
                                employeeId: schedule.employee_id,
                                shiftId: schedule.shift_id || 0,
                                date: schedule.date,
                                startTime: schedule.shift_start,
                                endTime: schedule.shift_end
                            },
                            canDrag: !hasAbsence,
                            collect: (monitor) => ({
                                isDragging: monitor.isDragging()
                            })
                        });

                        return (
                            <div
                                key={schedule.id}
                                ref={drag}
                                className={cn(
                                    "px-2 py-1 rounded text-xs font-medium cursor-move shadow-sm transition-all",
                                    isDragging && "opacity-50 shadow-md scale-95",
                                    hasAbsence && "opacity-50 cursor-not-allowed"
                                )}
                                style={{
                                    backgroundColor: schedule.shift_type === 'fixed' ? '#3b82f6' :
                                        schedule.shift_type === 'promised' ? '#22c55e' :
                                            schedule.shift_type === 'availability' ? '#f59e0b' :
                                                '#64748b',
                                    color: 'white'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent triggering the cell's onClick
                                    if (!hasAbsence) {
                                        setSelectedSchedule(schedule);
                                        setIsAddingNewShift(false);
                                        setIsEditModalOpen(true);
                                    }
                                }}
                            >
                                {formatEmployeeName(employee)}
                                {schedule.shift_start && schedule.shift_end && (
                                    <span className="text-[10px] ml-1 bg-black/20 px-1 rounded">
                                        {schedule.shift_start}-{schedule.shift_end}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    {isHovered && (
                        <span className="opacity-50">{startTimeStr}-{endTimeStr}</span>
                    )}
                </div>
            )}

            {selectedSchedule && isEditModalOpen && (
                <ShiftEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedSchedule(null);
                        setIsAddingNewShift(false);
                    }}
                    schedule={selectedSchedule}
                    onSave={onUpdate}
                />
            )}
        </div>
    );
};

export function TimeGridScheduleTable({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading,
    employeeAbsences,
    absenceTypes
}: TimeGridScheduleTableProps) {
    // Fetch settings to get opening hours
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
    });

    // Fetch employees data
    const { data: employeesData } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees,
    });

    // Create employee lookup for quick access
    const employeeLookup = useMemo(() => {
        if (!employeesData) return {};
        return employeesData.reduce((acc: Record<number, Employee>, employee: Employee) => {
            acc[employee.id] = employee;
            return acc;
        }, {});
    }, [employeesData]);

    // Generate days from date range
    const days = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to || !settings) return [];
        const days = [];
        let currentDate = dateRange.from;

        while (currentDate <= dateRange.to) {
            const dayIndex = currentDate.getDay().toString();
            const isSunday = dayIndex === '0';
            const isWeekday = dayIndex !== '0';  // Monday-Saturday
            const isOpeningDay = settings.general?.opening_days?.[dayIndex];

            // Include the day if:
            // 1. It's marked as an opening day, OR
            // 2. It's Sunday and show_sunday is true, OR
            // 3. It's a weekday and show_weekdays is true
            if (isOpeningDay ||
                (isSunday && settings.display?.show_sunday) ||
                (isWeekday && settings.display?.show_weekdays)) {
                days.push(currentDate);
            }
            currentDate = addDays(currentDate, 1);
        }

        return days;
    }, [dateRange, settings]);

    // Generate time slots based on opening hours (30-minute intervals)
    const timeSlots = useMemo(() => {
        if (!settings || !settings.general) {
            // Default time slots if settings are not available
            const slots = [];
            for (let i = 8; i < 22; i++) {
                slots.push({
                    start: i * 60,
                    end: (i + 1) * 60,
                    label: `${i}:00 - ${i + 1}:00`
                });
            }
            return slots;
        }

        // Parse opening hours from settings - use store_opening and store_closing
        const slots = [];
        const increment = 30; // 30-minute time slots

        // Use store_opening and store_closing from general settings
        const startMinutes = parseTime(settings.general.store_opening || "09:00");
        const endMinutes = parseTime(settings.general.store_closing || "21:00");

        for (let time = startMinutes; time < endMinutes; time += increment) {
            slots.push({
                start: time,
                end: time + increment,
                label: `${formatMinutesToTime(time)} - ${formatMinutesToTime(time + increment)}`
            });
        }

        return slots;
    }, [settings]);

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

    // Enhanced onDrop function that includes time updates
    const handleDrop = async (
        scheduleId: number,
        employeeId: number,
        newDate: Date,
        shiftId: number,
        newStartTime: string,
        newEndTime: string
    ) => {
        // Calculate duration of the original shift to preserve it
        const schedule = schedules.find(s => s.id === scheduleId);

        if (!schedule) return;

        // Create update object with appropriate properties
        // Note: If ScheduleUpdate type doesn't include shift_start and shift_end,
        // we need to use a type assertion or update the type definition
        const updates = {
            date: format(newDate, 'yyyy-MM-dd'),
            employee_id: employeeId,
            shift_id: shiftId,
            // Use type assertion to bypass TypeScript error if necessary
        } as ScheduleUpdate;

        // Add shift_start and shift_end if they exist on the type
        if (newStartTime) {
            (updates as any).shift_start = newStartTime;
        }

        if (newEndTime) {
            (updates as any).shift_end = newEndTime;
        }

        await onUpdate(scheduleId, updates);
    };

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
        <Card className="shadow-md border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50">
                <div>
                    <CardTitle className="text-lg font-bold">Zeitraster Ansicht</CardTitle>
                    {dateRange?.from && dateRange?.to && (
                        <div className="text-sm text-muted-foreground mt-1 font-medium">
                            {format(dateRange.from, 'dd.MM.yyyy')} - {format(dateRange.to, 'dd.MM.yyyy')}
                        </div>
                    )}
                </div>

                {/* Legend for shift types */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-sm">
                        {settings?.shift_types ? (
                            // Use colors from settings if available
                            settings.shift_types.map((type: any) => (
                                <div key={type.id} className="flex items-center gap-1">
                                    <div
                                        className="w-5 h-5 rounded-md"
                                        style={{ backgroundColor: type.color }}
                                    ></div>
                                    <span>{type.name}</span>
                                </div>
                            ))
                        ) : (
                            // Fallback to hardcoded colors
                            <>
                                <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-md bg-blue-500"></div>
                                    <span>Fest</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-md bg-green-500"></div>
                                    <span>Wunsch</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-md bg-amber-500"></div>
                                    <span>Verfügbarkeit</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-md bg-slate-400"></div>
                                    <span>Standard</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="w-full overflow-x-auto" style={{ maxWidth: '100%' }}>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b bg-slate-100">
                                <th className="w-[100px] sticky left-0 z-20 bg-slate-100 text-left p-4 font-semibold text-slate-700">
                                    Tag
                                </th>
                                {timeSlots.map((slot, index) => (
                                    <th
                                        key={index}
                                        className="min-w-[120px] text-center p-2 font-semibold text-slate-700"
                                    >
                                        <div className="text-xs">{slot.label}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {days.map(day => (
                                <tr key={day.toISOString()} className="hover:bg-slate-50/50 border-b">
                                    <td className="font-medium sticky left-0 z-10 bg-slate-50 w-[100px] p-2">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800">
                                                {weekdayAbbr[format(day, 'EEEE')]}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {format(day, 'dd.MM.yyyy')}
                                            </span>
                                        </div>
                                    </td>
                                    {timeSlots.map((slot, index) => (
                                        <TimeSlotCell
                                            key={index}
                                            day={day}
                                            timeSlot={slot}
                                            schedules={schedules}
                                            onDrop={handleDrop}
                                            onUpdate={onUpdate}
                                            settings={settings}
                                            employeeAbsences={employeeAbsences}
                                            absenceTypes={absenceTypes}
                                            employeeLookup={employeeLookup}
                                        />
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
} 