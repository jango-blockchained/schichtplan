import React from "react";
import { Schedule, ScheduleUpdate, Settings } from "@/types";
import { DateRange } from "react-day-picker";
import { Card } from "@/components/ui/card";
import {
  addDays,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";
import { de } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { getSettings, getEmployees } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MonthlyViewProps {
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
}

export const MonthlyView = ({
  schedules,
  dateRange,
  onDrop,
  onUpdate,
  isLoading,
  employeeAbsences,
  absenceTypes,
  storeSettings,
}: MonthlyViewProps) => {
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

  // Use the first day of the month from the dateRange
  const currentMonth = startOfMonth(dateRange.from);
  const lastDayOfMonth = endOfMonth(currentMonth);

  // Generate days for the month view (including days from previous/next month to fill the grid)
  const startDay = currentMonth.getDay(); // 0 = Sunday, 1 = Monday, ...
  const adjustedStartDay = startDay === 0 ? 6 : startDay - 1; // Adjust for Monday start (0 = Monday)

  const firstDayToShow = addDays(currentMonth, -adjustedStartDay);
  const daysToShow = eachDayOfInterval({
    start: firstDayToShow,
    end: addDays(
      lastDayOfMonth,
      42 - (adjustedStartDay + lastDayOfMonth.getDate()),
    ),
  });

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

  // Helper function to get shift type badge
  const getShiftTypeBadge = (shiftTypeId?: string) => {
    if (!shiftTypeId) return null;

    let variant = "default";
    let label = shiftTypeId;

    switch (shiftTypeId) {
      case "EARLY":
        variant = "default";
        label = "Früh";
        break;
      case "MIDDLE":
        variant = "secondary";
        label = "Mittel";
        break;
      case "LATE":
        variant = "outline";
        label = "Spät";
        break;
      case "NON_WORKING":
        variant = "outline";
        label = "---";
        break;
      case "OFF":
        variant = "outline";
        label = "Frei";
        break;
    }

    return (
      <Badge
        variant={variant as any}
        className={
          shiftTypeId === "NON_WORKING"
            ? "bg-slate-100 text-slate-400 border-slate-200"
            : ""
        }
      >
        {label}
      </Badge>
    );
  };

  // Function to get absence badge
  const getAbsenceBadge = (absence: any) => {
    if (!absence || !absenceTypes) return null;

    const absenceType = absenceTypes.find(
      (type) => type.id === absence.absence_type,
    );
    const style = absenceType
      ? {
          backgroundColor: `${absenceType.color}20`,
          color: absenceType.color,
          borderColor: absenceType.color,
        }
      : {
          backgroundColor: "#ff000020",
          color: "#ff0000",
          borderColor: "#ff0000",
        };

    return (
      <Badge variant="outline" style={style}>
        {absenceType?.name || "Abwesend"}
      </Badge>
    );
  };

  // Check if employee is absent on a specific day
  const isEmployeeAbsent = (
    employeeId: number,
    day: Date,
  ): { isAbsent: boolean; absence?: any } => {
    if (!employeeAbsences || !employeeAbsences[employeeId]) {
      return { isAbsent: false };
    }

    const dayFormatted = format(day, "yyyy-MM-dd");
    const absence = employeeAbsences[employeeId].find((absence) => {
      const absenceStart = new Date(absence.start_date);
      const absenceEnd = new Date(absence.end_date);
      const dayDate = new Date(dayFormatted);

      return dayDate >= absenceStart && dayDate <= absenceEnd;
    });

    return {
      isAbsent: !!absence,
      absence,
    };
  };

  // Function to check if a day is a store opening day
  const isStoreOpeningDay = (date: Date): boolean => {
    if (!storeSettings?.opening_days) return true;
    const dayIndex = date.getDay().toString();
    return storeSettings.opening_days[dayIndex] === true;
  };

  return (
    <div className="py-4">
      <Card className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">
            {format(currentMonth, "MMMM yyyy", { locale: de })}
          </h2>
        </div>

        {/* Calendar header - weekday names */}
        <div className="grid grid-cols-7 mb-2">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
            <div key={day} className="text-center font-semibold text-sm py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {daysToShow.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const daySchedules = schedulesByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);

            // Group schedules by shift type for this day
            const shiftCounts: Record<string, number> = {};
            daySchedules.forEach((schedule) => {
              if (schedule.shift_type_id) {
                shiftCounts[schedule.shift_type_id] =
                  (shiftCounts[schedule.shift_type_id] || 0) + 1;
              }
            });

            // Count absences
            let absenceCount = 0;
            if (employees && employeeAbsences) {
              employees.forEach((employee) => {
                const { isAbsent } = isEmployeeAbsent(employee.id, day);
                if (isAbsent) absenceCount++;
              });
            }

            // Check if it's a store opening day
            const isOpeningDay = isStoreOpeningDay(day);

            return (
              <div
                key={dateKey}
                className={cn(
                  "p-2 min-h-[100px] border rounded-md",
                  !isCurrentMonth && "opacity-40 bg-muted/40",
                  isToday(day) && "border-primary",
                  !isOpeningDay && "bg-muted/30",
                )}
              >
                <div className="text-right font-medium text-sm">
                  {format(day, "d")}
                </div>

                <div className="mt-2 space-y-1">
                  {Object.entries(shiftCounts).map(([shiftType, count]) => (
                    <div
                      key={shiftType}
                      className="flex justify-between items-center text-xs"
                    >
                      {getShiftTypeBadge(shiftType)}
                      <span>{count}</span>
                    </div>
                  ))}

                  {absenceCount > 0 && (
                    <div className="flex justify-between items-center text-xs mt-1">
                      <Badge
                        variant="outline"
                        className="bg-red-50 text-red-600 border-red-200"
                      >
                        Abwesend
                      </Badge>
                      <span>{absenceCount}</span>
                    </div>
                  )}

                  {daySchedules.length === 0 && absenceCount === 0 && (
                    <div className="text-xs text-muted-foreground text-center mt-3">
                      Keine Einträge
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
