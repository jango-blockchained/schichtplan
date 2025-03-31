import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WeeklySchedule, WeeklyShift, Settings } from '@/types';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Edit2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';
import { 
    calculateDailyHours, 
    calculateWeeklyHours, 
    calculateMonthlyHours,
    validateBreaks
} from '@/components/shifts/utils';
import { ShiftTableProps, ShiftCellProps, SubRowProps } from './types';

/**
 * SubRow component for displaying shift details
 */
const SubRow = ({ children, className, ...props }: SubRowProps) => (
    <div className={cn("flex flex-col border-t border-border first:border-t-0", className)} {...props}>
        {children}
    </div>
);

/**
 * Loading skeleton for the ShiftTable
 */
const LoadingSkeleton = () => (
    <Card className="overflow-x-auto">
        <div className="p-4 space-y-4">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-[150px]" />
                <Skeleton className="h-12 w-20" />
                <Skeleton className="h-12 w-20" />
                {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-[100px]" />
                ))}
                <Skeleton className="h-12 w-20" />
                <Skeleton className="h-12 w-20" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-20 w-[150px]" />
                    <Skeleton className="h-20 w-20" />
                    <Skeleton className="h-20 w-20" />
                    {Array.from({ length: 7 }).map((_, j) => (
                        <Skeleton key={j} className="h-20 w-[100px]" />
                    ))}
                    <Skeleton className="h-20 w-20" />
                    <Skeleton className="h-20 w-20" />
                </div>
            ))}
        </div>
    </Card>
);

/**
 * ShiftCell component for displaying individual shift details
 */
