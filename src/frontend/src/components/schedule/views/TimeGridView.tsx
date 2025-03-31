import React, { useMemo, useState } from 'react';
import { format, addDays, parseISO, isEqual } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDrag, useDrop } from 'react-dnd';
import { Schedule, Employee, ScheduleUpdate } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { getSettings, getEmployees } from '@/services/api';
import { Edit2, Plus, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShiftEditModal } from "@/components/schedule/shifts/ShiftEditModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TimeGridViewProps {
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
    type: 'EMPLOYEE_SCHEDULE';
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

// Component for an employee shift that can be dragged
const DraggableEmployeeShift = ({
    schedule,
    employee,
    settings,
    hasAbsence,
    onEdit,
    onDrop
}: {
    schedule: Schedule;
    employee: Employee;
    settings: any;
    hasAbsence: boolean;
    onEdit: () => void;
    onDrop: (scheduleId: number, employeeId: number, date: Date, shiftId: number, startTime: string, endTime: string) => Promise<void>;
}) => {
    const [{ isDragging }, drag] = useDrag({
        type: 'EMPLOYEE_SCHEDULE',
        item: {
            type: 'EMPLOYEE_SCHEDULE',
            scheduleId: schedule.id,
            employeeId: schedule.employee_id,
            shiftId: schedule.shift_id || 0,
            date: schedule.date || '',
            startTime: schedule.shift_start || '',
            endTime: schedule.shift_end || ''
        },
        canDrag: !hasAbsence,
        collect: (monitor) => ({
            isDragging: monitor.isDragging()
        })
    });

    return (
        <div
            ref={drag}
            className={cn(
                "px-2 py-1 rounded text-xs font-medium cursor-move shadow-sm transition-all",
                isDragging && "opacity-50 shadow-md scale-95",
                hasAbsence && "opacity-50 cursor-not-allowed"
            )}
            style={{
                backgroundColor: getShiftTypeColor(schedule, settings),
                color: 'white'
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (!hasAbsence) onEdit();
            }}
        >
            <div className="flex items-center justify-between mb-1">
                <span className="font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                    {employee.last_name}, {employee.first_name.charAt(0)}
                </span>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="ml-1 text-white/80 hover:text-white" onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}>
                                <Edit2 size={12} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Edit shift</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            <div className="text-[10px] flex justify-between">
                <Badge variant="outline" className="text-[8px] py-0 px-1 h-4 bg-white/20 text-white">
                    {getShiftTypeName(schedule)}
                </Badge>
                {schedule.shift_start && schedule.shift_end && (
                    <span className="text-[8px] whitespace-nowrap">
                        {schedule.shift_start}-{schedule.shift_end}
                    </span>
                )}
            </div>
        </div>
    );
};

