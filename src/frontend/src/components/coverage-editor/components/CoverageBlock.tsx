import React, { useEffect, useRef, useState } from 'react';
import { useDrag } from 'react-dnd';
import { Clock, PencilIcon, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CoverageBlockProps } from '../types';
import { GRID_CONSTANTS } from '../utils/constants';
import { formatDuration, minutesToTime, snapToQuarterHour, timeToMinutes } from '../utils/time';
import { BlockEditor } from './BlockEditor';

const { TIME_COLUMN_WIDTH, CELL_HEIGHT, BLOCK_VERTICAL_PADDING } = GRID_CONSTANTS;

export const CoverageBlock: React.FC<CoverageBlockProps> = ({
    slot,
    dayIndex,
    onUpdate,
    onDelete,
    isEditing,
    gridWidth,
    storeConfig,
    hours
}) => {
    const blockRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startWidth, setStartWidth] = useState(0);
    const [showEditor, setShowEditor] = useState(false);

    // Always use snapped times for position and width calculations
    const snappedStartTime = snapToQuarterHour(slot.startTime);
    const snappedEndTime = snapToQuarterHour(slot.endTime);

    // Determine if this is an opening or closing shift
    const isEarlyShift = snappedStartTime === storeConfig.store_opening;
    const isLateShift = snappedEndTime === storeConfig.store_closing;

    // Calculate grid dimensions - use store hours without keyholder times
    const gridStartTime = hours[0];
    const gridEndTime = hours[hours.length - 1];
    const gridStartMinutes = timeToMinutes(gridStartTime);
    const gridEndMinutes = timeToMinutes(gridEndTime);
    const totalGridMinutes = gridEndMinutes - gridStartMinutes;

    // Calculate block position and dimensions
    const startMinutes = timeToMinutes(snappedStartTime);
    const endMinutes = timeToMinutes(snappedEndTime);

    // Calculate the width of one hour in pixels
    const gridContentWidth = gridWidth - TIME_COLUMN_WIDTH;
    const hourWidth = gridContentWidth / (hours.length);

    // Calculate position based on hours from start, accounting for column centering
    const startHour = Math.floor((startMinutes - gridStartMinutes) / 60);
    const startMinuteOffset = (startMinutes - gridStartMinutes) % 60;
    const startOffsetPercentage = startMinuteOffset / 60;

    // Calculate the exact pixel position
    const startOffset = (startHour * hourWidth) + (startOffsetPercentage * hourWidth);

    // Calculate block width based on duration
    const durationMinutes = endMinutes - startMinutes;
    const durationHours = durationMinutes / 60;
    const blockWidth = durationHours * hourWidth;

    // Calculate keyholder times
    let keyholderBeforeMinutes = 0;
    let keyholderAfterMinutes = 0;
    let keyholderBeforeOffset = 0;
    let keyholderAfterOffset = 0;

    if (isEarlyShift) {
        keyholderBeforeMinutes = storeConfig.keyholder_before_minutes;
        const keyholderStartHour = Math.floor((startMinutes - keyholderBeforeMinutes - gridStartMinutes) / 60);
        const keyholderStartOffset = (startMinutes - keyholderBeforeMinutes - gridStartMinutes) % 60;
        keyholderBeforeOffset = (keyholderStartHour * hourWidth) + ((keyholderStartOffset / 60) * hourWidth);
    }
    if (isLateShift) {
        keyholderAfterMinutes = storeConfig.keyholder_after_minutes;
        const keyholderEndHour = Math.floor((endMinutes + keyholderAfterMinutes - gridStartMinutes) / 60);
        const keyholderEndOffset = (endMinutes + keyholderAfterMinutes - gridStartMinutes) % 60;
        keyholderAfterOffset = (keyholderEndHour * hourWidth) + ((keyholderEndOffset / 60) * hourWidth);
    }

    // Calculate keyholder extensions
    const keyholderBeforeWidth = keyholderBeforeMinutes > 0 ? (keyholderBeforeMinutes / 60) * hourWidth : 0;
    const keyholderAfterWidth = keyholderAfterMinutes > 0 ? (keyholderAfterMinutes / 60) * hourWidth : 0;

    const duration = formatDuration(snappedStartTime, snappedEndTime);

    // Create a unique key for the block
    const blockKey = `${dayIndex}-${snappedStartTime}-${snappedEndTime}`;

    const [{ isDragging }, drag] = useDrag({
        type: 'coverage-block',
        item: {
            type: 'coverage-block',
            slot: {
                ...slot,
                startTime: snappedStartTime,
                endTime: snappedEndTime
            },
            dayIndex
        },
        collect: monitor => ({
            isDragging: monitor.isDragging(),
        }),
        canDrag: () => isEditing && !isResizing,
    });

    useEffect(() => {
        if (blockRef.current) {
            drag(blockRef.current);
        }
    }, [drag]);

    const handleResizeStart = (e: React.MouseEvent) => {
        if (!isEditing) return;
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
        // Convert the pixel difference to hours
        const additionalHours = diff / hourWidth;
        // Round to nearest 15 minutes
        const additionalMinutes = Math.round(additionalHours * 60 / 15) * 15;
        const newEndMinutes = startMinutes + additionalMinutes;

        // Calculate new width based on rounded minutes
        const newDurationHours = (newEndMinutes - startMinutes) / 60;
        const newWidth = Math.max(0.25 * hourWidth, Math.min(newDurationHours * hourWidth, gridContentWidth - startOffset));

        if (blockRef.current) {
            blockRef.current.style.width = `${newWidth}px`;
        }
    };

    const handleResizeEnd = () => {
        if (!isResizing) return;
        setIsResizing(false);

        const width = blockRef.current?.offsetWidth || 0;
        // Convert width back to hours
        const durationHours = width / hourWidth;
        // Round to nearest 15 minutes
        const durationMinutes = Math.round(durationHours * 60 / 15) * 15;
        const newEndMinutes = startMinutes + durationMinutes;
        const newEndTime = minutesToTime(newEndMinutes);

        onUpdate({
            endTime: snapToQuarterHour(newEndTime)
        });
    };

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeEnd);
            return () => {
                window.removeEventListener('mousemove', handleResizeMove);
                window.removeEventListener('mouseup', handleResizeEnd);
            };
        }
    }, [isResizing]);

    console.log("snappedStartTime:", snappedStartTime);
    console.log("snappedEndTime:", snappedEndTime);
    console.log("gridStartMinutes:", gridStartMinutes);
    console.log("startMinutes:", startMinutes);
    console.log("endMinutes:", endMinutes);
    console.log("keyholderBeforeMinutes:", keyholderBeforeMinutes);
    console.log("keyholderAfterMinutes:", keyholderAfterMinutes);
    console.log("keyholderBeforeOffset:", keyholderBeforeOffset);
    console.log("startOffset:", startOffset);
    console.log("blockWidth:", blockWidth);
    useEffect(() => {
        if (blockRef.current) {
            const computedStyle = window.getComputedStyle(blockRef.current);
            console.log("CSS Properties - Position Exact:");
            console.log("left:", computedStyle.left);
            console.log("top:", computedStyle.top);
            console.log("width:", computedStyle.width);
            console.log("height:", computedStyle.height);
            console.log("zIndex:", computedStyle.zIndex);
            console.log("opacity:", computedStyle.opacity);
            console.log("transform:", computedStyle.transform);
            console.log("pointerEvents:", computedStyle.pointerEvents);
        }
    }, [isDragging, isResizing, isEditing, blockWidth, startOffset]);

    useEffect(() => {
        if (blockRef.current) {
            const computedStyle = window.getComputedStyle(blockRef.current);
            console.log("CSS Properties - Position Relative:");
            console.log("left:", `${TIME_COLUMN_WIDTH + startOffset}px`);
            console.log("width:", `${blockWidth}px`);
            console.log("height:", `${CELL_HEIGHT - BLOCK_VERTICAL_PADDING * 2}px`);
            console.log("top:", `${BLOCK_VERTICAL_PADDING}px`);
            console.log("opacity:", isDragging ? 0.5 : 1);
            console.log("zIndex:", isResizing ? 10 : isDragging ? 20 : 1);
            console.log("transform:", isDragging ? 'scale(1.02)' : 'scale(1)');
            console.log("pointerEvents:", isEditing ? 'all' : 'none');
        }
    }, [isDragging, isResizing, isEditing, blockWidth, startOffset]);

    return (
        <div
            ref={blockRef}
            style={{
                position: 'absolute',
                left: `${startOffset}px`,
                width: `${blockWidth}px`,
                height: `${CELL_HEIGHT - 2 * BLOCK_VERTICAL_PADDING}px`,
                top: `${BLOCK_VERTICAL_PADDING}px`,
                fontSize: GRID_CONSTANTS.FONT_SIZE.BLOCK,
                zIndex: isDragging ? 50 : isResizing ? 40 : 1,
                transform: isDragging ? 'scale(1.02)' : 'none',
                opacity: isDragging ? 0.7 : 1,
                cursor: isEditing ? (isResizing ? 'col-resize' : 'move') : 'default'
            }}
            className={cn(
                "flex items-center px-2 rounded-md transition-all duration-200",
                "border shadow-sm",
                slot.requiresKeyholder
                    ? "bg-amber-50 border-amber-200/70"
                    : "bg-primary/5 border-primary/20",
                isDragging && "ring-2 ring-primary shadow-lg",
                isResizing && "ring-2 ring-primary"
            )}
        >
            {/* Keyholder indicator */}
            {slot.requiresKeyholder && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-l" />
            )}

            <div className="flex justify-between items-center gap-2 select-none w-full min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                    <span className="text-primary font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                        {snappedStartTime} - {snappedEndTime}
                    </span>
                    <span className="text-muted-foreground font-medium bg-background/50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {duration}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn(
                        "px-1.5 py-0.5 rounded-full border whitespace-nowrap",
                        slot.requiresKeyholder
                            ? "bg-amber-50/80 border-amber-200/50 text-amber-700"
                            : "bg-primary/5 border-primary/10 text-muted-foreground"
                    )}>
                        {slot.minEmployees}-{slot.maxEmployees}
                    </span>
                </div>
            </div>

            {/* Resize handle */}
            {isEditing && (
                <div
                    className={cn(
                        "absolute right-0 top-0 bottom-0 w-2 cursor-col-resize",
                        "hover:bg-primary/20 rounded-r",
                        isResizing && "bg-primary/30"
                    )}
                    onMouseDown={handleResizeStart}
                />
            )}

            {/* Edit/Delete buttons */}
            {isEditing && (
                <div className={cn(
                    "absolute -top-8 right-0 flex items-center gap-1 bg-background rounded-md shadow-lg border px-1 py-0.5",
                    "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                )}>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowEditor(true);
                                    }}
                                    className="p-1 hover:bg-primary/10 rounded"
                                >
                                    <PencilIcon className="h-3 w-3" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-xs">Edit block</p>
                            </TooltipContent>
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
                                    className={cn(
                                        "p-1 hover:bg-destructive/10 rounded text-destructive",
                                        "opacity-0 group-hover:opacity-100 transition-opacity",
                                        "border border-destructive/20"
                                    )}
                                >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-xs">Delete block</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}

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
        </div>
    );
}; 