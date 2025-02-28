import React from 'react';
import { useDrop } from 'react-dnd';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeGridCellProps, CoverageTimeSlot } from '../types';
import { timeToMinutes } from '../utils/time';
import { GRID_CONSTANTS } from '../utils/constants';

const { CELL_HEIGHT } = GRID_CONSTANTS;

export const TimeGridCell: React.FC<TimeGridCellProps> = ({
    hour,
    cellIndex,
    dayIndex,
    slots,
    onAddSlot,
    isEditing,
    onDropBlock
}) => {
    const hasSlotInHour = slots.some(slot => {
        const slotHour = parseInt(slot.startTime.split(':')[0]);
        return slotHour === parseInt(hour);
    });

    const [{ isOver, canDrop }, drop] = useDrop({
        accept: 'coverage-block',
        canDrop: () => !hasSlotInHour && isEditing,
        drop: (item: any) => {
            if (onDropBlock) {
                onDropBlock(item.slot, cellIndex);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    });

    return (
        <div
            ref={drop}
            style={{ height: CELL_HEIGHT }}
            className={cn(
                "flex-1 relative border-r border-border/40 transition-all duration-300",
                isOver && canDrop && "bg-primary/20 border-primary shadow-inner ring-1 ring-primary/30",
                !hasSlotInHour && isEditing && "hover:bg-primary/10 hover:shadow-lg",
                cellIndex % 2 === 0 ? "bg-muted/10" : "bg-transparent",
                "group rounded-sm"
            )}
            onClick={() => !hasSlotInHour && isEditing && onAddSlot()}
        >
            {/* Vertical grid line */}
            <div className="absolute inset-y-0 right-0 w-px bg-border/40" />

            {/* Quarter hour markers */}
            {[15, 30, 45].map((minutes) => (
                <div
                    key={minutes}
                    className="absolute top-0 bottom-0"
                    style={{ left: `${(minutes / 60) * 100}%` }}
                >
                    <div className={cn(
                        "absolute inset-y-0 w-px transition-colors duration-300",
                        minutes === 30 ? "bg-border/50" : "bg-border/30",
                        isOver && "bg-primary/30"
                    )} />
                </div>
            ))}

            {/* Drop indicator */}
            {isOver && canDrop && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-2 border-2 border-dashed border-primary/30 rounded animate-pulse" />
                    <div className="relative z-10 bg-primary/20 rounded-full p-2">
                        <Plus className="h-5 w-5 text-primary animate-bounce" />
                    </div>
                </div>
            )}

            {/* Add button */}
            {!hasSlotInHour && isEditing && !isOver && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className={cn(
                        "rounded-full p-2 transition-all duration-300 transform",
                        "bg-primary/20 backdrop-blur-sm shadow-lg",
                        "group-hover:scale-110 group-hover:bg-primary/30",
                        "group-active:scale-95 group-active:bg-primary/40",
                        "border border-primary/30"
                    )}>
                        <Plus className="h-4 w-4 text-primary" />
                    </div>
                </div>
            )}
        </div>
    );
}; 