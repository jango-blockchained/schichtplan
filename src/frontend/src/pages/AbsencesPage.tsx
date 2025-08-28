import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { getAbsencesByRange, getEmployees, getSettings } from "@/services/api";
import { getWeekStartsOn } from "@/utils/weekStart";
import { useMemo } from "react";

export default function AbsencesPage() {
  // Week boundaries per settings
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings, staleTime: 300_000 });
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

  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: getEmployees });
  const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

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
                  {absences.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {(() => {
                          const emp = employeeMap.get(a.employee_id);
                          return emp ? `${emp.first_name} ${emp.last_name}` : `#${a.employee_id}`;
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.absence_type_id}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(a.start_date), "dd.MM.yyyy")} – {format(new Date(a.end_date), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.note || "–"}</TableCell>
                    </TableRow>
                  ))}
                  {absences.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
            {absences.map(a => {
              const emp = employeeMap.get(a.employee_id);
              return (
                <Card key={a.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {emp ? `${emp.first_name} ${emp.last_name}` : `#${a.employee_id}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="text-sm text-muted-foreground">Typ: </span>
                      <Badge variant="secondary">{a.absence_type_id}</Badge>
                    </div>
                    <div className="text-sm">
                      {format(new Date(a.start_date), "dd.MM.yyyy")} – {format(new Date(a.end_date), "dd.MM.yyyy")}
                    </div>
                    {a.note && <div className="text-sm text-muted-foreground">{a.note}</div>}
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
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { format, endOfWeek, startOfWeek } from "date-fns";
import { getAbsencesByRange, getEmployees, getSettings } from "@/services/api";
import { Absence, Employee } from "@/types";
import { useMemo, useState } from "react";
import { getWeekStartsOn } from "@/utils/weekStart";

type ViewMode = "table" | "cards";

export default function AbsencesPage() {
  // Week range based on settings
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const weekStartsOn = getWeekStartsOn(settings);
  const [currentDate] = useState(new Date());
  const start = useMemo(() => startOfWeek(currentDate, { weekStartsOn }), [currentDate, weekStartsOn]);
  const end = useMemo(() => endOfWeek(currentDate, { weekStartsOn }), [currentDate, weekStartsOn]);
  const rangeLabel = `${format(start, "dd.MM")} - ${format(end, "dd.MM.yyyy")}`;

  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["employees"], queryFn: getEmployees });
  const { data: absences = [], isLoading } = useQuery<Absence[]>({
    queryKey: ["absences", format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: () => getAbsencesByRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")),
  });

  const [view, setView] = useState<ViewMode>("table");

  const empMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Abwesenheiten"
        description={`Aktuelle Woche: ${rangeLabel}`}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
        <TabsList>
          <TabsTrigger value="table">Tabelle</TabsTrigger>
          <TabsTrigger value="cards">Karten</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div>Lade...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2">Mitarbeiter</th>
                        <th className="py-2">Zeitraum</th>
                        <th className="py-2">Typ</th>
                        <th className="py-2">Notiz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absences.map((a) => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-2">
                            {empMap.get(a.employee_id)?.first_name} {empMap.get(a.employee_id)?.last_name}
                          </td>
                          <td className="py-2">
                            {format(new Date(a.start_date), "dd.MM.yyyy")} – {format(new Date(a.end_date), "dd.MM.yyyy")}
                          </td>
                          <td className="py-2">
                            <Badge variant="secondary">{a.absence_type_id}</Badge>
                          </td>
                          <td className="py-2">{a.note || ""}</td>
                        </tr>
                      ))}
                      {absences.length === 0 && (
                        <tr>
                          <td className="py-6 text-center text-muted-foreground" colSpan={4}>Keine Abwesenheiten im Zeitraum</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards" className="mt-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {absences.map((a) => (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {empMap.get(a.employee_id)?.first_name} {empMap.get(a.employee_id)?.last_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Zeitraum:</span>{" "}
                      {format(new Date(a.start_date), "dd.MM.yyyy")} – {format(new Date(a.end_date), "dd.MM.yyyy")}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Typ:</span>{" "}
                      <Badge variant="outline">{a.absence_type_id}</Badge>
                    </div>
                    {a.note && (
                      <div>
                        <span className="text-muted-foreground">Notiz:</span>{" "}{a.note}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {absences.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">Keine Abwesenheiten im Zeitraum</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-2">
        <Button asChild variant="secondary"><a href="/employees">Zu Mitarbeiterseite</a></Button>
      </div>
    </div>
  );
}
