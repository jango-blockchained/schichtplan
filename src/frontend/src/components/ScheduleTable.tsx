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
import { Edit2, Trash2, Plus, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
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
import { EmployeeStatistics } from './Schedule/EmployeeStatistics';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
    shiftId: number;
    date: string;
}

// Define an extended type for Schedule that includes the break duration
type ExtendedSchedule = Schedule & {
    break_duration?: number | null;
    notes?: string | null;
    is_fixed?: boolean;
    is_promised?: boolean;
    is_availability_coverage?: boolean;
    shift_type?: 'fixed' | 'promised' | 'availability' | 'regular';
};

const isEmptySchedule = (schedule: Schedule | undefined) => {
    return !schedule || !schedule.shift_id;
};

const ScheduleCell = ({ schedule, onDrop, onUpdate, hasAbsence }: {
    schedule: Schedule | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
    hasAbsence?: boolean;
}) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showActions, setShowActions] = useState(false);

    // Add debug logging to help understand when cells are empty
    useEffect(() => {
        if (schedule && schedule.shift_id !== null && schedule.shift_start) {
            console.log(`ScheduleCell: Valid shift found for date ${schedule.date} - ${schedule.shift_start} to ${schedule.shift_end}`);
        }
    }, [schedule]);

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
        canDrag: !hasAbsence, // Prevent dragging if there's an absence
    }), [schedule, hasAbsence]);

    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'SCHEDULE',
        drop: (item: DragItem) => {
            if (schedule && !hasAbsence) { // Prevent dropping if there's an absence
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
        canDrop: () => !hasAbsence, // Prevent dropping if there's an absence
    }), [schedule, onDrop, hasAbsence]);

    const handleDelete = async () => {
        if (!schedule) return;
        try {
            console.log('🗑️ Deleting shift for schedule:', schedule.id);
            // Set shift_id to null explicitly instead of undefined
            await onUpdate(schedule.id, { shift_id: null });
            console.log('🗑️ Delete operation completed successfully');
        } catch (error) {
            console.error('🗑️ Error deleting shift:', error);
        }
    };

    const handleAdd = () => {
        if (hasAbsence) return; // Prevent adding if there's an absence
        setIsEditModalOpen(true);
    };

    if (!schedule || isEmptySchedule(schedule)) {
        // Create empty schedule object with safe defaults
        const emptySchedule: Schedule = {
            id: 0,
            employee_id: schedule?.employee_id ?? 0,
            shift_id: null,
            shift_start: null,
            shift_end: null,
            date: schedule?.date ?? new Date().toISOString().split('T')[0],
            version: schedule?.version ?? 1,
            is_empty: true,
            status: 'DRAFT'
        };

        return (
            <div
                ref={drop}
                style={{ width: '150px', height: '100px' }}
                className={cn(
                    'flex items-center justify-center text-muted-foreground relative',
                    'border border-dashed border-muted-foreground/20 rounded-md',
                    'hover:border-primary/50 transition-colors duration-200',
                    isOver && 'border-primary border-solid',
                    hasAbsence && 'cursor-not-allowed opacity-0' // Hide completely if absence
                )}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                {showActions && !hasAbsence ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleAdd}
                        className="absolute inset-0 w-full h-full flex items-center justify-center rounded-none"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                ) : (
                    <span className="text-sm">{hasAbsence ? "" : "-"}</span>
                )}
                {isEditModalOpen && !hasAbsence && (
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
    const shiftType = determineShiftType(schedule);
    const shiftTypeColor = getShiftTypeColor(shiftType);

    return (
        <>
            <div
                ref={(node) => drag(drop(node))}
                style={{ width: '150px', height: '100px' }}
                className={cn(
                    'p-2 rounded border transition-all duration-200 group relative',
                    'flex flex-col items-center justify-center',
                    isDragging && 'opacity-50 bg-primary/10',
                    isOver && 'ring-2 ring-primary/50',
                    'hover:bg-primary/5',
                    hasAbsence && 'opacity-0' // Hide completely if absence
                )}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                {/* Shift type indicator - colored line at top of cell */}
                <div
                    className={cn(
                        'absolute top-0 left-0 right-0 h-2 rounded-t',
                        shiftTypeColor
                    )}
                    title={`Shift type: ${shiftType}`}
                />

                <div className="flex flex-col space-y-1 items-center">
                    <Badge
                        variant="outline"
                        style={{
                            backgroundColor: getShiftTypeRGBColor(shiftType).bg,
                            color: getShiftTypeRGBColor(shiftType).text
                        }}
                        className="text-xs w-fit flex items-center justify-center font-medium"
                    >
                        {schedule.shift_start} - {schedule.shift_end}
                    </Badge>
                    {extendedSchedule.break_duration && extendedSchedule.break_duration > 0 && (
                        <div className="text-xs text-muted-foreground">
                            Pause: {extendedSchedule.break_duration} min
                        </div>
                    )}
                    {extendedSchedule.notes && (
                        <div className="text-xs text-muted-foreground italic text-center">
                            {extendedSchedule.notes}
                        </div>
                    )}
                </div>
                {showActions && !hasAbsence && (
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
            {isEditModalOpen && !hasAbsence && (
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

// Helper function to determine shift type based on properties
const determineShiftType = (schedule: Schedule): 'fixed' | 'promised' | 'availability' | 'regular' => {
    // For debugging
    const logShiftType = (source: string, type: 'fixed' | 'promised' | 'availability' | 'regular') => {
        console.log(`Determined shift type for schedule ${schedule.id}: ${type} (source: ${source})`);
        return type;
    };

    // First priority: check explicit shift_type property if it exists
    if (schedule.shift_type) {
        return logShiftType('explicit shift_type property', schedule.shift_type);
    }

    // Cast to extended schedule to access potential properties
    const extSchedule = schedule as ExtendedSchedule;

    // Second priority: check explicit boolean flag properties
    if (extSchedule.is_fixed) {
        return logShiftType('is_fixed flag', 'fixed');
    }
    if (extSchedule.is_promised) {
        return logShiftType('is_promised flag', 'promised');
    }
    if (extSchedule.is_availability_coverage) {
        return logShiftType('is_availability_coverage flag', 'availability');
    }

    // Third priority: try to determine from notes
    if (extSchedule.notes) {
        const notes = extSchedule.notes.toLowerCase();
        if (notes.includes('fix') || notes.includes('fest')) {
            return logShiftType('notes containing fix/fest', 'fixed');
        }
        if (notes.includes('wunsch') || notes.includes('promised') || notes.includes('pref')) {
            return logShiftType('notes containing wunsch/promised/pref', 'promised');
        }
        if (notes.includes('verfügbar') || notes.includes('avail')) {
            return logShiftType('notes containing verfügbar/avail', 'availability');
        }
    }

    // Default case: regular shift
    return logShiftType('default fallback', 'regular');
};

// Function to get color based on shift type
const getShiftTypeColor = (type: 'fixed' | 'promised' | 'availability' | 'regular'): string => {
    switch (type) {
        case 'fixed':
            return 'bg-blue-500'; // Blue for fixed shifts
        case 'promised':
            return 'bg-green-500'; // Green for promised/preferred shifts
        case 'availability':
            return 'bg-amber-500'; // Amber for availability coverage
        default:
            return 'bg-gray-300'; // Gray for regular shifts
    }
};

// Function to get direct CSS color values based on shift type
const getShiftTypeRGBColor = (type: 'fixed' | 'promised' | 'availability' | 'regular'): { bg: string, text: string } => {
    switch (type) {
        case 'fixed':
            return {
                bg: 'rgba(59, 130, 246, 0.2)', // Light blue background
                text: 'rgb(37, 99, 235)'       // Blue text
            };
        case 'promised':
            return {
                bg: 'rgba(34, 197, 94, 0.2)',  // Light green background
                text: 'rgb(22, 163, 74)'       // Green text
            };
        case 'availability':
            return {
                bg: 'rgba(245, 158, 11, 0.2)', // Light amber background
                text: 'rgb(217, 119, 6)'       // Amber text
            };
        default:
            return {
                bg: 'rgba(203, 213, 225, 0.2)', // Light gray background
                text: 'rgb(100, 116, 139)'      // Gray text
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
    if (!employeeAbsences || !absenceTypes) return null;

    const absences = employeeAbsences[employeeId] || [];
    const matchingAbsence = absences.find(absence => {
        const absenceStartDate = absence.start_date.split('T')[0];
        const absenceEndDate = absence.end_date.split('T')[0];
        const checkDate = dateString;

        return checkDate >= absenceStartDate && checkDate <= absenceEndDate;
    });

    if (matchingAbsence) {
        const absenceType = absenceTypes.find(type => type.id === matchingAbsence.absence_type_id);
        if (absenceType) {
            return {
                absence: matchingAbsence,
                type: absenceType
            };
        }
    }

    return null;
};

export function ScheduleTable({ schedules, dateRange, onDrop, onUpdate, isLoading, employeeAbsences, absenceTypes }: ScheduleTableProps) {
    const [expandedEmployees, setExpandedEmployees] = useState<number[]>([]);

    const toggleEmployeeExpand = (employeeId: number) => {
        setExpandedEmployees(prev =>
            prev.includes(employeeId)
                ? prev.filter(id => id !== employeeId)
                : [...prev, employeeId]
        );
    };

    // Fetch settings
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
    });

    // Fetch employee data to display names properly
    const { data: employeesData, isLoading: loadingEmployees } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees,
    });

    const employees = useMemo(() => {
        return employeesData || [];
    }, [employeesData]);

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

    // SIMPLIFIED APPROACH: Create a direct lookup map from employee_id and date to schedule
    const scheduleMap = useMemo(() => {
        const map: Record<number, Record<string, Schedule>> = {};

        // Process all schedules into the map for quick lookup
        schedules.forEach(schedule => {
            const employeeId = schedule.employee_id;

            // Normalize the date format by stripping any time component
            const dateStr = schedule.date.split('T')[0];

            // Initialize the employee map if it doesn't exist
            if (!map[employeeId]) {
                map[employeeId] = {};
            }

            // Store the schedule by date
            map[employeeId][dateStr] = schedule;
        });

        // Log some debugging info about our map
        console.log('🗺️ Schedule map created with:', {
            totalEmployees: Object.keys(map).length,
            sampleEmployee: Object.keys(map)[0] ? Object.keys(map)[0] : 'None',
            totalSchedules: schedules.length,
            schedulesWithShifts: schedules.filter(s => s.shift_id !== null).length
        });

        return map;
    }, [schedules]);

    // Get unique employees from schedules
    const uniqueEmployees = useMemo(() => {
        const employeeSet = new Set<number>();
        schedules.forEach(schedule => {
            employeeSet.add(schedule.employee_id);
        });
        return Array.from(employeeSet);
    }, [schedules]);

    const uniqueEmployeeIds = useMemo(() => {
        const ids = [...new Set(schedules.map(s => s.employee_id))];
        return ids;
    }, [schedules]);

    const groupedSchedules = useMemo(() => {
        const grouped: Record<number, Record<string, Schedule>> = {};

        // Make sure we have valid schedules
        if (!schedules || schedules.length === 0) {
            console.log('Warning: No schedules provided to ScheduleTable');
            return grouped;
        }

        console.log(`ScheduleTable: Processing ${schedules.length} total schedules`);

        // Count schedules with shift_id
        const schedulesWithShifts = schedules.filter(s => s.shift_id !== null);
        console.log(`ScheduleTable: Found ${schedulesWithShifts.length} schedules with shift_id`);

        // Group schedules by employee ID and then by date for quick lookup
        uniqueEmployeeIds.forEach(employeeId => {
            const employeeSchedules = schedules.filter(s => s.employee_id === employeeId);
            grouped[employeeId] = {};

            // Index each schedule by date for easy lookup
            employeeSchedules.forEach(schedule => {
                // Normalize date format by removing time component
                const dateKey = schedule.date.split('T')[0];
                grouped[employeeId][dateKey] = schedule;

                // Log the schedule date for debugging
                if (schedule.shift_id !== null) {
                    console.log(`Employee ${employeeId} has shift on ${dateKey}: ${schedule.shift_start} - ${schedule.shift_end}`);
                }
            });

            // Log schedules with shifts for this employee
            const shiftsForEmployee = employeeSchedules.filter(s => s.shift_id !== null);
            if (shiftsForEmployee.length === 0) {
                console.log(`Note: No shifts assigned for employee ID ${employeeId}`);
            } else {
                console.log(`Found ${shiftsForEmployee.length} shifts for employee ID ${employeeId}`);
            }
        });

        return grouped;
    }, [schedules, uniqueEmployeeIds]);

    // Improve the employee details lookup with fallbacks
    const getEmployeeDetails = (employeeId: number) => {
        // First try to find the employee in the employees data
        const employee = employees.find(e => e.id === employeeId);

        // Use fallback values if employee not found
        if (!employee) {
            console.log(`Warning: Employee with ID ${employeeId} not found in employees data`);
            return {
                contractedHours: 40,
                employeeGroup: 'VZ'
            };
        }

        // Return actual values with fallbacks for missing fields
        return {
            contractedHours: employee.contracted_hours || 40,
            employeeGroup: employee.employee_group || 'VZ'
        };
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

                {/* Add shift type legend and absence type legend */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span>Fest</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span>Wunsch</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                            <span>Verfügbarkeit</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                            <span>Standard</span>
                        </div>
                    </div>

                    {/* Absence type legend */}
                    {absenceTypes && absenceTypes.length > 0 && (
                        <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground mr-1">Absenz:</span>
                            {absenceTypes.map(type => (
                                <div key={type.id} className="flex items-center gap-1">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: type.color }}
                                    ></div>
                                    <span>{type.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="w-full overflow-x-auto" style={{ maxWidth: '100%' }}>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="w-[220px] sticky left-0 z-20 bg-background text-left p-4 font-medium text-muted-foreground">
                                    Mitarbeiter
                                </th>
                                {days.map(day => (
                                    <th key={day.toISOString()} className="w-[150px] text-center p-4 font-medium text-muted-foreground">
                                        <div className="font-semibold">
                                            {weekdayAbbr[format(day, 'EEEE')]}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {format(day, 'dd.MM')}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {uniqueEmployeeIds.map(employeeId => {
                                const employeeSchedules = groupedSchedules[employeeId] || {};
                                const { contractedHours, employeeGroup } = getEmployeeDetails(employeeId);
                                const isExpanded = expandedEmployees.includes(employeeId);

                                return (
                                    <React.Fragment key={employeeId}>
                                        <tr className="hover:bg-muted/40 border-b">
                                            <td className="font-medium sticky left-0 z-10 bg-background w-[220px] p-2">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => toggleEmployeeExpand(employeeId)}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-3 w-3" />
                                                        ) : (
                                                            <ChevronRight className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                    <span className="truncate max-w-[180px]">
                                                        {formatEmployeeName(employeeId)}
                                                    </span>
                                                </div>
                                            </td>
                                            {days.map((day) => {
                                                const dateString = format(day, 'yyyy-MM-dd');
                                                const daySchedule = employeeSchedules[dateString];
                                                // Check for absence
                                                const absenceInfo = checkForAbsence(employeeId, dateString, employeeAbsences, absenceTypes);

                                                const cellStyle = absenceInfo ? {
                                                    backgroundColor: `${absenceInfo.type.color}25`, // 25 is hex for 15% opacity
                                                    position: 'relative' as const
                                                } : {};

                                                return (
                                                    <td
                                                        key={`${employeeId}-${dateString}`}
                                                        className={cn(
                                                            "text-center p-0 w-[150px]",
                                                            absenceInfo ? "relative border-2 border-dashed" : ""
                                                        )}
                                                        style={{
                                                            ...cellStyle,
                                                            borderColor: absenceInfo ? `${absenceInfo.type.color}80` : undefined // 80 is hex for 50% opacity
                                                        }}
                                                        title={absenceInfo ? `${absenceInfo.type.name}` : undefined}
                                                    >
                                                        {absenceInfo && (
                                                            <>
                                                                <div
                                                                    className="absolute top-0 left-0 right-0 px-2 py-1 text-sm font-semibold z-10 text-center"
                                                                    style={{
                                                                        backgroundColor: absenceInfo.type.color,
                                                                        color: '#fff'
                                                                    }}
                                                                >
                                                                    {absenceInfo.type.name}
                                                                </div>
                                                                <div className="absolute inset-0 mt-8 flex flex-col items-center justify-center space-y-2 pt-4">
                                                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                                                    <span className="text-xs text-muted-foreground font-medium text-center px-2">
                                                                        No shifts allowed<br />during absence
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                        <ScheduleCell
                                                            schedule={daySchedule}
                                                            onDrop={onDrop}
                                                            onUpdate={onUpdate}
                                                            hasAbsence={!!absenceInfo}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={days.length + 1} className="bg-slate-50 p-4">
                                                    <EmployeeStatistics
                                                        employeeId={employeeId}
                                                        schedules={schedules}
                                                        contractedHours={contractedHours}
                                                        employeeGroup={employeeGroup}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
} 