import React from 'react';
import { useDrop } from 'react-dnd';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeGridCellProps } from '../types';
import { timeToMinutes } from '../utils/time';
import { GRID_CONSTANTS } from '../utils/constants';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const { CELL_HEIGHT } = GRID_CONSTANTS;

export const TimeGridCell: React.FC<TimeGridCellProps> = ({
    hour,
    cellIndex,
    dayIndex,
    slots,
    onAddSlot,
    isEditing,
    onDropBlock,
    minuteWidth,
    gridStartMinutes
}) => {
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: 'COVERAGE_BLOCK',
        collect: monitor => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
        drop: (item: { type: string; slot: any }) => {
            onDropBlock?.(item.slot, cellIndex);
        },
    });

    const currentHour = parseInt(hour);
    const nextHour = currentHour + 1;
    const timeRangeDisplay = `${hour} - ${nextHour.toString().padStart(2, '0')}:00`;

    // Calculate cell width based on minutes
    const cellStartMinutes = timeToMinutes(hour);
    const cellWidth = minuteWidth * 60; // Each cell represents 1 hour (60 minutes)

    const hasSlotInHour = slots.some(slot => {
        const startHour = parseInt(slot.startTime.split(':')[0]);
        const endHour = parseInt(slot.endTime.split(':')[0]);
        return currentHour >= startHour && currentHour < endHour;
    });

    // Create quarter-hour tooltips
    const getTimeForQuarter = (minutes: number) => {
        return `${currentHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        ref={drop}
                        style={{ width: cellWidth }}
                        className={cn(
                            "relative border-r border-border/50 transition-colors duration-200",
                            isOver && "bg-primary/5",
                            hasSlotInHour && "bg-primary/5"
                        )}
                        title={timeRangeDisplay}
                    >
                        {isEditing && !hasSlotInHour && (
                            <button
                                onClick={onAddSlot}
                                className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                            >
                                <Plus className="h-4 w-4 text-muted-foreground" />
                            </button>
                        )}
                        {/* Quarter-hour markers */}
                        {[15, 30, 45].map((minutes) => (
                            <TooltipProvider key={minutes}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="absolute top-0 bottom-0 cursor-help"
                                            style={{ left: `${(minutes / 60) * 100}%` }}
                                        >
                                            <div className={cn(
                                                "absolute inset-y-0 w-px transition-colors duration-300",
                                                minutes === 30 ? "bg-border/50" : "bg-border/30",
                                                isOver && "bg-primary/30"
                                            )} />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                        {getTimeForQuarter(minutes)}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </div>
                </TooltipTrigger>
            </Tooltip>
        </TooltipProvider>
    );
}; 