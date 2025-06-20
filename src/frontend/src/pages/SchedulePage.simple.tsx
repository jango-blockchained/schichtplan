import { PageHeader } from "@/components/PageHeader";
import { ScheduleTable } from "@/components/ScheduleTable";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/useSettings";
import { getSchedules } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { addDays, startOfWeek } from "date-fns";
import { useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export function SchedulePage() {
  const { settings, isLoading: isLoadingSettings } = useSettings();
  
  // Basic date range state
  const [dateRange, setDateRange] = useState({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6)
  });

  // Fetch schedules
  const { data: schedules = [], isLoading: isSchedulesLoading, error: schedulesError } = useQuery({
    queryKey: ["schedules", dateRange],
    queryFn: () => getSchedules(),
  });

  if (isLoadingSettings || isSchedulesLoading) {
    return (
        <div className="container mx-auto py-4 space-y-4 mb-16">
            <PageHeader title="Dienstplan">
                <Skeleton className="h-10 w-48" />
            </PageHeader>
            <Card className="p-4">
                <Skeleton className="h-96 w-full" />
            </Card>
      </div>
    );
  }

  if (schedulesError) {
    return (
      <div className="container mx-auto py-4 space-y-4 mb-16">
        <PageHeader title="Dienstplan" />
        <Card className="p-4">
          <div className="text-center text-destructive">
            Fehler beim Laden der Schichtdaten: {schedulesError.message}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto py-4 space-y-4 mb-16">
        <PageHeader title="Dienstplan" />

        {/* Main Schedule Table */}
        <ScheduleTable
          schedules={schedules}
          dateRange={dateRange}
          onDrop={async () => {
            // Handle drop functionality
            console.log('Drop functionality not implemented');
          }}
          onUpdate={async () => {
            // Handle update functionality
            console.log('Update functionality not implemented');
          }}
          isLoading={isSchedulesLoading}
          employeeAbsences={{}}
          absenceTypes={[]}
          currentVersion={1}
          openingDays={[1, 2, 3, 4, 5, 6, 7]}
        />
      </div>
    </DndProvider>
  );
}
