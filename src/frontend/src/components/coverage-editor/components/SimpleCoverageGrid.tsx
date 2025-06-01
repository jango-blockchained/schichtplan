import React from 'react';
import { cn } from '@/lib/utils';
import { CoverageTimeSlot } from '../types';

interface SimpleCoverageGridProps {
    coverage: {
        dayIndex: number;
        timeSlots: CoverageTimeSlot[];
    }[];
    storeOpening: string;
    storeClosing: string;
}

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const CELL_WIDTH = 96;
const LABEL_WIDTH = 64;

export const SimpleCoverageGrid: React.FC<SimpleCoverageGridProps> = ({
    coverage,
    storeOpening,
    storeClosing,
}) => {
    // Generate hour labels
    const startHour = parseInt(storeOpening.split(':')[0]);
    const endHour = parseInt(storeClosing.split(':')[0]);
    const hours = Array.from(
        { length: endHour - startHour + 1 },
        (_, i) => `${(startHour + i).toString().padStart(2, '0')}:00`
    );

    return (
        <div className="w-full overflow-x-auto border rounded-md">
            <div className="min-w-[800px] relative bg-background">
                {/* Time labels */}
                <div className="flex border-b sticky top-0 bg-background z-10">
                    <div style={{ width: LABEL_WIDTH }} className="shrink-0" />
                    {hours.map((hour) => (
                        <div
                            key={hour}
                            style={{ width: CELL_WIDTH }}
                            className="text-center text-[10px] text-muted-foreground/70 py-2 border-r relative"
                        >
                            <span className="absolute left-1/2 -translate-x-1/2 -bottom-3">
                                {hour}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Day rows */}
                {coverage.map(({ dayIndex, timeSlots }) => (
                    <div key={dayIndex} className="flex border-b h-11">
                        {/* Day label */}
                        <div
                            style={{ width: LABEL_WIDTH }}
                            className="shrink-0 flex items-center justify-center font-medium border-r bg-muted/5 text-sm"
                        >
                            {DAYS[dayIndex]}
                        </div>

                        {/* Time slots container */}
                        <div className="flex-1 relative">
                            {/* Grid lines */}
                            <div className="absolute inset-0 flex">
                                {hours.map((_, i) => (
                                    <div
                                        key={i}
                                        style={{ width: CELL_WIDTH }}
                                        className="border-r h-full"
                                    />
                                ))}
                            </div>

                            {/* Coverage blocks */}
                            {timeSlots.map((slot, index) => {
                                const startHourDiff = parseInt(slot.startTime.split(':')[0]) - startHour;
                                const endHourDiff = parseInt(slot.endTime.split(':')[0]) - startHour;
                                const width = (endHourDiff - startHourDiff) * CELL_WIDTH;
                                const left = startHourDiff * CELL_WIDTH;

                                return (
                                    <div
                                        key={index}
                                        style={{
                                            left: `${left}px`,
                                            width: `${width}px`,
                                        }}
                                        className={cn(
                                            "absolute top-1 bottom-1",
                                            "bg-primary/5 border border-primary/20 rounded-md",
                                            "flex items-center justify-center px-2 z-10",
                                            slot.requiresKeyholder && "bg-amber-50/50 border-amber-200/50"
                                        )}
                                    >
                                        <span className="text-[10px] font-medium truncate">
                                            {slot.minEmployees}-{slot.maxEmployees}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}; 