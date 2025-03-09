import { useState, useEffect, ChangeEvent } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';

interface ShiftEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: Schedule;
    onSave: (scheduleId: number, updates: Partial<Schedule>) => Promise<void>;
}

export function ShiftEditModal({ isOpen, onClose, schedule, onSave }: ShiftEditModalProps) {
    const [selectedShiftId, setSelectedShiftId] = useState<string>(schedule.shift_id?.toString() ?? '');
    const [breakStart, setBreakStart] = useState(schedule.break_start ?? '');
    const [breakEnd, setBreakEnd] = useState(schedule.break_end ?? '');
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
        setBreakStart(schedule.break_start ?? '');
        setBreakEnd(schedule.break_end ?? '');
        setNotes(schedule.notes ?? '');
    }, [schedule]);

    const handleSave = async () => {
        console.log('🟢 ShiftEditModal handleSave called');
        setIsSubmitting(true);
        try {
            const updates: Partial<Schedule> = {
                shift_id: selectedShiftId ? parseInt(selectedShiftId, 10) : undefined,
                break_start: breakStart || undefined,
                break_end: breakEnd || undefined,
                notes: notes || undefined,
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

    const timeStringToDate = (timeStr: string): Date => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours);
        date.setMinutes(minutes);
        return date;
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="breakStart">Pause Start</Label>
                            <Input
                                id="breakStart"
                                type="time"
                                value={breakStart}
                                onChange={(e) => setBreakStart(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="breakEnd">Pause Ende</Label>
                            <Input
                                id="breakEnd"
                                type="time"
                                value={breakEnd}
                                onChange={(e) => setBreakEnd(e.target.value)}
                            />
                        </div>
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