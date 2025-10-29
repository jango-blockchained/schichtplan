import { BulkVacationInputModal } from "@/components/BulkVacationInputModal";
import Calendar from "@/components/calendar/calendar";
import type { CalendarEvent, Mode } from "@/components/calendar/calendar-types";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { VacationAbsenceModal } from "@/components/VacationAbsenceModal";
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
  addMonths,
  differenceInDays,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  ArrowUpDown,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Trash2,
  Users,
  UserCheck,
  Info,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

export default function VacationPlanningPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<Mode>("month");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [absenceTypeFilter, setAbsenceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [groupByEmployee, setGroupByEmployee] = useState(false);
  const [sortField, setSortField] = useState<SortField>("start_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  type SortField = "employee" | "type" | "status" | "start_date" | "end_date" | "days";
  type SortDirection = "asc" | "desc";

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
    return absences.filter((absence) => absence.employee_id === selectedEmployeeId);
  }, [absences, selectedEmployeeId]);

  // Employee map for quick lookup
  const employeeMap = useMemo(() => {
    return new Map(employees.map((e) => [e.id, e]));
  }, [employees]);

  // Extract absence types from settings
  const absenceTypesArray = useMemo(() => {
    if (!settings?.employee_groups?.absence_types) return [];
    return settings.employee_groups.absence_types
      .filter((type): type is import("@/types").AbsenceType =>
        type.type === "absence_type" || type.type === "absence"
      );
  }, [settings]);

  const getAbsenceTypeInfo = useCallback(
    (typeId: string) => {
      if (!absenceTypesArray.length) return { name: typeId, color: "#808080" };
      const type = absenceTypesArray.find((t) => t.id === typeId);
      return type ? { name: type.name, color: type.color } : { name: typeId, color: "#808080" };
    },
    [absenceTypesArray],
  );

  const getEmployeeDisplayName = useCallback(
    (employeeId: number) => {
      const employee = employeeMap.get(employeeId);
      return employee
        ? `${employee.first_name} ${employee.last_name}`
        : `#${employeeId}`;
    },
    [employeeMap],
  );

  const getStatusInfo = useCallback((status: string) => {
    switch (status) {
      case "approved":
        return { label: "Genehmigt", className: "bg-emerald-100 text-emerald-700" };
      case "declined":
        return { label: "Abgelehnt", className: "bg-destructive/10 text-destructive" };
      default:
        return { label: "Beantragt", className: "bg-amber-100 text-amber-800" };
    }
  }, []);

  // Convert absences to calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return filteredAbsences.map((absence) => {
      const employee = employeeMap.get(absence.employee_id);
      // Get absence type info inline
      const type = absenceTypesArray.find((t) => t.id === absence.absence_type_id);
      const typeInfo = type ? { name: type.name, color: type.color } : { name: absence.absence_type_id, color: "#808080" };
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
  }, [filteredAbsences, employeeMap, absenceTypesArray]);

  // Get absence type info for table display

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

  const bulkCreateAbsenceMutation = useMutation({
    mutationFn: async (absences: Array<{
      employee_id: number;
      absence_type_id: string;
      start_date: string;
      end_date: string;
    }>) => {
      // Create all absences concurrently
      return Promise.all(
        absences.map((absence) =>
          createAbsence({
            ...absence,
            note: "",
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      toast({ title: `Abwesenheiten erfolgreich erstellt` });
      setShowBulkModal(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const processedAbsences = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return filteredAbsences
      .filter((absence) => {
        if (absenceTypeFilter !== "all" && absence.absence_type_id !== absenceTypeFilter) {
          return false;
        }

        if (statusFilter !== "all" && absence.status !== statusFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const employeeName = getEmployeeDisplayName(absence.employee_id).toLowerCase();
        const typeName = getAbsenceTypeInfo(absence.absence_type_id).name.toLowerCase();
        const note = absence.note?.toLowerCase() ?? "";

        return (
          employeeName.includes(normalizedSearch) ||
          typeName.includes(normalizedSearch) ||
          note.includes(normalizedSearch)
        );
      })
      .sort((a, b) => {
        const multiplier = sortDirection === "asc" ? 1 : -1;

        const getDays = (absence: Absence) =>
          differenceInDays(new Date(absence.end_date), new Date(absence.start_date)) + 1;

        let comparison = 0;

        switch (sortField) {
          case "employee":
            comparison = getEmployeeDisplayName(a.employee_id).localeCompare(
              getEmployeeDisplayName(b.employee_id),
              undefined,
              { sensitivity: "base" },
            );
            break;
          case "type":
            comparison = getAbsenceTypeInfo(a.absence_type_id).name.localeCompare(
              getAbsenceTypeInfo(b.absence_type_id).name,
              undefined,
              { sensitivity: "base" },
            );
            break;
          case "status":
            comparison = getStatusInfo(a.status).label.localeCompare(
              getStatusInfo(b.status).label,
              undefined,
              { sensitivity: "base" },
            );
            break;
          case "start_date":
            comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
            break;
          case "end_date":
            comparison = new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
            break;
          case "days":
            comparison = getDays(a) - getDays(b);
            break;
        }

        if (comparison !== 0) {
          return comparison * multiplier;
        }

        // Secondary sort to stabilize ordering
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      });
  }, [
    filteredAbsences,
    absenceTypeFilter,
    searchTerm,
    statusFilter,
    sortDirection,
    sortField,
    getAbsenceTypeInfo,
    getEmployeeDisplayName,
    getStatusInfo,
  ]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(processedAbsences.length / pageSize));
  }, [processedAbsences.length, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [absenceTypeFilter, statusFilter, searchTerm, selectedEmployeeId, pageSize, sortField, sortDirection]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedAbsences = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedAbsences.slice(startIndex, startIndex + pageSize);
  }, [processedAbsences, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    setCurrentPage(1);
    setSortDirection((prev) => (sortField === field ? (prev === "asc" ? "desc" : "asc") : "asc"));
    setSortField(field);
  };

  const renderSortableHeader = (label: string, field: SortField) => {
    const isActive = sortField === field;
    const direction = isActive ? sortDirection : undefined;

    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-auto px-2 font-semibold"
        onClick={() => handleSort(field)}
      >
        {label}
        <ArrowUpDown
          className={`ml-2 h-4 w-4 ${direction === "desc" ? "rotate-180 transition-transform" : ""
            } ${isActive ? "text-primary" : "text-muted-foreground"}`}
        />
      </Button>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Urlaubsplanung"
        description="Verwalten Sie Urlaubsanträge und Abwesenheiten"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Bulk Input
            </Button>
            <Button onClick={() => setShowAbsenceModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neue Abwesenheit
            </Button>
          </div>
        }
      />

      {/* Summary Statistics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktive Mitarbeiter</CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEmployees.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              verfügbar für Urlaubsplanung
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abwesenheiten</CardTitle>
            <CalendarDays className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredAbsences.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedEmployeeId ? "für ausgewählten Mitarbeiter" : "im angezeigten Zeitraum"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamttage</CardTitle>
            <CalendarOff className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredAbsences.reduce((sum, absence) => {
                // Add 1 to include both start and end dates (inclusive date range)
                const days = differenceInDays(
                  new Date(absence.end_date),
                  new Date(absence.start_date)
                ) + 1;
                return sum + days;
              }, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tage Abwesenheit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Select
                value={selectedEmployeeId?.toString() || "all"}
                onValueChange={(value) =>
                  setSelectedEmployeeId(value === "all" ? null : Number(value))
                }
              >
                <SelectTrigger className="w-full sm:w-[300px]">
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
            {selectedEmployeeId && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                Gefiltert
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Additional Filters Card */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="absence-type-filter" className="text-sm text-muted-foreground">
                Typ
              </Label>
              <Select
                value={absenceTypeFilter}
                onValueChange={setAbsenceTypeFilter}
              >
                <SelectTrigger id="absence-type-filter" className="w-[180px]">
                  <SelectValue placeholder="Alle Typen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Typen</SelectItem>
                  {absenceTypesArray.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-1 min-w-[200px] max-w-[300px] items-center gap-2">
              <Input
                placeholder="Suchen (Name, Typ, Notiz)"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="group-toggle" className="text-sm text-muted-foreground">
                Nach Mitarbeiter gruppieren
              </Label>
              <Switch
                id="group-toggle"
                checked={groupByEmployee}
                onCheckedChange={setGroupByEmployee}
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="status-filter" className="text-sm text-muted-foreground">
                Status
              </Label>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger id="status-filter" className="w-[180px]">
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="requested">Beantragt</SelectItem>
                  <SelectItem value="approved">Genehmigt</SelectItem>
                  <SelectItem value="declined">Abgelehnt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="page-size" className="text-sm text-muted-foreground">
                Einträge pro Seite
              </Label>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => setPageSize(Number(value))}
              >
                <SelectTrigger id="page-size" className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                <TableHead>{renderSortableHeader("Mitarbeiter", "employee")}</TableHead>
                <TableHead>{renderSortableHeader("Typ", "type")}</TableHead>
                <TableHead>{renderSortableHeader("Status", "status")}</TableHead>
                <TableHead>{renderSortableHeader("Von", "start_date")}</TableHead>
                <TableHead>{renderSortableHeader("Bis", "end_date")}</TableHead>
                <TableHead>{renderSortableHeader("Tage", "days")}</TableHead>
                <TableHead>Notiz</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAbsences.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Keine Abwesenheiten im ausgewählten Zeitraum
                  </TableCell>
                </TableRow>
              ) : (
                (() => {
                  let lastEmployeeId: number | null = null;

                  return paginatedAbsences.map((absence) => {
                    const typeInfo = getAbsenceTypeInfo(absence.absence_type_id);
                    const days =
                      differenceInDays(
                        new Date(absence.end_date),
                        new Date(absence.start_date),
                      ) + 1;
                    const employeeName = getEmployeeDisplayName(absence.employee_id);
                    const showGroupHeader = groupByEmployee && absence.employee_id !== lastEmployeeId;
                    lastEmployeeId = absence.employee_id;

                    return (
                      <Fragment key={absence.id}>
                        {showGroupHeader && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={7} className="font-medium">
                              {employeeName}
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell>{employeeName}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: typeInfo.color,
                                color: typeInfo.color,
                              }}
                            >
                              {typeInfo.name}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const statusInfo = getStatusInfo(absence.status);
                              return (
                                <Badge className={statusInfo.className} variant="secondary">
                                  {statusInfo.label}
                                </Badge>
                              );
                            })()}
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
                      </Fragment>
                    );
                  });
                })()
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Zeige {paginatedAbsences.length} von {processedAbsences.length} Abwesenheiten
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Seite {currentPage} von {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Absence Modal */}
      <VacationAbsenceModal
        open={showAbsenceModal}
        onOpenChange={setShowAbsenceModal}
        employees={activeEmployees}
        absenceTypes={absenceTypesArray}
        onSubmit={(data) => createAbsenceMutation.mutate(data)}
        isLoading={createAbsenceMutation.isPending}
      />

      {/* Bulk Vacation Input Modal */}
      <BulkVacationInputModal
        open={showBulkModal}
        onOpenChange={setShowBulkModal}
        employees={activeEmployees}
        absenceTypes={absenceTypesArray}
        onSubmit={(absences) => bulkCreateAbsenceMutation.mutate(absences)}
        isLoading={bulkCreateAbsenceMutation.isPending}
      />
    </div>
  );
}
