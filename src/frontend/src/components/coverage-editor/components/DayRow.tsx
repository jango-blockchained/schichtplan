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
    const handleDropBlock = (slot: any, newStartIndex: number) => {
        const newStartTime = hours[newStartIndex];
        const durationMinutes = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
        const newEndTime = minutesToTime(timeToMinutes(newStartTime) + durationMinutes);

        // Find the slot index in the current slots array
        const slotIndex = slots.findIndex(s =>
            s.startTime === slot.startTime &&
            s.endTime === slot.endTime
        );

        if (slotIndex !== -1) {
            onUpdateSlot(slotIndex, {
                startTime: snapToQuarterHour(newStartTime),
                endTime: snapToQuarterHour(newEndTime)
            });
        }
    };

    return (
        <div className="flex border-b relative" style={{ height: CELL_HEIGHT }}>
            {/* Day label */}
            <div
                className="shrink-0 flex items-center justify-center font-medium border-r bg-muted/5"
                style={{ width: TIME_COLUMN_WIDTH }}
            >
                {dayName}
            </div>

            {/* Time grid */}
            <div className="flex-1 flex relative">
                {hours.map((hour, index) => (
                    <TimeGridCell
                        key={hour}
                        hour={hour}
                        cellIndex={index}
                        dayIndex={dayIndex}
                        slots={slots}
                        onAddSlot={() => onAddSlot(index)}
                        isEditing={isEditing}
                        onDropBlock={handleDropBlock}
                    />
                ))}

                {/* Coverage blocks */}
                {slots.map((slot, index) => (
                    <CoverageBlock
                        key={`${slot.startTime}-${slot.endTime}-${index}`}
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