import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Schedule, ShiftType } from '@/types';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { getShifts, createShift } from '@/services/api';

interface ShiftEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: Schedule;
    onSave: (scheduleId: number, updates: Partial<Schedule>) => Promise<void>;
}

export function ShiftEditModal({ isOpen, onClose, schedule, onSave }: ShiftEditModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [shifts, setShifts] = useState<{ id: number; start_time: string; end_time: string }[]>([]);
    const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
    const [manualTimeEdit, setManualTimeEdit] = useState(false);
    const [formData, setFormData] = useState({
        shift_start: schedule.shift_start,
        shift_end: schedule.shift_end,
        break_start: schedule.break_start || '',
        break_end: schedule.break_end || '',
        notes: schedule.notes || '',
    });
    const { toast } = useToast();

    useEffect(() => {
        const fetchShifts = async () => {
            try {
                const shiftsData = await getShifts();
                setShifts(shiftsData);
            } catch (error) {
                toast({
                    title: "Error",
                    description: "Failed to load shifts",
                    variant: "destructive",
                });
            }
        };
        fetchShifts();
    }, []);

    const handleShiftSelect = (shiftId: string) => {
        const selectedShift = shifts.find(s => s.id === parseInt(shiftId));
        if (selectedShift) {
            setSelectedShiftId(selectedShift.id);
            if (!manualTimeEdit) {
                setFormData(prev => ({
                    ...prev,
                    shift_start: selectedShift.start_time,
                    shift_end: selectedShift.end_time,
                }));
            }
        }
    };

    const findOrCreateShift = async () => {
        // Check if a shift with the same time range exists
        const existingShift = shifts.find(
            s => s.start_time === formData.shift_start && s.end_time === formData.shift_end
        );

        if (existingShift) {
            return existingShift.id;
        }

        // If no matching shift exists, create a new one
        try {
            const newShift = await createShift({
                start_time: formData.shift_start,
                end_time: formData.shift_end,
                min_employees: 1,
                max_employees: 3,
                requires_break: true,
                active_days: { '1': true, '2': true, '3': true, '4': true, '5': true, '6': false, '0': false }
            });

            // Add the new shift to the local state
            setShifts(prev => [...prev, newShift]);
            return newShift.id;
        } catch (error) {
            throw new Error('Failed to create new shift');
        }
    };

    const handleSave = async () => {
        try {
            setIsLoading(true);

            let updates: Partial<Schedule> = {
                ...formData
            };

            // If manual edit is enabled, find or create a matching shift
            if (manualTimeEdit) {
                const shiftId = await findOrCreateShift();
                updates.shift_id = shiftId;
            } else if (selectedShiftId) {
                updates.shift_id = selectedShiftId;
            }

            await onSave(schedule.id, updates);
            toast({
                title: "Success",
                description: "Shift updated successfully",
            });
            onClose();
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update shift",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const timeStringToDate = (timeStr: string): Date => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours);
        date.setMinutes(minutes);
        return date;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Shift</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Shift Type</Label>
                        <Select onValueChange={handleShiftSelect} value={selectedShiftId?.toString()}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a shift type" />
                            </SelectTrigger>
                            <SelectContent>
                                {shifts.map((shift) => (
                                    <SelectItem key={shift.id} value={shift.id.toString()}>
                                        {shift.start_time} - {shift.end_time}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="manualEdit"
                            checked={manualTimeEdit}
                            onCheckedChange={(checked) => setManualTimeEdit(checked as boolean)}
                        />
                        <Label htmlFor="manualEdit">Manual time editing</Label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Time</Label>
                            <DateTimePicker
                                date={timeStringToDate(formData.shift_start)}
                                setDate={(date) => setFormData({
                                    ...formData,
                                    shift_start: date.toLocaleTimeString('de-DE', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                    })
                                })}
                                disabled={!manualTimeEdit}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End Time</Label>
                            <DateTimePicker
                                date={timeStringToDate(formData.shift_end)}
                                setDate={(date) => setFormData({
                                    ...formData,
                                    shift_end: date.toLocaleTimeString('de-DE', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                    })
                                })}
                                disabled={!manualTimeEdit}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Break Start</Label>
                            <DateTimePicker
                                date={formData.break_start ? timeStringToDate(formData.break_start) : new Date()}
                                setDate={(date) => setFormData({
                                    ...formData,
                                    break_start: date.toLocaleTimeString('de-DE', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                    })
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Break End</Label>
                            <DateTimePicker
                                date={formData.break_end ? timeStringToDate(formData.break_end) : new Date()}
                                setDate={(date) => setFormData({
                                    ...formData,
                                    break_end: date.toLocaleTimeString('de-DE', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                    })
                                })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Notes</Label>
                        <Input
                            value={formData.notes}
                            onChange={(e) => setFormData({
                                ...formData,
                                notes: e.target.value
                            })}
                            placeholder="Add notes..."
                        />
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isLoading}>
                            Save Changes
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 