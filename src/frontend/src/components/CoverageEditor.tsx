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
    const [keyholderBeforeMinutes, setKeyholderBeforeMinutes] = useState(slot.keyholderBeforeMinutes);
    const [keyholderAfterMinutes, setKeyholderAfterMinutes] = useState(slot.keyholderAfterMinutes);
    const [errors, setErrors] = useState<Record<string, string>>({});

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

        if (requiresKeyholder) {
            if (keyholderBeforeMinutes < 0) {
                newErrors.keyholderBefore = "Keyholder before minutes must be non-negative";
            }
            if (keyholderAfterMinutes < 0) {
                newErrors.keyholderAfter = "Keyholder after minutes must be non-negative";
            }
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
                requiresKeyholder,
                keyholderBeforeMinutes,
                keyholderAfterMinutes
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
                        checked={requiresKeyholder}
                        onChange={(e) => setRequiresKeyholder(e.target.checked)}
                        className="h-4 w-4"
                    />
                </div>

                {requiresKeyholder && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="keyholderBeforeMinutes">Minutes Before</Label>
                            <Input
                                id="keyholderBeforeMinutes"
                                type="number"
                                min={0}
                                value={keyholderBeforeMinutes}
                                onChange={(e) => setKeyholderBeforeMinutes(Number(e.target.value))}
                                className={errors.keyholderBefore ? "border-destructive" : ""}
                            />
                            {errors.keyholderBefore && <p className="text-sm text-destructive">{errors.keyholderBefore}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="keyholderAfterMinutes">Minutes After</Label>
                            <Input
                                id="keyholderAfterMinutes"
                                type="number"
                                min={0}
                                value={keyholderAfterMinutes}
                                onChange={(e) => setKeyholderAfterMinutes(Number(e.target.value))}
                                className={errors.keyholderAfter ? "border-destructive" : ""}
                            />
                            {errors.keyholderAfter && <p className="text-sm text-destructive">{errors.keyholderAfter}</p>}
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

    const getTimeInQuarters = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 4 + Math.round(minutes / 15);
    };

    const startQuarters = getTimeInQuarters(slot.startTime);
    const endQuarters = getTimeInQuarters(slot.endTime);
    const startHour = parseInt(slot.startTime.split(':')[0]);
    const startMinutes = parseInt(slot.startTime.split(':')[1]);
    const openingHourQuarters = getTimeInQuarters(storeConfig.store_opening);

    const cellWidth = (gridWidth - TIME_COLUMN_WIDTH) / hours.length;
    const quarterWidth = cellWidth / 4;
    const startOffsetQuarters = startQuarters - openingHourQuarters;
    const durationQuarters = endQuarters - startQuarters;

    const [{ isDragging }, drag] = useDrag({
        type: 'COVERAGE_BLOCK',
        item: { type: 'COVERAGE_BLOCK', slot, dayIndex },
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
        const newQuarters = Math.round(diff / quarterWidth);
        const newWidth = Math.max(quarterWidth, Math.min(startWidth + (newQuarters * quarterWidth), cellWidth * 24));

        if (blockRef.current) {
            blockRef.current.style.width = `${newWidth}px`;
        }
    };

    const handleResizeEnd = () => {
        if (!isResizing) return;
        setIsResizing(false);

        const width = blockRef.current?.offsetWidth || 0;
        const newQuarters = Math.round(width / quarterWidth);
        const totalMinutes = (startHour * 60 + startMinutes) + (newQuarters * 15);
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;

        const endTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;

        onUpdate({
            endTime
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

    const formatDuration = (startTime: string, endTime: string) => {
        const start = new Date(`1970-01-01T${startTime}`);
        const end = new Date(`1970-01-01T${endTime}`);
        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return diffHours === Math.floor(diffHours) ? `${diffHours}h` : `${diffHours.toFixed(2)}h`;
    };

    return (
        <div
            ref={blockRef}
            style={{
                position: 'absolute',
                left: `${TIME_COLUMN_WIDTH + (startOffsetQuarters * quarterWidth)}px`,
                width: `${durationQuarters * quarterWidth}px`,
                height: `${CELL_HEIGHT - BLOCK_VERTICAL_PADDING * 2}px`,
                opacity: isDragging ? 0.5 : 1,
            }}
            className={cn(
                "bg-primary/20 border border-primary rounded-md p-1 cursor-move flex flex-col justify-between",
                isEditing ? "hover:bg-primary/30" : ""
            )}
        >
            <div className="flex justify-between items-start text-xs">
                <div className="flex flex-col">
                    <span>{slot.startTime} - {slot.endTime}</span>
                    <span className="text-muted-foreground">
                        {slot.minEmployees}-{slot.maxEmployees} {slot.minEmployees === 1 ? 'person' : 'people'}
                    </span>
                    {slot.requiresKeyholder && (
                        <span className="text-primary font-medium">
                            🔑 Keyholder required
                            {(slot.keyholderBeforeMinutes > 0 || slot.keyholderAfterMinutes > 0) && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Clock className="h-3 w-3 inline ml-1" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Keyholder needed:</p>
                                            {slot.keyholderBeforeMinutes > 0 && (
                                                <p>{slot.keyholderBeforeMinutes} min before</p>
                                            )}
                                            {slot.keyholderAfterMinutes > 0 && (
                                                <p>{slot.keyholderAfterMinutes} min after</p>
                                            )}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </span>
                    )}
                </div>
                {isEditing && (
                    <div className="flex gap-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowEditor(true);
                            }}
                            className="p-1 hover:bg-primary/20 rounded"
                        >
                            <PencilIcon className="h-3 w-3" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-1 hover:bg-destructive/20 rounded text-destructive"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                )}
            </div>
            {isEditing && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize"
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
    const cellWidth = (gridWidth - TIME_COLUMN_WIDTH) / (hours.length - 1);
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

    // Calculate opening days from settings
    const openingDays = React.useMemo(() => {
        return Object.entries(storeConfig.opening_days)
            .filter(([_, isOpen]) => isOpen)
            .map(([dayIndex]) => Number(dayIndex))
            .sort((a, b) => a - b);
    }, [storeConfig.opening_days]);

    // Calculate hours array
    const hours = React.useMemo(() => {
        const startHour = parseInt(storeConfig.store_opening.split(':')[0]);
        const endHour = parseInt(storeConfig.store_closing.split(':')[0]);
        return Array.from(
            { length: endHour - startHour },
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
            keyholderBeforeMinutes: 0,
            keyholderAfterMinutes: 0
        };

        // Check if there's already a slot at this time
        const hasConflict = newCoverage[dayIndex].timeSlots.some(slot => {
            const slotStartHour = parseInt(slot.startTime.split(':')[0]);
            const slotEndHour = parseInt(slot.endTime.split(':')[0]);
            return startHour >= slotStartHour && startHour < slotEndHour;
        });

        if (!hasConflict) {
            newCoverage[dayIndex].timeSlots.push(newSlot);
            setCoverage(newCoverage);
            onChange?.(newCoverage);
        }
    };

    const handleUpdateSlot = (dayIndex: number, slotIndex: number, updates: Partial<CoverageTimeSlot>) => {
        const newCoverage = [...coverage];
        const startHour = parseInt(updates.startTime?.split(':')[0] ?? newCoverage[dayIndex].timeSlots[slotIndex].startTime.split(':')[0]);
        const endHour = parseInt(updates.endTime?.split(':')[0] ?? newCoverage[dayIndex].timeSlots[slotIndex].endTime.split(':')[0]);

        // Validate time range is within opening hours
        const openingHour = parseInt(storeConfig.store_opening.split(':')[0]);
        const closingHour = parseInt(storeConfig.store_closing.split(':')[0]);

        if (startHour < openingHour || endHour > closingHour) {
            return; // Don't allow updates outside opening hours
        }

        newCoverage[dayIndex].timeSlots[slotIndex] = {
            ...newCoverage[dayIndex].timeSlots[slotIndex],
            ...updates
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
        const morningShift: CoverageTimeSlot = {
            startTime: "09:00",
            endTime: "14:00",
            minEmployees: 1,
            maxEmployees: 2,
            employeeTypes: storeConfig.employee_types.map(t => t.id),
            requiresKeyholder: true,
            keyholderBeforeMinutes: 30,
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
            keyholderAfterMinutes: 30
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