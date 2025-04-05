import React from "react";
import { Schedule, ScheduleUpdate, Settings } from "@/types";
import { DateRange } from "react-day-picker";
import { TimeGridView } from "@/components/schedule/views/TimeGridView";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";
import { ShiftCoverageView } from "@/components/schedule/views/ShiftCoverageView";
import { MonthlyView } from "@/components/schedule/views/MonthlyView";
import { DailyView } from "@/components/schedule/views/DailyView";
import { EmployeeView } from "@/components/schedule/views/EmployeeView";
import { CalendarView } from "@/components/schedule/views/CalendarView";
import { ShiftsTableView } from "@/components/schedule/views/ShiftsTableView";
import { VersionsView } from "@/components/schedule/views/VersionsView";
import { OverviewView } from "@/components/schedule/views/OverviewView";
import { StatisticsView } from "@/components/schedule/views/StatisticsView";
import { ScheduleTable } from "@/components/schedule/views/ScheduleTable";

// Extended view types to include all available views
export type ScheduleViewType =
  | "table"
  | "grid"
  | "coverage"
  | "monthly"
  | "daily"
  | "employee"
  | "calendar"
  | "shifts"
  | "versions"
  | "overview"
  | "statistics";

interface ScheduleDisplayProps {
  viewType: ScheduleViewType;
  schedules: Schedule[];
  dateRange: DateRange | undefined;
  onDrop: (
    scheduleId: number,
    newEmployeeId: number,
    newDate: Date,
    newShiftId: number,
  ) => Promise<void>;
  onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
  isLoading: boolean;
  employeeAbsences?: Record<number, any[]>;
  absenceTypes?: Array<{
    id: string;
    name: string;
    color: string;
    type: "absence";
  }>;
  storeSettings?: Settings;
  onShiftTemplateClick?: (shiftId: number, date: Date) => void;
}

export const ScheduleDisplay = ({
  viewType,
  dateRange,
  storeSettings,
  ...props
}: ScheduleDisplayProps) => {
  // Ensure dateRange has valid from and to dates
  if (!dateRange || !dateRange.from || !dateRange.to) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Bitte wählen Sie einen Datumsbereich aus. Ein gültiges Startdatum und
          Enddatum werden benötigt.
        </AlertDescription>
      </Alert>
    );
  }

  // Ensure dateRange from is not after to
  if (dateRange.from > dateRange.to) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Das Startdatum kann nicht nach dem Enddatum liegen.
        </AlertDescription>
      </Alert>
    );
  }

  // Clone the dateRange to ensure we don't have any reference issues
  const safeRange: DateRange = {
    from: new Date(dateRange.from),
    to: new Date(dateRange.to),
  };

  // Common props for all views
  const viewProps = {
    dateRange: safeRange,
    storeSettings: storeSettings,
    ...props,
  };

  // Render appropriate view based on viewType
  switch (viewType) {
    case "table":
      return <ScheduleTable {...viewProps} />;
    case "grid":
      return <TimeGridView {...viewProps} />;
    case "coverage":
      return <ShiftCoverageView {...viewProps} />;
    case "monthly":
      return <MonthlyView {...viewProps} />;
    case "daily":
      return <DailyView {...viewProps} />;
    case "employee":
      return <EmployeeView {...viewProps} />;
    case "calendar":
      return <CalendarView {...viewProps} />;
    case "shifts":
      return <ShiftsTableView {...viewProps} />;
    case "versions":
      return (
        <VersionsView
          {...viewProps}
          onPublish={(version) => Promise.resolve()}
          onArchive={(version) => Promise.resolve()}
        />
      );
    case "overview":
      return (
        <OverviewView
          {...viewProps}
          dateRange={{ from: safeRange.from!, to: safeRange.to! }}
        />
      );
    case "statistics":
      return (
        <StatisticsView
          {...viewProps}
          employees={[]}
          dateRange={{ from: safeRange.from!, to: safeRange.to! }}
        />
      );
    default:
      return (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>Ungültiger View-Typ: {viewType}</AlertDescription>
        </Alert>
      );
  }
};
