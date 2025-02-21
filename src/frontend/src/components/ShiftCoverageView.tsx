import React from 'react';
import { Card } from '@/components/ui/card';
import { Settings, Shift } from '@/types';
import { addMinutes, format, subMinutes } from 'date-fns';

interface ShiftCoverageViewProps {
    settings: Settings;
    shifts: Shift[];
}

const ALL_DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const formatTime = (hours: number, minutes: number = 0): string => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const ShiftCoverageView: React.FC<ShiftCoverageViewProps> = ({ settings, shifts }) => {
    // Calculate extended time range including keyholder times
    const storeOpeningMinutes = timeToMinutes(settings.general.store_opening);
    const storeClosingMinutes = timeToMinutes(settings.general.store_closing);

    const startMinutes = storeOpeningMinutes - settings.general.keyholder_before_minutes;
    const endMinutes = storeClosingMinutes + settings.general.keyholder_after_minutes;

    const startHour = Math.floor(startMinutes / 60);
    const endHour = Math.ceil(endMinutes / 60);
    const totalHours = endHour - startHour;

    // Generate time labels for the timeline
    const timeLabels = Array.from({ length: totalHours + 1 }, (_, i) => {
        const hour = startHour + i;
        return formatTime(hour);
    });

    return (
        <Card className="p-4 space-y-4">
            <h3 className="font-semibold">Schichtabdeckung</h3>
            <div className="relative">
                {/* Time labels */}
                <div className="grid grid-cols-12 text-xs text-muted-foreground mb-2">
                    {timeLabels.map((label, index) => (
                        <div
                            key={label}
                            className="text-center"
                            style={{
                                gridColumn: index === timeLabels.length - 1 ? 'span 1' : 'span 1',
                            }}
                        >
                            {label}
                        </div>
                    ))}
                </div>

                {/* Day rows */}
                <div className="space-y-2">
                    {ALL_DAYS.map((day, dayIndex) => {
                        const isStoreOpen = settings.general.opening_days[dayIndex.toString()];
                        const dayShifts = shifts.filter(shift => shift.active_days[dayIndex.toString()]);

                        return (
                            <div key={day} className="relative h-12">
                                {/* Day label */}
                                <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-16 text-sm">
                                    {day}
                                </div>

                                {/* Store hours background */}
                                <div className={`h-full rounded-md ${isStoreOpen ? 'bg-muted' : 'bg-muted/30'}`}>
                                    {/* Keyholder time before opening */}
                                    {isStoreOpen && (
                                        <div
                                            className="absolute h-8 top-2 bg-yellow-100 border border-yellow-300 rounded-l"
                                            style={{
                                                left: '0%',
                                                width: `${(settings.general.keyholder_before_minutes / (totalHours * 60)) * 100}%`,
                                            }}
                                            title={`Keyholder time before opening (${settings.general.keyholder_before_minutes} min)`}
                                        />
                                    )}

                                    {/* Keyholder time after closing */}
                                    {isStoreOpen && (
                                        <div
                                            className="absolute h-8 top-2 bg-yellow-100 border border-yellow-300 rounded-r"
                                            style={{
                                                right: '0%',
                                                width: `${(settings.general.keyholder_after_minutes / (totalHours * 60)) * 100}%`,
                                            }}
                                            title={`Keyholder time after closing (${settings.general.keyholder_after_minutes} min)`}
                                        />
                                    )}

                                    {/* Shift blocks */}
                                    {isStoreOpen && dayShifts.map((shift) => {
                                        const shiftStartMinutes = timeToMinutes(shift.start_time) - (startHour * 60);
                                        const shiftEndMinutes = timeToMinutes(shift.end_time) - (startHour * 60);
                                        const left = (shiftStartMinutes / (totalHours * 60)) * 100;
                                        const width = ((shiftEndMinutes - shiftStartMinutes) / (totalHours * 60)) * 100;

                                        return (
                                            <div
                                                key={`${shift.id}-${day}`}
                                                className="absolute h-8 top-2 bg-primary/20 border border-primary rounded"
                                                style={{
                                                    left: `${left}%`,
                                                    width: `${width}%`,
                                                }}
                                                title={`${shift.start_time}-${shift.end_time} (${shift.min_employees}-${shift.max_employees} MA)`}
                                            >
                                                <div className="absolute inset-0 flex items-center justify-center text-xs truncate px-1">
                                                    {shift.min_employees}-{shift.max_employees} MA
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Employee count indicators */}
                                {isStoreOpen && (
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                                        <span className="text-xs text-muted-foreground">
                                            {dayShifts.reduce((acc, shift) => acc + shift.max_employees, 0)} MA max
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center space-x-4 text-xs text-muted-foreground">
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-muted rounded"></div>
                        <span>Öffnungszeit</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-primary/20 border border-primary rounded"></div>
                        <span>Schicht</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
                        <span>Keyholder Zeit</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-muted/30 rounded"></div>
                        <span>Geschlossen</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}; 