import React from 'react';
import { Schedule } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface ShiftType {
    id: string;
    name: string;
    color: string;
}

interface Settings {
    shift_types?: ShiftType[];
}

export interface TimeSlotDisplayProps {
    startTime: string;
    endTime: string;
    shiftType?: string;
    settings?: Settings;
    schedule?: Schedule;
    isLoading?: boolean;
    className?: string;
}

/**
 * TimeSlotDisplay component displays a time slot with proper styling based on shift type
 * 
 * @component
 * @example
 * ```tsx
 * <TimeSlotDisplay
 *   startTime="09:00"
 *   endTime="17:00"
 *   shiftType="EARLY"
 *   settings={settings}
 *   schedule={schedule}
 * />
 * ```
 */
export function TimeSlotDisplay({
    startTime,
    endTime,
    shiftType,
    settings,
    schedule,
    isLoading,
    className
}: TimeSlotDisplayProps) {
    if (isLoading) {
        return (
            <div className={cn("flex flex-col items-center", className)}>
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-4 w-16 mt-1" />
            </div>
        );
    }

    // Get background color based on shift type and settings
    const getBackgroundColor = (): string => {
        // First try to get color from settings based on shift_type_id
        if (schedule?.shift_type_id && settings?.shift_types) {
            const shiftTypeInfo = settings.shift_types.find(
                (type) => type.id === schedule.shift_type_id
            );
            if (shiftTypeInfo?.color) {
                return shiftTypeInfo.color;
            }
        }

        // Then try to get color from settings based on shift type
        if (typeof shiftType === 'string' && settings?.shift_types) {
            const shiftTypeInfo = settings.shift_types.find(
                (type) => type.id === shiftType
            );
            if (shiftTypeInfo?.color) {
                return shiftTypeInfo.color;
            }
        }

        // Fallback to default colors with better contrast
        if (typeof shiftType === 'string') {
            switch (shiftType) {
                case 'EARLY':
                    return '#15803d'; // Darker green for better contrast
                case 'MIDDLE':
                    return '#1d4ed8'; // Darker blue for better contrast
                case 'LATE':
                    return '#7e22ce'; // Darker purple for better contrast
            }
        }

        return '#475569'; // Darker slate gray for better contrast
    };

    // Get shift type display name
    const getShiftTypeDisplay = (): string | null => {
        // First try to get name from schedule
        if (schedule?.shift_type_name) {
            return schedule.shift_type_name;
        }

        // Then try to get name from settings
        if (typeof shiftType === 'string' && settings?.shift_types) {
            const shiftTypeInfo = settings.shift_types.find(
                (type) => type.id === shiftType
            );
            if (shiftTypeInfo?.name) {
                return shiftTypeInfo.name;
            }
        }

        // Fallback to default names
        if (typeof shiftType === 'string') {
            switch (shiftType) {
                case 'EARLY':
                    return 'Früh';
                case 'LATE':
                    return 'Spät';
                case 'MIDDLE':
                    return 'Mitte';
                default:
                    return shiftType;
            }
        }
        return null;
    };

    // Convert hex color to rgba for background with transparency
    const getRGBAColor = (hexColor: string, alpha: number = 0.15): string => {
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const bgColor = getBackgroundColor();
    const shiftTypeDisplay = getShiftTypeDisplay();
    const timeDisplay = `${startTime} - ${endTime}`;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn(
                            "flex flex-col items-center transition-all duration-200",
                            "hover:scale-105",
                            className
                        )}
                        role="cell"
                        aria-label={`${shiftTypeDisplay} shift from ${startTime} to ${endTime}`}
                    >
                        <div
                            className={cn(
                                "px-4 py-1.5 rounded-full text-sm font-medium",
                                "transition-colors duration-200",
                                "shadow-sm hover:shadow-md",
                                "border-2"
                            )}
                            style={{
                                backgroundColor: getRGBAColor(bgColor, 0.15),
                                color: bgColor,
                                borderColor: getRGBAColor(bgColor, 0.3)
                            }}
                        >
                            {timeDisplay}
                        </div>
                        {shiftTypeDisplay && (
                            <div
                                className={cn(
                                    "text-xs mt-1.5 font-medium",
                                    "transition-colors duration-200"
                                )}
                                style={{ color: bgColor }}
                            >
                                {shiftTypeDisplay}
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{shiftTypeDisplay} shift</p>
                    <p className="text-xs text-muted-foreground">{timeDisplay}</p>
                    {schedule?.notes && (
                        <p className="text-xs mt-1 text-muted-foreground">
                            {schedule.notes}
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
} 