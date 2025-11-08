import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { getAbsencesByRange, getEmployees, getSettings, updateAbsence } from "@/services/api";
import { Absence } from "@/types";
import { getWeekStartsOn } from "@/utils/weekStart";
import { safeParseDate, safeDateOperation } from "@/utils/errorUtils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInDays, endOfWeek, format, startOfWeek } from "date-fns";
import { Calendar, CalendarOff, Check, CheckCircle, LayoutGrid, Table as TableIcon, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DateRange } from "react-day-picker";

export default function AbsencesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<Partial<Absence>>({});

  // Week boundaries per settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 300_000,
  });
  const weekStartsOn = getWeekStartsOn(settings);

  // Determine the date range to use
  const { startISO, endISO, label } = useMemo(() => {
    const now = new Date();
    let from, to;

    if (customDateRange?.from && customDateRange?.to) {
      from = customDateRange.from;
      to = customDateRange.to;
    } else {
      from = startOfWeek(now, { weekStartsOn });
      to = endOfWeek(now, { weekStartsOn });
    }

    return {
      startISO: format(from, "yyyy-MM-dd"),
      endISO: format(to, "yyyy-MM-dd"),
      label: `${format(from, "dd.MM")} - ${format(to, "dd.MM.yyyy")}`,
    };
  }, [weekStartsOn, customDateRange]);

  const handleCurrentWeek = () => {
    setCustomDateRange(undefined);
  };

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

  // Calculate statistics
  const totalDays = useMemo(() => {
    return absences.reduce((sum, absence) => {
      try {
        const startDate = safeParseDate(absence.start_date);
        const endDate = safeParseDate(absence.end_date);
        const days = differenceInDays(endDate, startDate) + 1;
        return sum + (days > 0 ? days : 0);
      } catch (error) {
        console.error("Error calculating days for absence:", absence.id, error);
        return sum;
      }
    }, 0);
  }, [absences]);

  const affectedEmployees = useMemo(() => {
    const uniqueEmployeeIds = new Set(absences.map(a => a.employee_id));
    return uniqueEmployeeIds.size;
  }, [absences]);

  const updateAbsenceMutation = useMutation({
    mutationFn: (data: { id: number; updates: Partial<Absence> }) =>
      updateAbsence(data.id, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      toast({ title: "Abwesenheit aktualisiert" });
      setEditingId(null);
      setEditingData({});
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (absence: Absence) => {
    setEditingId(absence.id);
    setEditingData({ ...absence });
  };

  const handleSave = (id: number) => {
    updateAbsenceMutation.mutate({ id, updates: editingData });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingData({});
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Abwesenheiten"
        description={`Zeitraum: ${label}`}
      />

      {/* Date Range Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zeitraum wählen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Von</label>
              <Input
                type="date"
                value={
                  customDateRange?.from
                    ? format(customDateRange.from, "yyyy-MM-dd")
                    : format(startOfWeek(new Date(), { weekStartsOn }), "yyyy-MM-dd")
                }
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  setCustomDateRange({
                    from: newDate,
                    to: customDateRange?.to || newDate,
                  });
                }}
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Bis</label>
              <Input
                type="date"
                value={
                  customDateRange?.to
                    ? format(customDateRange.to, "yyyy-MM-dd")
                    : format(endOfWeek(new Date(), { weekStartsOn }), "yyyy-MM-dd")
                }
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  setCustomDateRange({
                    from: customDateRange?.from || new Date(),
                    to: newDate,
                  });
                }}
              />
            </div>
            <Button variant="outline" onClick={handleCurrentWeek}>
              Aktuelle Woche
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abwesenheiten</CardTitle>
            <CalendarOff className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{absences.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              in dieser Woche
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Betroffene Mitarbeiter</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{affectedEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">
              mit Abwesenheiten
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamttage</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDays}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tage Abwesenheit
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="table" className="w-full">
        <TabsList>
          <TabsTrigger value="table">
            <TableIcon className="h-4 w-4 mr-2" />
            Tabelle
          </TabsTrigger>
          <TabsTrigger value="cards">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Karten
          </TabsTrigger>
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
                    <TableHead className="w-24">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absences.map((a) => (
                    <TableRow key={a.id} className={editingId === a.id ? "bg-muted/50" : ""}>
                      <TableCell>
                        {(() => {
                          const emp = employeeMap.get(a.employee_id);
                          return emp
                            ? `${emp.first_name} ${emp.last_name}`
                            : `#${a.employee_id}`;
                        })()}
                      </TableCell>
                      <TableCell>
                        {editingId === a.id ? (
                          <Select
                            value={editingData.absence_type_id || a.absence_type_id}
                            onValueChange={(value) =>
                              setEditingData({
                                ...editingData,
                                absence_type_id: value,
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from(absenceTypeMap.values()).map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline">
                            {(() => {
                              const type = absenceTypeMap.get(a.absence_type_id);
                              return type ? type.name : a.absence_type_id;
                            })()}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === a.id ? (
                          <div className="space-y-2">
                            <Input
                              type="date"
                              value={safeDateOperation(
                                () => {
                                  const date = editingData.start_date
                                    ? safeParseDate(editingData.start_date)
                                    : safeParseDate(a.start_date);
                                  return format(date, "yyyy-MM-dd");
                                },
                                "",
                                "Error formatting start date in edit mode"
                              )}
                              onChange={(e) =>
                                setEditingData({
                                  ...editingData,
                                  start_date: e.target.value,
                                })
                              }
                            />
                            <Input
                              type="date"
                              value={safeDateOperation(
                                () => {
                                  const date = editingData.end_date
                                    ? safeParseDate(editingData.end_date)
                                    : safeParseDate(a.end_date);
                                  return format(date, "yyyy-MM-dd");
                                },
                                "",
                                "Error formatting end date in edit mode"
                              )}
                              onChange={(e) =>
                                setEditingData({
                                  ...editingData,
                                  end_date: e.target.value,
                                })
                              }
                            />
                          </div>
                        ) : (
                          <>
                            {safeDateOperation(
                              () => format(safeParseDate(a.start_date), "dd.MM.yyyy"),
                              "Invalid date",
                              "Error formatting start date"
                            )}{" "}
                            –{" "}
                            {safeDateOperation(
                              () => format(safeParseDate(a.end_date), "dd.MM.yyyy"),
                              "Invalid date",
                              "Error formatting end date"
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === a.id ? (
                          <Input
                            value={editingData.note || a.note || ""}
                            onChange={(e) =>
                              setEditingData({
                                ...editingData,
                                note: e.target.value,
                              })
                            }
                            className="text-muted-foreground"
                            placeholder="Notiz..."
                          />
                        ) : (
                          <span className="text-muted-foreground">
                            {a.note || "–"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === a.id ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSave(a.id)}
                              disabled={updateAbsenceMutation.isPending}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancel}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(a)}
                          >
                            Bearbeiten
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {absences.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-12"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle className="h-12 w-12 text-green-600/50" />
                          <p className="text-muted-foreground font-medium">
                            Keine Abwesenheiten im Zeitraum
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Alle Mitarbeiter sind verfügbar
                          </p>
                        </div>
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
              const isEditing = editingId === a.id;

              return (
                <Card key={a.id} className={isEditing ? "ring-2 ring-primary" : ""}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {emp
                        ? `${emp.first_name} ${emp.last_name}`
                        : `#${a.employee_id}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Typ:{" "}
                      </span>
                      {isEditing ? (
                        <Select
                          value={editingData.absence_type_id || a.absence_type_id}
                          onValueChange={(value) =>
                            setEditingData({
                              ...editingData,
                              absence_type_id: value,
                            })
                          }
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from(absenceTypeMap.values()).map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">
                          {(() => {
                            const type = absenceTypeMap.get(a.absence_type_id);
                            return type ? type.name : a.absence_type_id;
                          })()}
                        </Badge>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Von</label>
                        <Input
                          type="date"
                          value={safeDateOperation(
                            () => {
                              const date = editingData.start_date
                                ? safeParseDate(editingData.start_date)
                                : safeParseDate(a.start_date);
                              return format(date, "yyyy-MM-dd");
                            },
                            "",
                            "Error formatting start date in card edit mode"
                          )}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              start_date: e.target.value,
                            })
                          }
                        />
                        <label className="text-sm font-medium">Bis</label>
                        <Input
                          type="date"
                          value={safeDateOperation(
                            () => {
                              const date = editingData.end_date
                                ? safeParseDate(editingData.end_date)
                                : safeParseDate(a.end_date);
                              return format(date, "yyyy-MM-dd");
                            },
                            "",
                            "Error formatting end date in card edit mode"
                          )}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              end_date: e.target.value,
                            })
                          }
                        />
                        <label className="text-sm font-medium">Notiz</label>
                        <Input
                          value={editingData.note || a.note || ""}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              note: e.target.value,
                            })
                          }
                          placeholder="Notiz..."
                        />
                      </div>
                    ) : (
                      <>
                        <div className="text-sm">
                          <span className="font-medium">Von–Bis: </span>
                          {safeDateOperation(
                            () => format(safeParseDate(a.start_date), "dd.MM.yyyy"),
                            "Invalid date",
                            "Error formatting start date in card view"
                          )}{" "}
                          –{" "}
                          {safeDateOperation(
                            () => format(safeParseDate(a.end_date), "dd.MM.yyyy"),
                            "Invalid date",
                            "Error formatting end date in card view"
                          )}
                        </div>
                        {a.note && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Notiz: </span>
                            {a.note}
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex gap-2 pt-4">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleSave(a.id)}
                            disabled={updateAbsenceMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Speichern
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={handleCancel}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Abbrechen
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => handleEdit(a)}
                        >
                          Bearbeiten
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {absences.length === 0 && (
              <div className="col-span-full">
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle className="h-12 w-12 text-green-600/50" />
                      <p className="text-muted-foreground font-medium">
                        Keine Abwesenheiten im Zeitraum
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Alle Mitarbeiter sind verfügbar
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
