import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Calendar from "@/components/calendar/calendar";
import type { CalendarEvent, Mode } from "@/components/calendar/calendar-types";
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
import { useToast } from "@/components/ui/use-toast";
import {
  createAbsence,
  deleteAbsence,
  getAbsencesByRange,
  getEmployees,
  getSettings,
} from "@/services/api";
import { Absence, Employee, Settings } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  differenceInDays,
  endOfMonth,
  format,
  startOfMonth,
  addMonths,
  subMonths,
} from "date-fns";
import {
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { VacationAbsenceModal } from "@/components/VacationAbsenceModal";

export default function VacationPlanningPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<Mode>("month");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);

  // Date range for fetching absences - expanded to cover more than just current month
  const dateRange = useMemo(() => {
    const start = startOfMonth(subMonths(currentDate, 1));
    const end = endOfMonth(addMonths(currentDate, 1));
    return { start, end };
  }, [currentDate]);

  // Fetch settings
  const { data: settings } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 300_000,
  });

  // Fetch employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.is_active),
    [employees],
  );

  // Fetch absences
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

  // Employee map for quick lookup
  const employeeMap = useMemo(() => {
    return new Map(employees.map((e) => [e.id, e]));
  }, [employees]);

  // Get absence type info
  const getAbsenceTypeInfo = (typeId: string) => {
    if (!settings?.employee_groups?.absence_types) return { name: typeId, color: "#808080" };
    const type = settings.employee_groups.absence_types.find(
      (t) => t.id === typeId,
    );
    return type ? { name: type.name, color: type.color } : { name: typeId, color: "#808080" };
  };

  // Convert absences to calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return filteredAbsences.map((absence) => {
      const employee = employeeMap.get(absence.employee_id);
      const typeInfo = getAbsenceTypeInfo(absence.absence_type_id);
      const employeeName = employee
        ? `${employee.first_name} ${employee.last_name}`
        : `Employee #${absence.employee_id}`;

      return {
        id: absence.id.toString(),
        title: `${employeeName} - ${typeInfo.name}`,
        color: typeInfo.color,
        start: new Date(absence.start_date),
        end: new Date(absence.end_date),
      };
    });
  }, [filteredAbsences, employeeMap, settings]);

  // Handler for calendar events changes (not directly editable in this view)
  const handleEventsChange = (events: CalendarEvent[]) => {
    // This is called when events are modified through the calendar
    // For now, we'll handle create/delete through our modals
    console.log("Calendar events changed:", events);
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

      {/* Calendar View */}
      <Card>
        <CardContent className="pt-6">
          <Calendar
            events={calendarEvents}
            setEvents={handleEventsChange}
            mode={calendarMode}
            setMode={setCalendarMode}
            date={currentDate}
            setDate={setCurrentDate}
            calendarIconIsToday={true}
          />
        </CardContent>
      </Card>

      {/* List View */}
      <Card>
        <CardHeader>
          <CardTitle>Abwesenheiten Liste</CardTitle>
        </CardHeader>
        <CardContent>
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
                  const typeInfo = getAbsenceTypeInfo(absence.absence_type_id);
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
                        <Badge 
                          variant="outline"
                          style={{ 
                            borderColor: typeInfo.color,
                            color: typeInfo.color
                          }}
                        >
                          {typeInfo.name}
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
