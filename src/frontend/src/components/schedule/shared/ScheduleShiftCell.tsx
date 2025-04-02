import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useDrag, useDrop } from 'react-dnd';
import { Pencil, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Schedule, ScheduleUpdate } from '@/types';
import { ShiftTypeBadge } from './ShiftTypeBadge';
import { TimeRangeDisplay } from './TimeRangeDisplay';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface ScheduleShiftCellProps {
  schedule?: Schedule;
  hasAbsence?: boolean;
  isEditMode?: boolean;
  showValidation?: boolean;
  enableDragDrop?: boolean;
  onDrop?: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
  onUpdate?: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
  onEdit?: (schedule: Schedule) => void;
  onDelete?: (schedule: Schedule) => void;
  className?: string;
}

export const ScheduleShiftCell: React.FC<ScheduleShiftCellProps> = ({
  schedule,
  hasAbsence = false,
  isEditMode = false,
  showValidation = true,
  enableDragDrop = true,
  onDrop,
  onUpdate,
  onEdit,
  onDelete,
  className
}) => {
  const [showActions, setShowActions] = useState(false);
  
  // Validation logic
  const validateShift = () => {
    if (!schedule || !showValidation) return { isValid: true, issues: [] };
    
    const issues = [];
    let isValid = true;
    
    // Calculate shift duration in hours
    const calculateHours = () => {
      if (!schedule.shift_start || !schedule.shift_end) return 0;
      
      const [startHours, startMinutes] = schedule.shift_start.split(':').map(Number);
      const [endHours, endMinutes] = schedule.shift_end.split(':').map(Number);
      
      let hours = endHours - startHours;
      let minutes = endMinutes - startMinutes;
      
      if (hours < 0) hours += 24; // Handle overnight shifts
      if (minutes < 0) {
        minutes += 60;
        hours -= 1;
      }
      
      return hours + (minutes / 60);
    };
    
    const shiftHours = calculateHours();
    
    // Check for common validation issues
    if (shiftHours > 10) {
      issues.push('Schicht überschreitet 10 Stunden');
      isValid = false;
    }
    
    if (shiftHours > 6 && (!schedule.break_start || !schedule.break_end)) {
      issues.push('Pausenzeiten fehlen bei > 6h Schicht');
      isValid = false;
    }
    
    if (hasAbsence) {
      issues.push('Mitarbeiter ist an diesem Tag abwesend');
      isValid = false;
    }
    
    return { isValid, issues };
  };
  
  const { isValid, issues } = validateShift();
  
  // Drag and drop functionality
  const [{ isDragging }, drag] = useDrag({
    type: 'SCHEDULE',
    item: enableDragDrop && schedule ? {
      type: 'SCHEDULE',
      scheduleId: schedule.id,
      employeeId: schedule.employee_id,
      shiftId: schedule.shift_id || null,
      date: schedule.date,
      shift_type_id: schedule.shift_type_id
    } : null,
    canDrag: enableDragDrop && !!schedule && !hasAbsence,
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });
  
  const [{ isOver }, drop] = useDrop({
    accept: 'SCHEDULE',
    drop: (item: any) => {
      if (!schedule || !onDrop) return;
      onDrop(
        item.scheduleId,
        schedule.employee_id,
        new Date(schedule.date),
        item.shiftId || 0
      );
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    }),
    canDrop: () => enableDragDrop && !!schedule && !hasAbsence && !!onDrop
  });
  
  // Empty or absence cell
  if (!schedule || !schedule.shift_id) {
    return (
      <div
        ref={enableDragDrop ? (node) => drag(drop(node)) : undefined}
        className={cn(
          "p-2 rounded-md border border-dashed border-gray-300",
          "min-h-[80px] flex items-center justify-center",
          isDragging && "opacity-50 bg-primary/10",
          isOver && "ring-2 ring-primary/50",
          hasAbsence && "bg-red-50/30",
          className
        )}
      >
        <div className="text-sm text-muted-foreground">
          {hasAbsence ? 'Abwesend' : 'Keine Schicht'}
        </div>
      </div>
    );
  }
  
  return (
    <div
      ref={enableDragDrop ? (node) => drag(drop(node)) : undefined}
      className={cn(
        "p-3 rounded-md border relative transition-all",
        "min-h-[80px]",
        !isValid && "border-destructive bg-destructive/5",
        isDragging && "opacity-50 shadow-lg",
        isOver && "ring-2 ring-primary/50",
        isEditMode && "hover:shadow-md",
        className
      )}
      onMouseEnter={() => isEditMode && setShowActions(true)}
      onMouseLeave={() => isEditMode && setShowActions(false)}
    >
      {/* Shift type badge */}
      <div className="mb-2">
        <ShiftTypeBadge
          type={schedule.shift_type_id || 'DEFAULT'}
          name={schedule.shift_type_name}
        />
      </div>
      
      {/* Time range display */}
      <TimeRangeDisplay
        startTime={schedule.shift_start}
        endTime={schedule.shift_end}
        shiftType={schedule.shift_type_id}
        isInvalid={!isValid}
      />
      
      {/* Display break times if available */}
      {schedule.break_start && schedule.break_end && (
        <div className="mt-1.5 text-xs text-muted-foreground">
          <span>Pause: {schedule.break_start} - {schedule.break_end}</span>
        </div>
      )}
      
      {/* Display validations issues */}
      {showValidation && issues.length > 0 && (
        <div className="mt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  <span>{issues.length} Problem{issues.length !== 1 ? 'e' : ''}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <ul className="text-xs list-disc pl-4">
                  {issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      
      {/* Edit/Delete buttons */}
      {isEditMode && showActions && (
        <div className="absolute top-2 right-2 flex items-center space-x-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => schedule && onEdit(schedule)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => schedule && onDelete(schedule)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}; 