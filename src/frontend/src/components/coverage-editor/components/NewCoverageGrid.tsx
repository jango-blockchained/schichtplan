import React from 'react';
import { cn } from '@/lib/utils';
import { CoverageTimeSlot, StoreConfig } from '../types';
import { DAYS_SHORT } from '../utils/constants';
import { Key } from 'lucide-react';
import { GRID_CONSTANTS } from '../utils/constants';

interface NewCoverageGridProps {
    coverage: {
        dayIndex: number;
        timeSlots: CoverageTimeSlot[];
    }[];
    storeConfig: StoreConfig;
    isEditing: boolean;
    onUpdateSlot: (dayIndex: number, slotIndex: number, updates: Partial<CoverageTimeSlot>) => void;
    onDeleteSlot: (dayIndex: number, slotIndex: number) => void;
    onAddSlot: (dayIndex: number, startTime: string) => void;
    onEditSlot: (dayIndex: number, slotIndex: number) => void;
}

const generateTimeSlots = (storeConfig: StoreConfig): {
    allSlots: string[],
    regularSlots: string[],
    beforeSlot: string | null,
    afterSlot: string | null
} => {
    const slots: string[] = [];
    const regularSlots: string[] = [];

    // Calculate before slot if needed
    let beforeSlot: string | null = null;
    if (storeConfig.keyholder_before_minutes) {
        const beforeTime = new Date(`2024-01-01 ${storeConfig.store_opening}`);
        beforeTime.setMinutes(beforeTime.getMinutes() - storeConfig.keyholder_before_minutes);
        beforeSlot = beforeTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        slots.push(beforeSlot);
    }

    // Regular store hours
    let current = new Date(`2024-01-01 ${storeConfig.store_opening}`);
    const storeEnd = new Date(`2024-01-01 ${storeConfig.store_closing}`);

    while (current <= storeEnd) {
        const timeSlot = current.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        slots.push(timeSlot);
        regularSlots.push(timeSlot);
        current.setMinutes(current.getMinutes() + 60);
    }

    // Calculate after slot if needed
    let afterSlot: string | null = null;
    if (storeConfig.keyholder_after_minutes) {
        const afterTime = new Date(`2024-01-01 ${storeConfig.store_closing}`);
        afterTime.setMinutes(afterTime.getMinutes() + storeConfig.keyholder_after_minutes);
        afterSlot = afterTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        slots.push(afterSlot);
    }

    return { allSlots: slots, regularSlots, beforeSlot, afterSlot };
};

export const NewCoverageGrid: React.FC<NewCoverageGridProps> = ({
    coverage,
    storeConfig,
    isEditing,
    onUpdateSlot,
    onDeleteSlot,
    onAddSlot,
    onEditSlot
}) => {
    const { allSlots, regularSlots, beforeSlot, afterSlot } = generateTimeSlots(storeConfig);

    return (
        <div className="w-full overflow-x-auto bg-background">
            <div className="min-w-[800px] relative">
                {/* Time labels */}
                <div className="flex border-b bg-muted/5">
                    <div className="w-16 shrink-0" />
                    {allSlots.map((time) => (
                        <div
                            key={time}
                            className={cn(
                                "w-24 text-center py-2 border-r",
                                "font-medium tracking-tight",
                                time === beforeSlot || time === afterSlot
                                    ? "bg-amber-500/10 text-amber-600"
                                    : "text-muted-foreground"
                            )}
                            style={{ fontSize: GRID_CONSTANTS.FONT_SIZE.TIMELINE }}
                        >
                            {time === beforeSlot && (
                                <div className="flex items-center justify-center gap-1">
                                    <Key className="h-3 w-3" />
                                    <span>Opening</span>
                                </div>
                            )}
                            {time === afterSlot && (
                                <div className="flex items-center justify-center gap-1">
                                    <Key className="h-3 w-3" />
                                    <span>Closing</span>
                                </div>
                            )}
                            {time !== beforeSlot && time !== afterSlot && time}
                        </div>
                    ))}
                </div>

                {/* Day rows */}
                <div className="relative">
                    {coverage.map(({ dayIndex, timeSlots: slots }) => (
                        <div key={dayIndex} className="flex border-b relative h-12">
                            {/* Day label */}
                            <div className="w-16 shrink-0 flex items-center justify-center font-medium border-r">
                                {DAYS_SHORT[dayIndex]}
                            </div>

                            {/* Time grid */}
                            <div className="flex-1 relative">
                                {/* Grid lines */}
                                <div className="absolute inset-0 flex pointer-events-none">
                                    {allSlots.map((time, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-24 h-full border-r",
                                                time === beforeSlot || time === afterSlot
                                                    ? "border-amber-200/50 bg-amber-50/30"
                                                    : "border-border/50"
                                            )}
                                        />
                                    ))}
                                </div>

                                {/* Clickable areas for adding new blocks */}
                                {isEditing && (
                                    <div className="absolute inset-0 flex">
                                        {regularSlots.map((time, i) => (
                                            <div
                                                key={i}
                                                className="w-24 h-full hover:bg-primary/5 cursor-pointer transition-colors"
                                                onClick={() => onAddSlot(dayIndex, time)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Coverage blocks */}
                                {slots.map((slot, index) => {
                                    const startIndex = allSlots.findIndex(t => t === slot.startTime);
                                    const endIndex = allSlots.findIndex(t => t === slot.endTime);
                                    if (startIndex === -1) return null;

                                    const width = (endIndex - startIndex || 1) * 96;
                                    const left = startIndex * 96;

                                    const isKeyholderSlot =
                                        (slot.startTime === beforeSlot && slot.requiresKeyholder) ||
                                        (slot.endTime === afterSlot && slot.requiresKeyholder);

                                    return (
                                        <div
                                            key={index}
                                            style={{
                                                position: 'absolute',
                                                left: `${left}px`,
                                                width: `${width}px`,
                                                top: '4px',
                                                bottom: '4px',
                                            }}
                                            className="z-10"
                                        >
                                            <div className={cn(
                                                "h-full rounded-md border px-2 flex items-center justify-center gap-1",
                                                isKeyholderSlot
                                                    ? "bg-amber-500/10 border-amber-200"
                                                    : "bg-primary/10 border-primary/20",
                                                isEditing && "cursor-pointer hover:bg-primary/20"
                                            )}
                                                onClick={() => isEditing && onEditSlot(dayIndex, index)}
                                            >
                                                {isKeyholderSlot && <Key className="h-3 w-3 text-amber-600" />}
                                                <span className="text-xs font-medium whitespace-nowrap overflow-hidden">
                                                    {slot.startTime}-{slot.endTime} ({slot.minEmployees}-{slot.maxEmployees})
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}; 