import React from "react";
import { DateRange } from "react-day-picker";
import { format, getWeek, getYear, addWeeks, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateRangeSelectorProps {
  dateRange: DateRange | undefined;
  scheduleDuration: number;
  onWeekChange: (weekOffset: number) => void;
  onDurationChange: (duration: number) => void;
}

export function DateRangeSelector({
  dateRange,
  scheduleDuration,
  onWeekChange,
  onDurationChange,
}: DateRangeSelectorProps) {
  // If no date range is set, show placeholder
  if (!dateRange?.from || !dateRange?.to) {
    return (
      <Card className="mb-4">
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-lg">Zeitraumauswahl</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="text-center text-muted-foreground">
            Kein Datumsbereich ausgewählt
          </div>
        </CardContent>
      </Card>
    );
  }

  // Helper function to format week number and date range as string
  const formatWeekLabel = () => {
    const fromDate = dateRange.from!;
    const weekNumber = getWeek(fromDate, { weekStartsOn: 1 });
    const year = getYear(fromDate);
    return `Kalenderwoche ${weekNumber}/${year}`;
  };

  // Helper function to format date range
  const formatDateRangeLabel = () => {
    return `${format(dateRange.from!, "dd.MM.yyyy")} - ${format(dateRange.to!, "dd.MM.yyyy")}`;
  };

  return (
    <Card className="mb-4">
      <CardHeader className="py-4 border-b">
        <CardTitle className="text-lg flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Zeitraumauswahl
        </CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onWeekChange(-1)}
              title="Vorherige Woche"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center min-w-[180px]">
              <span className="font-semibold">{formatWeekLabel()}</span>
              <span className="text-sm text-muted-foreground">
                {formatDateRangeLabel()}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onWeekChange(1)}
              title="Nächste Woche"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Anzahl Wochen:</span>
            <Select
              value={scheduleDuration.toString()}
              onValueChange={(value) => onDurationChange(parseInt(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Wochen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Woche</SelectItem>
                <SelectItem value="2">2 Wochen</SelectItem>
                <SelectItem value="3">3 Wochen</SelectItem>
                <SelectItem value="4">4 Wochen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
