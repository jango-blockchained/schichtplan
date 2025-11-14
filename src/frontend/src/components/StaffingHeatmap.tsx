import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { addDays, eachDayOfInterval, format, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { Info } from "lucide-react";
import { useMemo, useState } from "react";

export interface HeatmapData {
  date: string; // ISO date string
  value: number; // The metric value to display
  present?: number;
  on_vacation?: number;
  absent?: number;
}

interface StaffingHeatmapProps {
  data: HeatmapData[];
  title?: string;
  description?: string;
  metric?: "total_absent" | "on_vacation" | "present" | "absent";
  onMetricChange?: (metric: string) => void;
  minValue?: number;
  maxValue?: number;
}

export function StaffingHeatmap({
  data,
  title = "Belegungsplan Heatmap",
  description,
  metric = "total_absent",
  onMetricChange,
  minValue,
  maxValue,
}: StaffingHeatmapProps) {
  const [selectedMetric, setSelectedMetric] = useState(metric);

  // Calculate min/max if not provided
  const { min, max } = useMemo(() => {
    if (minValue !== undefined && maxValue !== undefined) {
      return { min: minValue, max: maxValue };
    }
    const values = data.map((d) => d.value);
    return {
      min: Math.min(...values, 0),
      max: Math.max(...values, 1),
    };
  }, [data, minValue, maxValue]);

  // Color scale function - returns tailwind class
  const getColorClass = (value: number): string => {
    if (max === min) return "bg-blue-200";

    const normalized = (value - min) / (max - min);

    if (normalized <= 0.2) return "bg-green-200 text-green-900";
    if (normalized <= 0.4) return "bg-green-300 text-green-900";
    if (normalized <= 0.6) return "bg-yellow-300 text-yellow-900";
    if (normalized <= 0.8) return "bg-orange-400 text-orange-900";
    return "bg-red-500 text-white";
  };

  // Group data by week
  const weekGroups = useMemo(() => {
    if (data.length === 0) return [];

    const weeks: Array<{ weekStart: Date; days: HeatmapData[] }> = [];
    let currentWeek: HeatmapData[] = [];
    let currentWeekStart: Date | null = null;

    data.forEach((day) => {
      const date = new Date(day.date);
      const weekStart = startOfWeek(date, { locale: de });

      if (
        !currentWeekStart ||
        weekStart.getTime() !== currentWeekStart.getTime()
      ) {
        if (currentWeek.length > 0) {
          weeks.push({ weekStart: currentWeekStart!, days: currentWeek });
        }
        currentWeek = [day];
        currentWeekStart = weekStart;
      } else {
        currentWeek.push(day);
      }
    });

    if (currentWeek.length > 0 && currentWeekStart) {
      weeks.push({ weekStart: currentWeekStart, days: currentWeek });
    }

    return weeks;
  }, [data]);

  const handleMetricChange = (newMetric: string) => {
    setSelectedMetric(newMetric);
    onMetricChange?.(newMetric);
  };

  const getMetricLabel = (metric: string): string => {
    switch (metric) {
      case "total_absent":
        return "Gesamt Abwesend";
      case "on_vacation":
        return "Im Urlaub";
      case "absent":
        return "Andere Abwesenheit";
      case "present":
        return "Anwesend";
      default:
        return "Unbekannt";
    }
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Keine Daten verfügbar
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          {onMetricChange && (
            <Select value={selectedMetric} onValueChange={handleMetricChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Metrik wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total_absent">Gesamt Abwesend</SelectItem>
                <SelectItem value="on_vacation">Im Urlaub</SelectItem>
                <SelectItem value="absent">Andere Abwesenheit</SelectItem>
                <SelectItem value="present">Anwesend</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Color Legend */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Legende:</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-300 border border-border" />
              <span>Niedrig</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-yellow-300 border border-border" />
              <span>Mittel</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-500 border border-border" />
              <span>Hoch</span>
            </div>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="space-y-2">
          {/* Weekday Headers */}
          <div className="grid grid-cols-8 gap-1">
            <div className="text-xs font-medium text-muted-foreground p-2">
              KW
            </div>
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
              <div
                key={day}
                className="text-xs font-medium text-center text-muted-foreground p-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Week Rows */}
          <TooltipProvider>
            {weekGroups.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-8 gap-1">
                {/* Week Number */}
                <div className="text-xs font-medium text-muted-foreground p-2 flex items-center">
                  {format(week.weekStart, "w", { locale: de })}
                </div>

                {/* Days of Week */}
                {eachDayOfInterval({
                  start: week.weekStart,
                  end: addDays(week.weekStart, 6),
                }).map((date) => {
                  const dateStr = format(date, "yyyy-MM-dd");
                  const dayData = week.days.find((d) => d.date === dateStr);

                  if (!dayData) {
                    return (
                      <div
                        key={dateStr}
                        className="aspect-square bg-muted/20 rounded border border-border"
                      />
                    );
                  }

                  return (
                    <Tooltip key={dateStr}>
                      <TooltipTrigger asChild>
                        <div
                          className={`aspect-square rounded border border-border flex items-center justify-center text-xs font-medium cursor-pointer hover:ring-2 hover:ring-primary transition-all ${getColorClass(
                            dayData.value
                          )}`}
                        >
                          {format(date, "d")}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {format(date, "dd.MM.yyyy", { locale: de })}
                          </p>
                          <p className="text-xs">
                            {getMetricLabel(selectedMetric)}: {dayData.value}
                          </p>
                          {dayData.present !== undefined && (
                            <p className="text-xs">
                              Anwesend: {dayData.present}
                            </p>
                          )}
                          {dayData.on_vacation !== undefined && (
                            <p className="text-xs">
                              Im Urlaub: {dayData.on_vacation}
                            </p>
                          )}
                          {dayData.absent !== undefined && (
                            <p className="text-xs">
                              Abwesend: {dayData.absent}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
