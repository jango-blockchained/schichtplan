import React, { useState, useEffect, useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DailyCoverage, CoverageTimeSlot } from '@/types';
import { GripVertical, Plus, Trash2, Clock, PencilIcon, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const CELL_HEIGHT = 48;
const TIME_COLUMN_WIDTH = 80;
const HEADER_HEIGHT = 48;
const TIME_ROW_HEIGHT = 24;
const BLOCK_VERTICAL_PADDING = 0;
const GRID_GAP = 0;

interface StoreConfigProps {
    store_opening: string;
    store_closing: string;
    opening_days: { [key: string]: boolean };
    min_employees_per_shift: number;
    max_employees_per_shift: number;
    employee_types: Array<{
        id: string;
        name: string;
        abbr?: string;
    }>;
    keyholder_before_minutes: number;
    keyholder_after_minutes: number;
}

interface BlockEditorProps {
    slot: CoverageTimeSlot;
    onSave: (updates: CoverageTimeSlot) => void;
    onCancel: () => void;
    storeConfig: StoreConfigProps;
}

const BlockEditor: React.FC<BlockEditorProps> = ({ slot, onSave, onCancel, storeConfig }) => {
    const [startTime, setStartTime] = useState(slot.startTime);
    const [endTime, setEndTime] = useState(slot.endTime);
    const [minEmployees, setMinEmployees] = useState(slot.minEmployees);
    const [maxEmployees, setMaxEmployees] = useState(slot.maxEmployees);
    const [selectedTypes, setSelectedTypes] = useState<string[]>(slot.employeeTypes);
    const [requiresKeyholder, setRequiresKeyholder] = useState(slot.requiresKeyholder);
    const [keyholderBeforeMinutes, setKeyholderBeforeMinutes] = useState<number>(
        slot.startTime === storeConfig.store_opening ? storeConfig.keyholder_before_minutes : 0
    );
    const [keyholderAfterMinutes, setKeyholderAfterMinutes] = useState<number>(
        slot.endTime === storeConfig.store_closing ? storeConfig.keyholder_after_minutes : 0
    );
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Check if this is an early or late shift
    const isEarlyShift = startTime === storeConfig.store_opening;
    const isLateShift = endTime === storeConfig.store_closing;

    // Update requiresKeyholder and minutes when early or late shift is detected
    useEffect(() => {
        if (isEarlyShift) {
            setRequiresKeyholder(true);
            setKeyholderBeforeMinutes(storeConfig.keyholder_before_minutes);
            setKeyholderAfterMinutes(0);
        } else if (isLateShift) {
            setRequiresKeyholder(true);
            setKeyholderBeforeMinutes(0);
            setKeyholderAfterMinutes(storeConfig.keyholder_after_minutes);
        } else {
            setKeyholderBeforeMinutes(0);
            setKeyholderAfterMinutes(0);
        }
    }, [isEarlyShift, isLateShift, storeConfig.keyholder_before_minutes, storeConfig.keyholder_after_minutes]);

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (parseInt(startTime) >= parseInt(endTime)) {
            newErrors.time = "End time must be after start time";
        }

        if (minEmployees > maxEmployees) {
            newErrors.employees = "Minimum employees cannot exceed maximum";
        }

        if (minEmployees < 1) {
            newErrors.minEmployees = "Minimum employees must be at least 1";
        }

        if (selectedTypes.length === 0) {
            newErrors.types = "At least one employee type must be selected";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (validateForm()) {
            onSave({
                startTime,
                endTime,
                minEmployees,
                maxEmployees,
                employeeTypes: selectedTypes,
                requiresKeyholder: requiresKeyholder || isEarlyShift || isLateShift,
                keyholderBeforeMinutes: isEarlyShift ? storeConfig.keyholder_before_minutes : 0,
                keyholderAfterMinutes: isLateShift ? storeConfig.keyholder_after_minutes : 0
            });
        }
    };

    const toggleEmployeeType = (typeId: string) => {
        setSelectedTypes(prev =>
            prev.includes(typeId)
                ? prev.filter(id => id !== typeId)
                : [...prev, typeId]
        );
    };

    return (
        <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                        id="startTime"
                        type="time"
                        step="900"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className={errors.time ? "border-destructive" : ""}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                        id="endTime"
                        type="time"
                        step="900"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className={errors.time ? "border-destructive" : ""}
                    />
                </div>
            </div>
            {errors.time && <p className="text-sm text-destructive">{errors.time}</p>}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="minEmployees">Min Employees</Label>
                    <Input
                        id="minEmployees"
                        type="number"
                        min={1}
                        value={minEmployees}
                        onChange={(e) => setMinEmployees(Number(e.target.value))}
                        className={errors.employees || errors.minEmployees ? "border-destructive" : ""}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="maxEmployees">Max Employees</Label>
                    <Input
                        id="maxEmployees"
                        type="number"
                        min={minEmployees}
                        value={maxEmployees}
                        onChange={(e) => setMaxEmployees(Number(e.target.value))}
                        className={errors.employees ? "border-destructive" : ""}
                    />
                </div>
            </div>
            {errors.employees && <p className="text-sm text-destructive">{errors.employees}</p>}
            {errors.minEmployees && <p className="text-sm text-destructive">{errors.minEmployees}</p>}

            <div className="space-y-2">
                <Label>Employee Types</Label>
                <div className="flex flex-wrap gap-2">
                    {storeConfig.employee_types.map((type) => (
                        <Button
                            key={type.id}
                            variant={selectedTypes.includes(type.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleEmployeeType(type.id)}
                            className={cn(
                                "transition-colors",
                                selectedTypes.includes(type.id) ? "bg-primary" : "hover:bg-primary/10"
                            )}
                        >
                            {type.name}
                        </Button>
                    ))}
                </div>
                {errors.types && <p className="text-sm text-destructive">{errors.types}</p>}
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Label htmlFor="requiresKeyholder">Requires Keyholder</Label>
                    <input
                        type="checkbox"
                        id="requiresKeyholder"
                        checked={requiresKeyholder || isEarlyShift || isLateShift}
                        onChange={(e) => setRequiresKeyholder(e.target.checked)}
                        disabled={isEarlyShift || isLateShift}
                        className="h-4 w-4"
                    />
                    {(isEarlyShift || isLateShift) && (
                        <span className="text-xs text-muted-foreground ml-2">
                            (Required for {isEarlyShift ? 'opening' : 'closing'} shift)
                        </span>
                    )}
                </div>

                {(requiresKeyholder || isEarlyShift || isLateShift) && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Minutes Before</Label>
                            <div className="text-sm text-muted-foreground">
                                {keyholderBeforeMinutes} minutes
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Minutes After</Label>
                            <div className="text-sm text-muted-foreground">
                                {keyholderAfterMinutes} minutes
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave}>Save</Button>
            </div>
        </div>
    );
};

interface CoverageBlockProps {
    slot: CoverageTimeSlot;
    dayIndex: number;
    onUpdate: (updates: Partial<CoverageTimeSlot>) => void;
    onDelete: () => void;
    isEditing: boolean;
    gridWidth: number;
    storeConfig: StoreConfigProps;
    hours: string[];
}

const CoverageBlock: React.FC<CoverageBlockProps> = ({ slot, dayIndex, onUpdate, onDelete, isEditing, gridWidth, storeConfig, hours }) => {
    const blockRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startWidth, setStartWidth] = useState(0);
    const [showEditor, setShowEditor] = useState(false);

    const snapToQuarterHour = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const roundedMinutes = Math.round(minutes / 15) * 15;
        const adjustedHours = roundedMinutes === 60 ? hours + 1 : hours;
        const finalMinutes = roundedMinutes === 60 ? 0 : roundedMinutes;
        return `${adjustedHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
    };

    const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const formatDuration = (startTime: string, endTime: string) => {
        const start = new Date(`1970-01-01T${startTime}`);
        const end = new Date(`1970-01-01T${endTime}`);
        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return diffHours === Math.floor(diffHours) ? `${diffHours}h` : `${diffHours.toFixed(1)}h`;
    };

    // Always use snapped times for position and width calculations
    const snappedStartTime = snapToQuarterHour(slot.startTime);
    const snappedEndTime = snapToQuarterHour(slot.endTime);

    const startMinutes = timeToMinutes(snappedStartTime);
    const endMinutes = timeToMinutes(snappedEndTime);
    const gridStartMinutes = timeToMinutes(hours[0]);
    const gridEndMinutes = timeToMinutes(hours[hours.length - 1]) + 60;

    const gridContentWidth = gridWidth - TIME_COLUMN_WIDTH;
    const minuteWidth = gridContentWidth / (gridEndMinutes - gridStartMinutes);

    // Precise position and width calculation using snapped times
    const startOffset = (startMinutes - gridStartMinutes) * minuteWidth;
    const blockWidth = (endMinutes - startMinutes) * minuteWidth;

    const isEarlyShift = snappedStartTime === storeConfig.store_opening;
    const isLateShift = snappedEndTime === storeConfig.store_closing;
    const duration = formatDuration(snappedStartTime, snappedEndTime); // Use snapped times for duration

    const [{ isDragging }, drag] = useDrag({
        type: 'COVERAGE_BLOCK',
        item: { type: 'COVERAGE_BLOCK', slot: { ...slot, startTime: snappedStartTime, endTime: snappedEndTime }, dayIndex }, // Use snapped times for dragging
        collect: monitor => ({
            isDragging: monitor.isDragging(),
        }),
        canDrag: () => isEditing && !isResizing,
    });

    useEffect(() => {
        if (blockRef.current) {
            drag(blockRef.current);
        }
    }, [drag]);

    const handleResizeStart = (e: React.MouseEvent) => {
        if (!isEditing) return;
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setStartX(e.pageX);
        setStartWidth(blockRef.current?.offsetWidth || 0);
    };

    const handleResizeMove = (e: MouseEvent) => {
        if (!isResizing) return;
        e.preventDefault();

        const diff = e.pageX - startX;
        const newMinutes = Math.round(diff / minuteWidth / 0.25) * 15;
        const newWidth = Math.max(minuteWidth * 15, Math.min(startWidth + diff, gridContentWidth));

        if (blockRef.current) {
            blockRef.current.style.width = `${newWidth}px`;
        }
    };

    const handleResizeEnd = () => {
        if (!isResizing) return;
        setIsResizing(false);

        const width = blockRef.current?.offsetWidth || 0;
        const newMinutes = Math.round(width / minuteWidth / 0.25) * 15 + startMinutes;
        const newHours = Math.floor(newMinutes / 60);
        const newMins = newMinutes % 60;

        const endTime = `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
        const snappedEndTime = snapToQuarterHour(endTime); // Ensure the new end time is snapped

        onUpdate({
            endTime: snappedEndTime
        });
    };

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeEnd);
            return () => {
                window.removeEventListener('mousemove', handleResizeMove);
                window.removeEventListener('mouseup', handleResizeEnd);
            };
        }
    }, [isResizing]);

    return (
        <div
            ref={blockRef}
            style={{
                position: 'absolute',
                left: `${TIME_COLUMN_WIDTH + startOffset}px`,
                width: `${blockWidth}px`,
                height: `${CELL_HEIGHT - BLOCK_VERTICAL_PADDING * 2}px`,
                opacity: isDragging ? 0.5 : 1,
            }}
            className={cn(
                "bg-primary/10 border border-primary/20 rounded-sm p-1 cursor-move flex flex-col",
                isEditing ? "hover:bg-primary/20" : ""
            )}
        >
            <div className="flex justify-between items-start gap-1 mb-auto">
                <div className="flex flex-col min-w-0 flex-grow">
                    <div className="flex justify-between items-center text-xs font-medium">
                        <span className="truncate">{snappedStartTime} - {snappedEndTime}</span>
                        <span className="text-muted-foreground ml-2">{duration}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{slot.minEmployees}-{slot.maxEmployees} {slot.minEmployees === 1 ? 'person' : 'people'}</span>
                    </div>
                    {(slot.requiresKeyholder || isEarlyShift || isLateShift) && (
                        <div className="flex items-center gap-1 text-xs text-primary">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger className="flex items-center gap-1 hover:text-primary/80">
                                        <span>🔑</span>
                                        <Clock className="h-3 w-3" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                        <p className="font-medium">Keyholder needed:</p>
                                        {isEarlyShift && (
                                            <p>{storeConfig.keyholder_before_minutes} min before opening</p>
                                        )}
                                        {isLateShift && (
                                            <p>{storeConfig.keyholder_after_minutes} min after closing</p>
                                        )}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
                </div>
                {isEditing && (
                    <div className="flex gap-0.5 shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowEditor(true);
                            }}
                            className="p-0.5 hover:bg-primary/20 rounded-sm"
                        >
                            <PencilIcon className="h-3 w-3" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-0.5 hover:bg-destructive/20 rounded-sm text-destructive"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                )}
            </div>
            {isEditing && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/20"
                    onMouseDown={handleResizeStart}
                />
            )}
            {showEditor && (
                <Dialog open={showEditor} onOpenChange={setShowEditor}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Coverage Block</DialogTitle>
                        </DialogHeader>
                        <BlockEditor
                            slot={slot}
                            onSave={(updates) => {
                                onUpdate(updates);
                                setShowEditor(false);
                            }}
                            onCancel={() => setShowEditor(false)}
                            storeConfig={storeConfig}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

interface TimeGridCellProps {
    hour: string;
    cellIndex: number;
    dayIndex: number;
    slots: CoverageTimeSlot[];
    onAddSlot: () => void;
    isEditing: boolean;
    onDropBlock?: (block: CoverageTimeSlot, newStartIndex: number) => void;
}

const TimeGridCell: React.FC<TimeGridCellProps> = ({
    hour,
    cellIndex,
    dayIndex,
    slots,
    onAddSlot,
    isEditing,
    onDropBlock
}) => {
    const [{ isOver }, drop] = useDrop({
        accept: 'COVERAGE_BLOCK',
        collect: monitor => ({
            isOver: monitor.isOver(),
        }),
        drop: (item: { type: string; slot: CoverageTimeSlot }) => {
            onDropBlock?.(item.slot, cellIndex);
        },
    });

    const currentHour = parseInt(hour);
    const hasSlotInHour = slots.some(slot => {
        const startHour = parseInt(slot.startTime.split(':')[0]);
        const endHour = parseInt(slot.endTime.split(':')[0]);
        return currentHour >= startHour && currentHour < endHour;
    });

    return (
        <div
            ref={drop}
            className={cn(
                "flex-1 relative border-r border-border/40",
                isOver && "bg-primary/5",
                !hasSlotInHour && isEditing && "hover:bg-accent/20",
                currentHour % 2 === 0 ? "bg-muted/20" : "bg-transparent"
            )}
            onClick={() => !hasSlotInHour && isEditing && onAddSlot()}
        >
            {!hasSlotInHour && isEditing && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="rounded-full bg-primary/10 p-1">
                        <Plus className="h-4 w-4 text-primary/70" />
                    </div>
                </div>
            )}
        </div>
    );
};

interface DayRowProps {
    dayName: string;
    dayIndex: number;
    slots: CoverageTimeSlot[];
    hours: string[];
    onAddSlot: (hour: number) => void;
    onUpdateSlot: (index: number, updates: Partial<CoverageTimeSlot>) => void;
    onDeleteSlot: (index: number) => void;
    isEditing: boolean;
    gridWidth: number;
    storeConfig: StoreConfigProps;
}

const DayRow: React.FC<DayRowProps> = ({
    dayName,
    dayIndex,
    slots,
    hours,
    onAddSlot,
    onUpdateSlot,
    onDeleteSlot,
    isEditing,
    gridWidth,
    storeConfig,
}) => {
    const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const gridStartMinutes = timeToMinutes(hours[0]);
    const gridEndMinutes = timeToMinutes(hours[hours.length - 1]) + 60;
    const totalGridMinutes = gridEndMinutes - gridStartMinutes;

    const gridContentWidth = gridWidth - TIME_COLUMN_WIDTH;
    const minuteWidth = gridContentWidth / totalGridMinutes;

    const cellWidth = gridContentWidth / (hours.length - 1);
    const openingHour = parseInt(storeConfig.store_opening.split(':')[0]);

    const handleDropBlock = (slot: CoverageTimeSlot, cellIndex: number) => {
        if (!isEditing) return;

        const slotIndex = slots.findIndex(s =>
            s.startTime === slot.startTime &&
            s.endTime === slot.endTime &&
            s.minEmployees === slot.minEmployees &&
            s.maxEmployees === slot.maxEmployees
        );

        if (slotIndex === -1) return;

        const duration = parseInt(slot.endTime) - parseInt(slot.startTime);

        const newStartHour = openingHour + cellIndex;
        const newEndHour = Math.min(newStartHour + duration, parseInt(storeConfig.store_closing.split(':')[0]));

        // Don't allow dropping outside store hours
        if (newStartHour < openingHour || newStartHour >= parseInt(storeConfig.store_closing.split(':')[0])) return;

        // Check for conflicts more efficiently
        const hasConflict = slots.some((existingSlot, index) => {
            if (index === slotIndex) return false;
            const existingStart = parseInt(existingSlot.startTime);
            const existingEnd = parseInt(existingSlot.endTime);
            return (newStartHour < existingEnd && newEndHour > existingStart);
        });

        if (!hasConflict) {
            onUpdateSlot(slotIndex, {
                startTime: `${newStartHour.toString().padStart(2, '0')}:00`,
                endTime: `${newEndHour.toString().padStart(2, '0')}:00`
            });
        }
    };

    return (
        <div className="flex w-full border-b border-border/50 hover:bg-accent/5">
            <div
                className="flex items-center justify-center font-medium shrink-0 border-r border-border/50 text-sm text-muted-foreground"
                style={{ width: TIME_COLUMN_WIDTH, height: CELL_HEIGHT }}
            >
                {DAYS_SHORT[dayIndex]}
            </div>
            <div className="flex-1 relative flex">
                {hours.map((hour, i) => (
                    <TimeGridCell
                        key={hour}
                        hour={hour}
                        cellIndex={i}
                        dayIndex={dayIndex}
                        slots={slots}
                        onAddSlot={() => onAddSlot(i)}
                        isEditing={isEditing}
                        onDropBlock={handleDropBlock}
                    />
                ))}
                {slots.map((slot, index) => (
                    <CoverageBlock
                        key={index}
                        slot={slot}
                        dayIndex={dayIndex}
                        onUpdate={(updates) => onUpdateSlot(index, updates)}
                        onDelete={() => onDeleteSlot(index)}
                        isEditing={isEditing}
                        gridWidth={gridWidth}
                        storeConfig={storeConfig}
                        hours={hours}
                    />
                ))}
            </div>
        </div>
    );
};

interface CoverageEditorProps {
    initialCoverage?: DailyCoverage[];
    storeConfig: StoreConfigProps;
    onChange?: (coverage: DailyCoverage[]) => void;
}

export const CoverageEditor: React.FC<CoverageEditorProps> = ({ initialCoverage, storeConfig, onChange }) => {
    const { toast } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [gridWidth, setGridWidth] = useState(0);

    // Utility function to convert time to minutes
    const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Calculate opening days from settings
    const openingDays = React.useMemo(() => {
        return Object.entries(storeConfig.opening_days)
            .filter(([_, isOpen]) => isOpen)
            .map(([dayIndex]) => Number(dayIndex))
            .sort((a, b) => a - b);
    }, [storeConfig.opening_days]);

    // Calculate hours array
    const hours = React.useMemo(() => {
        const startHour = parseInt(storeConfig.store_opening);
        const endHour = parseInt(storeConfig.store_closing);
        return Array.from(
            { length: endHour - startHour + 1 }, // +1 to include the last hour
            (_, i) => `${(startHour + i).toString().padStart(2, '0')}:00`
        );
    }, [storeConfig.store_opening, storeConfig.store_closing]);

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
        const startHour = parseInt(storeConfig.store_opening.split(':')[0]) + hour;
        const endHour = Math.min(startHour + 1, parseInt(storeConfig.store_closing.split(':')[0]));

        if (startHour >= parseInt(storeConfig.store_closing.split(':')[0])) {
            return; // Don't add slots outside opening hours
        }

        const newCoverage = [...coverage];
        const newSlot: CoverageTimeSlot = {
            startTime: `${startHour.toString().padStart(2, '0')}:00`,
            endTime: `${endHour.toString().padStart(2, '0')}:00`,
            minEmployees: storeConfig.min_employees_per_shift,
            maxEmployees: storeConfig.max_employees_per_shift,
            employeeTypes: storeConfig.employee_types.map(t => t.id),
            requiresKeyholder: false,
            keyholderBeforeMinutes: storeConfig.keyholder_before_minutes,
            keyholderAfterMinutes: storeConfig.keyholder_after_minutes
        };

        // Check if there's already a slot at this time
        const hasConflict = newCoverage[dayIndex].timeSlots.some(slot => {
            const slotStartMinutes = timeToMinutes(slot.startTime);
            const slotEndMinutes = timeToMinutes(slot.endTime);
            const newStartMinutes = timeToMinutes(newSlot.startTime);
            const newEndMinutes = timeToMinutes(newSlot.endTime);
            return (newStartMinutes < slotEndMinutes && newEndMinutes > slotStartMinutes);
        });

        if (!hasConflict) {
            newCoverage[dayIndex].timeSlots.push(newSlot);
            setCoverage(newCoverage);
            onChange?.(newCoverage);
        }
    };

    const handleUpdateSlot = (dayIndex: number, slotIndex: number, updates: Partial<CoverageTimeSlot>) => {
        const newCoverage = [...coverage];
        const currentSlot = newCoverage[dayIndex].timeSlots[slotIndex];

        // Determine new start and end times, using current slot if not specified
        const startTime = updates.startTime ?? currentSlot.startTime;
        const endTime = updates.endTime ?? currentSlot.endTime;

        // Validate time range is within opening hours
        const openingMinutes = timeToMinutes(storeConfig.store_opening);
        const closingMinutes = timeToMinutes(storeConfig.store_closing);
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);

        if (startMinutes < openingMinutes || endMinutes > closingMinutes) {
            return; // Don't allow updates outside opening hours
        }

        // Check for conflicts with other slots
        const hasConflict = newCoverage[dayIndex].timeSlots.some((slot, index) => {
            if (index === slotIndex) return false;
            const slotStartMinutes = timeToMinutes(slot.startTime);
            const slotEndMinutes = timeToMinutes(slot.endTime);
            return (startMinutes < slotEndMinutes && endMinutes > slotStartMinutes);
        });

        if (!hasConflict) {
            newCoverage[dayIndex].timeSlots[slotIndex] = {
                ...currentSlot,
                ...updates
            };
            setCoverage(newCoverage);
            onChange?.(newCoverage);
        }
    };

    const handleDeleteSlot = (dayIndex: number, slotIndex: number) => {
        const newCoverage = [...coverage];
        newCoverage[dayIndex].timeSlots.splice(slotIndex, 1);
        setCoverage(newCoverage);
        onChange?.(newCoverage);
    };

    const handleAddDefaultSlots = () => {
        const morningShift: CoverageTimeSlot = {
            startTime: "09:00",
            endTime: "14:00",
            minEmployees: 1,
            maxEmployees: 2,
            employeeTypes: storeConfig.employee_types.map(t => t.id),
            requiresKeyholder: true,
            keyholderBeforeMinutes: storeConfig.keyholder_before_minutes,
            keyholderAfterMinutes: 0
        };

        const afternoonShift: CoverageTimeSlot = {
            startTime: "14:00",
            endTime: "20:00",
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

                <div className="overflow-x-auto" ref={containerRef}>
                    <div className="w-full">
                        {/* Time row */}
                        <div className="flex border-b border-border/50" style={{ height: TIME_ROW_HEIGHT }}>
                            <div
                                className="shrink-0 border-r border-border/50"
                                style={{ width: TIME_COLUMN_WIDTH }}
                            />
                            <div className="flex-1 relative">
                                <div className="absolute inset-0 flex">
                                    {hours.map((hour, index) => (
                                        <div key={hour} className="flex-1 relative">
                                            <div className="absolute -bottom-[1px] -left-px w-px h-2 bg-border" />
                                            <div className="absolute -bottom-6 start-0 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap">
                                                {hour}
                                            </div>
                                        </div>
                                    ))}
                                    {/* Last time marker */}
                                    <div className="absolute -bottom-[1px] right-0 w-px h-2 bg-border" />
                                </div>
                            </div>
                        </div>

                        {/* Grid header with day labels */}
                        <div className="flex border-b border-border/50" style={{ height: HEADER_HEIGHT }}>
                            <div
                                className="flex items-center justify-center font-medium shrink-0 border-r border-border/50 bg-muted/50 text-sm text-muted-foreground"
                                style={{ width: TIME_COLUMN_WIDTH }}
                            >
                                <Clock className="h-4 w-4" />
                            </div>
                            <div className="flex-1 flex">
                                {hours.map((_, index) => (
                                    <div
                                        key={index}
                                        className="flex-1 border-r border-border/50 bg-muted/50"
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Day rows */}
                        {openingDays.map((dayIndex) => (
                            <DayRow
                                key={dayIndex}
                                dayName={DAYS_SHORT[dayIndex]}
                                dayIndex={dayIndex}
                                slots={coverage[dayIndex].timeSlots}
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
                </div>
            </Card>
        </DndProvider>
    );
}; 