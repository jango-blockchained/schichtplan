import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Settings } from '@/types';
import { Shift } from '@/services/api';
import { Trash } from 'lucide-react';

interface ShiftFormProps {
    settings?: Settings;
    shift?: Shift;
    onSave: (data: {
        start_time: string;
        end_time: string;
        min_employees: number;
        max_employees: number;
        requires_break: boolean;
        active_days: { [key: string]: boolean };
    }) => void;
    onDelete?: () => void;
}

const ALL_DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// Helper function to convert active_days from array to object if needed
const normalizeActiveDays = (activeDays: any): { [key: string]: boolean } => {
    if (Array.isArray(activeDays)) {
        // Convert from number[] to {[key: string]: boolean}
        const result: { [key: string]: boolean } = {};
        for (let i = 0; i < 7; i++) {
            result[i.toString()] = activeDays.includes(i);
        }
        return result;
    }
    return activeDays || {};
};

export const ShiftForm: React.FC<ShiftFormProps> = ({ settings, shift, onSave, onDelete }) => {
    const defaultSettings = settings || {
        general: {
            store_opening: '08:00',
            store_closing: '20:00',
            opening_days: { '1': true, '2': true, '3': true, '4': true, '5': true, '0': false, '6': false }
        }
    };

    const [formData, setFormData] = useState({
        start_time: shift?.start_time || defaultSettings.general.store_opening,
        end_time: shift?.end_time || defaultSettings.general.store_closing,
        min_employees: shift?.min_employees || 1,
        max_employees: shift?.max_employees || 5,
        requires_break: shift?.requires_break ?? true,
        active_days: normalizeActiveDays(shift?.active_days) || normalizeActiveDays(defaultSettings.general.opening_days),
    });

    useEffect(() => {
        if (shift) {
            setFormData({
                start_time: shift.start_time,
                end_time: shift.end_time,
                min_employees: shift.min_employees,
                max_employees: shift.max_employees,
                requires_break: shift.requires_break,
                active_days: normalizeActiveDays(shift.active_days),
            });
        }
    }, [shift]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    // Convert time string to minutes for calculations
    const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Calculate shift duration in hours
    const calculateDuration = (): number => {
        const startMinutes = timeToMinutes(formData.start_time);
        const endMinutes = timeToMinutes(formData.end_time);
        let duration = endMinutes - startMinutes;
        if (duration < 0) duration += 24 * 60; // Handle overnight shifts
        return duration / 60;
    };

    return (
        <Card className="p-4">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">
                        {shift ? `Schicht ${shift.id}` : 'Neue Schicht'}
                    </h3>
                    {onDelete && (
                        <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={onDelete}
                        >
                            <Trash className="h-4 w-4 mr-1" /> Löschen
                        </Button>
                    )}
                </div>

                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label>Öffnungszeiten</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="start_time">Beginn</Label>
                                <Input
                                    id="start_time"
                                    type="time"
                                    value={formData.start_time}
                                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="end_time">Ende</Label>
                                <Input
                                    id="end_time"
                                    type="time"
                                    value={formData.end_time}
                                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Aktive Tage</Label>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {ALL_DAYS.map((day) => (
                                        <TableHead key={day} className="text-center">{day}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    {ALL_DAYS.map((_, index) => (
                                        <TableCell key={index} className="text-center">
                                            <Switch
                                                checked={!!formData.active_days[index.toString()]}
                                                onCheckedChange={(checked) =>
                                                    setFormData({
                                                        ...formData,
                                                        active_days: {
                                                            ...formData.active_days,
                                                            [index.toString()]: checked,
                                                        },
                                                    })
                                                }
                                            />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div className="grid gap-2">
                        <Label>Schicht Visualisierung</Label>
                        <Card className="p-4">
                            <div className="relative h-12 bg-muted rounded-md">
                                {/* Store hours background */}
                                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs text-muted-foreground">
                                    <span>{defaultSettings.general.store_opening}</span>
                                    <span>{defaultSettings.general.store_closing}</span>
                                </div>

                                {/* Shift visualization */}
                                <div
                                    className="absolute h-8 top-2 bg-primary/20 border border-primary rounded"
                                    style={{
                                        left: `${(timeToMinutes(formData.start_time) - timeToMinutes(defaultSettings.general.store_opening)) / (timeToMinutes(defaultSettings.general.store_closing) - timeToMinutes(defaultSettings.general.store_opening)) * 100}%`,
                                        width: `${(timeToMinutes(formData.end_time) - timeToMinutes(formData.start_time)) / (timeToMinutes(defaultSettings.general.store_closing) - timeToMinutes(defaultSettings.general.store_opening)) * 100}%`,
                                    }}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center text-xs">
                                        {calculateDuration().toFixed(1)}h
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="min_employees">Min. Mitarbeiter</Label>
                            <Input
                                id="min_employees"
                                type="number"
                                min="1"
                                value={formData.min_employees}
                                onChange={(e) => setFormData({ ...formData, min_employees: parseInt(e.target.value) })}
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="max_employees">Max. Mitarbeiter</Label>
                            <Input
                                id="max_employees"
                                type="number"
                                min={formData.min_employees}
                                value={formData.max_employees}
                                onChange={(e) => setFormData({ ...formData, max_employees: parseInt(e.target.value) })}
                                required
                            />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="requires_break"
                            checked={formData.requires_break}
                            onCheckedChange={(checked) => setFormData({ ...formData, requires_break: checked })}
                        />
                        <Label htmlFor="requires_break">Pause erforderlich</Label>
                    </div>
                </div>

                <Button type="submit" className="w-full">
                    Speichern
                </Button>
            </form>
        </Card>
    );
}; 