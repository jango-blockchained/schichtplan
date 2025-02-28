import React from 'react';
import { cn } from '@/lib/utils';
import { CoverageTimeSlot } from '../types';
import { Clock, GripHorizontal, PencilIcon, Trash2 } from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NewCoverageBlockProps {
    slot: CoverageTimeSlot;
    dayIndex: number;
    slotIndex: number;
    startSlotIndex: number;
    duration: number;
    isEditing: boolean;
    onUpdate: (updates: Partial<CoverageTimeSlot>) => void;
    onDelete: () => void;
    onEdit: () => void;
}

export const NewCoverageBlock: React.FC<NewCoverageBlockProps> = ({
    slot,
    dayIndex,
    slotIndex,
    startSlotIndex,
    duration,
    isEditing,
    onUpdate,
    onDelete,
    onEdit
}) => {
    return (
        <div
            className={cn(
                "absolute bg-primary/5 border border-primary/20 rounded-md",
                "flex items-center justify-between px-2 py-1 group",
                isEditing && "cursor-move hover:bg-primary/10 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
            )}
            style={{
                top: `${dayIndex * 40 + 4}px`, // Added 4px padding
                left: `calc(80px + (${startSlotIndex} * var(--slot-width)))`,
                width: `calc(${duration} * var(--slot-width))`,
                height: '32px'
            }}
        >
            {/* Drag handle - only visible when editing */}
            {isEditing && (
                <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
                    <GripHorizontal className="h-3 w-3" />
                </div>
            )}

            <div className="flex items-center gap-2 min-w-0 ml-5">
                <span className="text-primary font-medium text-[11px] whitespace-nowrap">
                    {slot.startTime} - {slot.endTime}
                </span>
                <span className="bg-primary/5 px-2 py-0.5 rounded-full text-[10px] border border-primary/10 text-muted-foreground whitespace-nowrap">
                    {slot.minEmployees}-{slot.maxEmployees} {slot.minEmployees === 1 ? 'person' : 'people'}
                </span>
            </div>

            <div className="flex items-center gap-2">
                {slot.requiresKeyholder && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 text-amber-600/70 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50 whitespace-nowrap">
                                <span className="text-[10px]">🔑</span>
                                <Clock className="h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                                <p className="font-medium">Keyholder needed</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {isEditing && (
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit();
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
            </div>

            {/* Resize handle */}
            {isEditing && (
                <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-primary/30 transition-all duration-200 rounded-r" />
            )}
        </div>
    );
}; 