import React, { useEffect, useRef, useState } from "react";
import Gantt from "frappe-gantt";
import { PageLayout } from "@/layouts";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  getSchedules,
  getAbsences,
  getEmployees,
  getShifts,
  type Schedule,
  type Absence,
  type Employee,
  type Shift,
} from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Calendar, RefreshCw } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, addWeeks } from "date-fns";

type DataType = "schedules" | "shifts" | "absences" | "vacation";
type ViewMode = "Day" | "Week" | "Month" | "Year";

interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies?: string;
  custom_class?: string;
}

const GanttViewPage: React.FC = () => {
  const ganttRef = useRef<HTMLDivElement>(null);
  const ganttInstanceRef = useRef<Gantt | null>(null);
  const [dataType, setDataType] = useState<DataType>("schedules");
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const [dateRange, setDateRange] = useState({
    start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    end: format(
      endOfWeek(addWeeks(new Date(), 2), { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    ),
  });

  // Fetch data based on selected type
  const {
    data: employees,
    isLoading: employeesLoading,
    error: employeesError,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const {
    data: schedules,
    isLoading: schedulesLoading,
    error: schedulesError,
    refetch: refetchSchedules,
  } = useQuery({
    queryKey: ["schedules", dateRange.start, dateRange.end],
    queryFn: () => getSchedules(dateRange.start, dateRange.end),
    enabled: dataType === "schedules",
  });

  const {
    data: absences,
    isLoading: absencesLoading,
    error: absencesError,
    refetch: refetchAbsences,
  } = useQuery({
    queryKey: ["absences", dateRange.start, dateRange.end],
    queryFn: () => getAbsences(),
    enabled: dataType === "absences" || dataType === "vacation",
  });

  const {
    data: shifts,
    isLoading: shiftsLoading,
    error: shiftsError,
    refetch: refetchShifts,
  } = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
    enabled: dataType === "shifts",
  });

  // Transform data to Gantt tasks format
  const transformToGanttTasks = (): GanttTask[] => {
    const tasks: GanttTask[] = [];

    if (dataType === "schedules" && schedules?.schedules && employees) {
      const employeeMap = new Map(
        employees.map((emp) => [emp.id, emp.first_name + " " + emp.last_name]),
      );

      // Group schedules by employee and date
      const schedulesByEmployee = schedules.schedules.reduce(
        (acc, schedule) => {
          if (schedule.shift_start && schedule.shift_end && !schedule.is_empty) {
            const key = `${schedule.employee_id}-${schedule.date}`;
            if (!acc[key]) {
              acc[key] = schedule;
            }
          }
          return acc;
        },
        {} as Record<string, Schedule>,
      );

      Object.values(schedulesByEmployee).forEach((schedule, index) => {
        const employeeName =
          employeeMap.get(schedule.employee_id) || `Employee ${schedule.employee_id}`;
        const start = `${schedule.date} ${schedule.shift_start}`;
        const end = `${schedule.date} ${schedule.shift_end}`;

        tasks.push({
          id: `schedule-${schedule.id || index}`,
          name: `${employeeName} - ${schedule.shift_start} to ${schedule.shift_end}`,
          start: start,
          end: end,
          progress: 100,
          custom_class: "schedule-bar",
        });
      });
    } else if (
      (dataType === "absences" || dataType === "vacation") &&
      absences &&
      employees
    ) {
      const employeeMap = new Map(
        employees.map((emp) => [emp.id, emp.first_name + " " + emp.last_name]),
      );

      absences.forEach((absence, index) => {
        // Filter vacation if needed
        if (
          dataType === "vacation" &&
          absence.absence_type_id !== "vacation"
        ) {
          return;
        }

        const employeeName =
          employeeMap.get(absence.employee_id) ||
          `Employee ${absence.employee_id}`;
        const absenceTypeName =
          absence.absence_type_id === "vacation"
            ? "Vacation"
            : absence.absence_type_id === "sick"
              ? "Sick Leave"
              : "Absence";

        tasks.push({
          id: `absence-${absence.id || index}`,
          name: `${employeeName} - ${absenceTypeName}`,
          start: absence.start_date,
          end: absence.end_date,
          progress: 100,
          custom_class:
            absence.absence_type_id === "vacation"
              ? "vacation-bar"
              : "absence-bar",
        });
      });
    } else if (dataType === "shifts" && shifts) {
      shifts.forEach((shift, index) => {
        const days = shift.active_days
          ? shift.active_days
              .map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d])
              .join(", ")
          : "All days";

        // For shifts, we need to create sample date ranges
        const today = new Date();
        const startDate = format(today, "yyyy-MM-dd");
        const endDate = format(addWeeks(today, 1), "yyyy-MM-dd");

        tasks.push({
          id: `shift-${shift.id || index}`,
          name: `Shift: ${shift.start_time} - ${shift.end_time} (${days})`,
          start: `${startDate} ${shift.start_time}`,
          end: `${endDate} ${shift.end_time}`,
          progress: 50,
          custom_class: "shift-bar",
        });
      });
    }

    return tasks;
  };

  // Initialize and update Gantt chart
  useEffect(() => {
    if (!ganttRef.current) return;

    const tasks = transformToGanttTasks();

    // Ensure we have valid tasks
    if (tasks.length === 0) {
      if (ganttInstanceRef.current) {
        ganttInstanceRef.current = null;
        ganttRef.current.innerHTML = "";
      }
      return;
    }

    try {
      // Clear existing gantt
      if (ganttInstanceRef.current) {
        ganttRef.current.innerHTML = "";
        ganttInstanceRef.current = null;
      }

      // Create new gantt instance
      ganttInstanceRef.current = new Gantt(ganttRef.current, tasks, {
        view_mode: viewMode,
        date_format: "YYYY-MM-DD",
        language: "en",
        popup_on: "click",
        bar_height: 30,
        bar_corner_radius: 3,
        arrow_curve: 5,
        padding: 18,
        on_click: (task: Gantt.Task) => {
          console.log("Task clicked:", task);
        },
        on_date_change: (task: Gantt.Task, start: Date, end: Date) => {
          console.log("Date changed:", task, start, end);
        },
        on_progress_change: (task: Gantt.Task, progress: number) => {
          console.log("Progress changed:", task, progress);
        },
      });
    } catch (error) {
      console.error("Error creating Gantt chart:", error);
    }
  }, [
    schedules,
    absences,
    shifts,
    employees,
    dataType,
    viewMode,
    dateRange.start,
    dateRange.end,
  ]);

  const isLoading =
    employeesLoading ||
    (dataType === "schedules" && schedulesLoading) ||
    ((dataType === "absences" || dataType === "vacation") && absencesLoading) ||
    (dataType === "shifts" && shiftsLoading);

  const error =
    employeesError ||
    (dataType === "schedules" && schedulesError) ||
    ((dataType === "absences" || dataType === "vacation") && absencesError) ||
    (dataType === "shifts" && shiftsError);

  const handleRefresh = () => {
    if (dataType === "schedules") {
      refetchSchedules();
    } else if (dataType === "absences" || dataType === "vacation") {
      refetchAbsences();
    } else if (dataType === "shifts") {
      refetchShifts();
    }
  };

  const handleDataTypeChange = (value: DataType) => {
    setDataType(value);
  };

  const handleViewModeChange = (value: ViewMode) => {
    setViewMode(value);
    if (ganttInstanceRef.current) {
      ganttInstanceRef.current.change_view_mode(value);
    }
  };

  return (
    <PageLayout
      title="Gantt View"
      description="Visual timeline view of schedules, shifts, absences, and vacations"
      breadcrumbs={[
        { href: "/", label: "Home" },
        { label: "Gantt View", isCurrentPage: true },
      ]}
      headerActions={
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <Card className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Data Type:</span>
              <Select value={dataType} onValueChange={handleDataTypeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="schedules">Schedules</SelectItem>
                  <SelectItem value="shifts">Shifts</SelectItem>
                  <SelectItem value="absences">Absences</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">View Mode:</span>
              <Select value={viewMode} onValueChange={handleViewModeChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select view mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Day">Day</SelectItem>
                  <SelectItem value="Week">Week</SelectItem>
                  <SelectItem value="Month">Month</SelectItem>
                  <SelectItem value="Year">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error
                ? error.message
                : "Failed to load data. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="gantt-container">
            <div ref={ganttRef} className="gantt-chart"></div>
            {transformToGanttTasks().length === 0 && (
              <div className="flex h-64 items-center justify-center">
                <p className="text-muted-foreground">
                  No data available for the selected type and date range.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      <style>{`
        /* Frappe Gantt Base Styles */
        :root {
          --g-arrow-color: #1f2937;
          --g-bar-color: #fff;
          --g-bar-border: #fff;
          --g-tick-color-thick: #ededed;
          --g-tick-color: #f3f3f3;
          --g-actions-background: #f3f3f3;
          --g-border-color: #ebeff2;
          --g-text-muted: #7c7c7c;
          --g-text-light: #fff;
          --g-text-dark: #171717;
          --g-progress-color: #dbdbdb;
          --g-handle-color: #37352f;
          --g-weekend-label-color: #dcdce4;
          --g-expected-progress: #c4c4e9;
          --g-header-background: #fff;
          --g-row-color: #fdfdfd;
          --g-row-border-color: #c7c7c7;
          --g-today-highlight: #37352f;
          --g-popup-actions: #ebeff2;
          --g-weekend-highlight-color: #f7f7f7;
        }

        .gantt-container {
          line-height: 14.5px;
          position: relative;
          overflow: auto;
          font-size: 12px;
          height: var(--gv-grid-height);
          width: 100%;
          border-radius: 8px;
          min-height: 400px;
        }

        .gantt-container .popup-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          background: #fff;
          box-shadow: 0 10px 24px -3px #0003;
          padding: 10px;
          border-radius: 5px;
          width: max-content;
          z-index: 1000;
        }

        .gantt-container .grid-header {
          background-color: var(--g-header-background);
          position: sticky;
          top: 0;
          left: 0;
          border-bottom: 1px solid var(--g-row-border-color);
          z-index: 1000;
        }

        .gantt .grid-background {
          fill: none;
        }

        .gantt .grid-row {
          fill: var(--g-row-color);
        }

        .gantt .row-line {
          stroke: var(--g-border-color);
        }

        .gantt .tick {
          stroke: var(--g-tick-color);
          stroke-width: 0.4;
        }

        .gantt .tick.thick {
          stroke: var(--g-tick-color-thick);
          stroke-width: 0.7;
        }

        .gantt .bar-wrapper .bar {
          fill: var(--g-bar-color);
          stroke: var(--g-bar-border);
          stroke-width: 0;
          transition: stroke-width 0.3s ease;
          outline: 1px solid var(--g-row-border-color);
          border-radius: 3px;
        }

        .gantt .bar-progress {
          fill: var(--g-progress-color);
          border-radius: 4px;
        }

        .gantt .bar-label {
          fill: var(--g-text-dark);
          dominant-baseline: central;
          font-family: Helvetica;
          font-size: 13px;
          font-weight: 400;
        }

        .gantt .bar-wrapper {
          cursor: pointer;
        }

        .gantt .bar-wrapper:hover .bar {
          transition: transform 0.3s ease;
        }
        
        .gantt-chart svg {
          width: 100%;
          height: auto;
        }
        
        .schedule-bar {
          fill: hsl(var(--primary));
        }
        
        .absence-bar {
          fill: hsl(var(--destructive));
        }
        
        .vacation-bar {
          fill: hsl(142.1 76.2% 36.3%);
        }
        
        .shift-bar {
          fill: hsl(var(--secondary));
        }
      `}</style>
    </PageLayout>
  );
};

export default GanttViewPage;
