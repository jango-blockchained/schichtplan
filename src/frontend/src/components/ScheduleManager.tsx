import React, { useState, useEffect } from "react";
import { ScheduleTable } from "./ScheduleTable";
import { Schedule, ScheduleUpdate } from "@/types";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Loader2, Plus } from "lucide-react"; // For empty state
import { Button } from "@/components/ui/button"; // For empty state

interface ScheduleManagerProps {
  schedules: Schedule[];
  dateRange: DateRange | undefined;
  onDrop: (update: ScheduleUpdate) => Promise<void>;
  onUpdate: (update: ScheduleUpdate) => Promise<void>;
  isLoading: boolean;
  employeeAbsences?: Record<number, any[]>;
  absenceTypes?: Array<{
    id: string;
    name: string;
    color: string;
    type: "absence_type";
  }>;
  currentVersion?: number;
  // Removed activeView as we're always using table view

  // New props for empty state handling
  isEmptyState: boolean;
  versions: Array<{ version: number /* other version props */ }>; // Adjust as per your actual version type
  isGenerating?: boolean;
  onEmptyStateCreateVersion: () => void;
  onEmptyStateGenerateSchedule: () => void;
  openingDays: number[]; // Add openingDays prop
}

export function ScheduleManager({
  schedules,
  dateRange,
  onDrop,
  onUpdate,
  isLoading,
  employeeAbsences,
  absenceTypes,
  currentVersion,
  // Destructure new props
  isEmptyState,
  versions,
  isGenerating,
  onEmptyStateCreateVersion,
  onEmptyStateGenerateSchedule,
  openingDays, // Destructure openingDays prop
}: ScheduleManagerProps) {
  // Log detailed debug info about received schedules
  useEffect(() => {
    // Basic count info
    const schedulesWithShiftId = schedules.filter((s) => s.shift_id !== null);
    const schedulesWithTimes = schedulesWithShiftId.filter(
      (s) => s.shift_start && s.shift_end,
    );
    const employeeIds = [...new Set(schedules.map((s) => s.employee_id))];

    console.log("🔵 ScheduleManager received:", {
      totalSchedules: schedules.length,
      withShiftId: schedulesWithShiftId.length,
      withTimes: schedulesWithTimes.length,
      uniqueEmployees: employeeIds.length,
      currentVersion,
      dateRange: dateRange
        ? {
            from: dateRange.from?.toISOString(),
            to: dateRange.to?.toISOString(),
          }
        : null,
      isEmptyState,
      versionsCount: versions.length,
      isGenerating,
    });

    // Log the first few schedules with shift IDs for debugging
    if (schedulesWithShiftId.length > 0) {
      console.log(
        "🔵 First 3 schedules with shifts:",
        schedulesWithShiftId.slice(0, 3),
      );
    } else if (!isEmptyState) {
      // Only warn if not in empty state, otherwise it's expected
      console.log(
        "🔵 WARNING: No schedules with shift IDs found (and not in empty state)",
      );
    }
  }, [
    schedules,
    dateRange,
    currentVersion,
    isEmptyState,
    versions,
    isGenerating,
  ]);

  // Debug log for ScheduleManager render
  console.log("🔍 RENDERING ScheduleManager with:", {
    schedulesCount: schedules.length,
    dateRangeFrom: dateRange?.from ? dateRange.from.toISOString() : "undefined",
    dateRangeTo: dateRange?.to ? dateRange.to.toISOString() : "undefined",
    isLoading,
    currentVersion,
    isEmptyState,
    isGenerating,
  });

  if (isEmptyState) {
    return (
      <Card className="mb-4 border-dashed border-2 border-border">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Keine Einträge gefunden</h3>
          <p className="text-muted-foreground text-center mb-4">
            {versions.length === 0
              ? "Für den ausgewählten Zeitraum wurde noch keine Version erstellt."
              : "Für den ausgewählten Zeitraum wurden keine Schichtplan-Einträge gefunden."}
          </p>
          {versions.length === 0 ? (
            <Button onClick={onEmptyStateCreateVersion} variant="outline">
              Neue Version erstellen
            </Button>
          ) : (
            <Button
              onClick={onEmptyStateGenerateSchedule}
              disabled={isGenerating || !currentVersion}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Schichtplan generieren
            </Button>
          )}
          {!currentVersion && versions.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Bitte wählen Sie eine Version aus, um den Dienstplan zu
              generieren.
            </p>
          )}
          {/* Consider if this condition is still needed or how to check it
                    {(!dateRange?.from || !dateRange?.to) && versions.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                            Bitte wählen Sie einen Datumsbereich aus, um eine Version zu erstellen.
                        </p>
                    )}
                    */}
        </CardContent>
      </Card>
    );
  }

  // Original rendering logic when not in empty state
  return (
    <Card>
      <CardContent className="p-0">
        <ScheduleTable
          schedules={schedules}
          dateRange={dateRange}
          onDrop={onDrop}
          onUpdate={onUpdate}
          isLoading={isLoading}
          employeeAbsences={employeeAbsences}
          absenceTypes={absenceTypes}
          currentVersion={currentVersion}
          openingDays={openingDays} // Pass openingDays to ScheduleTable
        />
      </CardContent>
    </Card>
  );
}
