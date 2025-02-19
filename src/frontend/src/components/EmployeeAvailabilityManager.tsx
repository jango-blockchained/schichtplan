import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { Availability, TimeSlot, createAvailability, deleteAvailability, getEmployeeAvailabilities, updateAvailability } from '@/services/api';
import { toast } from '@/components/ui/use-toast';

interface EmployeeAvailabilityManagerProps {
    employeeId: number;
}

export const EmployeeAvailabilityManager: React.FC<EmployeeAvailabilityManagerProps> = ({
    employeeId,
}) => {
    const [availabilities, setAvailabilities] = useState<Availability[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [isRecurring, setIsRecurring] = useState(false);
    const [availabilityType, setAvailabilityType] = useState<Availability['availability_type']>('unavailable');
    const [reason, setReason] = useState('');
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

    useEffect(() => {
        loadAvailabilities();
    }, [employeeId]);

    const loadAvailabilities = async () => {
        try {
            const data = await getEmployeeAvailabilities(employeeId);
            setAvailabilities(data);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load availabilities",
                variant: "destructive",
            });
        }
    };

    const handleSubmit = async () => {
        if (!selectedDate) return;

        try {
            const newAvailability: Omit<Availability, 'id'> = {
                employee_id: employeeId,
                start_date: format(selectedDate, 'yyyy-MM-dd'),
                end_date: format(selectedDate, 'yyyy-MM-dd'),
                availability_type: availabilityType,
                reason,
                is_recurring: isRecurring,
                recurrence_day: isRecurring ? selectedDate.getDay() : undefined,
            };

            if (timeSlots.length > 0) {
                // If time slots are selected, create separate availability entries for each slot
                for (const slot of timeSlots) {
                    await createAvailability({
                        ...newAvailability,
                        start_time: slot.start,
                        end_time: slot.end,
                    });
                }
            } else {
                // If no time slots selected, create a full-day availability
                await createAvailability(newAvailability);
            }

            toast({
                title: "Success",
                description: "Availability updated successfully",
            });

            // Reset form and reload availabilities
            setReason('');
            setTimeSlots([]);
            loadAvailabilities();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update availability",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteAvailability(id);
            toast({
                title: "Success",
                description: "Availability deleted successfully",
            });
            loadAvailabilities();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete availability",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Set Availability</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <Label>Recurring</Label>
                            <Switch
                                checked={isRecurring}
                                onCheckedChange={setIsRecurring}
                            />
                        </div>

                        <div className="grid gap-4">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => setSelectedDate(date instanceof Date ? date : undefined)}
                            />

                            <div className="space-y-2">
                                <Label>Availability Type</Label>
                                <Select
                                    value={availabilityType}
                                    onValueChange={(value: Availability['availability_type']) => setAvailabilityType(value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unavailable">Unavailable</SelectItem>
                                        <SelectItem value="preferred_off">Prefer Not to Work</SelectItem>
                                        <SelectItem value="preferred_work">Prefer to Work</SelectItem>
                                        <SelectItem value="available">Available</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Reason (Optional)</Label>
                                <Input
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Enter reason..."
                                />
                            </div>

                            <AvailabilityCalendar
                                availability={timeSlots}
                                onChange={setTimeSlots}
                            />

                            <Button onClick={handleSubmit}>Save Availability</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Current Availabilities</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {availabilities.map((availability) => (
                            <div
                                key={availability.id}
                                className="flex items-center justify-between p-4 border rounded-lg"
                            >
                                <div>
                                    <p className="font-medium">
                                        {availability.is_recurring
                                            ? `Every ${format(new Date(2024, 0, availability.recurrence_day! + 1), 'EEEE')}`
                                            : `${format(new Date(availability.start_date), 'PP')}`}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {availability.start_time && availability.end_time
                                            ? `${availability.start_time} - ${availability.end_time}`
                                            : 'All Day'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {availability.availability_type.replace('_', ' ')}
                                        {availability.reason && ` - ${availability.reason}`}
                                    </p>
                                </div>
                                <Button
                                    variant="destructive"
                                    onClick={() => availability.id && handleDelete(availability.id)}
                                >
                                    Delete
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}; 