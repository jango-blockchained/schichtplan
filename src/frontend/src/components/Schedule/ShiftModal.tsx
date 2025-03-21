import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Schedule } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule?: Schedule;
    onSave: (data: any) => Promise<void>;
    title?: string;
}

export function ShiftModal({ isOpen, onClose, schedule, onSave, title = "Shift Details" }: ShiftModalProps) {
    const [shiftData, setShiftData] = useState({
        start_time: schedule?.shift_start || schedule?.start_time || '09:00',
        end_time: schedule?.shift_end || schedule?.end_time || '17:00',
        shift_type_id: schedule?.shift_type_id || 'EARLY',
        notes: schedule?.notes || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setShiftData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setShiftData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        try {
            await onSave({
                ...schedule,
                ...shiftData
            });
            onClose();
        } catch (error) {
            console.error("Error saving shift:", error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="start_time" className="text-right">
                            Start Time
                        </Label>
                        <Input
                            id="start_time"
                            name="start_time"
                            type="time"
                            value={shiftData.start_time}
                            onChange={handleChange}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="end_time" className="text-right">
                            End Time
                        </Label>
                        <Input
                            id="end_time"
                            name="end_time"
                            type="time"
                            value={shiftData.end_time}
                            onChange={handleChange}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="shift_type_id" className="text-right">
                            Shift Type
                        </Label>
                        <Select
                            value={shiftData.shift_type_id}
                            onValueChange={(value) => handleSelectChange('shift_type_id', value)}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select shift type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="EARLY">Early</SelectItem>
                                <SelectItem value="MIDDLE">Middle</SelectItem>
                                <SelectItem value="LATE">Late</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="notes" className="text-right">
                            Notes
                        </Label>
                        <Input
                            id="notes"
                            name="notes"
                            value={shiftData.notes}
                            onChange={handleChange}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSubmit}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 