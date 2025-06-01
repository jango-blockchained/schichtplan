import React, { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import {
  format,
  getWeek,
  getYear,
  addWeeks,
  startOfWeek,
  addDays,
  differenceInCalendarWeeks,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Label } from "@/components/ui/label";

interface EnhancedDateRangeSelectorProps {
  dateRange: DateRange | undefined;
  scheduleDuration: number;
  onWeekChange: (weekOffset: number) => void;
  onDurationChange: (duration: number) => void;
  hasVersions: boolean;
  onCreateNewVersion: () => void;
  onCreateNewVersionWithSpecificDateRange: (options: {
    dateRange: DateRange;
  }) => void;
  currentVersion?: number;
}

export function EnhancedDateRangeSelector({
  dateRange,
  scheduleDuration,
  onWeekChange,
  onDurationChange,
  hasVersions,
  onCreateNewVersion,
  onCreateNewVersionWithSpecificDateRange,
  currentVersion,
}: EnhancedDateRangeSelectorProps) {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  // State for the date range selected within the dialog
  const [dialogSelectedDateRange, setDialogSelectedDateRange] = useState<
    DateRange | undefined
  >();

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

  const openConfirmationDialog = (initialDialogRange: DateRange) => {
    setDialogSelectedDateRange(initialDialogRange);
    setIsConfirmDialogOpen(true);
  };

  // Handle week change with confirmation if versions exist
  const handleWeekChange = (weekOffset: number) => {
    if (hasVersions) {
      if (dateRange?.from) {
        const from = addWeeks(
          startOfWeek(dateRange.from, { weekStartsOn: 1 }),
          weekOffset,
        );
        from.setHours(0, 0, 0, 0);
        const to = addDays(from, 6 * scheduleDuration); // Use current scheduleDuration for initial dialog display
        to.setHours(23, 59, 59, 999);
        openConfirmationDialog({ from, to });
      }
    } else {
      onWeekChange(weekOffset);
    }
  };

  // Handle duration change with confirmation if versions exist
  const handleDurationChange = (newDuration: number) => {
    if (hasVersions) {
      if (dateRange?.from) {
        const from = dateRange.from;
        const to = addDays(
          startOfWeek(from, { weekStartsOn: 1 }),
          6 * newDuration,
        );
        to.setHours(23, 59, 59, 999);
        openConfirmationDialog({ from, to });
      }
    } else {
      onDurationChange(newDuration);
    }
  };

  // Execute the pending action and create a new version
  const handleConfirmChange = () => {
    if (dialogSelectedDateRange?.from && dialogSelectedDateRange?.to) {
      console.log(
        "📅 EnhancedDateRangeSelector: Creating new version with specific date range:",
        {
          from: dialogSelectedDateRange.from.toISOString(),
          to: dialogSelectedDateRange.to.toISOString(),
        },
      );

      // Call back with only the dateRange selected in the dialog
      onCreateNewVersionWithSpecificDateRange({
        dateRange: dialogSelectedDateRange,
      });
    } else {
      console.log(
        "📅 EnhancedDateRangeSelector: Cannot create version - no valid date range selected",
      );
    }
    setIsConfirmDialogOpen(false);
  };

  return (
    <>
      <Card className="mb-4 border border-border shadow-lg bg-card">
        <CardHeader className="py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center font-medium">
              <Calendar className="h-6 w-6 mr-2 text-primary" />
              Zeitraumauswahl
            </CardTitle>
            {currentVersion && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Aktuelle Version:</span>
                <div className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium shadow-sm border border-primary/20">
                  V{currentVersion}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleWeekChange(-1)}
                title="Vorherige Woche"
                className="border-border/30 hover:border-primary/50 hover:bg-primary/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col items-center min-w-[220px] px-6 py-3 bg-primary/15 rounded-lg border border-primary/30 shadow-sm">
                <span className="font-medium text-lg text-primary">{formatWeekLabel()}</span>
                <span className="text-sm font-medium text-primary/90">
                  {formatDateRangeLabel()}
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleWeekChange(1)}
                title="Nächste Woche"
                className="border-border/30 hover:border-primary/50 hover:bg-primary/10"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Anzahl Wochen:</span>
              <Select
                value={scheduleDuration.toString()}
                onValueChange={(value) => handleDurationChange(parseInt(value))}
              >
                <SelectTrigger className="w-[120px] border-border/30 hover:border-primary/50">
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

      {/* Enhanced Confirmation Dialog */}
      <AlertDialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Neue Version erstellen
            </AlertDialogTitle>
            <AlertDialogDescription>
              Wählen Sie den genauen Zeitraum für die neue Version. Die
              Plandaten der aktuellen Version bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="dialogDateRangePicker">
                Zeitraum für neue Version
              </Label>
              <DateRangePicker
                id="dialogDateRangePicker"
                dateRange={dialogSelectedDateRange}
                onChange={setDialogSelectedDateRange}
                className="w-full"
              />
            </div>
            {dialogSelectedDateRange?.from && dialogSelectedDateRange?.to && (
              <p className="text-sm text-muted-foreground mt-1">
                Ausgewählt: {format(dialogSelectedDateRange.from, "dd.MM.yyyy")}{" "}
                - {format(dialogSelectedDateRange.to, "dd.MM.yyyy")}
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmChange}
              disabled={
                !dialogSelectedDateRange?.from || !dialogSelectedDateRange?.to
              }
            >
              Neue Version erstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
