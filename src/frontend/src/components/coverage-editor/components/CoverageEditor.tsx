import React, { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, PencilIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { CoverageEditorProps, DailyCoverage } from '../types';
import { DAYS_SHORT, GRID_CONSTANTS } from '../utils/constants';
import { DayRow } from './DayRow';
import { timeToMinutes, minutesToTime } from '../utils/time';

const { TIME_COLUMN_WIDTH, TIME_ROW_HEIGHT, HEADER_HEIGHT } = GRID_CONSTANTS;

export const CoverageEditor: React.FC<CoverageEditorProps> = ({ initialCoverage, storeConfig, onChange }) => {
    const { toast } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [gridWidth, setGridWidth] = useState(0);

    // Calculate opening days from settings
    const openingDays = React.useMemo(() => {
        return Object.entries(storeConfig.opening_days)
            .filter(([_, isOpen]) => isOpen)
            .map(([dayIndex]) => Number(dayIndex))
            .sort((a, b) => a - b);
    }, [storeConfig.opening_days]);

    // Calculate hours array
    const hours = React.useMemo(() => {
        // Ensure we have valid store hours
        if (!storeConfig?.store_opening || !storeConfig?.store_closing) {
            return ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
        }

        const [openingHour, openingMinute] = storeConfig.store_opening.split(':').map(Number);
        const [closingHour, closingMinute] = storeConfig.store_closing.split(':').map(Number);

        // Calculate the number of hours needed (including partial hours)
        const totalHours = closingHour - openingHour + (closingMinute >= openingMinute ? 1 : 0);

        return Array.from({ length: totalHours }, (_, i) => {
            const hour = (openingHour + i).toString().padStart(2, '0');
            return `${hour}:00`;
        });
    }, [storeConfig?.store_opening, storeConfig?.store_closing]);

    // Initialize coverage state
    const [coverage, setCoverage] = useState<DailyCoverage[]>(() => {
        const defaultCoverage = Array.from({ length: 7 }, (_, index) => ({
            dayIndex: index,
            timeSlots: []
        }));

        if (initialCoverage) {
            return defaultCoverage.map((defaultDay) => {
                const initialDay = initialCoverage.find(day => day.dayIndex === defaultDay.dayIndex);
                return initialDay || defaultDay;
            });
        }

        return defaultCoverage;
    });

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setGridWidth(containerRef.current.offsetWidth);
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const handleAddSlot = (dayIndex: number, hour: number) => {
        const storeOpeningHour = parseInt(storeConfig.store_opening.split(':')[0]);
        const storeClosingHour = parseInt(storeConfig.store_closing.split(':')[0]);
        const storeOpeningMinutes = parseInt(storeConfig.store_opening.split(':')[1]);
        const storeClosingMinutes = parseInt(storeConfig.store_closing.split(':')[1]);

        // Get the hour from the hours array
        const hourString = hours[hour];
        const startHour = parseInt(hourString.split(':')[0]);
        const startMinutes = parseInt(hourString.split(':')[1] || '0');

        // Calculate start time
        const startTime = `${startHour.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;

        // Calculate end time - either next hour or store closing time
        const endHour = Math.min(startHour + 1, storeClosingHour);
        const endMinutes = endHour === storeClosingHour ? storeClosingMinutes : startMinutes;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

        if (startHour >= storeClosingHour) {
            return; // Don't add slots outside opening hours
        }

        // Determine if this is an opening or closing shift
        const isEarlyShift = startTime === storeConfig.store_opening;
        const isLateShift = endTime === storeConfig.store_closing;

        const newCoverage = [...coverage];
        const newSlot = {
            startTime,
            endTime,
            minEmployees: storeConfig.min_employees_per_shift,
            maxEmployees: storeConfig.max_employees_per_shift,
            employeeTypes: storeConfig.employee_types.map(t => t.id),
            requiresKeyholder: isEarlyShift || isLateShift,
            keyholderBeforeMinutes: isEarlyShift ? storeConfig.keyholder_before_minutes : 0,
            keyholderAfterMinutes: isLateShift ? storeConfig.keyholder_after_minutes : 0
        };

        // Check if there's already a slot at this time
        const hasConflict = newCoverage[dayIndex].timeSlots.some(slot => {
            const slotStartMinutes = timeToMinutes(slot.startTime);
            const slotEndMinutes = timeToMinutes(slot.endTime);
            const newStartMinutes = timeToMinutes(startTime);
            const newEndMinutes = timeToMinutes(endTime);
            return (newStartMinutes < slotEndMinutes && newEndMinutes > slotStartMinutes);
        });

        if (!hasConflict) {
            newCoverage[dayIndex].timeSlots.push(newSlot);
            setCoverage(newCoverage);
            onChange?.(newCoverage);
        }
    };

    const handleUpdateSlot = (dayIndex: number, slotIndex: number, updates: any) => {
        const newCoverage = [...coverage];
        const currentSlot = newCoverage[dayIndex].timeSlots[slotIndex];

        // Determine if this is an opening or closing shift after the update
        const isEarlyShift = (updates.startTime || currentSlot.startTime) === storeConfig.store_opening;
        const isLateShift = (updates.endTime || currentSlot.endTime) === storeConfig.store_closing;

        newCoverage[dayIndex].timeSlots[slotIndex] = {
            ...currentSlot,
            ...updates,
            requiresKeyholder: isEarlyShift || isLateShift,
            keyholderBeforeMinutes: isEarlyShift ? storeConfig.keyholder_before_minutes : 0,
            keyholderAfterMinutes: isLateShift ? storeConfig.keyholder_after_minutes : 0
        };
        setCoverage(newCoverage);
        onChange?.(newCoverage);
    };

    const handleDeleteSlot = (dayIndex: number, slotIndex: number) => {
        const newCoverage = [...coverage];
        newCoverage[dayIndex].timeSlots.splice(slotIndex, 1);
        setCoverage(newCoverage);
        onChange?.(newCoverage);
    };

    const handleAddDefaultSlots = () => {
        // Use the exact store opening and closing times
        const morningShift = {
            startTime: storeConfig.store_opening,
            endTime: "14:00",
            minEmployees: 1,
            maxEmployees: 2,
            employeeTypes: storeConfig.employee_types.map(t => t.id),
            requiresKeyholder: true,
            keyholderBeforeMinutes: storeConfig.keyholder_before_minutes,
            keyholderAfterMinutes: 0
        };

        const afternoonShift = {
            startTime: "14:00",
            endTime: storeConfig.store_closing,
            minEmployees: 1,
            maxEmployees: 2,
            employeeTypes: storeConfig.employee_types.map(t => t.id),
            requiresKeyholder: true,
            keyholderBeforeMinutes: 0,
            keyholderAfterMinutes: storeConfig.keyholder_after_minutes
        };

        // Add morning and afternoon shifts for each day
        const newCoverage = [...coverage];
        openingDays.forEach((dayIdx) => {
            if (dayIdx !== 0) { // Skip Sunday (index 0)
                // Clear existing slots first to avoid conflicts
                newCoverage[dayIdx].timeSlots = [];
                // Add the new shifts
                newCoverage[dayIdx].timeSlots.push(morningShift, afternoonShift);
            }
        });
        setCoverage(newCoverage);
        onChange?.(newCoverage);

        toast({
            title: "Default shifts added",
            description: "Added shifts for Monday through Saturday",
        });
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b p-4 bg-card">
                    <h2 className="text-lg font-semibold">Employee Coverage Requirements</h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={isEditing ? "secondary" : "outline"}
                            size="sm"
                            className="gap-2"
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            <PencilIcon className="h-4 w-4" />
                            {isEditing ? 'Done' : 'Edit'}
                        </Button>
                        {isEditing && (
                            <Button
                                variant="default"
                                size="sm"
                                className="gap-2"
                                onClick={handleAddDefaultSlots}
                            >
                                <Plus className="h-4 w-4" />
                                Add All
                            </Button>
                        )}
                    </div>
                </div>

                <div ref={containerRef} className="overflow-auto relative">
                    {/* Time header */}
                    <div className="flex" style={{ height: HEADER_HEIGHT }}>
                        <div style={{ width: TIME_COLUMN_WIDTH }} className="shrink-0 border-r border-border/50" />
                        <div className="flex-1 flex relative border-b border-border/50">
                            {hours.map((hour, i) => (
                                <div
                                    key={hour}
                                    className="flex-1 relative border-r border-border/50 flex items-center justify-center text-sm font-medium text-muted-foreground"
                                >
                                    {hour}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Days grid */}
                    {openingDays.map((dayIndex) => (
                        <DayRow
                            key={dayIndex}
                            dayName={DAYS_SHORT[dayIndex]}
                            dayIndex={dayIndex}
                            slots={coverage.find(c => c.dayIndex === dayIndex)?.timeSlots || []}
                            hours={hours}
                            onAddSlot={(hourIndex) => handleAddSlot(dayIndex, hourIndex)}
                            onUpdateSlot={(slotIndex, updates) => handleUpdateSlot(dayIndex, slotIndex, updates)}
                            onDeleteSlot={(slotIndex) => handleDeleteSlot(dayIndex, slotIndex)}
                            isEditing={isEditing}
                            gridWidth={gridWidth}
                            storeConfig={storeConfig}
                        />
                    ))}
                </div>
            </Card>
        </DndProvider>
    );
}; 