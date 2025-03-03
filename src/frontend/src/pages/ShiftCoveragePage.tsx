import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getShifts, Shift } from '@/services/api';
import { format } from 'date-fns';

interface TimeSlot {
    time: string;
    shifts: Shift[];
}

export function ShiftCoveragePage() {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

    useEffect(() => {
        const fetchShifts = async () => {
            try {
                const shiftsData = await getShifts();
                setShifts(shiftsData);
                generateTimeSlots(shiftsData);
            } catch (error) {
                console.error('Failed to fetch shifts:', error);
            }
        };
        fetchShifts();
    }, []);

    const generateTimeSlots = (shifts: Shift[]) => {
        // Generate 24-hour time slots
        const slots: TimeSlot[] = [];
        for (let hour = 0; hour < 24; hour++) {
            const time = `${hour.toString().padStart(2, '0')}:00`;
            const shiftsInSlot = shifts.filter(shift => {
                const shiftStart = parseInt(shift.start_time.split(':')[0]);
                const shiftEnd = parseInt(shift.end_time.split(':')[0]);
                if (shiftEnd <= shiftStart) {
                    // Overnight shift
                    return hour >= shiftStart || hour < shiftEnd;
                }
                return hour >= shiftStart && hour < shiftEnd;
            });
            slots.push({ time, shifts: shiftsInSlot });
        }
        setTimeSlots(slots);
    };

    return (
        <div className="container mx-auto py-6">
            <Card>
                <CardHeader>
                    <CardTitle>Shift Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative w-96 h-96 mx-auto">
                        {/* Clock circle */}
                        <div className="absolute inset-0 rounded-full border-2 border-gray-200" />

                        {/* Hour markers */}
                        {Array.from({ length: 24 }, (_, i) => (
                            <div
                                key={i}
                                className="absolute w-1 h-4 bg-gray-300"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    transformOrigin: '50% 0',
                                    transform: `rotate(${i * 15}deg) translateY(-50%)`,
                                }}
                            />
                        ))}

                        {/* Time slots with shifts */}
                        {timeSlots.map((slot, index) => {
                            const angle = (index * 15 - 90) * (Math.PI / 180);
                            const radius = 160; // Slightly smaller than the clock face
                            const x = Math.cos(angle) * radius + 192; // 192 is half of the container width
                            const y = Math.sin(angle) * radius + 192;

                            return (
                                <div
                                    key={slot.time}
                                    className={`absolute flex items-center justify-center w-8 h-8 -ml-4 -mt-4 rounded-full ${slot.shifts.length > 0 ? 'bg-blue-500 text-white' : 'bg-gray-100'
                                        }`}
                                    style={{
                                        left: `${x}px`,
                                        top: `${y}px`,
                                    }}
                                    title={`${slot.time} - ${slot.shifts.length} shifts`}
                                >
                                    {slot.shifts.length}
                                </div>
                            );
                        })}

                        {/* Center text showing current time */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-lg font-semibold">
                                {format(new Date(), 'HH:mm')}
                            </div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-6 grid grid-cols-2 gap-4">
                        {timeSlots.map(slot => (
                            <div key={slot.time} className="flex items-center space-x-2">
                                <div className={`w-4 h-4 rounded-full ${slot.shifts.length > 0 ? 'bg-blue-500' : 'bg-gray-100'
                                    }`} />
                                <span>{slot.time} - {slot.shifts.length} shifts</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 