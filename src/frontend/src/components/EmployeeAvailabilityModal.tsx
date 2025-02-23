import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check } from 'lucide-react';
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
import { getSettings, updateEmployeeAvailability, getEmployeeAvailabilities, EmployeeAvailability } from '@/services/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { AvailabilityTypeSelect } from './AvailabilityTypeSelect';

interface EmployeeAvailabilityModalProps {
    employeeId: number;
    employeeName: string;
    employeeGroup: string;
    contractedHours: number;
    isOpen: boolean;
    onClose: () => void;
}

type TimeSlot = {
    time: string;
    hour: number;
    days: { [key: string]: boolean };
};

type CellState = {
    selected: boolean;
    type: string;
};

// Define days starting with Monday (1) to Sunday (7)
const ALL_DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const TIME_FORMAT = 'HH:mm';

// Helper function to convert backend day index (0=Sunday) to frontend index (0=Monday)
const convertBackendDayToFrontend = (backendDay: number): number => {
    return (backendDay + 6) % 7; // Shifts Sunday (0) to position 6
};

// Helper function to convert frontend day index (0=Monday) to backend index (0=Sunday)
const convertFrontendDayToBackend = (frontendDay: number): number => {
    return (frontendDay + 1) % 7; // Shifts Monday (0) to position 1
};

