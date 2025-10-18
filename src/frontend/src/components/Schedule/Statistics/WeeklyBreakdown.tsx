import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Activity, Calendar, Clock, Users } from "lucide-react";
import React from "react";

interface WeeklyBreakdownProps {
  weeklyBreakdown: Array<{
    weekStart: Date;
    weekEnd: Date;
    weekNumber: string;
    hours: number;
    shifts: number;
    employees: number;
  }>;
}

export const WeeklyBreakdown = React.memo(function WeeklyBreakdown({
  weeklyBreakdown,
}: WeeklyBreakdownProps) {
  if (weeklyBreakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Wöchentliche Aufschlüsselung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Keine Daten für wöchentliche Aufschlüsselung verfügbar.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals and averages
  const totalHours = weeklyBreakdown.reduce((sum, week) => sum + week.hours, 0);
  const totalShifts = weeklyBreakdown.reduce(
    (sum, week) => sum + week.shifts,
    0,
  );
  const avgHoursPerWeek = totalHours / weeklyBreakdown.length;
  const avgShiftsPerWeek = totalShifts / weeklyBreakdown.length;
  const maxHours = Math.max(...weeklyBreakdown.map((w) => w.hours));
  const maxShifts = Math.max(...weeklyBreakdown.map((w) => w.shifts));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Wöchentliche Aufschlüsselung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{totalHours.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Gesamt Stunden</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{totalShifts}</div>
            <div className="text-xs text-muted-foreground">
              Gesamt Schichten
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {avgHoursPerWeek.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">Ø Stunden/Woche</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {avgShiftsPerWeek.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">
              Ø Schichten/Woche
            </div>
          </div>
        </div>

        {/* Weekly Details */}
        <div className="space-y-3">
          <h5 className="text-sm font-medium">Wochenübersicht:</h5>
          {weeklyBreakdown.map((week, index) => {
            const hoursPercentage =
              maxHours > 0 ? (week.hours / maxHours) * 100 : 0;
            const shiftsPercentage =
              maxShifts > 0 ? (week.shifts / maxShifts) * 100 : 0;

            return (
              <div key={index} className="p-3 border rounded-lg space-y-2">
                {/* Week Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">KW {week.weekNumber}</span>
                    <span className="text-sm text-muted-foreground">
                      ({format(week.weekStart, "dd.MM.", { locale: de })} -{" "}
                      {format(week.weekEnd, "dd.MM.", { locale: de })})
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{week.employees}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      <span>{week.shifts}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{week.hours.toFixed(1)}h</span>
                    </div>
                  </div>
                </div>

                {/* Hours Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Stunden ({week.hours.toFixed(1)}h)</span>
                    <span>{hoursPercentage.toFixed(0)}% vom Maximum</span>
                  </div>
                  <Progress value={hoursPercentage} className="h-2" />
                </div>

                {/* Shifts Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Schichten ({week.shifts})</span>
                    <span>{shiftsPercentage.toFixed(0)}% vom Maximum</span>
                  </div>
                  <Progress value={shiftsPercentage} className="h-2" />
                </div>

                {/* Additional Metrics */}
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>
                    Ø {(week.hours / Math.max(week.shifts, 1)).toFixed(1)}h pro
                    Schicht
                  </span>
                  <span>
                    Ø {(week.hours / Math.max(week.employees, 1)).toFixed(1)}h
                    pro MA
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trend Analysis */}
        {weeklyBreakdown.length > 1 && (
          <div className="border-t pt-3">
            <h5 className="text-sm font-medium mb-2">Trend-Analyse:</h5>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Stärkste Woche:</span>
                <div className="font-medium">
                  KW{" "}
                  {
                    weeklyBreakdown.find((w) => w.hours === maxHours)
                      ?.weekNumber
                  }
                  ({maxHours.toFixed(1)}h)
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Schwächste Woche:</span>
                <div className="font-medium">
                  KW{" "}
                  {
                    weeklyBreakdown.find(
                      (w) =>
                        w.hours ===
                        Math.min(...weeklyBreakdown.map((w) => w.hours)),
                    )?.weekNumber
                  }
                  ({Math.min(...weeklyBreakdown.map((w) => w.hours)).toFixed(1)}
                  h)
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
