import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VersionManager } from "@/components/VersionManager";
import { getSettings } from "@/services/api";
import { getWeekStartsOn } from "@/utils/weekStart";
import { useQuery } from "@tanstack/react-query";
import { addDays, endOfWeek, startOfWeek } from "date-fns";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Link } from "react-router-dom";

export default function VersionsPage() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const weekStartsOn = getWeekStartsOn(settings);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const from = startOfWeek(now, { weekStartsOn });
    const to = endOfWeek(now, { weekStartsOn });
    return { from, to };
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Versionen"
        description="Verwalte Plan-Versionen in Tabellen- oder Kalenderansicht"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/calendar">Kalenderansicht</Link>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="table" className="w-full">
        <TabsList>
          <TabsTrigger value="table">Tabelle</TabsTrigger>
          <TabsTrigger value="calendar">Kalender</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <VersionManager
                dateRange={dateRange}
                layout="vertical"
                isCollapsible={false}
                initiallyCollapsed={false}
                showCreateButton={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3">
                <div>Nutze die Kalenderseite, um Versionen im Kontext der Woche zu sehen.</div>
                <div className="flex gap-2">
                  <Button asChild>
                    <Link to="/calendar">Zur Kalenderansicht wechseln</Link>
                  </Button>
                  <Button variant="secondary" onClick={() => setDateRange((dr) => ({
                    from: dr?.from ? addDays(dr.from, -7) : undefined,
                    to: dr?.to ? addDays(dr.to, -7) : undefined,
                  }))}>Vorherige Woche</Button>
                  <Button variant="secondary" onClick={() => setDateRange((dr) => ({
                    from: dr?.from ? addDays(dr.from, 7) : undefined,
                    to: dr?.to ? addDays(dr.to, 7) : undefined,
                  }))}>Nächste Woche</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
