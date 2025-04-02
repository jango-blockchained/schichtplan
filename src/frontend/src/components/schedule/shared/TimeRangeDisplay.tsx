import React from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

export interface TimeRangeDisplayProps {
  startTime?: string;
  endTime?: string;
  shiftType?: string;
  color?: string;
  showIcon?: boolean;
  isInvalid?: boolean;
  className?: string;
}

export const TimeRangeDisplay: React.FC<TimeRangeDisplayProps> = ({
  startTime,
  endTime,
  shiftType,
  color,
  showIcon = true,
  isInvalid = false,
  className
}) => {
  // Default colors for standard shift types (same as badge)
  const getDefaultColor = (type?: string): string => {
    if (!type) return '#64748b'; // Default slate
    
    switch (type) {
      case 'EARLY':
        return '#3b82f6'; // Blue
      case 'MIDDLE':
        return '#22c55e'; // Green
      case 'LATE':
        return '#f59e0b'; // Amber
      default:
        return '#64748b'; // Slate
    }
  };

  const displayColor = color || getDefaultColor(shiftType);
  
  if (!startTime || !endTime) {
    return (
      <div className={cn(
        "text-sm text-muted-foreground flex items-center",
        className
      )}>
        {showIcon && <Clock className="h-3.5 w-3.5 mr-1.5 opacity-70" />}
        <span>Keine Zeitangabe</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex items-center font-medium",
        isInvalid && "text-destructive",
        className
      )}
      style={{ color: isInvalid ? undefined : displayColor }}
    >
      {showIcon && <Clock className="h-3.5 w-3.5 mr-1.5" />}
      <span>{startTime} - {endTime}</span>
    </div>
  );
}; 