const ShiftCell = ({ 
    shift, 
    showValidation = true, 
    onBreakNotesUpdate, 
    employeeId,
    settings,
    compact = false
}: ShiftCellProps) => {
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState(shift?.break?.notes || '');
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();

    // Fetch settings if not provided
    const { data: fetchedSettings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
        enabled: !settings
    });

    const activeSettings = settings || fetchedSettings;

    if (!shift) return null;

    const dailyHours = calculateDailyHours(shift);
    const shiftHours = parseFloat(dailyHours.split(':')[0]) + parseFloat(dailyHours.split(':')[1]) / 60;

    // Validation checks
    const { hasBreakViolation, hasLongBreakViolation, hasHoursViolation } = validateBreaks({
        start_time: shift.start_time,
        end_time: shift.end_time,
        break: shift.break
    });

    // Determine shift type based on time or ID
    const determineShiftType = () => {
        // If the shift has a shift_type_id, use that
        if (shift.shift_type_id) {
            return shift.shift_type_id;
        }

        // Otherwise guess based on start time
        const startHour = parseInt(shift.start_time?.split(':')[0] || '0');
        if (startHour < 11) return 'EARLY';
        if (startHour >= 16) return 'LATE';
        return 'MIDDLE';
    };

    const shiftTypeId = determineShiftType();

    // Find the shift type details in settings
    const shiftTypeInfo = activeSettings?.shift_types?.find(type => type.id === shiftTypeId);

    // Get the color and name for the shift type
    const shiftTypeColor = shiftTypeInfo?.color || '#64748b'; // Default slate gray
    const shiftTypeName = shiftTypeInfo?.name || (
        shiftTypeId === 'EARLY' ? 'Frühschicht' :
        shiftTypeId === 'MIDDLE' ? 'Mittelschicht' :
        shiftTypeId === 'LATE' ? 'Spätschicht' : 'Schicht'
    );

    const handleNotesUpdate = async () => {
        if (!onBreakNotesUpdate || !employeeId || shift.day === undefined || !shift.break) {
            return;
        }

        try {
            setIsUpdating(true);
            await onBreakNotesUpdate(employeeId, shift.day, notes.trim());
            setIsEditingNotes(false);
            toast({
                description: "Pausennotizen wurden gespeichert.",
            });
        } catch (error) {
            toast({
                title: "Fehler",
                description: error instanceof Error ? error.message : "Fehler beim Speichern der Notizen",
                variant: "destructive",
            });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCancel = () => {
        setNotes(shift.break?.notes || '');
        setIsEditingNotes(false);
    };

    // Compact view for schedule/shifts/ShiftTable.tsx style
    if (compact) {
        return (
            <div className="h-full w-full space-y-1">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{shift.start_time} - {shift.end_time}</span>
                    {shift.break && onBreakNotesUpdate && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button 
                                        onClick={() => setIsEditingNotes(true)}
                                        className="text-xs text-primary hover:text-primary/80"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Edit break notes</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                
                {shift.shift_type_id && (
                    <Badge variant="outline" className="text-xs font-normal py-0 h-5">
                        {shiftTypeName}
                    </Badge>
                )}
                
                {shift.break && (
                    <div className="text-xs text-muted-foreground">
                        Break: {shift.break.start} - {shift.break.end}
                    </div>
                )}
                
                {shift.break?.notes && !isEditingNotes && (
                    <div className="text-xs text-muted-foreground">{shift.break.notes}</div>
                )}
                
                {isEditingNotes && (
                    <div className="space-y-1.5 pt-1">
                        <Input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Break notes..."
                            size={3}
                            className="text-xs h-6 py-1 px-2"
                        />
                        <div className="flex gap-1 justify-end">
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="h-6 text-xs py-0 px-2"
                                onClick={handleCancel}
                            >
                                Cancel
                            </Button>
                            <Button 
                                variant="default" 
                                size="sm"
                                className="h-6 text-xs py-0 px-2"
                                onClick={handleNotesUpdate}
                                disabled={isUpdating}
                            >
                                {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                            </Button>
                        </div>
                    </div>
                )}
                
                <div className="text-xs text-muted-foreground">Total: {dailyHours}h</div>
            </div>
        );
    }

    // Full view for shifts/components/ShiftTable.tsx style
    return (
        <div className={cn(
            "p-2 rounded border border-border",
            (hasBreakViolation || hasLongBreakViolation || hasHoursViolation) ? "border-destructive" : "hover:border-primary"
        )}>
            {/* Display shift type in badge with the correct color */}
            <div className="mb-2">
                <Badge
                    variant="outline"
                    style={{
                        backgroundColor: `${shiftTypeColor}20`, // Add transparency
                        color: shiftTypeColor,
                        borderColor: shiftTypeColor
                    }}
                >
                    {shiftTypeName}
                </Badge>
            </div>
            <SubRow>Beginn: {shift.start_time}</SubRow>
            {shift.break && (
                <>
                    <SubRow>Pause: {shift.break.start}</SubRow>
                    <SubRow>Ende: {shift.break.end}</SubRow>
                    <SubRow className="flex items-center gap-2">
                        {isEditingNotes ? (
                            <>
                                <Input
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Pausennotizen..."
                                    className="h-8 text-sm"
                                    disabled={isUpdating}
                                />
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleNotesUpdate}
                                        className="h-8 px-2"
                                        disabled={isUpdating}
                                    >
                                        {isUpdating ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            "Speichern"
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleCancel}
                                        className="h-8 px-2"
                                        disabled={isUpdating}
                                    >
                                        Abbrechen
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 w-full">
                                <span className="text-sm text-muted-foreground flex-1">
                                    {shift.break.notes || 'Keine Pausennotizen'}
                                </span>
                                {onBreakNotesUpdate && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setIsEditingNotes(true)}
                                        className="h-6 w-6 p-0"
                                    >
                                        <Edit2 className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </SubRow>
                </>
            )}
            <SubRow>Ende: {shift.end_time}</SubRow>
            <SubRow className="flex justify-between items-center">
                <span>Summe / Tag: {dailyHours}</span>
                {showValidation && (hasBreakViolation || hasLongBreakViolation || hasHoursViolation) && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <AlertCircle className="h-4 w-4 text-destructive" />
                            </TooltipTrigger>
                            <TooltipContent>
                                {hasBreakViolation && <p>Pause erforderlich für Schichten &gt; 6 Stunden</p>}
                                {hasLongBreakViolation && <p>Zweite Pause erforderlich für Schichten &gt; 9 Stunden</p>}
                                {hasHoursViolation && <p>Maximale Arbeitszeit von 10 Stunden überschritten</p>}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </SubRow>
        </div>
    );
};

/**
 * ShiftTable component for displaying weekly schedules
 */
export const ShiftTable = ({ 
    weekStart, 
    weekEnd, 
    isLoading, 
    error, 
    data, 
    onShiftUpdate, 
    onBreakNotesUpdate,
    settings,
    showValidation = true,
    compact = false,
    filterOpeningDays = false
}: ShiftTableProps) => {
    const [localData, setLocalData] = useState(data);
    const { toast } = useToast();
    
    // Fetch settings if not provided
    const { data: fetchedSettings, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
        enabled: !settings
    });
    
    const activeSettings = settings || fetchedSettings;
    
    // Generate days for the week
    const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    
    // Filter days based on opening days if needed
    const filteredDates = filterOpeningDays && activeSettings?.general?.opening_days
        ? dates.filter(date => {
            const dayIndex = date.getDay().toString();
            return activeSettings.general.opening_days[dayIndex];
        })
        : dates;
    
    // Days to display
    const daysToShow = filteredDates.length > 0 ? filteredDates : dates;

    const handleDragEnd = useCallback(async (result: DropResult) => {
        if (!result.destination || !onShiftUpdate) return;

        const { source, destination, draggableId } = result;
        const [employeeId, dayStr] = draggableId.split('-');
        const fromDay = parseInt(dayStr, 10);
        const toDay = parseInt(destination.droppableId.split('-')[1], 10);

        // Don't do anything if dropped in the same spot
        if (fromDay === toDay) return;

        try {
            // Update backend
            await onShiftUpdate(parseInt(employeeId, 10), fromDay, toDay);

            // Update local state
            setLocalData(prevData => {
                return prevData.map(employee => {
                    if (employee.employee_id.toString() !== employeeId) return employee;

                    const newShifts = [...employee.shifts];
                    const shiftIndex = newShifts.findIndex(s => s.day === fromDay);
                    if (shiftIndex === -1) return employee;

                    const [shift] = newShifts.splice(shiftIndex, 1);
                    shift.day = toDay;
                    newShifts.push(shift);

                    return {
                        ...employee,
                        shifts: newShifts,
                    };
                });
            });
            
            toast({
                title: "Success",
                description: "Shift updated successfully",
            });
        } catch (error) {
            console.error('Failed to update shift:', error);
            // Reset to original data if update fails
            setLocalData(data);
            
            toast({
                title: "Error",
                description: "Failed to update shift",
                variant: "destructive",
            });
        }
    }, [onShiftUpdate, data, toast]);

    if (isLoading || isLoadingSettings) {
        return <LoadingSkeleton />;
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    // Compact view (similar to schedule/shifts/ShiftTable.tsx)
    if (compact) {
        return (
            <Card className="shadow-none p-0">
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-44">Employee</TableHead>
                                <TableHead className="w-28">Position</TableHead>
                                <TableHead className="w-16">Contracted</TableHead>
                                {daysToShow.map((day) => (
                                    <TableHead key={day.toString()}>
                                        {format(day, 'EEE, dd.MM', { locale: de })}
                                    </TableHead>
                                ))}
                                <TableHead>Weekly</TableHead>
                                <TableHead>Monthly</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {localData.map((employee, index) => (
                                <TableRow key={employee.employee_id} className={cn(index % 2 === 0 ? 'bg-background' : 'bg-muted/50')}>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium">{employee.name}</span>
                                            {employee.position === 'Teamleiter' && (
                                                <Badge variant="outline" className="w-fit">
                                                    TL
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{employee.position}</TableCell>
                                    <TableCell>{employee.contracted_hours}:00</TableCell>
                                    {daysToShow.map((day, dayIndex) => {
                                        // Map the actual day of week (0-6) to the shift day value
                                        const dayOfWeek = day.getDay(); // 0 = Sunday, 1 = Monday, etc
                                        // Find shift for this day
                                        const shift = employee.shifts.find(s => s.day === dayOfWeek);
                                        
                                        return (
                                            <Droppable key={dayOfWeek} droppableId={dayOfWeek.toString()}>
                                                {(provided, snapshot) => (
                                                    <TableCell
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className={cn(
                                                            'p-0 relative',
                                                            snapshot.isDraggingOver && 'bg-accent'
                                                        )}
                                                    >
                                                        {shift && (
                                                            <Draggable
                                                                draggableId={`${employee.employee_id}-${dayOfWeek}`}
                                                                index={0}
                                                            >
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        className={cn(
                                                                            'p-4',
                                                                            snapshot.isDragging && 'bg-accent'
                                                                        )}
                                                                    >
                                                                        <ShiftCell
                                                                            shift={shift}
                                                                            employeeId={employee.employee_id}
                                                                            onBreakNotesUpdate={onBreakNotesUpdate}
                                                                            settings={activeSettings}
                                                                            showValidation={showValidation}
                                                                            compact={true}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        )}
                                                        {provided.placeholder}
                                                    </TableCell>
                                                )}
                                            </Droppable>
                                        );
                                    })}
                                    <TableCell>
                                        {calculateWeeklyHours(employee.shifts)}h
                                    </TableCell>
                                    <TableCell>
                                        {calculateMonthlyHours(employee.shifts)}h
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </DragDropContext>
            </Card>
        );
    }

    // Full view (similar to shifts/components/ShiftTable.tsx)
    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Card className="overflow-x-auto">
                <div className="p-4 border-b border-border">
                    <h2 className="text-xl font-semibold">Mitarbeiter-Einsatz-Planung (MEP)</h2>
                    <div className="text-sm text-muted-foreground mt-2">
                        <span>Filiale: {activeSettings?.store_name || ''}</span>
                        <span className="ml-4">Woche vom: {format(weekStart, 'dd.MM.yy')} bis: {format(weekEnd, 'dd.MM.yy')}</span>
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableCell className="font-medium min-w-[150px]">Name, Vorname</TableCell>
                            <TableCell className="font-medium w-20">Position</TableCell>
                            <TableCell className="font-medium w-20">Plan / Woche</TableCell>
                            {daysToShow.map((date) => (
                                <TableCell key={date.toISOString()} className="font-medium min-w-[100px]">
                                    {format(date, 'EEEE\ndd.MM', { locale: de })}
                                </TableCell>
                            ))}
                            <TableCell className="font-medium w-20">Summe / Woche</TableCell>
                            <TableCell className="font-medium w-20">Summe / Monat</TableCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {localData.map((employee, index) => (
                            <TableRow key={employee.employee_id} className={cn(index % 2 === 0 ? 'bg-background' : 'bg-muted/50')}>
                                <TableCell className="align-top">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium">{employee.name}</span>
                                        {employee.position === 'Teamleiter' && (
                                            <Badge variant="secondary" className="w-fit">TL</Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="align-top text-center">
                                    {employee.position}
                                </TableCell>
                                <TableCell className="align-top text-center">
                                    {employee.contracted_hours}:00
                                </TableCell>
                                {daysToShow.map((_, dayIndex) => (
                                    <TableCell key={dayIndex} className="align-top p-0">
                                        <Droppable droppableId={`drop-${dayIndex}`}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                    className={cn(
                                                        "min-h-[120px] p-2",
                                                        snapshot.isDraggingOver && "bg-accent"
                                                    )}
                                                >
                                                    {employee.shifts
                                                        .filter(s => s.day === dayIndex)
                                                        .map((shift, index) => (
                                                            <Draggable
                                                                key={`${employee.employee_id}-${shift.day}`}
                                                                draggableId={`${employee.employee_id}-${shift.day}`}
                                                                index={index}
                                                            >
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        className={cn(
                                                                            "mb-2 last:mb-0",
                                                                            snapshot.isDragging && "opacity-50"
                                                                        )}
                                                                    >
                                                                        <ShiftCell
                                                                            shift={shift}
                                                                            employeeId={employee.employee_id}
                                                                            onBreakNotesUpdate={onBreakNotesUpdate}
                                                                            settings={activeSettings}
                                                                            showValidation={showValidation}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </TableCell>
                                ))}
                                <TableCell className="align-top text-center">
                                    {calculateWeeklyHours(employee.shifts)}
                                </TableCell>
                                <TableCell className="align-top text-center">
                                    {calculateMonthlyHours(employee.shifts)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="p-4 space-y-2 text-sm text-muted-foreground border-t border-border">
                    <p>h : 60 Minuten</p>
                    <p>
                        Anwesenheiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.
                        Am Ende der Woche: wöchentliche und monatliche Summe eintragen.
                    </p>
                    <p>
                        Abwesenheiten: Feiertag, Krankheit (AU-Bescheinigung), Freizeit, Schule (Führungsnachweis), Urlaub
                    </p>
                </div>
            </Card>
        </DragDropContext>
    );
};