import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { BlockEditorProps } from '../types';
import { snapToQuarterHour, timeToMinutes } from '../utils/time';

export const BlockEditor: React.FC<BlockEditorProps> = ({ slot, onSave, onCancel, storeConfig }) => {
    const [startTime, setStartTime] = useState(snapToQuarterHour(slot.startTime));
    const [endTime, setEndTime] = useState(snapToQuarterHour(slot.endTime));
    const [minEmployees, setMinEmployees] = useState(slot.minEmployees);
    const [maxEmployees, setMaxEmployees] = useState(slot.maxEmployees);
    const [selectedTypes, setSelectedTypes] = useState<string[]>(slot.employeeTypes);
    const [requiresKeyholder, setRequiresKeyholder] = useState(slot.requiresKeyholder);
    const [keyholderBeforeMinutes, setKeyholderBeforeMinutes] = useState<number>(
        slot.startTime === storeConfig?.store_opening ? storeConfig?.keyholder_before_minutes ?? 0 : 0
    );
    const [keyholderAfterMinutes, setKeyholderAfterMinutes] = useState<number>(
        slot.endTime === storeConfig?.store_closing ? storeConfig?.keyholder_after_minutes ?? 0 : 0
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

        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);
        const storeOpeningMinutes = timeToMinutes(storeConfig.store_opening);
        const storeClosingMinutes = timeToMinutes(storeConfig.store_closing);

        if (startMinutes >= endMinutes) {
            newErrors.time = "End time must be after start time";
        }

        if (startMinutes < storeOpeningMinutes || endMinutes > storeClosingMinutes) {
            newErrors.time = "Time slot must be within store hours";
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

    const handleTimeChange = (type: 'start' | 'end', value: string) => {
        const snappedTime = snapToQuarterHour(value);
        if (type === 'start') {
            setStartTime(snappedTime);
        } else {
            setEndTime(snappedTime);
        }
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
                        onChange={(e) => handleTimeChange('start', e.target.value)}
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
                        onChange={(e) => handleTimeChange('end', e.target.value)}
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