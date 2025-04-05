import React, { useState } from 'react';
import { format } from 'date-fns';
import { useDrop } from 'react-dnd';
import { Schedule, Employee, ScheduleUpdate } from '@/types';
import { cn } from '@/lib/utils';
import { ShiftEditModal } from '@/components/schedule/shifts/ShiftEditModal';
import { DraggableEmployeeShift } from './DraggableEmployeeShift';
import { formatMinutesToTime, parseTime } from '../utils/scheduleUtils';

interface TimeSlotCellProps {
  timeSlot: { start: number; end: number };
  day: Date;
  schedules: Schedule[];
  settings: any;
  employeeLookup: Record<number, Employee>;
  employeeAbsences?: Record<number, any[]>;
  absenceTypes?: Array<{ id: string; name: string; color: string; type: string; }>;
  onDrop: (scheduleId: number, employeeId: number, date: Date, shiftId: number, startTime: string, endTime: string) => Promise<void>;
  onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
}

interface DragItem {
  type: 'EMPLOYEE_SCHEDULE';
  scheduleId: number;
  employeeId: number;
  shiftId: number;
  date: string;
  startTime: string;
  endTime: string;
}

export function TimeSlotCell({
  timeSlot,
  day,
  schedules,
  settings,
  employeeLookup,
  employeeAbsences,
  absenceTypes,
  onDrop,
  onUpdate
}: TimeSlotCellProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isAddingNewShift, setIsAddingNewShift] = useState(false);

  const dayStr = format(day, 'yyyy-MM-dd');
  const startTimeStr = formatMinutesToTime(timeSlot.start);
  const endTimeStr = formatMinutesToTime(timeSlot.end);

  // Find schedules that overlap with this time slot on this day
  const overlappingSchedules = schedules.filter(schedule => {
    if (!schedule.date || schedule.date !== dayStr) return false;
    
    const shiftStart = schedule.shift_start ? parseTime(schedule.shift_start) : 0;
    const shiftEnd = schedule.shift_end ? parseTime(schedule.shift_end) : 0;
    
    // Check if schedule overlaps with this time slot
    return (
      (shiftStart <= timeSlot.start && shiftEnd > timeSlot.start) || 
      (shiftStart >= timeSlot.start && shiftStart < timeSlot.end)
    );
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'EMPLOYEE_SCHEDULE',
    drop: (item: DragItem) => {
      onDrop(
        item.scheduleId,
        item.employeeId,
        new Date(dayStr),
        item.shiftId,
        startTimeStr,
        formatMinutesToTime(timeSlot.start + (parseTime(item.endTime) - parseTime(item.startTime)))
      );
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    }),
    // Only allow dropping if this time slot is within opening hours
    canDrop: () => true 
  });

  // Handle clicking on an empty cell to add a new shift
  const handleAddNewShift = () => {
    const endTime = formatMinutesToTime(timeSlot.start + 60); // Default duration: 1 hour
    const newSchedule: Schedule = {
      id: 0, 
      employee_id: 0,
      date: dayStr,
      shift_id: 0,
      shift_start: startTimeStr,
      shift_end: endTime,
      version: 0,
      status: 'DRAFT',
      is_empty: false
    };

    setSelectedSchedule(newSchedule);
    setIsAddingNewShift(true);
    setIsEditModalOpen(true);
  };

  // Adapt our onUpdate function to match what ShiftEditModal expects
  const handleSaveShift = (scheduleData: Partial<Schedule>) => {
    if (selectedSchedule) {
      return onUpdate(selectedSchedule.id, scheduleData as ScheduleUpdate);
    }
    return Promise.resolve();
  };

  return (
    <td
      ref={drop}
      className={cn(
        "border p-1 relative transition-colors duration-150 min-h-[40px] align-top",
        isOver && "bg-primary/10 ring-1 ring-primary",
        isHovered && "bg-slate-50",
        overlappingSchedules.length === 0 && "cursor-pointer hover:bg-blue-50/30"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        if (overlappingSchedules.length === 0) {
          handleAddNewShift();
        }
      }}
    >
      {overlappingSchedules.length > 0 ? (
        <div className="flex flex-col gap-1 min-h-[40px]">
          {overlappingSchedules.map(schedule => {
            const employee = employeeLookup[schedule.employee_id];
            if (!employee) return null;

            // Check for absence
            const hasAbsence = employeeAbsences && absenceTypes &&
              employeeAbsences[schedule.employee_id]?.some(absence => {
                const absenceStartDate = absence.start_date.split('T')[0];
                const absenceEndDate = absence.end_date.split('T')[0];
                return dayStr >= absenceStartDate && dayStr <= absenceEndDate;
              });

            return (
              <DraggableEmployeeShift
                key={schedule.id}
                schedule={schedule}
                employee={employee}
                settings={settings}
                hasAbsence={!!hasAbsence}
                onEdit={() => {
                  setSelectedSchedule(schedule);
                  setIsAddingNewShift(false);
                  setIsEditModalOpen(true);
                }}
                onDrop={onDrop}
              />
            );
          })}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground min-h-[40px]">
          {isHovered && (
            <span className="opacity-50">{startTimeStr}</span>
          )}
        </div>
      )}

      {selectedSchedule && isEditModalOpen && (
        <ShiftEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedSchedule(null);
            setIsAddingNewShift(false);
          }}
          schedule={selectedSchedule}
          onSave={handleSaveShift}
        />
      )}
    </td>
  );
} 