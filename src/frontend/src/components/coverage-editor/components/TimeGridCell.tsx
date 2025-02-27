import React from 'react';
import { useDrop } from 'react-dnd';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeGridCellProps } from '../types';
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
    const hasSlotInHour = slots.some(slot => {
        const startHour = parseInt(slot.startTime.split(':')[0]);
        const endHour = parseInt(slot.endTime.split(':')[0]);
        return currentHour >= startHour && currentHour < endHour;
    });

    return (
        <div
            ref={drop}
            style={{ height: CELL_HEIGHT }}
            className={cn(
                "flex-1 relative border-r border-border/40 transition-all duration-300",
                isOver && canDrop && "bg-primary/20 border-primary shadow-inner",
                !hasSlotInHour && isEditing && "hover:bg-primary/10 hover:shadow-lg",
                currentHour % 2 === 0 ? "bg-muted/10" : "bg-transparent",
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

            {!hasSlotInHour && isEditing && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className={cn(
                        "rounded-full p-2.5 transition-all duration-300 transform",
                        "bg-primary/20 backdrop-blur-sm shadow-lg",
                        "group-hover:scale-110 group-hover:bg-primary/30",
                        "group-active:scale-95 group-active:bg-primary/40",
                        "border border-primary/30"
                    )}>
                        <Plus className="h-5 w-5 text-primary" />
                    </div>
                </div>
            )}
        </div>
    );
}; 