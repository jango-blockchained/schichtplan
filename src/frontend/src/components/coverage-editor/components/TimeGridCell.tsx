import React from 'react';
import { useDrop } from 'react-dnd';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeGridCellProps } from '../types';
import { timeToMinutes } from '../utils/time';

export const TimeGridCell: React.FC<TimeGridCellProps> = ({
    hour,
    cellIndex,
    dayIndex,
    slots,
    onAddSlot,
    isEditing,
    onDropBlock
}) => {
    const [{ isOver }, drop] = useDrop({
        accept: 'COVERAGE_BLOCK',
        collect: monitor => ({
            isOver: monitor.isOver(),
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
            className={cn(
                "flex-1 relative border-r border-border/40",
                isOver && "bg-primary/5",
                !hasSlotInHour && isEditing && "hover:bg-accent/20",
                currentHour % 2 === 0 ? "bg-muted/20" : "bg-transparent"
            )}
            onClick={() => !hasSlotInHour && isEditing && onAddSlot()}
        >
            {!hasSlotInHour && isEditing && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="rounded-full bg-primary/10 p-1">
                        <Plus className="h-4 w-4 text-primary/70" />
                    </div>
                </div>
            )}
        </div>
    );
}; 