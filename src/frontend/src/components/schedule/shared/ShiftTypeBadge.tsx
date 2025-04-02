import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ShiftTypeBadgeProps {
  type: string;
  color?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ShiftTypeBadge: React.FC<ShiftTypeBadgeProps> = ({
  type,
  color,
  name,
  size = 'md',
  className
}) => {
  // Default colors for standard shift types
  const getDefaultColor = (shiftType: string): string => {
    switch (shiftType) {
      case 'EARLY':
        return '#3b82f6'; // Blue for early shifts
      case 'MIDDLE':
        return '#22c55e'; // Green for middle shifts
      case 'LATE':
        return '#f59e0b'; // Amber for late shifts
      default:
        return '#64748b'; // Slate for other types
    }
  };

  // Default names for standard shift types
  const getDefaultName = (shiftType: string): string => {
    switch (shiftType) {
      case 'EARLY':
        return 'Frühschicht';
      case 'MIDDLE':
        return 'Mittelschicht';
      case 'LATE':
        return 'Spätschicht';
      default:
        return shiftType;
    }
  };

  const badgeColor = color || getDefaultColor(type);
  const badgeName = name || getDefaultName(type);
  
  const sizeClasses = {
    sm: 'text-xs py-0 px-2',
    md: 'text-sm py-0.5 px-2.5',
    lg: 'text-base py-1 px-3'
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        sizeClasses[size],
        "font-medium transition-colors",
        className
      )}
      style={{
        backgroundColor: `${badgeColor}20`,
        color: badgeColor,
        borderColor: badgeColor
      }}
    >
      {badgeName}
    </Badge>
  );
}; 