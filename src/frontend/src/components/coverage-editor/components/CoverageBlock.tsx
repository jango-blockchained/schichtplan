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

    const startMinutes = timeToMinutes(snappedStartTime);
    const endMinutes = timeToMinutes(snappedEndTime);
    const gridStartMinutes = timeToMinutes(hours[0]);
    const gridEndMinutes = timeToMinutes(hours[hours.length - 1]) + 60;

    const gridContentWidth = gridWidth - TIME_COLUMN_WIDTH;
    const minuteWidth = gridContentWidth / (gridEndMinutes - gridStartMinutes);

    // Precise position and width calculation using snapped times
    const startOffset = (startMinutes - gridStartMinutes) * minuteWidth;
    const blockWidth = (endMinutes - startMinutes) * minuteWidth;

    const isEarlyShift = snappedStartTime === storeConfig.store_opening;
    const isLateShift = snappedEndTime === storeConfig.store_closing;
    const duration = formatDuration(snappedStartTime, snappedEndTime);

    const [{ isDragging }, drag] = useDrag({
        type: 'COVERAGE_BLOCK',
        item: {
            type: 'COVERAGE_BLOCK',
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
        const newMinutes = Math.round((startWidth + diff) / minuteWidth);
        const snappedMinutes = Math.round(newMinutes / 15) * 15;
        const newWidth = Math.max(minuteWidth * 15, Math.min(snappedMinutes * minuteWidth, gridContentWidth));

        if (blockRef.current) {
            blockRef.current.style.width = `${newWidth}px`;
        }
    };

    const handleResizeEnd = () => {
        if (!isResizing) return;
        setIsResizing(false);

        const width = blockRef.current?.offsetWidth || 0;
        const newMinutes = Math.round(width / minuteWidth);
        const snappedMinutes = Math.round(newMinutes / 15) * 15;
        const newEndMinutes = startMinutes + snappedMinutes;
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

    return (
        <div
            ref={blockRef}
            style={{
                position: 'absolute',
                left: `${TIME_COLUMN_WIDTH + startOffset}px`,
                width: `${blockWidth}px`,
                height: `${CELL_HEIGHT - BLOCK_VERTICAL_PADDING * 2}px`,
                opacity: isDragging ? 0.5 : 1,
            }}
            className={cn(
                "bg-primary/10 border border-primary/20 rounded-sm p-1 cursor-move flex flex-col",
                isEditing ? "hover:bg-primary/20" : ""
            )}
        >
            <div className="flex justify-between items-start gap-1 mb-auto">
                <div className="flex flex-col min-w-0 flex-grow">
                    <div className="flex justify-between items-center text-xs font-medium">
                        <span className="truncate">{snappedStartTime} - {snappedEndTime}</span>
                        <span className="text-muted-foreground ml-2">{duration}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{slot.minEmployees}-{slot.maxEmployees} {slot.minEmployees === 1 ? 'person' : 'people'}</span>
                    </div>
                    {(slot.requiresKeyholder || isEarlyShift || isLateShift) && (
                        <div className="flex items-center gap-1 text-xs text-primary">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger className="flex items-center gap-1 hover:text-primary/80">
                                        <span>🔑</span>
                                        <Clock className="h-3 w-3" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                        <p className="font-medium">Keyholder needed:</p>
                                        {isEarlyShift && (
                                            <p>{storeConfig.keyholder_before_minutes} min before opening</p>
                                        )}
                                        {isLateShift && (
                                            <p>{storeConfig.keyholder_after_minutes} min after closing</p>
                                        )}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
                </div>
                {isEditing && (
                    <div className="flex gap-0.5 shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowEditor(true);
                            }}
                            className="p-0.5 hover:bg-primary/20 rounded-sm"
                        >
                            <PencilIcon className="h-3 w-3" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-0.5 hover:bg-destructive/20 rounded-sm text-destructive"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                )}
            </div>
            {isEditing && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/20"
                    onMouseDown={handleResizeStart}
                />
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