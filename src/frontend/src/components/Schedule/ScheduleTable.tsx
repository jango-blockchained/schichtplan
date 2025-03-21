import React, { useMemo, useState, useEffect, Fragment } from 'react';
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
import { Edit2, Trash2, Plus, ChevronDown, ChevronRight, AlertTriangle, Pencil, Trash } from 'lucide-react';
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
import { EmployeeStatistics } from './EmployeeStatistics';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShiftModal } from './ShiftModal';

// Type definitions
type ShiftType = 'EARLY' | 'MIDDLE' | 'LATE';

interface Settings {
    shift_types?: Array<{
        id: string;
        name: string;
        color: string;
    }>;
    availability_types?: {
        types: Array<{
            id: string;
            name: string;
            color: string;
        }>;
    };
}

interface ScheduleTableProps {
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
    shiftId: number | null;
    date: string;
    shift_type_id?: string; // EARLY, MIDDLE, LATE
}

// Define an extended type for Schedule that includes the break duration
type ExtendedSchedule = Schedule & {
    break_duration?: number | null;
    notes?: string | null;
    additional_slots?: TimeSlot[];
    shift_name?: string;
};

interface TimeSlot {
    start: string;
    end: string;
}

// Helper function to check if a schedule is empty (no shift assigned)
const isEmptySchedule = (schedule: Schedule): boolean => {
    // A schedule is empty if:
    // 1. It has is_empty flag set to true OR
    // 2. It has no shift_id AND no shift_start/shift_end times
    return (
        schedule.is_empty === true ||
        (schedule.shift_id === null &&
            (!schedule.shift_start || !schedule.shift_end) &&
            (!schedule.start_time || !schedule.end_time))
    );
};

// Add this component above the ScheduleCell component
interface TimeSlotDisplayProps {
    startTime: string;
    endTime: string;
    shiftType?: string;
    settings?: any;
    schedule?: Schedule;
}

