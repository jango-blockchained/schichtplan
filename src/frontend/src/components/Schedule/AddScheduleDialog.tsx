import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
// Removed unused useQuery, useMutation, useQueryClient for now, can be added back if other parts need them
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { getEmployeeAvailabilityByDate, getApplicableShiftsForEmployee } from '@/services/api';
import { cn } from '@/lib/utils';
import { EmployeeAvailabilityStatus, ApplicableShift, AvailabilityTypeStrings } from '@/types';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

interface AddScheduleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAddSchedule: (scheduleData: {
        employee_id: number;
        date: string;
        shift_id: number;
        version: number;
        availability_type: AvailabilityTypeStrings | null;
    }) => Promise<void>;
    version: number;
    defaultDate?: Date;
    defaultEmployeeId?: number;
}

export function AddScheduleDialog({
    isOpen,
    onClose,
    onAddSchedule,
    version,
    defaultDate: initialDefaultDate, // Renamed to avoid conflict in useEffect
    defaultEmployeeId: initialDefaultEmployeeId, // Renamed
}: AddScheduleDialogProps) {
    const { toast } = useToast();

    const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDefaultDate || new Date());
    const [selectedShift, setSelectedShift] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [employeeStatusList, setEmployeeStatusList] = useState<EmployeeAvailabilityStatus[]>([]);
    const [isLoadingEmployeeStatus, setIsLoadingEmployeeStatus] = useState(false);
    
    const [applicableShiftsList, setApplicableShiftsList] = useState<ApplicableShift[]>([]);
    const [isLoadingApplicableShifts, setIsLoadingApplicableShifts] = useState(false);
    
    const [selectedAvailabilityType, setSelectedAvailabilityType] = useState<AvailabilityTypeStrings | null>(null);

    // Effect to reset and initialize state when dialog opens or default props change
    useEffect(() => {
        if (isOpen) {
            setSelectedDate(initialDefaultDate || new Date());
            // initialDefaultEmployeeId will be handled by the selectedDate change effect triggering employee load
            //setSelectedEmployee(initialDefaultEmployeeId || null); 
            setSelectedShift(null);
            setApplicableShiftsList([]);
            setSelectedAvailabilityType(null);
            // Employee list will be cleared and re-fetched by the selectedDate change effect
        } else {
            // Clear everything when closed to ensure fresh state on next open
            setSelectedDate(new Date());
            setSelectedEmployee(null);
            setSelectedShift(null);
            setEmployeeStatusList([]);
            setApplicableShiftsList([]);
            setSelectedAvailabilityType(null);
            setIsLoadingEmployeeStatus(false);
            setIsLoadingApplicableShifts(false);
            setIsSubmitting(false);
        }
    }, [isOpen, initialDefaultDate, initialDefaultEmployeeId]);

    // Fetch employee availability status when selectedDate changes (and dialog is open)
    useEffect(() => {
        if (selectedDate && isOpen) {
            setIsLoadingEmployeeStatus(true);
            setSelectedEmployee(null); // Reset employee when date changes
            setEmployeeStatusList([]);
            setSelectedShift(null); // Reset shift when date changes
            setApplicableShiftsList([]);
            setSelectedAvailabilityType(null);

            getEmployeeAvailabilityByDate(format(selectedDate, 'yyyy-MM-dd'))
                .then(data => {
                    setEmployeeStatusList(data);
                    // If there was a defaultEmployeeId and the date matches the initialDefaultDate,
                    // try to pre-select the employee if they are in the new list and available.
                    if (initialDefaultEmployeeId && initialDefaultDate && format(selectedDate, 'yyyy-MM-dd') === format(initialDefaultDate, 'yyyy-MM-dd')) {
                        const defaultEmp = data.find(emp => emp.employee_id === initialDefaultEmployeeId && emp.status === 'Available');
                        if (defaultEmp) {
                            setSelectedEmployee(initialDefaultEmployeeId);
                        }
                    }
                })
                .catch(error => {
                    console.error("Error fetching employee availability status:", error);
                    toast({
                        title: "Fehler",
                        description: `Mitarbeiterverfügbarkeit konnte nicht geladen werden: ${(error as Error).message}`,
                        variant: "destructive",
                    });
                    setEmployeeStatusList([]);
                })
                .finally(() => {
                    setIsLoadingEmployeeStatus(false);
                });
        } else if (!isOpen) {
            setEmployeeStatusList([]); // Clear list if dialog is closed
            setSelectedEmployee(null);
        }
    }, [selectedDate, isOpen, toast, initialDefaultDate, initialDefaultEmployeeId]);

    // Fetch applicable shifts when selectedDate or selectedEmployee changes (and dialog is open)
    useEffect(() => {
        if (selectedDate && selectedEmployee && isOpen) {
            setIsLoadingApplicableShifts(true);
            setSelectedShift(null); // Reset shift when employee/date changes
            setApplicableShiftsList([]);
            setSelectedAvailabilityType(null);

            getApplicableShiftsForEmployee(format(selectedDate, 'yyyy-MM-dd'), selectedEmployee)
                .then(data => {
                    setApplicableShiftsList(data);
                })
                .catch(error => {
                    console.error("Error fetching applicable shifts:", error);
                    toast({
                        title: "Fehler",
                        description: `Verfügbare Schichten konnten nicht geladen werden: ${(error as Error).message}`,
                        variant: "destructive",
                    });
                    setApplicableShiftsList([]);
                })
                .finally(() => {
                    setIsLoadingApplicableShifts(false);
                });
        } else {
            setApplicableShiftsList([]);
            setSelectedShift(null);
            setSelectedAvailabilityType(null);
        }
    }, [selectedDate, selectedEmployee, isOpen, toast]);

    const handleSubmit = async () => {
        if (!selectedEmployee || !selectedDate || !selectedShift || !selectedAvailabilityType) {
            toast({
                title: "Fehlende Eingabe",
                description: "Bitte wählen Sie Datum, Mitarbeiter und Schicht aus. Der Verfügbarkeitstyp wird automatisch ermittelt.",
                variant: "warning", // Changed from default to warning
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await onAddSchedule({
                employee_id: selectedEmployee,
                date: format(selectedDate, 'yyyy-MM-dd'),
                shift_id: selectedShift,
                version,
                availability_type: selectedAvailabilityType,
            });
            onClose(); // Close dialog on success
        } catch (error) {
            console.error('Error adding schedule:', error);
            toast({
                title: "Fehler beim Speichern",
                description: (error instanceof Error) ? error.message : "Ein unbekannter Fehler ist aufgetreten.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEmployeeChange = (value: string) => {
        const employeeId = value ? Number(value) : null;
        setSelectedEmployee(employeeId);
        // Shift selection will be reset by the useEffect watching selectedEmployee
    };

    const handleShiftChange = (value: string) => {
        const shiftId = value ? Number(value) : null;
        setSelectedShift(shiftId);
        if (shiftId) {
            const chosenShift = applicableShiftsList.find(s => s.shift_id === shiftId);
            setSelectedAvailabilityType(chosenShift ? chosenShift.availability_type : null);
        } else {
            setSelectedAvailabilityType(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Neuen Schichtplan hinzufügen</DialogTitle>
                    <DialogDescription>
                        Fügen Sie einen neuen Schichtplan für einen Mitarbeiter hinzu.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Date Input */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date-picker" className="text-right">
                            Datum
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date-picker" // Ensure unique id if Label's htmlFor is used
                                    variant="outline"
                                    className={cn(
                                        "col-span-3 justify-start text-left font-normal",
                                        !selectedDate && "text-muted-foreground"
                                    )}
                                    disabled={isSubmitting}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, 'dd.MM.yyyy') : <span>Datum auswählen</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    {/* Employee Input */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="employee-select" className="text-right">
                            Mitarbeiter
                        </Label>
                        <Select
                            value={selectedEmployee?.toString() || ''}
                            onValueChange={handleEmployeeChange}
                            disabled={isLoadingEmployeeStatus || !selectedDate || isSubmitting}
                        >
                            <SelectTrigger className="col-span-3" id="employee-select">
                                <SelectValue placeholder={isLoadingEmployeeStatus ? "Lädt Mitarbeiter..." : ( !selectedDate ? "Bitte Datum wählen" : "Mitarbeiter auswählen")} />
                            </SelectTrigger>
                            <SelectContent>
                                {isLoadingEmployeeStatus && <div className="p-2 text-sm text-muted-foreground text-center">Lädt Mitarbeiter...</div>}
                                {!isLoadingEmployeeStatus && selectedDate && employeeStatusList.length === 0 && 
                                    <div className="p-2 text-sm text-muted-foreground text-center">Keine Mitarbeiter für dieses Datum.</div>}
                                {employeeStatusList.map((empStatus) => (
                                    <SelectItem 
                                        key={empStatus.employee_id} 
                                        value={empStatus.employee_id.toString()}
                                        disabled={empStatus.status !== 'Available'} 
                                    >
                                        {empStatus.employee_name} 
                                        <span className={cn(
                                            "text-xs opacity-80 ml-2",
                                            empStatus.status !== 'Available' && "text-red-500"
                                        )}>
                                            ({empStatus.status})
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Shift Input */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="shift-select" className="text-right">
                            Schicht
                        </Label>
                        <Select
                            value={selectedShift?.toString() || ''}
                            onValueChange={handleShiftChange}
                            disabled={isLoadingApplicableShifts || !selectedEmployee || isSubmitting}
                        >
                            <SelectTrigger className="col-span-3" id="shift-select">
                                <SelectValue placeholder={isLoadingApplicableShifts ? "Lädt Schichten..." : (!selectedEmployee ? "Bitte Mitarbeiter wählen" : "Schicht auswählen")} />
                            </SelectTrigger>
                            <SelectContent>
                                {isLoadingApplicableShifts && <div className="p-2 text-sm text-muted-foreground text-center">Lädt Schichten...</div>}
                                {!isLoadingApplicableShifts && selectedEmployee && applicableShiftsList.length === 0 && 
                                    <div className="p-2 text-sm text-muted-foreground text-center">Keine Schichten für diesen Mitarbeiter an diesem Tag.</div>}
                                {applicableShiftsList.map((shift) => (
                                    <SelectItem key={shift.shift_id} value={shift.shift_id.toString()}>
                                        {shift.name} ({shift.start_time} - {shift.end_time}) 
                                        <span className="text-xs opacity-80 ml-2">({shift.availability_type})</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedEmployee || !selectedDate || !selectedShift || !selectedAvailabilityType || isSubmitting || isLoadingEmployeeStatus || isLoadingApplicableShifts}
                    >
                        {isSubmitting ? 'Speichert...' : 'Speichern'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 