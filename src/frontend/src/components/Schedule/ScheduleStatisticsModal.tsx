import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScheduleStatistics } from "./ScheduleStatistics";
import { Schedule, Employee } from "@/types";
import { DateRange } from "react-day-picker";

interface ScheduleStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedules: Schedule[];
  employees: Employee[];
  dateRange?: DateRange;
  version?: number;
}

export function ScheduleStatisticsModal({
  isOpen,
  onClose,
  schedules,
  employees,
  dateRange,
  version,
}: ScheduleStatisticsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Schichtplan-Statistiken</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <ScheduleStatistics
            schedules={schedules}
            employees={employees}
            dateRange={dateRange}
            version={version}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
