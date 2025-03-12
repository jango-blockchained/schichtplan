import { useState, useEffect, ChangeEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Schedule, ScheduleUpdate } from '@/types';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { getShifts, createShift } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';

interface ShiftEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: Schedule;
    onSave: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
}

export function ShiftEditModal({ isOpen, onClose, schedule, onSave }: ShiftEditModalProps) {
    const [selectedShiftId, setSelectedShiftId] = useState<string>(schedule.shift_id?.toString() ?? '');
    const [breakDuration, setBreakDuration] = useState<number>((schedule as any).break_duration ?? 0);
    const [notes, setNotes] = useState(schedule.notes ?? '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const { data: shifts } = useQuery({
        queryKey: ['shifts'],
        queryFn: getShifts,
    });

    useEffect(() => {
        if (schedule.shift_id) {
            setSelectedShiftId(schedule.shift_id.toString());
        }
        setBreakDuration((schedule as any).break_duration ?? 0);
        setNotes(schedule.notes ?? '');
    }, [schedule]);

    const handleSave = async () => {
        console.log('🟢 ShiftEditModal handleSave called');
        setIsSubmitting(true);
        try {
            const updates: ScheduleUpdate = {
                shift_id: selectedShiftId ? parseInt(selectedShiftId, 10) : null,
                break_duration: breakDuration || null,
                notes: notes || null,
            };

            console.log('🟢 Calling onSave with:', { scheduleId: schedule.id, updates });
            await onSave(schedule.id, updates);
            console.log('🟢 onSave completed successfully');

            toast({
                title: "Success",
                description: "Shift updated successfully",
            });
            onClose();
        } catch (error) {
            console.error('🟢 Error in handleSave:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update shift",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {schedule.shift_id ? 'Schicht bearbeiten' : 'Neue Schicht erstellen'}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="shift">Schicht</Label>
                        <Select
                            value={selectedShiftId}
                            onValueChange={setSelectedShiftId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Schicht auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                                {shifts?.map((shift) => (
                                    <SelectItem key={shift.id} value={shift.id.toString()}>
                                        {shift.start_time} - {shift.end_time}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="breakDuration">Pausenlänge: {breakDuration} Minuten</Label>
                        <Slider
                            id="breakDuration"
                            value={[breakDuration]}
                            min={0}
                            max={60}
                            step={5}
                            onValueChange={(values) => setBreakDuration(values[0])}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notizen</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                            placeholder="Notizen zur Schicht..."
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={onClose}>
                        Abbrechen
                    </Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? 'Speichern...' : 'Speichern'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
} 