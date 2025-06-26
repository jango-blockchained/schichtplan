import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Employee, Schedule } from "@/types";
import { AlertTriangle, Info } from "lucide-react";
import React from "react";
import { DateRange } from "react-day-picker";
import { ScheduleStatistics } from "./ScheduleStatistics";


interface SchedulePageContentProps {
  // Data props
  scheduleData: Schedule[];
  employees: Employee[];
  effectiveDateRange: DateRange | undefined;
  
  // Loading states
  isLoadingSchedules: boolean;
  isLoadingEmployees: boolean;
  
  // Error states
  scheduleError: Error | null;
  employeeError: Error | null;
  
  // Settings
  openingDays: number[];
  version?: number;
  
  // Children for flexible content composition
  children?: React.ReactNode;
}

export function SchedulePageContent({
  scheduleData,
  employees,
  effectiveDateRange,
  isLoadingSchedules,
  isLoadingEmployees,
  scheduleError,
  employeeError,
  openingDays,
  version,
  children,
}: SchedulePageContentProps) {
  // Show loading skeleton
  if (isLoadingSchedules || isLoadingEmployees) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <Skeleton className="h-96 w-full" />
        </Card>
      </div>
    );
  }

  // Show error if either data source failed
  if (scheduleError || employeeError) {
    return (
      <div className="space-y-6">
        {scheduleError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Fehler beim Laden der Schichtdaten</AlertTitle>
            <AlertDescription>
              {scheduleError.message || "Ein unbekannter Fehler ist aufgetreten."}
            </AlertDescription>
          </Alert>
        )}
        {employeeError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Fehler beim Laden der Mitarbeiterdaten</AlertTitle>
            <AlertDescription>
              {employeeError.message || "Ein unbekannter Fehler ist aufgetreten."}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  // Show info when no data is available but no error occurred
  if (!scheduleData?.length && !isLoadingSchedules) {
    return (
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Keine Schichtdaten vorhanden</AlertTitle>
          <AlertDescription>
            Für den gewählten Zeitraum sind keine Schichtdaten verfügbar. 
            Möglicherweise müssen Sie zuerst einen Schichtplan generieren.
          </AlertDescription>
        </Alert>
        
        {/* Show statistics even with no schedule data */}
        <ScheduleStatistics
          schedules={scheduleData}
          dateRange={effectiveDateRange}
          employees={employees}
          openingDays={openingDays}
          version={version}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Section */}
      <ScheduleStatistics
        schedules={scheduleData}
        dateRange={effectiveDateRange}
        employees={employees}
        openingDays={openingDays}
        version={version}
      />

      {/* Main Content - passed as children for flexibility */}
      {children}
    </div>
  );
}
