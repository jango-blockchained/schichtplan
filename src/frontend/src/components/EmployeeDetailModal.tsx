import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAbsences, getSchedules, getSettings } from "@/services/api";
import { Absence, Employee, Settings } from "@/types";
import { safeParseDate, safeDateOperation } from "@/utils/errorUtils";
import { useQuery } from "@tanstack/react-query";
import {
  differenceInDays,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import {
  Briefcase,
  Calendar,
  CalendarDays,
  Clock,
  Mail,
  Phone,
  User,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

interface EmployeeDetailModalProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeDetailModal({
  employee,
  open,
  onOpenChange,
}: EmployeeDetailModalProps) {
  const [dateRange] = useState(() => {
    const now = new Date();
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
    };
  });

  // Fetch settings for date formatting
  const { data: settings } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
    enabled: open && !!employee,
  });

  // Fetch employee absences
  const { data: absences = [] } = useQuery<Absence[]>({
    queryKey: ["absences", employee?.id],
    queryFn: () => getAbsences(employee!.id),
    enabled: open && !!employee,
  });

  // Fetch employee schedules for the current month
  const { data: scheduleResponse } = useQuery({
    queryKey: [
      "schedules",
      format(dateRange.start, "yyyy-MM-dd"),
      format(dateRange.end, "yyyy-MM-dd"),
      employee?.id,
    ],
    queryFn: () =>
      getSchedules(
        format(dateRange.start, "yyyy-MM-dd"),
        format(dateRange.end, "yyyy-MM-dd"),
        undefined,
        true,
      ),
    enabled: open && !!employee,
  });

  // Filter schedules for this employee
  const employeeSchedules = useMemo(() => {
    if (!scheduleResponse?.schedules || !employee) return [];
    return scheduleResponse.schedules.filter(
      (s) => s.employee_id === employee.id,
    );
  }, [scheduleResponse, employee]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!employee || !absences || !employeeSchedules) {
      return {
        totalAbsenceDays: 0,
        upcomingAbsences: 0,
        totalScheduledShifts: 0,
        totalScheduledHours: 0,
      };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Calculate total absence days
    const totalAbsenceDays = absences.reduce((total, absence) => {
      try {
        const start = safeParseDate(absence.start_date);
        const end = safeParseDate(absence.end_date);
        const days = differenceInDays(end, start) + 1;
        return total + (days > 0 ? days : 0);
      } catch (error) {
        console.error("Error calculating absence days:", absence.id, error);
        return total;
      }
    }, 0);

    // Count upcoming absences
    const upcomingAbsences = absences.filter(
      (a) => safeParseDate(a.start_date) >= now,
    ).length;

    // Count scheduled shifts
    const totalScheduledShifts = employeeSchedules.filter(
      (s) => s.shift_id,
    ).length;

    // Calculate total hours (if duration info is available)
    const totalScheduledHours = employeeSchedules.reduce((total, schedule) => {
      if (schedule.shift_start && schedule.shift_end) {
        const start = new Date(`2000-01-01T${schedule.shift_start}`);
        const end = new Date(`2000-01-01T${schedule.shift_end}`);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return total + hours;
      }
      return total;
    }, 0);

    return {
      totalAbsenceDays,
      upcomingAbsences,
      totalScheduledShifts,
      totalScheduledHours: Math.round(totalScheduledHours * 10) / 10,
    };
  }, [employee, absences, employeeSchedules]);

  // Get absence type name from settings
  const getAbsenceTypeName = (typeId: string) => {
    if (!settings?.employee_groups?.absence_types) return typeId;
    const type = settings.employee_groups.absence_types.find(
      (t) => t.id === typeId,
    );
    return type?.name || typeId;
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <User className="h-6 w-6" />
            {employee.first_name} {employee.last_name}
            {!employee.is_active && (
              <Badge variant="secondary">Inaktiv</Badge>
            )}
            {employee.is_keyholder && (
              <Badge variant="default">Schlüsselhalter</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="absences">Abwesenheiten</TabsTrigger>
            <TabsTrigger value="schedule">Dienstplan</TabsTrigger>
            <TabsTrigger value="statistics">Statistik</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Persönliche Daten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Geburtstag</p>
                      <p className="font-medium">
                        {employee.birthday
                          ? safeDateOperation(
                              () => format(safeParseDate(employee.birthday), "dd.MM.yyyy"),
                              "Invalid date",
                              "Error formatting employee birthday"
                            )
                          : "–"}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">E-Mail</p>
                      <p className="font-medium">{employee.email || "–"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefon</p>
                      <p className="font-medium">{employee.phone || "–"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vertragsdaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Gruppe</p>
                      <p className="font-medium">{employee.employee_group}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Vertragsstunden
                      </p>
                      <p className="font-medium">
                        {employee.contracted_hours}h/Woche
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge
                        variant={employee.is_active ? "default" : "secondary"}
                      >
                        {employee.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Urlaubstage p.a.
                      </p>
                      <p className="font-medium">
                        {employee.vacation_per_year}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Schnellübersicht</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center p-4 border rounded-lg">
                    <CalendarDays className="h-8 w-8 text-primary mb-2" />
                    <p className="text-2xl font-bold">
                      {statistics.totalAbsenceDays}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Abwesenheitstage (gesamt)
                    </p>
                  </div>
                  <div className="flex flex-col items-center p-4 border rounded-lg">
                    <Calendar className="h-8 w-8 text-primary mb-2" />
                    <p className="text-2xl font-bold">
                      {statistics.upcomingAbsences}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Anstehende Abwesenheiten
                    </p>
                  </div>
                  <div className="flex flex-col items-center p-4 border rounded-lg">
                    <Briefcase className="h-8 w-8 text-primary mb-2" />
                    <p className="text-2xl font-bold">
                      {statistics.totalScheduledShifts}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Geplante Schichten (Monat)
                    </p>
                  </div>
                  <div className="flex flex-col items-center p-4 border rounded-lg">
                    <Clock className="h-8 w-8 text-primary mb-2" />
                    <p className="text-2xl font-bold">
                      {statistics.totalScheduledHours}h
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Geplante Stunden (Monat)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Absences Tab */}
          <TabsContent value="absences">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Abwesenheiten</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {absences.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Keine Abwesenheiten erfasst
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Typ</TableHead>
                          <TableHead>Von</TableHead>
                          <TableHead>Bis</TableHead>
                          <TableHead>Tage</TableHead>
                          <TableHead>Notiz</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {absences.map((absence) => {
                          const days = safeDateOperation(
                            () => {
                              const start = safeParseDate(absence.start_date);
                              const end = safeParseDate(absence.end_date);
                              const diff = differenceInDays(end, start) + 1;
                              return diff > 0 ? diff : 0;
                            },
                            0,
                            "Error calculating absence days"
                          );
                          return (
                            <TableRow key={absence.id}>
                              <TableCell>
                                <Badge variant="outline">
                                  {getAbsenceTypeName(absence.absence_type_id)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {safeDateOperation(
                                  () => format(safeParseDate(absence.start_date), "dd.MM.yyyy"),
                                  "Invalid date",
                                  "Error formatting absence start date"
                                )}
                              </TableCell>
                              <TableCell>
                                {safeDateOperation(
                                  () => format(safeParseDate(absence.end_date), "dd.MM.yyyy"),
                                  "Invalid date",
                                  "Error formatting absence end date"
                                )}
                              </TableCell>
                              <TableCell>{days}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {absence.note || "–"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Dienstplan ({format(dateRange.start, "MMMM yyyy")})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {employeeSchedules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Keine Schichten geplant
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Schicht</TableHead>
                          <TableHead>Zeiten</TableHead>
                          <TableHead>Notizen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeSchedules
                          .filter((s) => s.shift_id)
                          .sort(
                            (a, b) =>
                              safeParseDate(a.date).getTime() -
                              safeParseDate(b.date).getTime(),
                          )
                          .map((schedule) => (
                            <TableRow key={schedule.id}>
                              <TableCell>
                                {safeDateOperation(
                                  () => format(safeParseDate(schedule.date), "dd.MM.yyyy"),
                                  "Invalid date",
                                  "Error formatting schedule date"
                                )}
                              </TableCell>
                              <TableCell>
                                {schedule.shift_type_id && (
                                  <Badge>{schedule.shift_type_id}</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {schedule.shift_start && schedule.shift_end
                                  ? `${schedule.shift_start.substring(0, 5)} - ${schedule.shift_end.substring(0, 5)}`
                                  : "–"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {schedule.notes || "–"}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Arbeitszeit (Aktueller Monat)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Geplante Schichten
                      </span>
                      <span className="font-bold text-lg">
                        {statistics.totalScheduledShifts}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Geplante Stunden
                      </span>
                      <span className="font-bold text-lg">
                        {statistics.totalScheduledHours}h
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Vertragsstunden (Woche)
                      </span>
                      <span className="font-bold text-lg">
                        {employee.contracted_hours}h
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Abwesenheiten</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Gesamte Abwesenheitstage
                      </span>
                      <span className="font-bold text-lg">
                        {statistics.totalAbsenceDays}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Anstehende Abwesenheiten
                      </span>
                      <span className="font-bold text-lg">
                        {statistics.upcomingAbsences}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