export const EmployeeAvailabilityModal: React.FC<EmployeeAvailabilityModalProps> = ({
    employeeId,
    employeeName,
    employeeGroup,
    contractedHours,
    isOpen,
    onClose,
}) => {
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [selectedCells, setSelectedCells] = useState<Map<string, string>>(new Map());
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<string | null>(null);
    const [dailyHours, setDailyHours] = useState<{ [key: string]: number }>({});
    const [weeklyHours, setWeeklyHours] = useState(0);
    const [activeDays, setActiveDays] = useState<string[]>([]);
    const [currentType, setCurrentType] = useState<string>('AVL');

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
    });

    const { data: availabilities, refetch: refetchAvailabilities } = useQuery({
        queryKey: ['employee-availabilities', employeeId],
        queryFn: () => getEmployeeAvailabilities(employeeId),
    });

    useEffect(() => {
        // Initialize with empty selection and hours immediately
        setSelectedCells(new Map());
        setDailyHours({});
        setWeeklyHours(0);

        if (settings) {
            // Convert opening days from backend format (0=Sunday) to frontend format (0=Monday)
            const activeWeekDays = ALL_DAYS.filter((_, frontendIndex) => {
                const backendIndex = convertFrontendDayToBackend(frontendIndex);
                return settings.general.opening_days[backendIndex.toString()];
            });

            setActiveDays(activeWeekDays);

            const { store_opening, store_closing } = settings.general;
            const [startHour] = store_opening.split(':').map(Number);
            const [endHour] = store_closing.split(':').map(Number);

            const slots: TimeSlot[] = [];
            for (let hour = startHour; hour < endHour; hour++) {
                const nextHour = hour + 1;
                slots.push({
                    time: `${format(new Date().setHours(hour, 0), TIME_FORMAT)} - ${format(new Date().setHours(nextHour, 0), TIME_FORMAT)}`,
                    hour: hour,
                    days: activeWeekDays.reduce((acc, day) => ({ ...acc, [day]: false }), {}),
                });
            }
            setTimeSlots(slots);
        }
    }, [settings]);

    useEffect(() => {
        if (!activeDays.length) return;

        const dayHours: { [key: string]: number } = {};
        activeDays.forEach(day => {
            dayHours[day] = 0;
        });
        setDailyHours(dayHours);

        if (availabilities) {
            const newSelectedCells = new Map<string, string>();
            availabilities.forEach(availability => {
                const frontendDayIndex = convertBackendDayToFrontend(availability.day_of_week);
                const day = ALL_DAYS[frontendDayIndex];

                if (activeDays.includes(day)) {
                    const hour = format(new Date().setHours(availability.hour, 0), TIME_FORMAT);
                    const nextHour = format(new Date().setHours(availability.hour + 1, 0), TIME_FORMAT);
                    const cellId = `${day}-${hour} - ${nextHour}`;
                    newSelectedCells.set(cellId, availability.availability_type || 'AVL');
                }
            });
            setSelectedCells(newSelectedCells);
            calculateHours(newSelectedCells);
        }
    }, [availabilities, activeDays]);

    const calculateHours = (cells: Map<string, string>) => {
        if (!activeDays.length) return;

        const dayHours: { [key: string]: number } = {};
        activeDays.forEach(day => {
            dayHours[day] = 0;
        });

        Array.from(cells.keys()).forEach(cellId => {
            const dayMatch = cellId.match(/^([^-]+)-/);
            if (dayMatch && dayMatch[1] && dayHours.hasOwnProperty(dayMatch[1])) {
                dayHours[dayMatch[1]]++;
            }
        });

        const totalHours = Object.values(dayHours).reduce((sum, hours) => sum + hours, 0);

        setDailyHours(dayHours);
        setWeeklyHours(totalHours);
    };

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
        const newSelectedCells = new Map(selectedCells);
        if (newSelectedCells.has(cellId)) {
            newSelectedCells.delete(cellId);
        } else {
            newSelectedCells.set(cellId, currentType);
        }
        setSelectedCells(newSelectedCells);
        calculateHours(newSelectedCells);
    };

    const handleSelectAll = () => {
        const newSelectedCells = new Map<string, string>();
        timeSlots.forEach(({ time }) => {
            activeDays.forEach(day => {
                newSelectedCells.set(`${day}-${time}`, currentType);
            });
        });
        setSelectedCells(newSelectedCells);
        calculateHours(newSelectedCells);
    };

    const handleDeselectAll = () => {
        setSelectedCells(new Map());
        calculateHours(new Map());
    };

    const handleToggleDay = (day: string) => {
        const newSelectedCells = new Map(selectedCells);
        const isDaySelected = timeSlots.every(({ time }) =>
            newSelectedCells.has(`${day}-${time}`)
        );

        timeSlots.forEach(({ time }) => {
            const cellId = `${day}-${time}`;
            if (isDaySelected) {
                newSelectedCells.delete(cellId);
            } else {
                newSelectedCells.set(cellId, currentType);
            }
        });

        setSelectedCells(newSelectedCells);
        calculateHours(newSelectedCells);
    };

    const handleSave = async () => {
        const availabilityData = Array.from(selectedCells.entries()).map(([cellId, type]) => {
            const [day, timeRange] = cellId.split('-');
            const frontendDayIndex = ALL_DAYS.indexOf(day);
            const backendDayIndex = convertFrontendDayToBackend(frontendDayIndex);
            const [startTime] = timeRange.trim().split(' - ');
            const [hour] = startTime.split(':').map(Number);

            return {
                employee_id: employeeId,
                day_of_week: backendDayIndex,
                hour: hour,
                is_available: true,
                availability_type: type
            };
        });

        await updateEmployeeAvailability(employeeId, availabilityData);
        await refetchAvailabilities();
        onClose();
    };

    const getCellColor = (cellId: string) => {
        if (!selectedCells.has(cellId)) return '';
        const type = selectedCells.get(cellId);
        const availabilityType = settings?.availability_types?.types.find(t => t.id === type);
        return availabilityType?.color || '#22c55e';
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl" onMouseUp={handleMouseUp}>
                <DialogHeader>
                    <DialogTitle>Verfügbarkeit für {employeeName}</DialogTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{employeeGroup}</Badge>
                        <span>Vertragsstunden: {contractedHours}h/Woche</span>
                        <span>Mögliche Stunden: {weeklyHours}h/Woche</span>
                    </div>
                </DialogHeader>
                <div className="flex justify-between items-center mb-4">
                    <AvailabilityTypeSelect
                        value={currentType}
                        onChange={setCurrentType}
                    />
                    <div className="flex space-x-2">
                        <Button variant="outline" onClick={handleSelectAll}>
                            Alle auswählen
                        </Button>
                        <Button variant="outline" onClick={handleDeselectAll}>
                            Alle abwählen
                        </Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-24">Zeit</TableHead>
                                {activeDays.map(day => (
                                    <TableHead key={day} className="text-center">
                                        <Button
                                            variant="ghost"
                                            className="w-full"
                                            onClick={() => handleToggleDay(day)}
                                        >
                                            <div>
                                                {day}
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {dailyHours[day] || 0}h
                                                </div>
                                            </div>
                                        </Button>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {timeSlots.map(({ time }) => (
                                <TableRow key={time}>
                                    <TableCell className="font-medium">{time}</TableCell>
                                    {activeDays.map(day => {
                                        const cellId = `${day}-${time}`;
                                        return (
                                            <TableCell
                                                key={cellId}
                                                className={cn(
                                                    'cursor-pointer select-none transition-colors text-center',
                                                    selectedCells.has(cellId)
                                                        ? 'hover:brightness-90'
                                                        : 'hover:bg-muted'
                                                )}
                                                style={{
                                                    backgroundColor: getCellColor(cellId)
                                                }}
                                                onMouseDown={() => handleCellMouseDown(day, time)}
                                                onMouseEnter={() => handleCellMouseEnter(day, time)}
                                            >
                                                {selectedCells.has(cellId) && (
                                                    <Check className="h-4 w-4 mx-auto text-white" />
                                                )}
                                            </TableCell>
                                        );
                                    })}
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