import React from "react";
import { Schedule, ScheduleUpdate } from "@/types";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { getSettings, getEmployees } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
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
}

export const CalendarView = ({
  schedules,
  dateRange,
  onDrop,
  onUpdate,
  isLoading,
  employeeAbsences,
  absenceTypes,
}: CalendarViewProps) => {
  // Fetch settings and employees
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const { data: employees, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  if (isLoading || isLoadingSettings || isLoadingEmployees) {
    return <Skeleton className="w-full h-[600px]" />;
  }

  if (!dateRange?.from || !dateRange?.to) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Bitte wählen Sie einen Datumsbereich aus
        </AlertDescription>
      </Alert>
    );
  }

  // Use the month from the dateRange
  const currentMonth = startOfMonth(dateRange.from);
  const lastDayOfMonth = endOfMonth(currentMonth);

  // Group schedules by date
  const schedulesByDate: Record<string, Schedule[]> = {};
  schedules.forEach((schedule) => {
    if (!schedule.date) return;

    const dateKey = schedule.date.split("T")[0]; // Format: YYYY-MM-DD
    if (!schedulesByDate[dateKey]) {
      schedulesByDate[dateKey] = [];
    }
    schedulesByDate[dateKey].push(schedule);
  });

  // Group absences by date
  const absencesByDate: Record<string, any[]> = {};
  if (employeeAbsences && employees) {
    employees.forEach((employee) => {
      const employeeId = employee.id;
      if (!employeeAbsences[employeeId]) return;

      employeeAbsences[employeeId].forEach((absence) => {
        const startDate = new Date(absence.start_date);
        const endDate = new Date(absence.end_date);

        // For each day between start and end of absence
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateKey = format(currentDate, "yyyy-MM-dd");
          if (!absencesByDate[dateKey]) {
            absencesByDate[dateKey] = [];
          }
          absencesByDate[dateKey].push({
            ...absence,
            employeeId,
          });

          // Next day
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
    });
  }

  // Function to render the day content
  const renderDay = (day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const daySchedules = schedulesByDate[dateKey] || [];
    const dayAbsences = absencesByDate[dateKey] || [];

    // Count shifts by type
    const shiftCounts: Record<string, number> = {};
    daySchedules.forEach((schedule) => {
      if (schedule.shift_type_id) {
        shiftCounts[schedule.shift_type_id] =
          (shiftCounts[schedule.shift_type_id] || 0) + 1;
      }
    });

    return (
      <div className="w-full h-full flex flex-col">
        <div className="text-sm font-medium mb-1">{format(day, "d")}</div>

        <div className="text-xs space-y-1">
          {/* Show shift counts */}
          {Object.entries(shiftCounts).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between">
              <Badge
                variant={
                  type === "EARLY"
                    ? "default"
                    : type === "MIDDLE"
                      ? "secondary"
                      : "outline"
                }
                className="text-[10px] h-4 px-1 py-0"
              >
                {type === "EARLY"
                  ? "F"
                  : type === "MIDDLE"
                    ? "M"
                    : type === "LATE"
                      ? "S"
                      : type}
              </Badge>
              <span>{count}</span>
            </div>
          ))}

          {/* Show absence count if any */}
          {dayAbsences.length > 0 && (
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 py-0 bg-red-50 text-red-600 border-red-200"
              >
                A
              </Badge>
              <span>{dayAbsences.length}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Custom modifier to identify days with schedules or absences
  const modifiers = {
    hasSchedules: (day: Date) => {
      const dateKey = format(day, "yyyy-MM-dd");
      return !!schedulesByDate[dateKey]?.length;
    },
    hasAbsences: (day: Date) => {
      const dateKey = format(day, "yyyy-MM-dd");
      return !!absencesByDate[dateKey]?.length;
    },
  };

  // Custom modifier styles
  const modifiersStyles = {
    hasSchedules: {
      backgroundColor: "var(--primary-50)",
      borderColor: "var(--primary-200)",
    },
    hasAbsences: {
      backgroundColor: "rgba(254, 202, 202, 0.5)", // red-100 with opacity
    },
    selected: {
      backgroundColor: "var(--primary-100)",
      color: "var(--primary-900)",
    },
  };

  return (
    <div className="py-4">
      <Card>
        <CardContent className="p-6">
          <Calendar
            mode="range"
            defaultMonth={currentMonth}
            selected={dateRange}
            disabled={false}
            showOutsideDays={true}
            fixedWeeks={true}
            ISOWeek={true} // Use ISO week numbering
            locale={de}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles as any}
            components={{
              Day: ({ date, ...props }) => (
                <div
                  {...props}
                  className={cn(
                    props.className,
                    "relative h-[80px] w-full p-2 flex flex-col justify-start items-stretch transition-colors",
                    isSameDay(date, new Date()) && "border border-primary",
                  )}
                >
                  {renderDay(date)}
                </div>
              ),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};
