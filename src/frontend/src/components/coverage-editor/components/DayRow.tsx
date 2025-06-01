import React from "react";
import { DayRowProps } from "../types";
import { GRID_CONSTANTS } from "../utils/constants";
import { minutesToTime, snapToQuarterHour, timeToMinutes } from "../utils/time";
import { TimeGridCell } from "./TimeGridCell";
import { CoverageBlock } from "./CoverageBlock";

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
  selectedBlocks,
  onBlockSelect,
  selectionMode,
}) => {
  // Calculate grid dimensions using exact store hours
  const gridStartMinutes = timeToMinutes(storeConfig.store_opening);
  const gridEndMinutes = timeToMinutes(storeConfig.store_closing);
  const totalGridMinutes = gridEndMinutes - gridStartMinutes;

  // Calculate grid content width and minute width
  const gridContentWidth = gridWidth - TIME_COLUMN_WIDTH;
  const minuteWidth = gridContentWidth / totalGridMinutes;

  const handleDropBlock = (slot: any, cellIndex: number) => {
    if (!isEditing) return;

    // Find the slot index
    const slotIndex = slots.findIndex(
      (s) =>
        s.startTime === slot.startTime &&
        s.endTime === slot.endTime &&
        s.minEmployees === slot.minEmployees &&
        s.maxEmployees === slot.maxEmployees,
    );

    if (slotIndex === -1) return;

    // Calculate new start time based on cell index
    // Each cell represents one hour, and we need to calculate the time at the start of that cell
    const hourOfDay = parseInt(hours[cellIndex].split(":")[0]);
    const minutesOfHour = parseInt(hours[cellIndex].split(":")[1] || "0");
    const newStartTime = `${hourOfDay.toString().padStart(2, "0")}:${minutesOfHour.toString().padStart(2, "0")}`;

    // Maintain the original duration
    const originalStartMinutes = timeToMinutes(slot.startTime);
    const originalEndMinutes = timeToMinutes(slot.endTime);
    const originalDuration = originalEndMinutes - originalStartMinutes;
    const newStartMinutes = timeToMinutes(newStartTime);
    const newEndMinutes = newStartMinutes + originalDuration;
    const newEndTime = minutesToTime(newEndMinutes);

    // Validate against store hours
    const storeOpeningMinutes = timeToMinutes(storeConfig.store_opening);
    const storeClosingMinutes = timeToMinutes(storeConfig.store_closing);

    if (
      newStartMinutes < storeOpeningMinutes ||
      newEndMinutes > storeClosingMinutes
    ) {
      return; // Outside store hours
    }

    // Check for conflicts using minute-based comparisons
    const hasConflict = slots.some((existingSlot, index) => {
      if (index === slotIndex) return false;

      const existingStartMinutes = timeToMinutes(existingSlot.startTime);
      const existingEndMinutes = timeToMinutes(existingSlot.endTime);

      return (
        newStartMinutes < existingEndMinutes &&
        newEndMinutes > existingStartMinutes
      );
    });

    if (!hasConflict) {
      onUpdateSlot(slotIndex, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
    }
  };

  return (
    <div className="relative" style={{ height: CELL_HEIGHT }}>
      <div
        className="absolute left-0 top-0 bottom-0 flex items-center justify-center bg-background border-r"
        style={{ width: TIME_COLUMN_WIDTH }}
      >
        <span className="text-sm font-medium">{dayName}</span>
      </div>
      <div
        className="absolute top-0 bottom-0 flex"
        style={{ left: TIME_COLUMN_WIDTH, right: 0 }}
      >
        {hours.map((hour, index) => (
          <TimeGridCell
            key={`${dayIndex}-${hour}`}
            hour={hour}
            cellIndex={index}
            dayIndex={dayIndex}
            slots={slots}
            onAddSlot={() => onAddSlot(index)}
            isEditing={isEditing}
            onDropBlock={handleDropBlock}
            minuteWidth={minuteWidth}
            gridStartMinutes={gridStartMinutes}
          />
        ))}
      </div>
      {slots.map((slot, index) => {
        const blockKey = `${dayIndex}-${index}`;
        const isSelected = selectedBlocks.has(blockKey);
        
        return (
          <CoverageBlock
            key={`${dayIndex}-${slot.startTime}-${slot.endTime}-${index}`}
            slot={slot}
            dayIndex={dayIndex}
            slotIndex={index}
            onUpdate={(updates) => onUpdateSlot(index, updates)}
            onDelete={() => onDeleteSlot(index)}
            isEditing={isEditing}
            gridWidth={gridWidth}
            storeConfig={storeConfig}
            hours={hours}
            gridStartMinutes={gridStartMinutes}
            totalGridMinutes={totalGridMinutes}
            isSelected={isSelected}
            onSelect={(selected) => onBlockSelect(dayIndex, index, selected)}
            selectionMode={selectionMode}
          />
        );
      })}
    </div>
  );
};