const TimeSlotDisplay = ({ startTime, endTime, shiftType, settings, schedule }: TimeSlotDisplayProps) => {
    // This function determines the background color of the time slot pill
    // Based on shift type (EARLY, MIDDLE, LATE) and settings
    const getBackgroundColor = () => {
        // First try to get color from settings based on shift_type_id
        if (schedule?.shift_type_id && settings?.shift_types) {
            const shiftTypeInfo = settings.shift_types.find(
                (type: any) => type.id === schedule.shift_type_id
            );
            if (shiftTypeInfo?.color) {
                return shiftTypeInfo.color;
            }
        }

        // Then try to get color from settings based on shift type
        if (typeof shiftType === 'string' && settings?.shift_types) {
            const shiftTypeInfo = settings.shift_types.find(
                (type: any) => type.id === shiftType
            );
            if (shiftTypeInfo?.color) {
                return shiftTypeInfo.color;
            }
        }

        // Fallback to default colors if no settings found
        if (typeof shiftType === 'string') {
            if (['EARLY', 'MIDDLE', 'LATE'].includes(shiftType)) {
                switch (shiftType) {
                    case 'EARLY':
                        return '#4CAF50'; // Default green for early shifts
                    case 'MIDDLE':
                        return '#2196F3'; // Default blue for middle shifts
                    case 'LATE':
                        return '#9C27B0'; // Default purple for late shifts
                }
            }
        }

        return '#64748b'; // Default slate gray
    };

    // Helper function to get a formatted display name for the shift type
    const getShiftTypeDisplay = () => {
        // First try to get name from schedule
        if (schedule?.shift_type_name) {
            return schedule.shift_type_name;
        }

        // Then try to get name from settings
        if (typeof shiftType === 'string' && settings?.shift_types) {
            const shiftTypeInfo = settings.shift_types.find(
                (type: any) => type.id === shiftType
            );
            if (shiftTypeInfo?.name) {
                return shiftTypeInfo.name;
            }
        }

        // Fallback to default names
        if (typeof shiftType === 'string') {
            switch (shiftType) {
                case 'EARLY':
                    return 'Früh';
                case 'LATE':
                    return 'Spät';
                case 'MIDDLE':
                    return 'Mitte';
                default:
                    return shiftType;
            }
        }
        return null;
    };

    const bgColor = getBackgroundColor();
    const shiftTypeDisplay = getShiftTypeDisplay();

    // Convert hex color to rgba for background with transparency
    const getRGBAColor = (hexColor: string, alpha: number = 0.2) => {
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    return (
        <div className="flex flex-col items-center">
            <div
                className="px-4 py-1 rounded-full text-sm font-medium"
                style={{
                    backgroundColor: getRGBAColor(bgColor, 0.2),
                    color: bgColor,
                    border: `1px solid ${bgColor}`
                }}
            >
                {startTime} - {endTime}
            </div>
            {shiftTypeDisplay && (
                <div className="text-xs mt-1 font-medium" style={{ color: bgColor }}>
                    {shiftTypeDisplay}
                </div>
            )}
        </div>
    );
};

// Add the ScheduleCellProps interface
interface ScheduleCellProps {
    employee: Employee;
    dayIndex: number;
    cellIndex: number;
    date: Date;
    schedule: Schedule;
    absenceInfo?: { type: string; color: string; start_time?: string; end_time?: string; } | null;
    onDropHandler?: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdateHandler?: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
}

const ScheduleCell = ({
    employee,
    dayIndex,
    cellIndex,
    date,
    schedule,
    absenceInfo,
    onDropHandler,
    onUpdateHandler
}: ScheduleCellProps) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [showActions, setShowActions] = useState(false);

    // Extract the absence information
    const hasAbsence = !!absenceInfo;

    const [{ isDragging }, drag] = useDrag({
        type: 'SCHEDULE',
        item: schedule ? {
            type: 'SCHEDULE',
            scheduleId: schedule.id,
            employeeId: schedule.employee_id,
            shiftId: schedule.shift_id || null,
            date: schedule.date,
            shift_type_id: schedule.shift_type_id
        } : undefined,
        canDrag: !!schedule && !hasAbsence,
        collect: (monitor) => ({
            isDragging: monitor.isDragging()
        })
    });

    const [{ isOver }, drop] = useDrop({
        accept: 'SCHEDULE',
        drop: (item: DragItem) => {
            if (!schedule) return;
            // Use prop passed from parent
            if (onDropHandler) {
                onDropHandler(
                    item.scheduleId,
                    schedule.employee_id,
                    new Date(schedule.date),
                    item.shiftId || 0
                );
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver()
        }),
        canDrop: () => !!schedule && !hasAbsence
    });

    // Fetch settings to get availability type colors
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
    });

    const handleDelete = async () => {
        if (!schedule) return;
        try {
            // Use prop passed from parent
            if (onUpdateHandler) {
                await onUpdateHandler(schedule.id, { shift_id: null });
            }
        } catch (error) {
            console.error('Error deleting shift:', error);
        }
    };

    const handleAddClick = () => {
        if (hasAbsence) return; // Prevent adding if there's an absence
        setIsAddModalOpen(true);
    };

    const handleEditClick = () => {
        setIsEditModalOpen(true);
    };

    const handleSaveShift = async (data: any) => {
        // Implementation would go here
        console.log('Saving shift:', data);
        setIsEditModalOpen(false);
        setIsAddModalOpen(false);
    };

    const onDeleteClick = (scheduleId: number) => {
        handleDelete();
    };

    // Check if the schedule is empty (no shift) - this should be separate from absence
    const isEmpty = !schedule || (
        !schedule.shift_id &&
        !schedule.employee_id &&
        !schedule.shift_start &&
        !schedule.shift_end
    );

    // Cast the schedule to ExtendedSchedule to access the additional properties
    const extendedSchedule = schedule as ExtendedSchedule;
    const shiftType = determineShiftType(schedule);
    const shiftTypeColor = getShiftTypeColor(shiftType, settings);

    // Show employee name in cell flag - could be a prop or determined based on view mode
    const showEmployeeNameInCell = false; // Set based on your requirements

    // Get availability type color from settings
    const getAvailabilityTypeColor = (availabilityType: string) => {
        if (!settings?.availability_types?.types) return '#22c55e'; // Default green

        const typeInfo = settings.availability_types.types.find(
            (type: any) => type.id === availabilityType
        );

        return typeInfo?.color || '#22c55e'; // Default to green if not found
    };

    // Get the availability type from the schedule
    // If not provided, use a default based on the shift type
    const getDefaultAvailabilityType = (schedule: Schedule, shiftType: string): string => {
        // First check if the schedule has an explicit availability_type
        if (schedule.availability_type) {
            return schedule.availability_type;
        }

        // If the shift_type_id is explicitly set, use that to determine availability_type
        if (schedule.shift_type_id) {
            return schedule.shift_type_id;
        }

        // Check notes for keywords that might indicate fixed shifts
        if (schedule.notes) {
            const notes = schedule.notes.toLowerCase();
            if (notes.includes('fix') || notes.includes('fest')) {
                return 'FIX';
            }
            if (notes.includes('wunsch') || notes.includes('promised') || notes.includes('pref')) {
                return 'PRF';
            }
        }

        // Check for specific time patterns that might indicate fixed shifts
        // This is a temporary solution until the backend properly provides availability_type
        if (schedule.shift_start && schedule.shift_end) {
            // Example: Consider specific shift patterns as fixed
            if (schedule.shift_start === '12:00' && schedule.shift_end === '16:00') {
                return 'FIX'; // Consider afternoon shifts as fixed
            }
        }

        // Default based on shift type as a last resort
        return shiftType;
    };

    const availabilityType = getDefaultAvailabilityType(schedule, shiftType);
    const availabilityColor = getAvailabilityTypeColor(availabilityType);

    return (
        <>
            <div
                ref={(node) => drag(drop(node))}
                style={{ width: '100%', height: '100%' }}
                className={cn(
                    'p-2 rounded-md border transition-all duration-200 group relative',
                    'flex flex-col gap-2 items-center justify-center',
                    isDragging && 'opacity-50 bg-primary/10',
                    isOver && 'ring-2 ring-primary/50',
                    'hover:bg-primary/5',
                    hasAbsence && 'bg-red-50 border-red-200'
                )}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                {/* Display absence information as a prominent banner */}
                {hasAbsence && (
                    <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-t text-center z-20">
                        {absenceInfo?.type || 'Absence'}
                    </div>
                )}

                {/* Top colored line - using availability type color */}
                <div
                    className={cn(
                        "absolute top-0 left-0 right-0 h-2 rounded-t",
                        hasAbsence && "top-6" // Move down if absence banner is shown
                    )}
                    style={{
                        backgroundColor: availabilityColor // Uses the availability type color
                    }}
                    title={`Availability type: ${availabilityType}`}
                />

                {/* The rest of the cell content - including shift information */}
                <div className={cn("flex flex-col w-full space-y-2 items-center", hasAbsence ? "mt-7" : "mt-2")}>
                    {!isEmpty ? (
                        <>
                            {/* Time display - uses shift type color */}
                            <TimeSlotDisplay
                                startTime={schedule.shift_start || schedule.start_time || '00:00'}
                                endTime={schedule.shift_end || schedule.end_time || '00:00'}
                                shiftType={shiftType} // Pass the shift type for color
                                settings={settings}
                                schedule={schedule}
                            />

                            {/* Employee Name (only when in shift mode) */}
                            {showEmployeeNameInCell && (
                                <div className="text-xs text-center font-medium truncate max-w-full">
                                    {employee.first_name} {employee.last_name}
                                </div>
                            )}

                            {/* Show the shift name if available */}
                            {extendedSchedule.shift_name && (
                                <div
                                    className="text-xs text-center font-medium truncate max-w-full"
                                    style={{ color: shiftTypeColor }}
                                >
                                    {extendedSchedule.shift_name}
                                </div>
                            )}

                            {/* Edit/Delete buttons when hovering */}
                            {showActions && (
                                <div className="absolute bottom-1 right-1 flex space-x-1">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={handleEditClick}
                                    >
                                        <Pencil size={12} />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => onDeleteClick?.(schedule.id)}
                                    >
                                        <Trash size={12} />
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        // Empty cell content with "+" button
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full"
                            onClick={handleAddClick}
                        >
                            <Plus size={16} />
                        </Button>
                    )}
                </div>
            </div>

            {isEditModalOpen && onUpdateHandler && (
                <ShiftEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    schedule={schedule}
                    onSave={onUpdateHandler}
                />
            )}

            {isAddModalOpen && onUpdateHandler && (
                <ShiftEditModal
                    isOpen={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    schedule={{
                        id: 0,
                        employee_id: employee.id,
                        date: format(date, 'yyyy-MM-dd'),
                        is_empty: true
                    } as Schedule}
                    onSave={onUpdateHandler}
                />
            )}
        </>
    );
};

// Helper function to determine shift type based on properties
const determineShiftType = (schedule: Schedule): ShiftType => {
    if (schedule.shift_type_id) {
        return schedule.shift_type_id;
    }

    const startTime = schedule.shift_start;
    if (!startTime) return 'EARLY';

    const hour = parseInt(startTime.split(':')[0]);
    if (hour < 10) return 'EARLY';
    if (hour < 14) return 'MIDDLE';
    return 'LATE';
};

const getShiftTypeDisplay = (shiftType: ShiftType): string => {
    switch (shiftType) {
        case 'EARLY': return 'Früh';
        case 'MIDDLE': return 'Mitte';
        case 'LATE': return 'Spät';
        default: return 'Früh';
    }
};

const getShiftTypeColor = (shiftType: ShiftType, settings?: Settings): string => {
    const shiftTypeInfo = settings?.shift_types?.find((type: { id: string }) => type.id === shiftType);
    if (shiftTypeInfo?.color) return shiftTypeInfo.color;

    switch (shiftType) {
        case 'EARLY': return '#22c55e';
        case 'MIDDLE': return '#3b82f6';
        case 'LATE': return '#f59e0b';
        default: return '#64748b';
    }
};

// Function to get direct CSS color values based on shift type
const getShiftTypeRGBColor = (type: string, schedule?: Schedule, settingsData?: any): { bg: string, text: string } => {
    // First try to get color from settings based on the shift_type_id
    if (settingsData && schedule?.shift_type_id) {
        const shiftTypeData = settingsData.find(
            (t: any) => t.id === schedule.shift_type_id
        );

        if (shiftTypeData?.color) {
            // Convert hex color to rgba for background with transparency
            const hex = shiftTypeData.color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return {
                bg: `rgba(${r}, ${g}, ${b}, 0.2)`,
                text: shiftTypeData.color
            };
        }
    }

    // Fall back to default colors based on shift type
    switch (type) {
        case 'EARLY':
            return {
                bg: 'rgba(59, 130, 246, 0.2)',
                text: 'rgb(37, 99, 235)'
            };
        case 'MIDDLE':
            return {
                bg: 'rgba(34, 197, 94, 0.2)',
                text: 'rgb(22, 163, 74)'
            };
        case 'LATE':
            return {
                bg: 'rgba(245, 158, 11, 0.2)',
                text: 'rgb(217, 119, 6)'
            };
        default:
            return {
                bg: 'rgba(203, 213, 225, 0.2)',
                text: 'rgb(100, 116, 139)'
            };
    }
};

// Helper function to check if an employee has an absence for a given date
const checkForAbsence = (
    employeeId: number,
    dateString: string,
    employeeAbsences?: Record<number, any[]>,
    absenceTypes?: Array<{ id: string; name: string; color: string; type: string; }>
) => {
    // Only proceed with the check if we have the data we need
    if (employeeAbsences && absenceTypes) {
        const absences = employeeAbsences[employeeId] || [];
        const matchingAbsence = absences.find(absence => {
            // Use start_date and end_date fields from the API
            const absenceStartDate = absence.start_date?.split('T')[0] || absence.date;
            const absenceEndDate = absence.end_date?.split('T')[0] || absence.date;
            const checkDate = dateString;

            return checkDate >= absenceStartDate && checkDate <= absenceEndDate;
        });

        if (matchingAbsence) {
            const absenceType = absenceTypes.find(type => type.id === matchingAbsence.absence_type_id);
            return {
                type: absenceType?.name || matchingAbsence.type || 'Absence',
                color: absenceType?.color || '#ff0000',
                start_time: matchingAbsence.start_time,
                end_time: matchingAbsence.end_time
            };
        }
    }
    return null;
};

// Export the main ScheduleTable component
export function ScheduleTable({ schedules, dateRange, onDrop, onUpdate, isLoading, employeeAbsences, absenceTypes }: ScheduleTableProps) {
    const [expandedEmployees, setExpandedEmployees] = useState<number[]>([]);

    // Get unique employees
    const uniqueEmployees = useMemo(() => {
        const employeeSet = new Set<number>();
        schedules.forEach(schedule => {
            employeeSet.add(schedule.employee_id);
        });
        return Array.from(employeeSet);
    }, [schedules]);

    // Group schedules by employee and date for rendering
    const groupedSchedules = useMemo(() => {
        const grouped: Record<number, Record<string, Schedule>> = {};

        uniqueEmployees.forEach(employeeId => {
            grouped[employeeId] = {};
        });

        schedules.forEach(schedule => {
            if (!grouped[schedule.employee_id]) {
                grouped[schedule.employee_id] = {};
            }
            grouped[schedule.employee_id][schedule.date] = schedule;
        });

        return grouped;
    }, [schedules, uniqueEmployees]);

    // Create date array for the table header
    const dates = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];
        const result = [];
        let current = new Date(dateRange.from);
        const end = new Date(dateRange.to);

        while (current <= end) {
            result.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        return result;
    }, [dateRange]);

    // Fetch employees data
    const { data: employeesData } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees,
    });

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Employee</TableHead>
                            {dates.map(date => (
                                <TableHead key={date.toISOString()}>{format(date, 'E, MMM d')}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {uniqueEmployees.map(employeeId => (
                            <TableRow key={employeeId}>
                                <TableCell>Employee {employeeId}</TableCell>
                                {dates.map((date, dayIndex) => {
                                    const dateStr = format(date, 'yyyy-MM-dd');
                                    const schedule = groupedSchedules[employeeId]?.[dateStr];
                                    const absenceInfo = checkForAbsence(employeeId, dateStr, employeeAbsences, absenceTypes);

                                    // Find the employee data or create a minimal valid employee object
                                    const employeeData = employeesData?.find(e => e.id === (schedule?.employee_id || employeeId));

                                    return (
                                        <TableCell key={dateStr}>
                                            <ScheduleCell
                                                employee={{
                                                    id: schedule?.employee_id || employeeId,
                                                    employee_id: employeeData?.employee_id || employeeId.toString(),
                                                    first_name: employeeData?.first_name || '',
                                                    last_name: employeeData?.last_name || '',
                                                    employee_group: employeeData?.employee_group || '',
                                                    contracted_hours: employeeData?.contracted_hours || 0,
                                                    is_keyholder: employeeData?.is_keyholder || false,
                                                    is_active: true,
                                                    email: employeeData?.email || null,
                                                    phone: employeeData?.phone || null,
                                                    birthday: null,
                                                    created_at: null,
                                                    updated_at: null,
                                                    max_daily_hours: employeeData?.max_daily_hours || 8,
                                                    max_weekly_hours: employeeData?.max_weekly_hours || 40
                                                }}
                                                dayIndex={dayIndex}
                                                cellIndex={0}
                                                date={new Date(dateStr)}
                                                schedule={schedule}
                                                absenceInfo={absenceInfo || undefined}
                                                onDropHandler={onDrop}
                                                onUpdateHandler={onUpdate}
                                            />
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
} 