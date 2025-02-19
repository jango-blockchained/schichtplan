import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { getSettings, updateEmployeeAvailability, getEmployeeAvailabilities } from '@/services/api';
import { cn } from '@/lib/utils';

interface EmployeeAvailabilityModalProps {
    employeeId: number;
    employeeName: string;
    isOpen: boolean;
    onClose: () => void;
}

type TimeSlot = {
    time: string;
    days: { [key: string]: boolean };
};

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const TIME_FORMAT = 'HH:mm';

export const EmployeeAvailabilityModal: React.FC<EmployeeAvailabilityModalProps> = ({
    employeeId,
    employeeName,
    isOpen,
    onClose,
}) => {
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<string | null>(null);

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
    });

    const { data: availabilities, refetch: refetchAvailabilities } = useQuery({
        queryKey: ['employee-availabilities', employeeId],
        queryFn: () => getEmployeeAvailabilities(employeeId),
    });

    useEffect(() => {
        if (settings) {
            const { store_opening, store_closing } = settings.general;
            const [startHour] = store_opening.split(':').map(Number);
            const [endHour] = store_closing.split(':').map(Number);

            const slots: TimeSlot[] = [];
            for (let hour = startHour; hour <= endHour; hour++) {
                slots.push({
                    time: format(new Date().setHours(hour, 0), TIME_FORMAT),
                    days: DAYS.reduce((acc, day) => ({ ...acc, [day]: false }), {}),
                });
            }
            setTimeSlots(slots);
        }
    }, [settings]);

    useEffect(() => {
        if (availabilities) {
            const newSelectedCells = new Set<string>();
            availabilities.forEach(availability => {
                const day = DAYS[new Date(availability.date).getDay()];
                const time = format(new Date(availability.date).setHours(availability.hour), TIME_FORMAT);
                newSelectedCells.add(`${day}-${time}`);
            });
            setSelectedCells(newSelectedCells);
        }
    }, [availabilities]);

    const handleCellMouseDown = (day: string, time: string) => {
        setIsDragging(true);
        const cellId = `${day}-${time}`;
        setDragStart(cellId);
        toggleCell(cellId);
    };

    const handleCellMouseEnter = (day: string, time: string) => {
        if (isDragging && dragStart) {
            const cellId = `${day}-${time}`;
            toggleCell(cellId);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragStart(null);
    };

    const toggleCell = (cellId: string) => {
        const newSelectedCells = new Set(selectedCells);
        if (newSelectedCells.has(cellId)) {
            newSelectedCells.delete(cellId);
        } else {
            newSelectedCells.add(cellId);
        }
        setSelectedCells(newSelectedCells);
    };

    const handleSave = async () => {
        const availabilityData = Array.from(selectedCells).map(cellId => {
            const [day, time] = cellId.split('-');
            const dayIndex = DAYS.indexOf(day);
            const [hour] = time.split(':').map(Number);

            return {
                employee_id: employeeId,
                day_of_week: dayIndex,
                hour: hour,
                is_available: true,
            };
        });

        await updateEmployeeAvailability(employeeId, availabilityData);
        await refetchAvailabilities();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl" onMouseUp={handleMouseUp}>
                <DialogHeader>
                    <DialogTitle>Verfügbarkeit für {employeeName}</DialogTitle>
                </DialogHeader>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-24">Zeit</TableHead>
                                {DAYS.map(day => (
                                    <TableHead key={day}>{day}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {timeSlots.map(({ time }) => (
                                <TableRow key={time}>
                                    <TableCell className="font-medium">{time}</TableCell>
                                    {DAYS.map(day => (
                                        <TableCell
                                            key={`${day}-${time}`}
                                            className={cn(
                                                'cursor-pointer select-none transition-colors',
                                                selectedCells.has(`${day}-${time}`)
                                                    ? 'bg-primary hover:bg-primary/90'
                                                    : 'hover:bg-muted'
                                            )}
                                            onMouseDown={() => handleCellMouseDown(day, time)}
                                            onMouseEnter={() => handleCellMouseEnter(day, time)}
                                        />
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Abbrechen
                    </Button>
                    <Button onClick={handleSave}>
                        Speichern
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 