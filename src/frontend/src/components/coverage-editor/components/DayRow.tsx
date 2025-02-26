import React from 'react';
import { DayRowProps } from '../types';
import { GRID_CONSTANTS } from '../utils/constants';
import { minutesToTime, snapToQuarterHour, timeToMinutes } from '../utils/time';
import { TimeGridCell } from './TimeGridCell';
import { CoverageBlock } from './CoverageBlock';

const { TIME_COLUMN_WIDTH, CELL_HEIGHT } = GRID_CONSTANTS;

export const DayRow: React.FC<DayRowProps> = ({
    dayName,
    dayIndex,
    slots,
    hours,
    onAddSlot,
    onUpdateSlot,
    onDeleteSlot,
    isEditing,
    gridWidth,
    storeConfig,
}) => {
    const gridStartMinutes = timeToMinutes(hours[0]);
    const gridEndMinutes = timeToMinutes(hours[hours.length - 1]) + 60;
    const totalGridMinutes = gridEndMinutes - gridStartMinutes;

    const gridContentWidth = gridWidth - TIME_COLUMN_WIDTH;
    const minuteWidth = gridContentWidth / totalGridMinutes;

    const handleDropBlock = (slot: any, cellIndex: number) => {
        if (!isEditing) return;

        // Find the slot index
        const slotIndex = slots.findIndex(s =>
            s.startTime === slot.startTime &&
            s.endTime === slot.endTime &&
            s.minEmployees === slot.minEmployees &&
            s.maxEmployees === slot.maxEmployees
        );

        if (slotIndex === -1) return;

        // Calculate new start time based on cell index and grid start time
        const cellMinutes = cellIndex * 60; // Each cell is one hour
        const newStartMinutes = gridStartMinutes + cellMinutes;

        // Maintain the original duration
        const originalDuration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
        const newEndMinutes = newStartMinutes + originalDuration;

        // Convert to time strings and snap to quarter hours
        const newStartTime = snapToQuarterHour(minutesToTime(newStartMinutes));
        const newEndTime = snapToQuarterHour(minutesToTime(newEndMinutes));

        // Validate against store hours
        const storeOpeningMinutes = timeToMinutes(storeConfig.store_opening);
        const storeClosingMinutes = timeToMinutes(storeConfig.store_closing);

        if (timeToMinutes(newStartTime) < storeOpeningMinutes ||
            timeToMinutes(newEndTime) > storeClosingMinutes) {
            return; // Outside store hours
        }

        // Check for conflicts using minute-based comparisons
        const hasConflict = slots.some((existingSlot, index) => {
            if (index === slotIndex) return false;

            const existingStartMinutes = timeToMinutes(existingSlot.startTime);
            const existingEndMinutes = timeToMinutes(existingSlot.endTime);
            const newStartMin = timeToMinutes(newStartTime);
            const newEndMin = timeToMinutes(newEndTime);

            return (newStartMin < existingEndMinutes && newEndMin > existingStartMinutes);
        });

        if (!hasConflict) {
            onUpdateSlot(slotIndex, {
                startTime: newStartTime,
                endTime: newEndTime
            });
        }
    };

    return (
        <div className="flex w-full border-b border-border/50 hover:bg-accent/5">
            <div
                className="flex items-center justify-center font-medium shrink-0 border-r border-border/50 text-sm text-muted-foreground"
                style={{ width: TIME_COLUMN_WIDTH, height: CELL_HEIGHT }}
            >
                {dayName}
            </div>
            <div className="flex-1 relative flex">
                {hours.map((hour, i) => (
                    <TimeGridCell
                        key={hour}
                        hour={hour}
                        cellIndex={i}
                        dayIndex={dayIndex}
                        slots={slots}
                        onAddSlot={() => onAddSlot(i)}
                        isEditing={isEditing}
                        onDropBlock={handleDropBlock}
                    />
                ))}
                {slots.map((slot, index) => (
                    <CoverageBlock
                        key={index}
                        slot={slot}
                        dayIndex={dayIndex}
                        onUpdate={(updates) => onUpdateSlot(index, updates)}
                        onDelete={() => onDeleteSlot(index)}
                        isEditing={isEditing}
                        gridWidth={gridWidth}
                        storeConfig={storeConfig}
                        hours={hours}
                    />
                ))}
            </div>
        </div>
    );
}; 