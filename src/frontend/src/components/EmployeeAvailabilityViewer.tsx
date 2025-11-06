import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmployeeAvailabilities } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Clock, Info } from "lucide-react";
import React from "react";

interface EmployeeAvailabilityViewerProps {
  employeeId: number;
  employeeName: string;
  dateRange?: { from: Date; to: Date };
}

/**
 * Simplified Employee Availability Viewer
 * Displays employee availability in a compact, read-only format
 * for use in hover cards and quick previews
 */
export function EmployeeAvailabilityViewer({
  employeeId,
  employeeName,
  dateRange,
}: EmployeeAvailabilityViewerProps) {
  // Fetch employee availabilities
  const { data: availabilities, isLoading } = useQuery({
    queryKey: ["employee-availabilities", employeeId],
    queryFn: () => getEmployeeAvailabilities(employeeId),
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Helper to get day name in German
  const getDayName = (dayIndex: number): string => {
    const days = [
      "Montag",
      "Dienstag",
      "Mittwoch",
      "Donnerstag",
      "Freitag",
      "Samstag",
      "Sonntag",
    ];
    return days[dayIndex] || "Unbekannt";
  };

  // Helper to format availability type
  const getAvailabilityBadge = (type: string) => {
    switch (type.toUpperCase()) {
      case "FIXED":
        return (
          <Badge variant="default" className="text-xs bg-blue-500">
            Fest
          </Badge>
        );
      case "PREFERRED":
        return (
          <Badge variant="secondary" className="text-xs bg-green-500">
            Bevorzugt
          </Badge>
        );
      case "AVAILABLE":
        return (
          <Badge variant="outline" className="text-xs">
            Verfügbar
          </Badge>
        );
      case "UNAVAILABLE":
        return (
          <Badge variant="destructive" className="text-xs">
            Nicht verfügbar
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {type}
          </Badge>
        );
    }
  };

  // Group availabilities by day of week
  const availabilitiesByDay = React.useMemo(() => {
    if (!availabilities) return {};

    const grouped: Record<
      number,
      Array<{
        hour: number;
        is_available: boolean;
        availability_type: string;
      }>
    > = {};

    availabilities.forEach((avail) => {
      if (!grouped[avail.day_of_week]) {
        grouped[avail.day_of_week] = [];
      }
      grouped[avail.day_of_week].push({
        hour: avail.hour,
        is_available: avail.is_available,
        availability_type: avail.availability_type,
      });
    });

    // Sort hours for each day
    Object.keys(grouped).forEach((day) => {
      const dayNum = parseInt(day);
      grouped[dayNum].sort((a, b) => a.hour - b.hour);
    });

    return grouped;
  }, [availabilities]);

  // Helper to format time ranges
  const formatTimeRanges = (
    hours: Array<{ hour: number; is_available: boolean; availability_type: string }>
  ): string => {
    if (hours.length === 0) return "Keine Verfügbarkeit";

    // Filter for available hours
    const availableHours = hours.filter((h) => h.is_available);
    if (availableHours.length === 0) return "Nicht verfügbar";

    // Group consecutive hours into ranges
    const ranges: Array<{ start: number; end: number; type: string }> = [];
    let currentRange: { start: number; end: number; type: string } | null = null;

    availableHours.forEach((h) => {
      if (
        currentRange === null ||
        h.hour !== currentRange.end + 1 ||
        h.availability_type !== currentRange.type
      ) {
        // Start a new range
        if (currentRange !== null) {
          ranges.push(currentRange);
        }
        currentRange = {
          start: h.hour,
          end: h.hour,
          type: h.availability_type,
        };
      } else {
        // Extend current range
        currentRange.end = h.hour;
      }
    });

    // Add the last range
    if (currentRange !== null) {
      ranges.push(currentRange);
    }

    // Format ranges as strings
    return ranges
      .map((range) => {
        const startTime = `${range.start.toString().padStart(2, "0")}:00`;
        const endTime = `${(range.end + 1).toString().padStart(2, "0")}:00`;
        return `${startTime} - ${endTime}`;
      })
      .join(", ");
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Verfügbarkeit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const dayCount = Object.keys(availabilitiesByDay).length;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Verfügbarkeit: {employeeName}
        </CardTitle>
        {dateRange && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Calendar className="h-3 w-3" />
            {format(dateRange.from, "dd.MM.yyyy", { locale: de })} -{" "}
            {format(dateRange.to, "dd.MM.yyyy", { locale: de })}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {dayCount === 0 ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
            <Info className="h-4 w-4" />
            Keine spezifischen Verfügbarkeiten definiert
          </div>
        ) : (
          <>
            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
              const dayAvailabilities = availabilitiesByDay[dayIndex];
              if (!dayAvailabilities || dayAvailabilities.length === 0) {
                return null;
              }

              const timeRanges = formatTimeRanges(dayAvailabilities);
              const availabilityType =
                dayAvailabilities.find((a) => a.is_available)?.availability_type ||
                "AVAILABLE";

              return (
                <div
                  key={dayIndex}
                  className="flex items-start justify-between gap-2 pb-2 border-b last:border-0"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{getDayName(dayIndex)}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeRanges}
                    </div>
                  </div>
                  <div>{getAvailabilityBadge(availabilityType)}</div>
                </div>
              );
            })}
          </>
        )}

        <div className="pt-2 mt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            {dayCount > 0
              ? `${dayCount} Tag${dayCount !== 1 ? "e" : ""} mit Verfügbarkeiten`
              : "Für weitere Details die Verfügbarkeits-Verwaltung öffnen"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
