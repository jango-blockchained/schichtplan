import { VacationAbsenceModal } from "@/components/VacationAbsenceModal";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  createAbsence,
  deleteAbsence,
  getAbsencesByRange,
  getEmployees,
  getSettings,
} from "@/services/api";
import { Absence, Employee, Settings } from "@/types";
import { getWeekStartsOn } from "@/utils/weekStart";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  differenceInDays,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
} from "date-fns";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

export default function VacationPlanningPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);

  // Date range for current month
  const dateRange = useMemo(() => {
    return {
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    };
  }, [currentDate]);

  // Fetch settings
  const { data: settings } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 300_000,
  });

  const weekStartsOn = getWeekStartsOn(settings);

  // Fetch employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.is_active),
    [employees],
  );

  // Fetch absences for the current month
  const { data: absences = [] } = useQuery<Absence[]>({
    queryKey: [
      "absences",
      format(dateRange.start, "yyyy-MM-dd"),
      format(dateRange.end, "yyyy-MM-dd"),
    ],
    queryFn: () =>
      getAbsencesByRange(
        format(dateRange.start, "yyyy-MM-dd"),
        format(dateRange.end, "yyyy-MM-dd"),
      ),
  });

  // Filter absences by selected employee
  const filteredAbsences = useMemo(() => {
    if (!selectedEmployeeId) return absences;
    return absences.filter((a) => a.employee_id === selectedEmployeeId);
  }, [absences, selectedEmployeeId]);

  // Group absences by date
  const absencesByDate = useMemo(() => {
    const grouped = new Map<string, Absence[]>();
    filteredAbsences.forEach((absence) => {
      let cursor = new Date(absence.start_date);
      const end = new Date(absence.end_date);
      cursor.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      while (cursor.getTime() <= end.getTime()) {
        const key = format(cursor, "yyyy-MM-dd");
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(absence);
        cursor = addDays(cursor, 1);
      }
    });
    return grouped;
  }, [filteredAbsences]);

  // Employee map for quick lookup
  const employeeMap = useMemo(() => {
    return new Map(employees.map((e) => [e.id, e]));
  }, [employees]);

  // Get absence type name
  const getAbsenceTypeName = (typeId: string) => {
    if (!settings?.employee_groups?.absence_types) return typeId;
    const type = settings.employee_groups.absence_types.find(
      (t) => t.id === typeId,
    );
    return type?.name || typeId;
  };

  // Mutations
  const createAbsenceMutation = useMutation({
    mutationFn: createAbsence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      toast({ title: "Abwesenheit erfolgreich erstellt" });
      setShowAbsenceModal(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const deleteAbsenceMutation = useMutation({
    mutationFn: deleteAbsence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      toast({ title: "Abwesenheit erfolgreich gelöscht" });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Löschen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  // Navigation handlers
  const navigatePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const navigateNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const navigateToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Urlaubsplanung"
        description="Verwalten Sie Urlaubsanträge und Abwesenheiten"
        actions={
          <Button onClick={() => setShowAbsenceModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Abwesenheit
          </Button>
        }
      />

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <Select
              value={selectedEmployeeId?.toString() || "all"}
              onValueChange={(value) =>
                setSelectedEmployeeId(value === "all" ? null : Number(value))
              }
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Alle Mitarbeiter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                {activeEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>
                    {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Kalender
          </TabsTrigger>
          <TabsTrigger value="list">Liste</TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{format(currentDate, "MMMM yyyy")}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={navigateToday}
                    >
                      Heute
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={navigatePreviousMonth}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={navigateNextMonth}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={currentDate}
                  onMonthChange={setCurrentDate}
                  className="w-full"
                  components={{
                    Day: ({ date }) => {
                      const formattedDate = format(date, "yyyy-MM-dd");
                      const dayAbsences = absencesByDate.get(formattedDate) || [];
                      const hasAbsences = dayAbsences.length > 0;

                      return (
                        <div className="relative h-full w-full flex flex-col items-center justify-center">
                          <span className="text-sm">{format(date, "d")}</span>
                          {hasAbsences && (
                            <div className="absolute bottom-0 w-full flex justify-center gap-0.5 px-1">
                              {dayAbsences.slice(0, 3).map((_, idx) => (
                                <div
                                  key={idx}
                                  className="w-1.5 h-1.5 rounded-full bg-amber-500"
                                />
                              ))}
                              {dayAbsences.length > 3 && (
                                <span className="text-[10px] text-amber-500">
                                  +{dayAbsences.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    },
                  }}
                />
              </CardContent>
            </Card>

            {/* Selected Date Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedDate
                    ? format(selectedDate, "dd. MMMM yyyy")
                    : "Datum auswählen"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDate ? (
                  <div className="space-y-3">
                    {(() => {
                      const formattedDate = format(selectedDate, "yyyy-MM-dd");
                      const dayAbsences = absencesByDate.get(formattedDate) || [];

                      if (dayAbsences.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Keine Abwesenheiten an diesem Tag
                          </p>
                        );
                      }

                      return dayAbsences.map((absence) => {
                        const employee = employeeMap.get(absence.employee_id);
                        return (
                          <div
                            key={absence.id}
                            className="p-3 border rounded-lg space-y-2"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">
                                  {employee
                                    ? `${employee.first_name} ${employee.last_name}`
                                    : `Mitarbeiter #${absence.employee_id}`}
                                </p>
                                <Badge variant="secondary" className="mt-1">
                                  {getAbsenceTypeName(absence.absence_type_id)}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  deleteAbsenceMutation.mutate(absence.id)
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(absence.start_date), "dd.MM.yyyy")} -{" "}
                              {format(new Date(absence.end_date), "dd.MM.yyyy")}
                            </div>
                            {absence.note && (
                              <p className="text-sm">{absence.note}</p>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Wählen Sie ein Datum im Kalender aus
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* List View */}
        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Von</TableHead>
                    <TableHead>Bis</TableHead>
                    <TableHead>Tage</TableHead>
                    <TableHead>Notiz</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAbsences.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        Keine Abwesenheiten im ausgewählten Zeitraum
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAbsences.map((absence) => {
                      const employee = employeeMap.get(absence.employee_id);
                      const days =
                        differenceInDays(
                          new Date(absence.end_date),
                          new Date(absence.start_date),
                        ) + 1;

                      return (
                        <TableRow key={absence.id}>
                          <TableCell>
                            {employee
                              ? `${employee.first_name} ${employee.last_name}`
                              : `#${absence.employee_id}`}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getAbsenceTypeName(absence.absence_type_id)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(absence.start_date), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell>
                            {format(new Date(absence.end_date), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell>{days}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {absence.note || "–"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteAbsenceMutation.mutate(absence.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Absence Modal */}
      <VacationAbsenceModal
        open={showAbsenceModal}
        onOpenChange={setShowAbsenceModal}
        employees={activeEmployees}
        absenceTypes={(settings?.employee_groups?.absence_types || []).filter(
          (type): type is import("@/types").AbsenceType => type.type === "absence_type"
        )}
        onSubmit={(data) => createAbsenceMutation.mutate(data)}
        isLoading={createAbsenceMutation.isPending}
      />
    </div>
  );
}
