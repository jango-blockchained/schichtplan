import React, { useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Schedule, ScheduleUpdate } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Edit2, Trash2, Plus, AlertTriangle, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';
import { cn } from '@/lib/utils';
import { ShiftEditModal } from '../ShiftEditModal';
import { TimeSlotDisplay } from './TimeSlotDisplay';
import { useToast } from '@/components/ui/use-toast';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DragItem {
    type: 'SCHEDULE';
    scheduleId: number;
    employeeId: number;
    shiftId: number | null;
    date: string;
    shift_type_id?: string;
}

export interface ScheduleCellProps {
    schedule?: Schedule;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
    hasAbsence?: boolean;
    hasConflict?: boolean;
    isLoading?: boolean;
    className?: string;
    absenceInfo?: {
        type: string;
        start_time?: string;
        end_time?: string;
    };
}

/**
 * ScheduleCell component displays a single cell in the schedule table
 * with drag and drop capabilities and edit/delete actions
 * 
 * @component
 * @example
 * ```tsx
 * <ScheduleCell
 *   schedule={schedule}
 *   onDrop={handleDrop}
 *   onUpdate={handleUpdate}
 *   hasAbsence={false}
 * />
 * ```
 */
export function ScheduleCell({
    schedule,
    onDrop,
    onUpdate,
    hasAbsence,
    hasConflict,
    isLoading,
    className,
    absenceInfo
}: ScheduleCellProps) {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    // Loading state
    if (isLoading) {
        return (
            <div className={cn("p-4 border rounded-md", className)}>
                <Skeleton className="h-12 w-full mb-2" />
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                </div>
            </div>
        );
    }

    const [{ isDragging }, drag] = useDrag({
        type: 'SCHEDULE',
        item: schedule ? {
            type: 'SCHEDULE',
            scheduleId: schedule.id,
            employeeId: schedule.employee_id,
            shiftId: schedule.shift_id || null,
            date: schedule.date,
            shift_type_id: schedule.shift_type_id
        } : undefined,
        canDrag: !!schedule && !hasAbsence && !hasConflict && !isDeleting,
        collect: (monitor) => ({
            isDragging: monitor.isDragging()
        })
    });

    const [{ isOver }, drop] = useDrop({
        accept: 'SCHEDULE',
        drop: async (item: DragItem) => {
            if (!schedule) return;
            try {
                await onDrop(
                    item.scheduleId,
                    schedule.employee_id,
                    new Date(schedule.date),
                    item.shiftId || 0
                );
            } catch (error) {
                console.error('Error dropping schedule:', error);
                toast({
                    title: "Fehler beim Verschieben",
                    description: "Der Zeitplan konnte nicht verschoben werden. Bitte versuchen Sie es erneut.",
                    variant: "destructive"
                });
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver()
        }),
        canDrop: () => !!schedule && !hasAbsence && !hasConflict
    });

    // Fetch settings for shift type colors
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
    });

    const handleDelete = async () => {
        if (!schedule) return;
        try {
            setIsDeleting(true);
            await onUpdate(schedule.id, { shift_id: null });
            toast({
                title: "Schicht gelöscht",
                description: "Die Schicht wurde erfolgreich gelöscht."
            });
        } catch (error) {
            console.error('Error deleting shift:', error);
            toast({
                title: "Fehler beim Löschen",
                description: "Die Schicht konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAdd = () => {
        if (hasAbsence || hasConflict) return;
        setIsEditModalOpen(true);
    };

    const ref = (el: HTMLDivElement | null) => {
        drag(drop(el));
    };

    const getStatusMessage = () => {
        if (hasAbsence) {
            if (absenceInfo?.type) {
                return `Absence: ${absenceInfo.type}${absenceInfo.start_time ? ` (${absenceInfo.start_time} - ${absenceInfo.end_time})` : ''}`;
            }
            return "Employee has an absence on this day";
        }
        if (hasConflict) return "This shift conflicts with another shift";
        if (isDragging) return "Shift is being moved";
        if (isOver) return "Drop shift here";
        return null;
    };

    const statusMessage = getStatusMessage();

    // Simplified JSX structure
    return (
        <TooltipProvider>
            <div
                ref={ref}
                className={cn(
                    "relative p-4 border rounded-md transition-all duration-200",
                    isDragging && "opacity-50",
                    isOver && "bg-primary/10 border-primary",
                    hasAbsence && "bg-red-50 border-red-200",
                    hasConflict && "bg-amber-50 border-amber-200",
                    isDeleting && "opacity-50 pointer-events-none",
                    className
                )}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
                role="gridcell"
                aria-label={statusMessage || "Shift cell"}
                tabIndex={0}
            >
                {hasAbsence && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <AlertTriangle className="absolute top-2 right-2 text-red-500 h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{statusMessage}</p>
                        </TooltipContent>
                    </Tooltip>
                )}

                {hasConflict && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <AlertCircle className="absolute top-2 right-2 text-amber-500 h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{statusMessage}</p>
                        </TooltipContent>
                    </Tooltip>
                )}

                {schedule?.shift_id ? (
                    <>
                        <TimeSlotDisplay
                            startTime={schedule.start_time || ""}
                            endTime={schedule.end_time || ""}
                            shiftType={schedule.shift_type_id}
                            settings={settings}
                            schedule={schedule}
                        />
                        {showActions && !hasAbsence && !hasConflict && (
                            <div
                                className="absolute bottom-2 right-2 flex gap-1"
                                role="toolbar"
                                aria-label="Shift actions"
                            >
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsEditModalOpen(true)}
                                    aria-label="Edit shift"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleDelete}
                                    aria-label="Delete shift"
                                    disabled={isDeleting}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </>
                ) : hasAbsence ? (
                    <div className="flex items-center justify-center h-full w-full">
                        <div className="text-sm text-red-500 font-medium text-center">
                            {absenceInfo?.type || "Absence"}
                        </div>
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        className="w-full h-full flex items-center justify-center"
                        onClick={handleAdd}
                        disabled={hasAbsence || hasConflict}
                        aria-label="Add new shift"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                )}

                {isEditModalOpen && schedule && (
                    <ShiftEditModal
                        isOpen={isEditModalOpen}
                        schedule={schedule}
                        onClose={() => setIsEditModalOpen(false)}
                        onSave={async (scheduleId, updates) => {
                            await onUpdate(scheduleId, updates);
                            setIsEditModalOpen(false);
                        }}
                    />
                )}
            </div>
        </TooltipProvider>
    );
} 