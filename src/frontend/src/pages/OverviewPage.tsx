import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Link } from "react-router-dom";
import { getEmployees, getSchedules, getAbsencesByRange, type ScheduleResponse } from "@/services/api";
import { Users, CalendarDays, CalendarX2, ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { getWeekStartsOn } from "@/utils/weekStart";
import { useQuery as useSettingsQuery } from "@tanstack/react-query";
import { getSettings } from "@/services/api";

export default function OverviewPage() {
  // Settings for dynamic week start
  const { data: settings } = useSettingsQuery({ queryKey: ["settings"], queryFn: getSettings, staleTime: 300_000 });
  const weekStartsOn = getWeekStartsOn(settings);

  const { startISO, endISO, label } = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn });
    const end = endOfWeek(now, { weekStartsOn });
    return {
      startISO: format(start, "yyyy-MM-dd"),
      endISO: format(end, "yyyy-MM-dd"),
      label: `${format(start, "dd.MM")} - ${format(end, "dd.MM.yyyy")}`,
    };
  }, [weekStartsOn]);

  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: getEmployees });

  const { data: schedules } = useQuery<ScheduleResponse>({
    queryKey: ["schedules", startISO, endISO, undefined, true],
    queryFn: () => getSchedules(startISO, endISO, undefined, true),
  });

  const { data: absences } = useQuery({
    queryKey: ["absences", startISO, endISO],
    queryFn: () => getAbsencesByRange(startISO, endISO),
  });

  const totalShifts = schedules?.schedules?.length ?? 0;
  const filledShifts = schedules?.schedules?.filter((s) => !!s.employee_id).length ?? 0;
  const emptyShifts = totalShifts - filledShifts;

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader
        title="Übersicht"
        description={`Aktuelle Woche: ${label}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/calendar">Kalender öffnen</Link>
            </Button>
            <Button asChild>
              <Link to="/">Zum Schichtplan</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mitarbeiter</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Gesamtanzahl</p>
            <Button asChild variant="link" className="px-0 mt-2 text-sm">
              <Link to="/employees" className="inline-flex items-center">Verwalten <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schichten (diese Woche)</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filledShifts}/{totalShifts}</div>
            <p className="text-xs text-muted-foreground mt-1">Besetzt / Gesamt • Leer: {emptyShifts}</p>
            <Button asChild variant="link" className="px-0 mt-2 text-sm">
              <Link to="/">Zum Schichtplan <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abwesenheiten (diese Woche)</CardTitle>
            <CalendarX2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{absences?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Urlaub/Krankheit u.a.</p>
            <Button asChild variant="link" className="px-0 mt-2 text-sm">
              <Link to="/absences" className="inline-flex items-center">Abwesenheiten <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schnellzugriff</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link to="/versions">Versionen</Link></Button>
            <Button asChild variant="secondary"><Link to="/shifts">Schichtvorlagen</Link></Button>
            <Button asChild variant="secondary"><Link to="/coverage">Coverage</Link></Button>
            <Button asChild variant="secondary"><Link to="/settings">Einstellungen</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
