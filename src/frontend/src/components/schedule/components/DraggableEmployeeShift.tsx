import React from "react";
import { useDrag } from "react-dnd";
import { Edit2 } from "lucide-react";
import { Schedule, Employee } from "@/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getShiftTypeColor, getShiftTypeName } from "../utils/scheduleUtils";

interface DraggableEmployeeShiftProps {
  schedule: Schedule;
  employee: Employee;
  settings: any;
  hasAbsence: boolean;
  onEdit: () => void;
  onDrop: (
    scheduleId: number,
    employeeId: number,
    date: Date,
    shiftId: number,
    startTime: string,
    endTime: string,
  ) => Promise<void>;
}

export function DraggableEmployeeShift({
  schedule,
  employee,
  settings,
  hasAbsence,
  onEdit,
  onDrop,
}: DraggableEmployeeShiftProps) {
  const [{ isDragging }, drag] = useDrag({
    type: "EMPLOYEE_SCHEDULE",
    item: {
      type: "EMPLOYEE_SCHEDULE",
      scheduleId: schedule.id,
      employeeId: schedule.employee_id,
      shiftId: schedule.shift_id || 0,
      date: schedule.date || "",
      startTime: schedule.shift_start || "",
      endTime: schedule.shift_end || "",
    },
    canDrag: !hasAbsence,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={cn(
        "px-2 py-1 rounded text-xs font-medium cursor-move shadow-sm transition-all",
        isDragging && "opacity-50 shadow-md scale-95",
        hasAbsence && "opacity-50 cursor-not-allowed",
      )}
      style={{
        backgroundColor: getShiftTypeColor(schedule, settings),
        color: "white",
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!hasAbsence) onEdit();
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold whitespace-nowrap overflow-hidden text-ellipsis">
          {employee.last_name}, {employee.first_name.charAt(0)}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="ml-1 text-white/80 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Edit2 size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit shift</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="text-[10px] flex justify-between">
        <Badge
          variant="outline"
          className="text-[8px] py-0 px-1 h-4 bg-white/20 text-white"
        >
          {getShiftTypeName(schedule)}
        </Badge>
        {schedule.shift_start && schedule.shift_end && (
          <span className="text-[8px] whitespace-nowrap">
            {schedule.shift_start}-{schedule.shift_end}
          </span>
        )}
      </div>
    </div>
  );
}
