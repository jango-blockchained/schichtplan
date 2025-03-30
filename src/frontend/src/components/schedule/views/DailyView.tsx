import React, { useState } from 'react';
import { Schedule, ScheduleUpdate } from '@/types';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, addDays, setHours, setMinutes, isSameDay, addMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getSettings, getEmployees } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DailyViewProps {
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

export const DailyView = ({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading,
    employeeAbsences,
    absenceTypes
}: DailyViewProps) => {
    // Fetch settings and employees
    const { data: settings, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings
    });

    const { data: employees, isLoading: isLoadingEmployees } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees
    });

    // State for the selected day
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);

    if (isLoading || isLoadingSettings || isLoadingEmployees) {
        return <Skeleton className="w-full h-[600px]" />;
    }

    if (!dateRange?.from || !dateRange?.to) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Bitte wählen Sie einen Datumsbereich aus</AlertDescription>
            </Alert>
        );
    }

    // Initialize selected day if not set
    if (!selectedDay) {
        setSelectedDay(dateRange.from);
    }

    // Handle day navigation
    const goToPreviousDay = () => {
        if (selectedDay) {
            const prevDay = addDays(selectedDay, -1);
            if (prevDay >= dateRange.from && prevDay <= dateRange.to) {
                setSelectedDay(prevDay);
            }
        }
    };

    const goToNextDay = () => {
        if (selectedDay) {
            const nextDay = addDays(selectedDay, 1);
            if (nextDay >= dateRange.from && nextDay <= dateRange.to) {
                setSelectedDay(nextDay);
            }
        }
    };

    // Initialize time slots
    const timeSlots = [];
    if (settings) {
        const storeOpening = settings.general.store_opening || '09:00';
        const storeClosing = settings.general.store_closing || '21:00';
        
        const [openHour, openMinute] = storeOpening.split(':').map(Number);
        const [closeHour, closeMinute] = storeClosing.split(':').map(Number);
        
        let startTime = setMinutes(setHours(new Date(), openHour), openMinute);
        const endTime = setMinutes(setHours(new Date(), closeHour), closeMinute);
        
        while (startTime < endTime) {
            timeSlots.push(new Date(startTime));
            startTime = addMinutes(startTime, 30); // 30-minute slots
        }
    }

    // Filter schedules for the selected day
    const daySchedules = selectedDay 
        ? schedules.filter(schedule => {
            if (!schedule.date) return false;
            return isSameDay(new Date(schedule.date), selectedDay);
        })
        : [];

    // Group schedules by employee
    const schedulesByEmployee: Record<number, Schedule[]> = {};
    daySchedules.forEach(schedule => {
        if (!schedulesByEmployee[schedule.employee_id]) {
            schedulesByEmployee[schedule.employee_id] = [];
        }
        schedulesByEmployee[schedule.employee_id].push(schedule);
    });

    // Check if employee is absent
    const getEmployeeAbsence = (employeeId: number, day: Date) => {
        if (!employeeAbsences || !employeeAbsences[employeeId]) {
            return null;
        }

        return employeeAbsences[employeeId].find(absence => {
            const absenceStart = new Date(absence.start_date);
            const absenceEnd = new Date(absence.end_date);
            return day >= absenceStart && day <= absenceEnd;
        });
    };

    // Helper function to get shift type badge
    const getShiftTypeBadge = (shiftTypeId?: string) => {
        if (!shiftTypeId) return null;
        
        let variant = 'default';
        let label = shiftTypeId;
        
        switch(shiftTypeId) {
            case 'EARLY':
                variant = 'default';
                label = 'Früh';
                break;
            case 'MIDDLE':
                variant = 'secondary';
                label = 'Mittel';
                break;
            case 'LATE':
                variant = 'outline';
                label = 'Spät';
                break;
            case 'NON_WORKING':
                variant = 'outline';
                label = '---';
                break;
            case 'OFF':
                variant = 'outline';
                label = 'Frei';
                break;
        }
        
        return (
            <Badge variant={variant as any} className={shiftTypeId === 'NON_WORKING' ? 'bg-slate-100 text-slate-400 border-slate-200' : ''}>
                {label}
            </Badge>
        );
    };

    // Function to get absence badge
    const getAbsenceBadge = (absence: any) => {
        if (!absence || !absenceTypes) return null;
        
        const absenceType = absenceTypes.find(type => type.id === absence.absence_type);
        const style = absenceType ? 
            { backgroundColor: `${absenceType.color}20`, color: absenceType.color, borderColor: absenceType.color } :
            { backgroundColor: '#ff000020', color: '#ff0000', borderColor: '#ff0000' };
            
        return (
            <Badge variant="outline" style={style}>
                {absenceType?.name || 'Abwesend'}
            </Badge>
        );
    };

    // Function to handle date selection
    const handleDateChange = (dateStr: string) => {
        const dateParts = dateStr.split('-').map(Number); // [year, month, day]
        const newDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]); // Months are 0-indexed
        setSelectedDay(newDate);
    };

    // Generate selectable dates within range
    const selectableDates = [];
    if (dateRange.from && dateRange.to) {
        let currentDate = new Date(dateRange.from);
        while (currentDate <= dateRange.to) {
            selectableDates.push({
                value: format(currentDate, 'yyyy-MM-dd'),
                label: format(currentDate, 'EEEE, dd.MM.yyyy', { locale: de })
            });
            currentDate = addDays(currentDate, 1);
        }
    }

    // Function to check if a time slot is within a schedule's time
    const isWithinSchedule = (timeSlot: Date, schedule: Schedule) => {
        if (!schedule.shift_start || !schedule.shift_end) return false;
        
        const [startHour, startMinute] = schedule.shift_start.split(':').map(Number);
        const [endHour, endMinute] = schedule.shift_end.split(':').map(Number);
        
        const scheduleStartTime = setMinutes(setHours(new Date(), startHour), startMinute);
        const scheduleEndTime = setMinutes(setHours(new Date(), endHour), endMinute);
        
        return timeSlot >= scheduleStartTime && timeSlot < scheduleEndTime;
    };

    return (
        <div className="py-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-semibold">Tagesansicht</CardTitle>
                    
                    <div className="flex items-center space-x-2">
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={goToPreviousDay}
                            disabled={!selectedDay || (dateRange.from && selectedDay <= dateRange.from)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        
                        <Select
                            value={selectedDay ? format(selectedDay, 'yyyy-MM-dd') : ''}
                            onValueChange={handleDateChange}
                        >
                            <SelectTrigger className="w-[260px]">
                                <SelectValue placeholder="Wählen Sie ein Datum" />
                            </SelectTrigger>
                            <SelectContent>
                                {selectableDates.map(date => (
                                    <SelectItem key={date.value} value={date.value}>
                                        {date.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={goToNextDay}
                            disabled={!selectedDay || (dateRange.to && selectedDay >= dateRange.to)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                
                <CardContent className="pt-6">
                    {selectedDay && (
                        <>
                            <div className="mb-6">
                                <h3 className="text-lg font-medium">
                                    {format(selectedDay, 'EEEE, dd. MMMM yyyy', { locale: de })}
                                </h3>
                            </div>
                            
                            <div className="grid grid-cols-[auto_1fr] gap-4">
                                {/* Time slots column */}
                                <div className="space-y-4 pr-4 border-r">
                                    <div className="h-12"></div> {/* Spacer to align with employee header */}
                                    {timeSlots.map((slot, index) => (
                                        <div key={index} className="h-12 flex items-center justify-end">
                                            <span className="text-sm font-medium">
                                                {format(slot, 'HH:mm')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Employees column */}
                                <div className="overflow-x-auto">
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                                        {/* Employee headers */}
                                        {employees?.map(employee => (
                                            <div key={employee.id} className="h-12 flex flex-col justify-center px-2 border-b">
                                                <div className="font-medium text-sm truncate">
                                                    {employee.first_name} {employee.last_name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {employee.employee_group}
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {/* Employee schedules */}
                                        {employees?.map(employee => {
                                            const employeeSchedules = schedulesByEmployee[employee.id] || [];
                                            const absence = selectedDay ? getEmployeeAbsence(employee.id, selectedDay) : null;
                                            
                                            return (
                                                <div key={employee.id} className="relative">
                                                    {/* Time slots background */}
                                                    {timeSlots.map((slot, index) => (
                                                        <div 
                                                            key={index} 
                                                            className={cn(
                                                                "h-12 border-b border-dashed",
                                                                index % 2 === 0 ? "bg-muted/30" : ""
                                                            )}
                                                        ></div>
                                                    ))}
                                                    
                                                    {/* Absence indicator */}
                                                    {absence && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-red-50/60 z-10">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="p-2">
                                                                            {getAbsenceBadge(absence)}
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>
                                                                            {absence.absence_type}: {absence.reason || 'Kein Grund angegeben'}
                                                                        </p>
                                                                        <p className="text-xs">
                                                                            {format(new Date(absence.start_date), 'dd.MM.yyyy')} - {format(new Date(absence.end_date), 'dd.MM.yyyy')}
                                                                        </p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Schedules */}
                                                    {!absence && employeeSchedules.map(schedule => {
                                                        if (!schedule.shift_start || !schedule.shift_end) return null;
                                                        
                                                        // Calculate position based on time
                                                        const [startHour, startMinute] = schedule.shift_start.split(':').map(Number);
                                                        const [endHour, endMinute] = schedule.shift_end.split(':').map(Number);
                                                        
                                                        const startTime = startHour * 60 + startMinute;
                                                        const endTime = endHour * 60 + endMinute;
                                                        
                                                        // Find matching time slots
                                                        const matchingSlots = timeSlots.filter(slot => 
                                                            isWithinSchedule(slot, schedule)
                                                        );
                                                        
                                                        if (matchingSlots.length === 0) return null;
                                                        
                                                        const firstSlotIndex = timeSlots.findIndex(slot => 
                                                            format(slot, 'HH:mm') === format(matchingSlots[0], 'HH:mm')
                                                        );
                                                        
                                                        return (
                                                            <div 
                                                                key={schedule.id}
                                                                className="absolute left-0 right-0 bg-primary/10 border border-primary rounded px-2 z-10 flex items-center"
                                                                style={{
                                                                    top: `${firstSlotIndex * 48}px`, // 48px per slot
                                                                    height: `${matchingSlots.length * 48 - 4}px` // Subtract for borders
                                                                }}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-1">
                                                                        {getShiftTypeBadge(schedule.shift_type_id)}
                                                                        <span className="text-xs font-medium">
                                                                            {schedule.shift_start}-{schedule.shift_end}
                                                                        </span>
                                                                    </div>
                                                                    {schedule.notes && (
                                                                        <div className="text-xs text-muted-foreground mt-1 truncate">
                                                                            {schedule.notes}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}; 