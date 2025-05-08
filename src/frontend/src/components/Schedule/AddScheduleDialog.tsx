import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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
import { getEmployees, getShifts, type Shift } from '@/services/api';
import { cn } from '@/lib/utils';
import { Employee, Schedule } from '@/types';
import { Label } from '@/components/ui/label';

interface AddScheduleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAddSchedule: (scheduleData: {
        employee_id: number;
        date: string;
        shift_id: number;
        version: number;
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
    defaultDate = new Date(),
    defaultEmployeeId,
}: AddScheduleDialogProps) {
    const [selectedEmployee, setSelectedEmployee] = useState<number | null>(defaultEmployeeId || null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(defaultDate);
    const [selectedShift, setSelectedShift] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Update selected employee when defaultEmployeeId changes
    useEffect(() => {
        if (defaultEmployeeId) {
            setSelectedEmployee(defaultEmployeeId);
        }
    }, [defaultEmployeeId]);

    // Update selected date when defaultDate changes
    useEffect(() => {
        if (defaultDate) {
            setSelectedDate(defaultDate);
        }
    }, [defaultDate]);

    // Query for employees
    const employeesQuery = useQuery<Employee[], Error>({
        queryKey: ['employees'],
        queryFn: async () => {
            const employees = await getEmployees();
            return employees;
        },
    });

    // Query for shifts
    const shiftsQuery = useQuery<Shift[], Error>({
        queryKey: ['shifts'],
        queryFn: async () => {
            const shifts = await getShifts();
            return shifts;
        },
    });

    const handleSubmit = async () => {
        if (!selectedEmployee || !selectedDate || !selectedShift) {
            return;
        }

        setIsSubmitting(true);
        try {
            await onAddSchedule({
                employee_id: selectedEmployee,
                date: format(selectedDate, 'yyyy-MM-dd'),
                shift_id: selectedShift,
                version,
            });
            onClose();
        } catch (error) {
            console.error('Error adding schedule:', error);
        } finally {
            setIsSubmitting(false);
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
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="employee" className="text-right">
                            Mitarbeiter
                        </Label>
                        <Select
                            value={selectedEmployee?.toString() || ''}
                            onValueChange={(value) => setSelectedEmployee(Number(value))}
                        >
                            <SelectTrigger className="col-span-3" id="employee">
                                <SelectValue placeholder="Mitarbeiter auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                                {employeesQuery.isLoading && <SelectItem value="loading">Lädt...</SelectItem>}
                                {employeesQuery.data?.map((employee) => (
                                    <SelectItem key={employee.id} value={employee.id.toString()}>
                                        {employee.first_name} {employee.last_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">
                            Datum
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant="outline"
                                    className={cn(
                                        "col-span-3 justify-start text-left font-normal",
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
                                    onSelect={setSelectedDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="shift" className="text-right">
                            Schicht
                        </Label>
                        <Select
                            value={selectedShift?.toString() || ''}
                            onValueChange={(value) => setSelectedShift(Number(value))}
                        >
                            <SelectTrigger className="col-span-3" id="shift">
                                <SelectValue placeholder="Schicht auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                                {shiftsQuery.isLoading && <SelectItem value="loading">Lädt...</SelectItem>}
                                {shiftsQuery.data?.map((shift) => (
                                    <SelectItem key={shift.id} value={shift.id.toString()}>
                                        {shift.start_time} - {shift.end_time} ({shift.duration_hours}h)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedEmployee || !selectedDate || !selectedShift || isSubmitting}
                    >
                        {isSubmitting ? 'Speichert...' : 'Speichern'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 