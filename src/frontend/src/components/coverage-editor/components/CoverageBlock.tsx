import React, { useEffect, useRef, useState } from "react";
import { useDrag } from "react-dnd";
import { Clock, PencilIcon, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CoverageBlockProps } from "../types";
import { GRID_CONSTANTS } from "../utils/constants";
import {
  formatDuration,
  minutesToTime,
  snapToQuarterHour,
  timeToMinutes,
  calculateGridPosition,
  normalizeTime,
} from "../utils/time";
import { BlockEditor } from "./BlockEditor";

const { TIME_COLUMN_WIDTH, CELL_HEIGHT, BLOCK_VERTICAL_PADDING } =
  GRID_CONSTANTS;

export const CoverageBlock: React.FC<CoverageBlockProps> = ({
  slot,
  dayIndex,
  slotIndex,
  onUpdate,
  onDelete,
  isEditing,
  gridWidth,
  storeConfig,
  hours,
  isSelected,
  onSelect,
  selectionMode,
}) => {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [showEditor, setShowEditor] = useState(false);

  // Normalize times to ensure consistent format
  const displayStartTime = normalizeTime(slot.startTime);
  const displayEndTime = normalizeTime(slot.endTime);

  // Use snapped times for calculations
  const snappedStartTime = snapToQuarterHour(displayStartTime);
  const snappedEndTime = snapToQuarterHour(displayEndTime);

  // Determine if this is an opening or closing shift
  const isEarlyShift = snappedStartTime === storeConfig.store_opening;
  const isLateShift = snappedEndTime === storeConfig.store_closing;

  // Calculate grid dimensions
  const gridStartTime = hours[0];
  const gridEndTime = hours[hours.length - 1];
  const gridStartMinutes = timeToMinutes(gridStartTime);
  const gridEndMinutes = timeToMinutes(gridEndTime) + 60;
  const totalGridMinutes = gridEndMinutes - gridStartMinutes;

  // Calculate block position and dimensions
  const startMinutes = timeToMinutes(displayStartTime);
  const endMinutes = timeToMinutes(displayEndTime);

  // Calculate the width of the grid content area
  const gridContentWidth = gridWidth - TIME_COLUMN_WIDTH;

  // Calculate position and width using the utility function
  const startOffset = calculateGridPosition(
    displayStartTime,
    gridStartTime,
    totalGridMinutes,
    gridContentWidth,
  );
  const endOffset = calculateGridPosition(
    displayEndTime,
    gridStartTime,
    totalGridMinutes,
    gridContentWidth,
  );
  const blockWidth = endOffset - startOffset;

  // Calculate keyholder times
  const keyholderBeforeMinutes = isEarlyShift
    ? storeConfig.keyholder_before_minutes
    : 0;
  const keyholderAfterMinutes = isLateShift
    ? storeConfig.keyholder_after_minutes
    : 0;

  const keyholderBeforeWidth =
    keyholderBeforeMinutes > 0
      ? calculateGridPosition(
          minutesToTime(startMinutes - keyholderBeforeMinutes),
          gridStartTime,
          totalGridMinutes,
          gridContentWidth,
        ) - startOffset
      : 0;
  const keyholderAfterWidth =
    keyholderAfterMinutes > 0
      ? calculateGridPosition(
          minutesToTime(endMinutes + keyholderAfterMinutes),
          gridStartTime,
          totalGridMinutes,
          gridContentWidth,
        ) - endOffset
      : 0;

  const duration = formatDuration(displayStartTime, displayEndTime);

  // Create a unique key for the block
  const blockKey = `${dayIndex}-${displayStartTime}-${displayEndTime}`;

  const [{ isDragging }, drag] = useDrag({
    type: "COVERAGE_BLOCK",
    item: {
      type: "COVERAGE_BLOCK",
      slot: {
        ...slot,
        startTime: displayStartTime,
        endTime: displayEndTime,
      },
      dayIndex,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: () => isEditing && !isResizing,
  });

  useEffect(() => {
    if (blockRef.current && !selectionMode) {
      drag(blockRef.current);
    }
  }, [drag, selectionMode]);

  const handleBlockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectionMode) {
      onSelect(!isSelected);
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (!isEditing || selectionMode) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setStartX(e.pageX);
    setStartWidth(blockRef.current?.offsetWidth || 0);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    e.preventDefault();

    const diff = e.pageX - startX;
    const minuteWidth = gridContentWidth / totalGridMinutes;

    // Calculate new end minutes with 15-minute snapping
    const additionalMinutes = Math.round(diff / minuteWidth / 15) * 15;
    const newEndMinutes = Math.min(
      Math.max(startMinutes + 15, endMinutes + additionalMinutes),
      gridEndMinutes,
    );

    // Update block width using the grid position calculation
    if (blockRef.current) {
      const newEndOffset = calculateGridPosition(
        minutesToTime(newEndMinutes),
        gridStartTime,
        totalGridMinutes,
        gridContentWidth,
      );
      const newWidth = newEndOffset - startOffset;
      blockRef.current.style.width = `${newWidth}px`;
    }
  };

  const handleResizeEnd = () => {
    if (!isResizing) return;
    setIsResizing(false);

    const width = blockRef.current?.offsetWidth || 0;
    const widthPercentage = width / gridContentWidth;
    const durationMinutes =
      Math.round((widthPercentage * totalGridMinutes) / 15) * 15;
    const newEndMinutes = startMinutes + durationMinutes;
    const newEndTime = snapToQuarterHour(minutesToTime(newEndMinutes));

    onUpdate({
      endTime: newEndTime,
    });
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
      return () => {
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [isResizing]);

  // Debug logging
  console.log("Block Timing:", {
    snappedStartTime,
    snappedEndTime,
    gridStartMinutes,
    startMinutes,
    endMinutes,
    keyholderBeforeMinutes,
    keyholderAfterMinutes,
    startOffset,
    blockWidth,
  });

  useEffect(() => {
    if (blockRef.current) {
      const computedStyle = window.getComputedStyle(blockRef.current);
      console.log("CSS Properties - Position Exact:", {
        left: computedStyle.left,
        top: computedStyle.top,
        width: computedStyle.width,
        height: computedStyle.height,
        zIndex: computedStyle.zIndex,
        opacity: computedStyle.opacity,
        transform: computedStyle.transform,
        pointerEvents: computedStyle.pointerEvents,
      });
    }
  }, [isDragging, isResizing, isEditing, blockWidth, startOffset]);

  useEffect(() => {
    if (blockRef.current) {
      console.log("CSS Properties - Position Relative:", {
        left: `${TIME_COLUMN_WIDTH + startOffset}px`,
        width: `${blockWidth}px`,
        height: `${CELL_HEIGHT - BLOCK_VERTICAL_PADDING * 2}px`,
        top: `${BLOCK_VERTICAL_PADDING}px`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isResizing ? 10 : isDragging ? 20 : 1,
        transform: isDragging ? "scale(1.02)" : "scale(1)",
        pointerEvents: isEditing ? "all" : "none",
      });
    }
  }, [isDragging, isResizing, isEditing, blockWidth, startOffset]);

  return (
    <>
      <div
        key={blockKey}
        ref={blockRef}
        style={{
          position: "absolute",
          left: `${TIME_COLUMN_WIDTH + startOffset}px`,
          width: `${blockWidth}px`,
          height: `${CELL_HEIGHT - BLOCK_VERTICAL_PADDING * 2}px`,
          top: `${BLOCK_VERTICAL_PADDING}px`,
          opacity: isDragging ? 0.5 : 1,
          zIndex: isResizing ? 10 : isDragging ? 20 : 1,
          transform: isDragging ? "scale(1.02)" : "scale(1)",
          pointerEvents: (isEditing || selectionMode) ? "all" : "none",
        }}
        className={cn(
          "border rounded-md px-2.5 py-1.5 flex group relative",
          selectionMode ? "cursor-pointer" : "cursor-move",
          isSelected
            ? "bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-400/50"
            : "bg-primary/5 border-primary/20",
          isEditing && !selectionMode ? "hover:bg-primary/10 hover:border-primary/30" : "",
          selectionMode ? "hover:bg-primary/10" : "",
          "shadow-sm hover:shadow transition-all duration-200 ease-in-out",
          isDragging && "ring-2 ring-primary/30 shadow-lg",
          isResizing && "ring-2 ring-primary/50",
        )}
        onClick={handleBlockClick}
      >
        {isEarlyShift && keyholderBeforeMinutes > 0 && (
          <div
            className="absolute right-full h-full"
            style={{
              width: `${keyholderBeforeWidth}px`,
              right: `${blockWidth}px`,
            }}
          >
            <div className="w-full h-full bg-yellow-500/10 border-y border-l border-yellow-500/20 rounded-l-md flex items-center justify-center">
              <div className="flex items-center gap-1 px-1">
                <span className="text-[10px]">🔑</span>
                <span className="text-[10px] text-yellow-600/70">
                  {keyholderBeforeMinutes}m
                </span>
              </div>
            </div>
          </div>
        )}
        {isLateShift && keyholderAfterMinutes > 0 && (
          <div
            className="absolute left-full h-full -ml-px flex items-center"
            style={{ width: `${keyholderAfterWidth}px` }}
          >
            <div className="w-full h-full bg-yellow-500/10 border-y border-r border-yellow-500/20 rounded-r-md flex items-center justify-center">
              <div className="flex items-center gap-1 px-1">
                <span className="text-[10px]">🔑</span>
                <span className="text-[10px] text-yellow-600/70">
                  {keyholderAfterMinutes}m
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-between items-center gap-2 select-none w-full">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-primary font-medium text-xs whitespace-nowrap">
              {displayStartTime} - {displayEndTime}
            </span>
            <span className="text-muted-foreground font-medium bg-background/50 px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap">
              {duration}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-primary/5 px-2 py-0.5 rounded-full text-[10px] border border-primary/10 text-muted-foreground whitespace-nowrap">
              {slot.minEmployees}-{slot.maxEmployees}{" "}
              {slot.minEmployees === 1 ? "person" : "people"}
            </span>
            {(slot.requiresKeyholder || isEarlyShift || isLateShift) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1 text-primary/70 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10 whitespace-nowrap">
                    <span className="text-[10px]">🔑</span>
                    <Clock className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p className="font-medium">Keyholder needed:</p>
                    {isEarlyShift && (
                      <p>
                        {storeConfig.keyholder_before_minutes} min before
                        opening
                      </p>
                    )}
                    {isLateShift && (
                      <p>
                        {storeConfig.keyholder_after_minutes} min after closing
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isEditing && !selectionMode && (
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEditor(true);
                        }}
                        className="p-1 hover:bg-primary/10 rounded-md transition-colors"
                      >
                        <PencilIcon className="h-3.5 w-3.5 text-primary/70" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Edit block</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                        }}
                        className="p-1 hover:bg-destructive/10 rounded-md text-destructive/70 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Delete block</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            {selectionMode && isSelected && (
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {isEditing && !selectionMode && (
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize rounded-r-md transition-colors",
              "hover:bg-primary/20 hover:w-2",
              isResizing && "bg-primary/30 w-2",
            )}
            onMouseDown={handleResizeStart}
          />
        )}
      </div>
      {showEditor && (
        <Dialog open={showEditor} onOpenChange={setShowEditor}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Coverage Block</DialogTitle>
            </DialogHeader>
            <BlockEditor
              slot={slot}
              onSave={(updates) => {
                onUpdate(updates);
                setShowEditor(false);
              }}
              onCancel={() => setShowEditor(false)}
              storeConfig={storeConfig}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
