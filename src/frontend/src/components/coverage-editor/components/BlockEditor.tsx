import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { BlockEditorProps } from '../types';
import { snapToQuarterHour, timeToMinutes } from '../utils/time';

export const BlockEditor: React.FC<BlockEditorProps> = ({ slot, onSave, onCancel, storeConfig }) => {
    const [startTime, setStartTime] = useState(slot.startTime);
    const [endTime, setEndTime] = useState(slot.endTime);
    const [minEmployees, setMinEmployees] = useState(slot.minEmployees);
    const [maxEmployees, setMaxEmployees] = useState(slot.maxEmployees);
    const [employeeTypes, setEmployeeTypes] = useState(slot.employeeTypes);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Calculate keyholder requirements based on store settings
    const isEarlyShift = startTime === storeConfig.store_opening;
    const isLateShift = endTime === storeConfig.store_closing;
    const requiresKeyholder = isEarlyShift || isLateShift;
    const keyholderBeforeMinutes = isEarlyShift ? storeConfig.keyholder_before_minutes : 0;
    const keyholderAfterMinutes = isLateShift ? storeConfig.keyholder_after_minutes : 0;

    const handleTimeChange = (type: 'start' | 'end', value: string) => {
        const newErrors = { ...errors };
        delete newErrors.time;

        const storeOpeningMinutes = timeToMinutes(storeConfig.store_opening);
        const storeClosingMinutes = timeToMinutes(storeConfig.store_closing);
        const startMinutes = timeToMinutes(type === 'start' ? value : startTime);
        const endMinutes = timeToMinutes(type === 'end' ? value : endTime);

        // Validate times are within store hours
        if (startMinutes < storeOpeningMinutes || endMinutes > storeClosingMinutes) {
            newErrors.time = "Time slot must be within store hours";
        }

        // Validate end time is after start time
        if (endMinutes <= startMinutes) {
            newErrors.time = "End time must be after start time";
        }

        setErrors(newErrors);

        if (type === 'start') {
            setStartTime(value);
        } else {
            setEndTime(value);
        }
    };

    const handleSave = () => {
        if (Object.keys(errors).length > 0) return;

        onSave({
            startTime,
            endTime,
            minEmployees,
            maxEmployees,
            employeeTypes,
            requiresKeyholder,
            keyholderBeforeMinutes,
            keyholderAfterMinutes
        });
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
                        onChange={(e) => setMinEmployees(parseInt(e.target.value))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="maxEmployees">Max Employees</Label>
                    <Input
                        id="maxEmployees"
                        type="number"
                        min={minEmployees}
                        value={maxEmployees}
                        onChange={(e) => setMaxEmployees(parseInt(e.target.value))}
                    />
                </div>
            </div>

            {requiresKeyholder && (
                <div className="space-y-2">
                    <p className="text-sm font-medium">Keyholder Requirements</p>
                    {isEarlyShift && (
                        <p className="text-sm text-muted-foreground">
                            Keyholder must arrive {keyholderBeforeMinutes} minutes before opening
                        </p>
                    )}
                    {isLateShift && (
                        <p className="text-sm text-muted-foreground">
                            Keyholder must stay {keyholderAfterMinutes} minutes after closing
                        </p>
                    )}
                </div>
            )}

            <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave} disabled={Object.keys(errors).length > 0}>Save</Button>
            </div>
        </div>
    );
}; 