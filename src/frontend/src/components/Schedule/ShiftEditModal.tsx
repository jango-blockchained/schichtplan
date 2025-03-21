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
    const { toast } = useToast();
    const [modalType, setModalType] = useState<ModalType>('shift');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(schedule.employee_id?.toString() || '');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(
        schedule.date ? new Date(schedule.date) : undefined
    );
    const [selectedShiftId, setSelectedShiftId] = useState<string>(schedule.shift_id?.toString() || '');
    const [customStartTime, setCustomStartTime] = useState<string>(schedule.shift_start || '09:00');
    const [customEndTime, setCustomEndTime] = useState<string>(schedule.shift_end || '17:00');
    const [breakDuration, setBreakDuration] = useState<number>(schedule.break_duration || 0);
    const [notes, setNotes] = useState<string>(schedule.notes || '');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [absenceTypeId, setAbsenceTypeId] = useState<string>('');
    const [isCustomShift, setIsCustomShift] = useState<boolean>(!schedule.shift_id);
    const [availableShifts, setAvailableShifts] = useState<any[]>([]);
    const [isCheckingAvailability, setIsCheckingAvailability] = useState<boolean>(false);
    const [selectedAbsenceType, setSelectedAbsenceType] = useState<AbsenceType | null>(null);

    // Fetch employees data
    const { data: employees } = useQuery({
        queryKey: ['employees'],
        queryFn: getEmployees,
    });

    // Fetch shifts data
    const { data: shifts } = useQuery({
        queryKey: ['shifts'],
        queryFn: getShifts,
    });

    // Fetch absence types
    const { data: absenceTypes } = useQuery({
        queryKey: ['absenceTypes'],
        queryFn: getAbsenceTypes,
    });

    // Find the selected employee based on ID
    const selectedEmployee = employees?.find((emp) => emp.id === Number(selectedEmployeeId));

    // Function to check if an employee has an absence for the selected date
    const hasAbsenceForDate = (employeeId: string, date: Date): boolean => {
        // This is a placeholder function - in a real app you would check your absence data
        // For example, you might have a query to get absences and check if this date is in the range

        // For demo purposes, let's just return false
        // In your actual implementation, you would:
        // 1. Query your absence data for the given employee and date
        // 2. Check if there's an overlap

        return false;
    };

    // When the modal opens, check if the employee is available
    useEffect(() => {
        if (isOpen && selectedEmployeeId && selectedDate) {
            checkEmployeeAvailability();
        }

        // Subscribe to real-time events (optional - for WebSocket updates)
        subscribeToEvents('shift_availability_changed', handleEvent);

        return () => {
            // Clean up by unsubscribing
            unsubscribeFromEvents('shift_availability_changed', handleEvent);
        };
    }, [isOpen, selectedEmployeeId, selectedDate]);

    // Get a description of any absence for the selected employee and date
    const getAbsenceDescription = (employee: Employee, date?: Date): string => {
        if (!date) return '';

        // This is a placeholder - in a real app, you would fetch absence data
        // and return a description if one exists

        // Example:
        // const absence = absences.find(a => 
        //     a.employeeId === employee.id && 
        //     new Date(a.startDate) <= date &&
        //     new Date(a.endDate) >= date
        // );

        // if (absence) {
        //     return `${absence.type}: ${absence.reason}`;
        // }

        return '';
    };

    // When employee or date changes, update available shifts
    useEffect(() => {
        if (selectedEmployeeId && selectedDate) {
            updateAvailableShifts();
        }
    }, [selectedEmployeeId, selectedDate]);

    // Function to check employee availability
    const checkEmployeeAvailability = async () => {
        if (!selectedEmployeeId || !selectedDate) return;

        setIsCheckingAvailability(true);

        try {
            // Check if the employee is available for the selected date
            const response = await checkAvailability({
                employee_id: Number(selectedEmployeeId),
                date: format(selectedDate, 'yyyy-MM-dd'),
            });

            // If not available, show a warning
            if (!response.available) {
                toast({
                    title: "Availability Warning",
                    description: response.reason || "Employee may not be available for this date",
                    variant: "destructive",
                });
            }

            // Update available shifts based on response
            if (response.available_shifts) {
                setAvailableShifts(response.available_shifts);
            }

        } catch (error) {
            console.error("Error checking availability:", error);
            toast({
                title: "Error",
                description: "Failed to check employee availability",
                variant: "destructive",
            });
        } finally {
            setIsCheckingAvailability(false);
        }
    };

    // Handler for employee selection changes
    const handleEmployeeChange = (value: string) => {
        setSelectedEmployeeId(value);

        // Check if this employee has an absence for the selected date
        if (selectedDate && hasAbsenceForDate(value, selectedDate)) {
            toast({
                title: "Absence Alert",
                description: "This employee has an absence recorded for this date",
                variant: "destructive",
            });
        }

        // Check availability for the new employee
        if (selectedDate) {
            checkEmployeeAvailability();
        }
    };

    // Handler for date selection changes
    const handleDateChange = (date: Date | undefined) => {
        if (!date) return;

        setSelectedDate(date);

        // Check if the selected employee has an absence for this date
        if (selectedEmployeeId && hasAbsenceForDate(selectedEmployeeId, date)) {
            toast({
                title: "Absence Alert",
                description: "This employee has an absence recorded for this date",
                variant: "destructive",
            });
        }

        // Check availability for the new date
        if (selectedEmployeeId) {
            checkEmployeeAvailability();
        }
    };

    // Keep shifts updated when availability changes
    useEffect(() => {
        // Function to update available shifts
        const updateAvailableShifts = async () => {
            if (!selectedEmployeeId || !selectedDate) return;

            setIsCheckingAvailability(true);

            try {
                // This would be a call to your backend to get available shifts
                // for this employee on this date
                const response = await checkBulkAvailability({
                    employee_ids: [Number(selectedEmployeeId)],
                    date: format(selectedDate, 'yyyy-MM-dd'),
                });

                if (response && response.length > 0) {
                    const employeeData = response[0];
                    if (employeeData.available_shifts) {
                        setAvailableShifts(employeeData.available_shifts);
                    }
                }

            } catch (error) {
                console.error("Error updating available shifts:", error);
            } finally {
                setIsCheckingAvailability(false);
            }
        };

        updateAvailableShifts();
    }, [selectedEmployeeId, selectedDate]);

    // WebSocket or EventSource handler for real-time updates
    useEffect(() => {
        const handleEvent = (eventType: string, data: unknown) => {
            // Only handle events related to shift availability
            if (eventType !== 'shift_availability_changed') return;

            // Type assertion for the event data
            const availabilityData = data as {
                employee_id: number;
                date: string;
                available_shifts: any[];
            };

            // Check if this event is relevant to our current state
            if (
                availabilityData.employee_id === Number(selectedEmployeeId) &&
                availabilityData.date === format(selectedDate!, 'yyyy-MM-dd')
            ) {
                // Update our available shifts
                setAvailableShifts(availabilityData.available_shifts);

                // Notify the user
                toast({
                    title: "Availability Updated",
                    description: "Shift availability has been updated",
                });
            }
        };

        // Register event handler here (implementation depends on your setup)

        // Clean up function
        return () => {
            // Unregister event handler
        };
    }, [selectedEmployeeId, selectedDate]);

    // Handle saving the shift
    const handleSave = async () => {
        if (!selectedEmployeeId || !selectedDate) {
            toast({
                title: "Error",
                description: "Please select an employee and date",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const updates: ScheduleUpdate = {
                employee_id: Number(selectedEmployeeId),
                date: format(selectedDate, 'yyyy-MM-dd'),
                notes: notes,
                break_duration: breakDuration
            };

            // If using a predefined shift
            if (!isCustomShift && selectedShiftId) {
                updates.shift_id = Number(selectedShiftId);
            }
            // If using custom times
            else {
                updates.shift_start = customStartTime;
                updates.shift_end = customEndTime;
                // Clear the shift_id to indicate custom times
                updates.shift_id = null;
            }

            await onSave(schedule.id, updates);

            toast({
                title: "Success",
                description: "Shift has been saved successfully",
            });

            onClose();
        } catch (error) {
            console.error("Error saving shift:", error);
            toast({
                title: "Error",
                description: "Failed to save the shift",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle saving an absence
    const handleAbsenceSave = async () => {
        if (!selectedEmployeeId || !selectedDate || !absenceTypeId) {
            toast({
                title: "Error",
                description: "Please fill all required fields",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Create the absence
            await createAbsence({
                employee_id: Number(selectedEmployeeId),
                start_date: format(selectedDate, 'yyyy-MM-dd'),
                end_date: format(selectedDate, 'yyyy-MM-dd'),
                absence_type_id: absenceTypeId,
                notes: notes,
                start_time: customStartTime,
                end_time: customEndTime
            });

            toast({
                title: "Success",
                description: "Absence has been recorded successfully",
            });

            onClose();
        } catch (error) {
            console.error("Error saving absence:", error);
            toast({
                title: "Error",
                description: "Failed to record the absence",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {modalType === 'shift' ? 'Edit Shift' : 'Record Absence'}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex space-x-2 mb-4">
                    <Button
                        variant={modalType === 'shift' ? "default" : "outline"}
                        onClick={() => setModalType('shift')}
                        className="flex-1"
                    >
                        Shift
                    </Button>
                    <Button
                        variant={modalType === 'absence' ? "default" : "outline"}
                        onClick={() => setModalType('absence')}
                        className="flex-1"
                    >
                        Absence
                    </Button>
                </div>

                <div className="space-y-4">
                    {/* Employee selection - common to both modes */}
                    <div className="space-y-2">
                        <Label htmlFor="employee">Employee</Label>
                        <Select
                            value={selectedEmployeeId.toString()}
                            onValueChange={handleEmployeeChange}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees?.map((employee) => (
                                    <SelectItem key={employee.id} value={employee.id.toString()}>
                                        {employee.first_name} {employee.last_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date picker - common to both modes */}
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !selectedDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, "PPP") : "Select date"}
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

                    {/* Show absence notice if applicable */}
                    {selectedEmployee && selectedDate && getAbsenceDescription(selectedEmployee, selectedDate) && (
                        <div className="bg-red-50 p-2 rounded border border-red-200 text-red-800 text-sm">
                            {getAbsenceDescription(selectedEmployee, selectedDate)}
                        </div>
                    )}

                    {/* Shift-specific fields */}
                    {modalType === 'shift' && (
                        <>
                            {/* Shift selection vs custom times toggle */}
                            <div className="flex space-x-2">
                                <Button
                                    variant={!isCustomShift ? "default" : "outline"}
                                    onClick={() => setIsCustomShift(false)}
                                    className="flex-1"
                                >
                                    Predefined Shift
                                </Button>
                                <Button
                                    variant={isCustomShift ? "default" : "outline"}
                                    onClick={() => setIsCustomShift(true)}
                                    className="flex-1"
                                >
                                    Custom Times
                                </Button>
                            </div>

                            {!isCustomShift ? (
                                <div className="space-y-2">
                                    <Label htmlFor="shift">Shift</Label>
                                    <Select
                                        value={selectedShiftId}
                                        onValueChange={setSelectedShiftId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select shift" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {shifts?.map((shift) => (
                                                <SelectItem
                                                    key={shift.id}
                                                    value={shift.id.toString()}
                                                    disabled={availableShifts.length > 0 && !availableShifts.some(s => s.id === shift.id)}
                                                >
                                                    {shift.name} ({shift.start_time} - {shift.end_time})
                                                    {availableShifts.length > 0 && !availableShifts.some(s => s.id === shift.id) &&
                                                        " - Not Available"}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="flex space-x-4">
                                    <div className="space-y-2 flex-1">
                                        <Label htmlFor="startTime">Start Time</Label>
                                        <input
                                            type="time"
                                            id="startTime"
                                            value={customStartTime}
                                            onChange={(e) => setCustomStartTime(e.target.value)}
                                            className="w-full px-3 py-2 border rounded"
                                        />
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <Label htmlFor="endTime">End Time</Label>
                                        <input
                                            type="time"
                                            id="endTime"
                                            value={customEndTime}
                                            onChange={(e) => setCustomEndTime(e.target.value)}
                                            className="w-full px-3 py-2 border rounded"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Break duration slider */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label htmlFor="breakDuration">Break Duration (minutes)</Label>
                                    <span>{breakDuration} min</span>
                                </div>
                                <Slider
                                    id="breakDuration"
                                    value={[breakDuration]}
                                    onValueChange={(values) => setBreakDuration(values[0])}
                                    max={120}
                                    step={5}
                                />
                            </div>
                        </>
                    )}

                    {/* Absence-specific fields */}
                    {modalType === 'absence' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="absenceType">Absence Type</Label>
                                <Select
                                    value={absenceTypeId}
                                    onValueChange={setAbsenceTypeId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {absenceTypes?.map((type) => (
                                            <SelectItem key={type.id} value={type.id}>
                                                {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex space-x-4">
                                <div className="space-y-2 flex-1">
                                    <Label htmlFor="absStartTime">Start Time</Label>
                                    <input
                                        type="time"
                                        id="absStartTime"
                                        value={customStartTime}
                                        onChange={(e) => setCustomStartTime(e.target.value)}
                                        className="w-full px-3 py-2 border rounded"
                                    />
                                </div>
                                <div className="space-y-2 flex-1">
                                    <Label htmlFor="absEndTime">End Time</Label>
                                    <input
                                        type="time"
                                        id="absEndTime"
                                        value={customEndTime}
                                        onChange={(e) => setCustomEndTime(e.target.value)}
                                        className="w-full px-3 py-2 border rounded"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Notes - common to both modes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any additional notes"
                            className="min-h-20"
                        />
                    </div>

                    {/* Availability checking indicator */}
                    {isCheckingAvailability && (
                        <div className="flex items-center justify-center text-sm text-blue-600">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Checking availability...
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={modalType === 'shift' ? handleSave : handleAbsenceSave}
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 