// Component for a time slot cell that can receive dragged employee shifts
const TimeSlotCell = ({
    timeSlot,
    day,
    schedules,
    settings,
    employeeLookup,
    employeeAbsences,
    absenceTypes,
    onDrop,
    onUpdate
}: {
    timeSlot: { start: number; end: number };
    day: Date;
    schedules: Schedule[];
    settings: any;
    employeeLookup: Record<number, Employee>;
    employeeAbsences?: Record<number, any[]>;
    absenceTypes?: Array<{ id: string; name: string; color: string; type: string; }>;
    onDrop: (scheduleId: number, employeeId: number, date: Date, shiftId: number, startTime: string, endTime: string) => Promise<void>;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
}) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isAddingNewShift, setIsAddingNewShift] = useState(false);

    const dayStr = format(day, 'yyyy-MM-dd');
    const startTimeStr = formatMinutesToTime(timeSlot.start);
    const endTimeStr = formatMinutesToTime(timeSlot.end);

    // Find schedules that overlap with this time slot on this day
    const overlappingSchedules = schedules.filter(schedule => {
        if (!schedule.date || schedule.date !== dayStr) return false;
        
        const shiftStart = schedule.shift_start ? parseTime(schedule.shift_start) : 0;
        const shiftEnd = schedule.shift_end ? parseTime(schedule.shift_end) : 0;
        
        // Check if schedule overlaps with this time slot
        return (
            (shiftStart <= timeSlot.start && shiftEnd > timeSlot.start) || 
            (shiftStart >= timeSlot.start && shiftStart < timeSlot.end)
        );
    });

    const [{ isOver }, drop] = useDrop({
        accept: 'EMPLOYEE_SCHEDULE',
        drop: (item: DragItem) => {
            onDrop(
                item.scheduleId,
                item.employeeId,
                new Date(dayStr),
                item.shiftId,
                startTimeStr,
                formatMinutesToTime(timeSlot.start + (parseTime(item.endTime) - parseTime(item.startTime)))
            );
        },
        collect: (monitor) => ({
            isOver: monitor.isOver()
        }),
        // Only allow dropping if this time slot is within opening hours
        canDrop: () => true 
    });

    // Handle clicking on an empty cell to add a new shift
    const handleAddNewShift = () => {
        const endTime = formatMinutesToTime(timeSlot.start + 60); // Default duration: 1 hour
        const newSchedule: Schedule = {
            id: 0, 
            employee_id: 0,
            date: dayStr,
            shift_id: 0,
            shift_start: startTimeStr,
            shift_end: endTime,
            version: 0,
            status: 'DRAFT',
            is_empty: false
        };

        setSelectedSchedule(newSchedule);
        setIsAddingNewShift(true);
        setIsEditModalOpen(true);
    };

    return (
        <td
            ref={drop}
            className={cn(
                "border p-1 relative transition-colors duration-150 min-h-[40px] align-top",
                isOver && "bg-primary/10 ring-1 ring-primary",
                isHovered && "bg-slate-50",
                overlappingSchedules.length === 0 && "cursor-pointer hover:bg-blue-50/30"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => {
                if (overlappingSchedules.length === 0) {
                    handleAddNewShift();
                }
            }}
        >
            {overlappingSchedules.length > 0 ? (
                <div className="flex flex-col gap-1 min-h-[40px]">
                    {overlappingSchedules.map(schedule => {
                        const employee = employeeLookup[schedule.employee_id];
                        if (!employee) return null;

                        // Check for absence
                        const hasAbsence = employeeAbsences && absenceTypes &&
                            employeeAbsences[schedule.employee_id]?.some(absence => {
                                const absenceStartDate = absence.start_date.split('T')[0];
                                const absenceEndDate = absence.end_date.split('T')[0];
                                return dayStr >= absenceStartDate && dayStr <= absenceEndDate;
                            });

                        return (
                            <DraggableEmployeeShift
                                key={schedule.id}
                                schedule={schedule}
                                employee={employee}
                                settings={settings}
                                hasAbsence={!!hasAbsence}
                                onEdit={() => {
                                    setSelectedSchedule(schedule);
                                    setIsAddingNewShift(false);
                                    setIsEditModalOpen(true);
                                }}
                                onDrop={onDrop}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground min-h-[40px]">
                    {isHovered && (
                        <span className="opacity-50">{startTimeStr}</span>
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
        </td>
    );
};

export function TimeGridView({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading,
    employeeAbsences,
    absenceTypes
}: TimeGridViewProps) {
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

    // Generate days from date range, filtered by opening days
    const days = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to || !settings) return [];
        const days = [];
        let currentDate = dateRange.from;

        while (currentDate <= dateRange.to) {
            const dayIndex = currentDate.getDay().toString();
            const isOpeningDay = settings.general?.opening_days?.[dayIndex];

            // Include only days marked as opening days
            if (isOpeningDay) {
                days.push(currentDate);
            }
            currentDate = addDays(currentDate, 1);
        }

        return days;
    }, [dateRange, settings]);

    // Generate time slots in 15-minute intervals based on opening hours
    const timeSlots = useMemo(() => {
        if (!settings || !settings.general) {
            // Default time slots if settings are not available
            const slots = [];
            for (let i = 8 * 60; i < 22 * 60; i += 15) { // From 8:00 to 22:00 in 15-min intervals
                slots.push({
                    start: i,
                    end: i + 15,
                    label: `${formatMinutesToTime(i)}`
                });
            }
            return slots;
        }

        // Parse opening hours from settings - use store_opening and store_closing
        const slots = [];
        const increment = 15; // 15-minute time slots

        // Use store_opening and store_closing from general settings
        const startMinutes = parseTime(settings.general.store_opening || "09:00");
        const endMinutes = parseTime(settings.general.store_closing || "21:00");

        for (let time = startMinutes; time < endMinutes; time += increment) {
            slots.push({
                start: time,
                end: time + increment,
                label: `${formatMinutesToTime(time)}`
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
        const schedule = schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        // Determine the original duration of the shift
        const originalStart = schedule.shift_start ? parseTime(schedule.shift_start) : 0;
        const originalEnd = schedule.shift_end ? parseTime(schedule.shift_end) : 0;
        const duration = originalEnd - originalStart;

        // If we only have a start time but no specified end time, calculate it
        if (newStartTime && !newEndTime) {
            const newStartMinutes = parseTime(newStartTime);
            newEndTime = formatMinutesToTime(newStartMinutes + duration);
        }

        // Create update object with new properties
        const updates = {
            date: format(newDate, 'yyyy-MM-dd'),
            employee_id: employeeId,
            shift_id: shiftId,
            shift_start: newStartTime,
            shift_end: newEndTime
        } as ScheduleUpdate;

        await onUpdate(scheduleId, updates);
    };

    if (isLoading) {
        return <Skeleton className="w-full h-[600px]" />;
    }

    if (!dateRange?.from || !dateRange?.to) {
        return (
            <div className="text-center text-muted-foreground py-8">
                Bitte wählen Sie einen Zeitraum aus
            </div>
        );
    }

    if (days.length === 0) {
        return (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Keine Öffnungstage im ausgewählten Zeitraum gefunden
                </AlertDescription>
            </Alert>
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
                                    <span>Früh</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-md bg-amber-500"></div>
                                    <span>Mittel</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-md bg-purple-500"></div>
                                    <span>Spät</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="w-full overflow-auto" style={{ maxWidth: '100%' }}>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b bg-slate-100">
                                <th className="sticky left-0 z-20 bg-slate-100 text-left p-2 font-semibold text-slate-700 min-w-[80px] w-[80px]">
                                    Zeit
                                </th>
                                {days.map((day, index) => (
                                    <th key={index} className="text-center p-2 font-semibold text-slate-700 min-w-[120px]">
                                        <div className="font-bold">{weekdayAbbr[format(day, 'EEEE', { locale: de })]}</div>
                                        <div className="text-xs">{format(day, 'dd.MM.yyyy')}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {timeSlots.map((slot, slotIndex) => (
                                <tr key={slotIndex} className={cn(
                                    "border-b hover:bg-slate-50/50",
                                    slotIndex % 4 === 0 && "border-t-2 border-t-slate-200" // Highlight hour boundaries
                                )}>
                                    <td className={cn(
                                        "font-medium sticky left-0 z-10 bg-slate-50 p-2 text-xs",
                                        slotIndex % 4 === 0 && "font-bold" // Make hour markers bold
                                    )}>
                                        {slot.label}
                                    </td>
                                    {days.map((day, dayIndex) => (
                                        <TimeSlotCell
                                            key={dayIndex}
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

function determineShiftType(startTime: string): 'EARLY' | 'MIDDLE' | 'LATE' {
    if (!startTime) return 'MIDDLE';
    const startHour = parseInt(startTime.split(':')[0]);
    if (startHour < 10) return 'EARLY';
    if (startHour >= 14) return 'LATE';
    return 'MIDDLE';
}

// Helper function to get shift type color
function getShiftTypeColor(schedule: Schedule, settings: any): string {
    // First try to get color from shift_type_id
    if (schedule.shift_type_id && settings?.shift_types) {
        const shiftType = settings.shift_types.find(
            (type: any) => type.id === schedule.shift_type_id
        );
        if (shiftType?.color) return shiftType.color;
    }

    // Fallback to determining type from start time
    const determinedType = determineShiftType(schedule.shift_start || '');
    const shiftType = settings?.shift_types?.find(
        (type: any) => type.id === determinedType
    );
    return shiftType?.color || '#64748b';
}

// Helper function to get shift type name
function getShiftTypeName(schedule: Schedule): string {
    // First try to get name from shift_type_name
    if (schedule.shift_type_name) return schedule.shift_type_name;

    // Fallback to determining type from start time
    return determineShiftType(schedule.shift_start || '');
} 