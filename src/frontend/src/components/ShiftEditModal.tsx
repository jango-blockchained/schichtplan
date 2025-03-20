import { useState, useEffect, ChangeEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Schedule, ScheduleUpdate, Employee } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getEmployees, getShifts, checkAvailability, createAbsence, getAbsenceTypes, checkBulkAvailability, subscribeToEvents, unsubscribeFromEvents } from '@/services/api';
import type { AbsenceType } from '@/services/api';

type ModalType = 'shift' | 'absence';

interface ShiftEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: Schedule;
    onSave: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
}

export function ShiftEditModal({ isOpen, onClose, schedule, onSave }: ShiftEditModalProps) {
    const [modalType, setModalType] = useState<ModalType>('shift');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(schedule.date ? new Date(schedule.date) : undefined);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(schedule.employee_id?.toString() ?? '');
    const [selectedShiftId, setSelectedShiftId] = useState<string>(schedule.shift_id?.toString() ?? '');
    const [breakDuration, setBreakDuration] = useState<number>((schedule as any).break_duration ?? 0);
    const [notes, setNotes] = useState(schedule.notes ?? '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availableShifts, setAvailableShifts] = useState<typeof shifts>([]);
    const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

    // Absence specific state
    const [absenceType, setAbsenceType] = useState<string>('');
    const [startTime, setStartTime] = useState<string>('');
    const [endTime, setEndTime] = useState<string>('');

    const { toast } = useToast();

    // Query for employees
    const { data: employees } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees,
    });

    // Query for shifts
    const { data: shifts } = useQuery({
        queryKey: ['shifts'],
        queryFn: getShifts,
    });

    // Query for absence types
    const { data: absenceTypes } = useQuery({
        queryKey: ['absenceTypes'],
        queryFn: getAbsenceTypes,
    });

    // Filter out employees with absences for the selected date
    const availableEmployees = employees?.filter(employee => {
        if (!selectedDate) return true;
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

        // Check if employee has any absences that overlap with the selected date
        return !employee.absences?.some(absence => {
            // If absence has start_time and end_time, it's a partial day absence
            if (absence.start_time && absence.end_time) {
                return absence.date === selectedDateStr;
            }
            // Otherwise, it's a full day absence
            return absence.date === selectedDateStr;
        });
    }) ?? [];

    // Function to check if an employee has an absence for a given date
    const hasAbsenceForDate = (employeeId: string, date: Date): boolean => {
        if (!date || !employees) return false;

        const employee = employees.find(emp => emp.id.toString() === employeeId);
        if (!employee || !employee.absences || employee.absences.length === 0) return false;

        const dateStr = format(date, 'yyyy-MM-dd');

        // Check for any absence that overlaps with this date (including date ranges)
        return employee.absences.some(absence => {
            // Convert absence dates to Date objects for comparison
            const startDate = absence.start_date ? new Date(absence.start_date) : new Date(absence.date);
            const endDate = absence.end_date ? new Date(absence.end_date) : startDate;
            const checkDate = new Date(dateStr);

            // Reset time components for accurate date comparison
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            checkDate.setHours(0, 0, 0, 0);

            // Check if the date falls within the absence date range
            return checkDate >= startDate && checkDate <= endDate;
        });
    };

    // Get a human-readable description of the absence for the given date
    const getAbsenceDescription = (employee: Employee, date?: Date): string => {
        if (!date || !employee.absences) return "Abwesend";

        const dateStr = format(date, 'yyyy-MM-dd');

        // Find absence for this date
        const absence = employee.absences.find(abs => {
            const startDate = abs.start_date ? new Date(abs.start_date) : new Date(abs.date);
            const endDate = abs.end_date ? new Date(abs.end_date) : startDate;
            const checkDate = new Date(dateStr);

            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            checkDate.setHours(0, 0, 0, 0);

            return checkDate >= startDate && checkDate <= endDate;
        });

        if (!absence) return "Abwesend";

        // Format date range for display
        const start = absence.start_date ? format(new Date(absence.start_date), 'dd.MM') : format(new Date(absence.date), 'dd.MM');
        const end = absence.end_date ? format(new Date(absence.end_date), 'dd.MM') : start;

        if (start === end) {
            return `Abwesend am ${start}`;
        }

        return `Abwesend ${start}-${end}`;
    };

    // Handle checking employee availability
    const checkEmployeeAvailability = async () => {
        if (!selectedEmployeeId || !selectedDate || !shifts || !Array.isArray(shifts)) {
            setAvailableShifts([]);
            return;
        }

        // First check if employee has an absence for this date
        const employee = employees?.find(emp => emp.id.toString() === selectedEmployeeId);
        if (employee && selectedDate) {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');

            if (hasAbsenceForDate(selectedEmployeeId, selectedDate)) {
                setAvailableShifts([]); // No shifts available for absent employees
                return;
            }
        }

        try {
            const bulkCheck = await checkBulkAvailability({
                employee_id: parseInt(selectedEmployeeId, 10),
                shifts: shifts.map(shift => ({
                    shift_id: shift.id,
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    start_time: shift.start_time,
                    end_time: shift.end_time
                }))
            });

            const availableShifts = shifts.filter(shift => {
                const key = `${shift.id}_${format(selectedDate, 'yyyy-MM-dd')}`;
                const result = bulkCheck[key];
                return result && (result.is_available ||
                    result.availability_type === 'AVAILABLE' ||
                    result.availability_type === 'FIXED' ||
                    result.availability_type === 'PREFERRED');
            });
            setAvailableShifts(availableShifts);
        } catch (error) {
            // Fallback to showing all shifts when availability check fails
            setAvailableShifts(shifts || []);
        }
    };

    // Track if employee was manually selected by the user
    const [userSelectedEmployee, setUserSelectedEmployee] = useState(false);

    // Handle employee selection
    const handleEmployeeChange = (value: string) => {
        // Check if this employee has an absence for the selected date
        if (selectedDate && hasAbsenceForDate(value, selectedDate)) {
            toast({
                title: "Nicht verfügbar",
                description: `Dieser Mitarbeiter hat eine Abwesenheit für den ${format(selectedDate, 'dd.MM.yyyy')}`,
                variant: "destructive",
            });
            return; // Don't select this employee
        }

        setSelectedEmployeeId(value);
        setUserSelectedEmployee(true); // Mark that user has manually selected an employee
        // Reset shift selection when employee changes
        setSelectedShiftId('');
    };

    // Handle date selection
    const handleDateChange = (date: Date | undefined) => {
        setSelectedDate(date);

        // If the current employee has an absence for this date, clear the selection
        if (date && selectedEmployeeId && hasAbsenceForDate(selectedEmployeeId, date)) {
            toast({
                title: "Mitarbeiter nicht verfügbar",
                description: `Der ausgewählte Mitarbeiter hat eine Abwesenheit für den ${format(date, 'dd.MM.yyyy')}`,
                variant: "destructive",
            });
            setSelectedEmployeeId('');
            setUserSelectedEmployee(false);
        }

        // Reset shift selection when date changes
        setSelectedShiftId('');
    };

    // Only run availability check when employee, date and shifts are all available
    // AND employee was manually selected by the user or loaded from existing schedule
    useEffect(() => {
        // Skip availability check if this is a new entry (empty modal) 
        // and user hasn't selected an employee yet
        const isNewEntry = !schedule.id;
        if (isNewEntry && !userSelectedEmployee) {
            return;
        }

        // Don't check availability until we have all necessary data
        // and make sure the employee ID is valid
        if (!selectedEmployeeId || selectedEmployeeId === '' || !selectedDate || !shifts || !Array.isArray(shifts)) {
            return;
        }

        const updateAvailableShifts = async () => {
            setIsCheckingAvailability(true);
            try {
                await checkEmployeeAvailability();
            } catch (error) {
                // Fallback to showing all shifts when availability check fails
                setAvailableShifts(shifts || []);
            } finally {
                setIsCheckingAvailability(false);
            }
        };

        updateAvailableShifts();
    }, [selectedEmployeeId, selectedDate, shifts, schedule.id, userSelectedEmployee]);

    // Separate useEffect to initialize the state from the schedule prop
    useEffect(() => {
        if (schedule.employee_id) {
            setSelectedEmployeeId(schedule.employee_id.toString());
            // If loading from existing schedule, consider it as user-selected
            setUserSelectedEmployee(true);
        }
        if (schedule.shift_id) {
            setSelectedShiftId(schedule.shift_id.toString());
        }
        if (schedule.date) {
            setSelectedDate(new Date(schedule.date));
        }
        setBreakDuration((schedule as any).break_duration ?? 0);
        setNotes(schedule.notes ?? '');
    }, [schedule]);

    // Event subscription should have the employee ID in the dependency array
    useEffect(() => {
        const handleEvent = (eventType: string, data: unknown) => {
            if (eventType === 'AVAILABILITY_UPDATED' || eventType === 'ABSENCE_UPDATED') {
                // Check if we can perform availability check
                const isNewEntry = !schedule.id;
                const shouldCheckAvailability = selectedEmployeeId && (!isNewEntry || userSelectedEmployee);

                // Always call this function, but it will have an early return if conditions aren't met
                if (shouldCheckAvailability) {
                    try {
                        checkEmployeeAvailability();
                    } catch (error) {
                        // Silent error handling to prevent UI disruption
                    }
                }
            }
        };

        subscribeToEvents(['AVAILABILITY_UPDATED', 'ABSENCE_UPDATED'], handleEvent);

        return () => {
            unsubscribeFromEvents(['AVAILABILITY_UPDATED', 'ABSENCE_UPDATED']);
        };
    }, [selectedEmployeeId, schedule.id, userSelectedEmployee]);

    const handleSave = async () => {
        if (!selectedDate || !selectedEmployeeId || !selectedShiftId) {
            toast({
                title: "Error",
                description: "Please fill in all required fields",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const updates: ScheduleUpdate = {
                employee_id: parseInt(selectedEmployeeId, 10),
                date: format(selectedDate, 'yyyy-MM-dd'),
                shift_id: parseInt(selectedShiftId, 10),
                break_duration: breakDuration || null,
                notes: notes || null,
                availability_type: schedule.availability_type || 'AVL',
            };

            await onSave(schedule.id, updates);
            toast({
                title: "Success",
                description: "Shift updated successfully",
            });
            onClose();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update shift",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle absence save
    const handleAbsenceSave = async () => {
        if (!selectedDate || !selectedEmployeeId || !absenceType) {
            toast({
                title: "Error",
                description: "Please fill in all required fields",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await createAbsence({
                employee_id: parseInt(selectedEmployeeId, 10),
                date: format(selectedDate, 'yyyy-MM-dd'),
                type: absenceType,
                start_time: startTime || undefined,
                end_time: endTime || undefined,
            });
            toast({
                title: "Success",
                description: "Absence added successfully",
            });
            onClose();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to add absence",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {modalType === 'shift' ?
                            (schedule.shift_id ? 'Schicht bearbeiten' : 'Neue Schicht erstellen') :
                            'Abwesenheit hinzufügen'
                        }
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Type Selector */}
                    <div className="space-y-2">
                        <Label htmlFor="type">Typ</Label>
                        <Select
                            value={modalType}
                            onValueChange={(value: ModalType) => {
                                setModalType(value);
                                // Reset form when changing type
                                setSelectedEmployeeId('');
                                setUserSelectedEmployee(false);
                                setSelectedShiftId('');
                                setAbsenceType('');
                                setStartTime('');
                                setEndTime('');
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Typ auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="shift">Schicht</SelectItem>
                                <SelectItem value="absence">Abwesenheit</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {modalType === 'shift' ? (
                        // Shift Form
                        <>
                            {/* 1. Date */}
                            <div className="space-y-2">
                                <Label htmlFor="date">Datum</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            id="date"
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !selectedDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedDate ? format(selectedDate, 'dd.MM.yyyy') : <span>Datum auswählen</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={handleDateChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* 2. Employee (filtered by not absence) */}
                            <div className="space-y-2">
                                <Label htmlFor="employee">Mitarbeiter</Label>
                                <Select
                                    value={selectedEmployeeId}
                                    onValueChange={handleEmployeeChange}
                                    disabled={!selectedDate}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={selectedDate ? "Mitarbeiter auswählen" : "Bitte zuerst Datum wählen"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {employees?.map((employee) => {
                                            // Check if employee has absence on selected date
                                            const hasAbsence = selectedDate ? hasAbsenceForDate(employee.id.toString(), selectedDate) : false;

                                            // Add visual indicators for unavailable employees
                                            return (
                                                <SelectItem
                                                    key={employee.id}
                                                    value={employee.id.toString()}
                                                    disabled={hasAbsence}
                                                    className={cn(
                                                        hasAbsence && "text-destructive opacity-70 line-through"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>{employee.first_name} {employee.last_name}</span>
                                                        {hasAbsence && (
                                                            <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                                                                {getAbsenceDescription(employee, selectedDate)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 3. Shift (filtered by employee availabilities) */}
                            <div className="space-y-2">
                                <Label htmlFor="shift">Schicht</Label>
                                <Select
                                    value={selectedShiftId}
                                    onValueChange={setSelectedShiftId}
                                    disabled={!selectedEmployeeId || isCheckingAvailability}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={
                                            isCheckingAvailability ? "Verfügbarkeit wird geprüft..." :
                                                !selectedEmployeeId ? "Bitte zuerst Mitarbeiter wählen" :
                                                    "Schicht auswählen"
                                        } />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isCheckingAvailability ? (
                                            <div className="flex items-center justify-center p-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="ml-2">Verfügbarkeit wird geprüft...</span>
                                            </div>
                                        ) : (
                                            (availableShifts || []).map((shift) => (
                                                <SelectItem
                                                    key={shift.id}
                                                    value={shift.id.toString()}
                                                >
                                                    {shift.start_time} - {shift.end_time}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="breakDuration">Pausenlänge: {breakDuration} Minuten</Label>
                                <Slider
                                    id="breakDuration"
                                    value={[breakDuration]}
                                    min={0}
                                    max={60}
                                    step={5}
                                    onValueChange={(values) => setBreakDuration(values[0])}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notizen</Label>
                                <Textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                                    placeholder="Notizen zur Schicht..."
                                />
                            </div>
                        </>
                    ) : (
                        // Absence Form
                        <>
                            {/* Date Picker */}
                            <div className="space-y-2">
                                <Label htmlFor="date">Datum</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            id="date"
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !selectedDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedDate ? format(selectedDate, 'dd.MM.yyyy') : <span>Datum auswählen</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={handleDateChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Employee Selector */}
                            <div className="space-y-2">
                                <Label htmlFor="employee">Mitarbeiter</Label>
                                <Select
                                    value={selectedEmployeeId}
                                    onValueChange={handleEmployeeChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Mitarbeiter auswählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {employees?.map((employee) => {
                                            // Check if employee has absence on selected date
                                            const hasAbsence = selectedDate ? hasAbsenceForDate(employee.id.toString(), selectedDate) : false;

                                            // Add visual indicators for unavailable employees
                                            return (
                                                <SelectItem
                                                    key={employee.id}
                                                    value={employee.id.toString()}
                                                    disabled={hasAbsence}
                                                    className={cn(
                                                        hasAbsence && "text-destructive opacity-70 line-through"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>{employee.first_name} {employee.last_name}</span>
                                                        {hasAbsence && (
                                                            <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                                                                {getAbsenceDescription(employee, selectedDate)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Absence Type */}
                            <div className="space-y-2">
                                <Label htmlFor="absenceType">Abwesenheitstyp</Label>
                                <Select
                                    value={absenceType}
                                    onValueChange={setAbsenceType}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Typ auswählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {absenceTypes?.map((type) => (
                                            <SelectItem key={type.id} value={type.id}>
                                                <div className="flex items-center space-x-2">
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: type.color }}
                                                    />
                                                    <span>{type.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Time Range (Optional) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="startTime">Startzeit (Optional)</Label>
                                    <input
                                        type="time"
                                        id="startTime"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endTime">Endzeit (Optional)</Label>
                                    <input
                                        type="time"
                                        id="endTime"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={onClose}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={modalType === 'shift' ? handleSave : handleAbsenceSave}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Speichern...' : 'Speichern'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
} 