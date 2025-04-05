import React, { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import {
  format,
  getWeek,
  getYear,
  addWeeks,
  startOfWeek,
  addDays,
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
import { Separator } from "@/components/ui/separator";

interface EnhancedDateRangeSelectorProps {
  dateRange: DateRange | undefined;
  scheduleDuration: number;
  onWeekChange: (weekOffset: number) => void;
  onDurationChange: (duration: number) => void;
  hasVersions: boolean;
  onCreateNewVersion: () => void;
  onCreateNewVersionWithOptions: (options: {
    dateRange: DateRange;
    weekAmount: number;
  }) => void;
}

export function EnhancedDateRangeSelector({
  dateRange,
  scheduleDuration,
  onWeekChange,
  onDurationChange,
  hasVersions,
  onCreateNewVersion,
  onCreateNewVersionWithOptions,
}: EnhancedDateRangeSelectorProps) {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "week" | "duration";
    value: number;
  } | null>(null);

  // State for the new version options
  const [newVersionDateRange, setNewVersionDateRange] = useState<
    DateRange | undefined
  >(dateRange);
  const [newVersionWeekAmount, setNewVersionWeekAmount] =
    useState<number>(scheduleDuration);

  // Update new version options when dateRange or scheduleDuration changes
  useEffect(() => {
    setNewVersionDateRange(dateRange);
    setNewVersionWeekAmount(scheduleDuration);
  }, [dateRange, scheduleDuration]);

  // Sync the end date when start date or week amount changes
  useEffect(() => {
    if (newVersionDateRange?.from) {
      const from = newVersionDateRange.from;
      const to = addDays(
        startOfWeek(from, { weekStartsOn: 1 }),
        6 * newVersionWeekAmount,
      );
      to.setHours(23, 59, 59, 999);
      setNewVersionDateRange({ from, to });
    }
  }, [newVersionDateRange?.from, newVersionWeekAmount]);

  // If no date range is set, show placeholder
  if (!dateRange?.from || !dateRange?.to) {
    return (
      <div className="flex items-center justify-center p-4 mb-4 bg-muted/30 rounded-lg">
        <span className="text-muted-foreground">
          Kein Datumsbereich ausgewählt
        </span>
      </div>
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

  // Handle week change with confirmation if versions exist
  const handleWeekChange = (weekOffset: number) => {
    if (hasVersions) {
      setPendingAction({ type: "week", value: weekOffset });
      setIsConfirmDialogOpen(true);
    } else {
      onWeekChange(weekOffset);
    }
  };

  // Handle duration change with confirmation if versions exist
  const handleDurationChange = (duration: number) => {
    if (hasVersions) {
      setPendingAction({ type: "duration", value: duration });
      setIsConfirmDialogOpen(true);
    } else {
      onDurationChange(duration);
    }
  };

  // Execute the pending action and create a new version
  const handleConfirmChange = () => {
    // Create a new version with the options from the dialog
    if (newVersionDateRange?.from && newVersionDateRange?.to) {
      onCreateNewVersionWithOptions({
        dateRange: newVersionDateRange,
        weekAmount: newVersionWeekAmount,
      });
    }

    // Reset pending action
    setPendingAction(null);
    setIsConfirmDialogOpen(false);
  };

  // Handle date range change in the dialog
  const handleDialogDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from) {
      // When only the start date is selected, set the end date based on week amount
      if (!range.to) {
        const from = range.from;
        const to = addDays(
          startOfWeek(from, { weekStartsOn: 1 }),
          6 * newVersionWeekAmount,
        );
        to.setHours(23, 59, 59, 999);
        setNewVersionDateRange({ from, to });
      } else {
        setNewVersionDateRange(range);
      }
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-2 mb-4 bg-background border rounded-md">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Zeitraum:</span>
          <span className="text-sm text-muted-foreground">
            {formatDateRangeLabel()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleWeekChange(-1)}
            title="Vorherige Woche"
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col items-center min-w-[140px]">
            <span className="text-sm font-medium">{formatWeekLabel()}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleWeekChange(1)}
            title="Nächste Woche"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Wochen:</span>
          <Select
            value={scheduleDuration.toString()}
            onValueChange={(value) => handleDurationChange(parseInt(value))}
          >
            <SelectTrigger className="w-[80px] h-8">
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
              Bitte wählen Sie den Zeitraum und die Anzahl der Wochen für die
              neue Version.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="dateRange">Zeitraum</Label>
              <DateRangePicker
                dateRange={newVersionDateRange}
                onChange={handleDialogDateRangeChange}
                className="w-full"
              />
            </div>

            <Separator className="my-3" />

            <div className="space-y-2">
              <Label htmlFor="weekAmount">Anzahl Wochen</Label>
              <Select
                value={newVersionWeekAmount.toString()}
                onValueChange={(value) =>
                  setNewVersionWeekAmount(parseInt(value))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Wochen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Woche</SelectItem>
                  <SelectItem value="2">2 Wochen</SelectItem>
                  <SelectItem value="3">3 Wochen</SelectItem>
                  <SelectItem value="4">4 Wochen</SelectItem>
                </SelectContent>
              </Select>

              {newVersionDateRange?.from && newVersionDateRange?.to && (
                <p className="text-sm text-muted-foreground mt-2">
                  Zeitraum: {format(newVersionDateRange.from, "dd.MM.yyyy")} -{" "}
                  {format(newVersionDateRange.to, "dd.MM.yyyy")}
                </p>
              )}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChange}>
              Neue Version erstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
