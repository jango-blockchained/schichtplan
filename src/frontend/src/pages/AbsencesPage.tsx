import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAbsencesByRange, getEmployees, getSettings } from "@/services/api";
import { getWeekStartsOn } from "@/utils/weekStart";
import { useQuery } from "@tanstack/react-query";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { useMemo } from "react";

export default function AbsencesPage() {
  // Week boundaries per settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 300_000,
  });
  const weekStartsOn = getWeekStartsOn(settings);

  const { startISO, endISO, label } = useMemo(() => {
    const now = new Date();
    const from = startOfWeek(now, { weekStartsOn });
    const to = endOfWeek(now, { weekStartsOn });
    return {
      startISO: format(from, "yyyy-MM-dd"),
      endISO: format(to, "yyyy-MM-dd"),
      label: `${format(from, "dd.MM")} - ${format(to, "dd.MM.yyyy")}`,
    };
  }, [weekStartsOn]);

  const { data: absences = [] } = useQuery({
    queryKey: ["absences", startISO, endISO],
    queryFn: () => getAbsencesByRange(startISO, endISO),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });
  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  const absenceTypeMap = useMemo(() => {
    if (!settings?.employee_groups?.absence_types) return new Map();
    return new Map(
      settings.employee_groups.absence_types.map((type) => [type.id, type]),
    );
  }, [settings?.employee_groups?.absence_types]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Abwesenheiten"
        description={`Aktuelle Woche: ${label}`}
      />

      <Tabs defaultValue="table" className="w-full">
        <TabsList>
          <TabsTrigger value="table">Tabelle</TabsTrigger>
          <TabsTrigger value="cards">Karten</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Zeitraum</TableHead>
                    <TableHead>Notiz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absences.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {(() => {
                          const emp = employeeMap.get(a.employee_id);
                          return emp
                            ? `${emp.first_name} ${emp.last_name}`
                            : `#${a.employee_id}`;
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(() => {
                            const type = absenceTypeMap.get(a.absence_type_id);
                            return type ? type.name : a.absence_type_id;
                          })()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(a.start_date), "dd.MM.yyyy")} –{" "}
                        {format(new Date(a.end_date), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.note || "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {absences.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        Keine Abwesenheiten in dieser Woche.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards" className="mt-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {absences.map((a) => {
              const emp = employeeMap.get(a.employee_id);
              return (
                <Card key={a.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {emp
                        ? `${emp.first_name} ${emp.last_name}`
                        : `#${a.employee_id}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Typ:{" "}
                      </span>
                      <Badge variant="secondary">
                        {(() => {
                          const type = absenceTypeMap.get(a.absence_type_id);
                          return type ? type.name : a.absence_type_id;
                        })()}
                      </Badge>
                    </div>
                    <div className="text-sm">
                      {format(new Date(a.start_date), "dd.MM.yyyy")} –{" "}
                      {format(new Date(a.end_date), "dd.MM.yyyy")}
                    </div>
                    {a.note && (
                      <div className="text-sm text-muted-foreground">
                        {a.note}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {absences.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Keine Abwesenheiten in dieser Woche.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
