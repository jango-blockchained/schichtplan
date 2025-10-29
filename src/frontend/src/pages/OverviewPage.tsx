import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getAbsencesByRange,
  getEmployees,
  getSchedules,
  getSettings,
  type ScheduleResponse,
} from "@/services/api";
import { getWeekStartsOn } from "@/utils/weekStart";
import { useQuery, useQuery as useSettingsQuery } from "@tanstack/react-query";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { 
  ArrowRight, 
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays, 
  CalendarX2, 
  Clock,
  FileText,
  GitBranch,
  LayoutGrid,
  Settings,
  TrendingUp,
  Users,
  UserCheck,
  UserX
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

export default function OverviewPage() {
  // Settings for dynamic week start
  const { data: settings } = useSettingsQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 300_000,
  });
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

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const { data: schedules } = useQuery<ScheduleResponse>({
    queryKey: ["schedules", startISO, endISO, undefined, true],
    queryFn: () => getSchedules(startISO, endISO, undefined, true),
  });

  const { data: absences } = useQuery({
    queryKey: ["absences", startISO, endISO],
    queryFn: () => getAbsencesByRange(startISO, endISO),
  });

  const totalShifts = schedules?.schedules?.length ?? 0;
  const filledShifts =
    schedules?.schedules?.filter((s) => !!s.employee_id).length ?? 0;
  const emptyShifts = totalShifts - filledShifts;
  const activeEmployees = employees?.filter((e) => e.is_active).length ?? 0;
  const inactiveEmployees = (employees?.length ?? 0) - activeEmployees;
  const coverageRate = totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0;

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader
        title="Übersicht"
        description={`Aktuelle Woche: ${label}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/calendar">
                <Calendar className="mr-2 h-4 w-4" />
                Kalender öffnen
              </Link>
            </Button>
            <Button asChild>
              <Link to="/">
                <CalendarCheck className="mr-2 h-4 w-4" />
                Zum Schichtplan
              </Link>
            </Button>
          </div>
        }
      />

      {/* Main Statistics */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mitarbeiter</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{employees?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Gesamtanzahl</p>
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1 text-green-600">
                <UserCheck className="h-3 w-3" />
                <span>{activeEmployees} Aktiv</span>
              </div>
              {inactiveEmployees > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <UserX className="h-3 w-3" />
                  <span>{inactiveEmployees} Inaktiv</span>
                </div>
              )}
            </div>
            <Separator className="my-3" />
            <Button asChild variant="link" className="px-0 text-sm h-auto">
              <Link to="/employees" className="inline-flex items-center">
                Verwalten <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Schichten (diese Woche)
            </CardTitle>
            <CalendarDays className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {filledShifts}/{totalShifts}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Besetzt / Gesamt
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1 text-green-600">
                <CalendarCheck className="h-3 w-3" />
                <span>{filledShifts} Besetzt</span>
              </div>
              {emptyShifts > 0 && (
                <div className="flex items-center gap-1 text-amber-600">
                  <CalendarClock className="h-3 w-3" />
                  <span>{emptyShifts} Offen</span>
                </div>
              )}
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Abdeckung</span>
                <span className="font-medium">{coverageRate}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${coverageRate}%` }}
                />
              </div>
            </div>
            <Separator className="my-3" />
            <Button asChild variant="link" className="px-0 text-sm h-auto">
              <Link to="/" className="inline-flex items-center">
                Zum Schichtplan <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Abwesenheiten (diese Woche)
            </CardTitle>
            <CalendarX2 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{absences?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Urlaub/Krankheit u.a.
            </p>
            <div className="mt-3 space-y-1">
              {absences && absences.length > 0 ? (
                <div className="text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {absences.length} {absences.length === 1 ? 'Abwesenheit' : 'Abwesenheiten'} geplant
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  Keine Abwesenheiten in dieser Woche
                </div>
              )}
            </div>
            <Separator className="my-3" />
            <Button asChild variant="link" className="px-0 text-sm h-auto">
              <Link to="/absences" className="inline-flex items-center">
                Abwesenheiten <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Section */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <CardTitle>Schnellzugriff</CardTitle>
            </div>
            <CardDescription>
              Häufig verwendete Funktionen und Einstellungen
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/versions">
                <GitBranch className="mr-2 h-4 w-4" />
                Versionen
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/shifts">
                <Clock className="mr-2 h-4 w-4" />
                Schichtvorlagen
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/coverage">
                <CalendarClock className="mr-2 h-4 w-4" />
                Coverage
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Einstellungen
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Weitere Aktionen</CardTitle>
            </div>
            <CardDescription>
              Zusätzliche Tools und Verwaltungsfunktionen
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/vacation">
                <CalendarDays className="mr-2 h-4 w-4" />
                Urlaubsplanung
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/formulars">
                <FileText className="mr-2 h-4 w-4" />
                Formulare
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/calendar">
                <Calendar className="mr-2 h-4 w-4" />
                Kalenderansicht
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/ai">
                <TrendingUp className="mr-2 h-4 w-4" />
                AI Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
