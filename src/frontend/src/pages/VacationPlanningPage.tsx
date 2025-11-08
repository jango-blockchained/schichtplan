import { BulkVacationInputModal } from "@/components/BulkVacationInputModal";
import Calendar from "@/components/calendar/calendar";
import type { CalendarEvent, Mode } from "@/components/calendar/calendar-types";
import { MultistepVacationPlanningModal } from "@/components/MultistepVacationPlanningModal";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  updateAbsence,
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
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  Edit,
  Info,
  MoveHorizontal,
  Plus,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

// Helper function to parse ISO date string and treat it as local date (not UTC)
// This ensures "2025-01-15" is interpreted as 2025-01-15 00:00 in the user's local timezone
function parseLocalDate(dateString: string | undefined): Date {
  if (!dateString) {
    return new Date(); // Return current date if undefined
  }
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

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
  const [showMultistepModal, setShowMultistepModal] = useState(false);
  const [absenceTypeFilter, setAbsenceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [groupByEmployee, setGroupByEmployee] = useState(false);
  const [sortField, setSortField] = useState<SortField>("start_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<Partial<Absence>>({});
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);
  const [isListExpanded, setIsListExpanded] = useState(true);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingAbsence, setMovingAbsence] = useState<Absence | null>(null);
  const [moveData, setMoveData] = useState({ start_date: "", end_date: "" });
  const [selectedAbsenceIds, setSelectedAbsenceIds] = useState<Set<number>>(new Set());

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
        return {
          label: "Genehmigt",
          className: "bg-emerald-100 text-emerald-700",
          icon: <Check className="h-3 w-3" />
        };
      case "declined":
        return {
          label: "Abgelehnt",
          className: "bg-destructive/10 text-destructive",
          icon: <X className="h-3 w-3" />
        };
      default:
        return {
          label: "Beantragt",
          className: "bg-amber-100 text-amber-800",
          icon: <Clock className="h-3 w-3" />
        };
    }
  }, []);

  // Helper function to map hex colors to calendar-compatible color names
  const mapColorToCalendarColor = useCallback((hexColor: string): string => {
    const colorMap: Record<string, string> = {
      // Demo absence types
      '#FF9800': 'orange',   // Urlaub (vacation)
      '#F44336': 'red',      // Abwesend (absent)
      '#4CAF50': 'green',    // Schulung (training)

      // Common colors
      '#808080': 'blue',     // Default gray
      '#FF0000': 'red',      // Red
      '#00FF00': 'green',    // Green
      '#0000FF': 'blue',     // Blue
      '#FFFF00': 'yellow',   // Yellow
      '#FFA500': 'orange',   // Orange
      '#800080': 'purple',   // Purple
      '#FFC0CB': 'pink',     // Pink
      '#DC143C': 'red',      // Crimson
      '#228B22': 'green',    // Forest Green
      '#4169E1': 'indigo',   // Royal Blue
      '#FFD700': 'amber',    // Gold
      '#32CD32': 'emerald',  // Lime Green
    };

    // Normalize hex color to uppercase
    const normalizedHex = hexColor.toUpperCase();

    // Check exact match first
    if (colorMap[normalizedHex]) {
      return colorMap[normalizedHex];
    }

    // Default to blue if no match found
    return 'blue';
  }, []);

  // Convert absences to calendar events with enhanced metadata
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
        color: mapColorToCalendarColor(typeInfo.color),
        // Parse dates as local dates (not UTC) to avoid timezone issues
        start: parseLocalDate(absence.start_date),
        end: parseLocalDate(absence.end_date),
        // Add metadata for enhanced event component
        metadata: {
          absenceId: absence.id,
          employeeId: absence.employee_id,
          status: (absence.status || 'requested') as 'approved' | 'requested' | 'declined',
          note: absence.note,
        },
      };
    });
  }, [filteredAbsences, employeeMap, absenceTypesArray, mapColorToCalendarColor]);

  // Get absence type info for table display

  // Mutations (defined early for use in callbacks)
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

  const updateAbsenceMutation = useMutation({
    mutationFn: (data: { id: number; updates: Partial<Absence> }) =>
      updateAbsence(data.id, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      toast({ title: "Abwesenheit erfolgreich aktualisiert" });
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

  const bulkCreateAbsenceMutation = useMutation({
    mutationFn: async (absences: Array<{
      employee_id: number;
      absence_type_id: string;
      start_date: string;
      end_date: string;
      status?: string;
      note?: string;
    }>) => {
      // Create all absences concurrently
      return Promise.all(
        absences.map((absence) =>
          createAbsence({
            ...absence,
            status: absence.status || "requested",
            note: absence.note || "",
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

  // Handler for calendar event updates (drag & drop, resize)
  const handleEventUpdate = useCallback(
    (eventId: string, updates: { start: Date; end: Date }) => {
      const absenceId = Number(eventId);
      const absence = filteredAbsences.find((a) => a.id === absenceId);

      if (!absence) return;

      // Update backend
      updateAbsenceMutation.mutate({
        id: absenceId,
        updates: {
          start_date: format(updates.start, "yyyy-MM-dd"),
          end_date: format(updates.end, "yyyy-MM-dd"),
        },
      });
    },
    [filteredAbsences, updateAbsenceMutation]
  );

  // Handler for calendar event deletion
  const handleEventDelete = useCallback(
    (eventId: string) => {
      const absenceId = Number(eventId);
      deleteAbsenceMutation.mutate(absenceId);
    },
    [deleteAbsenceMutation]
  );

  // Handler for calendar events changes (for compatibility)
  const handleEventsChange = (events: CalendarEvent[]) => {
    // This is called when events are modified through the calendar
    // Updates are now handled through handleEventUpdate
    console.log("Calendar events changed:", events);
  };

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
          differenceInDays(parseLocalDate(absence.end_date), parseLocalDate(absence.start_date)) + 1;

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
            comparison = parseLocalDate(a.start_date).getTime() - parseLocalDate(b.start_date).getTime();
            break;
          case "end_date":
            comparison = parseLocalDate(a.end_date).getTime() - parseLocalDate(b.end_date).getTime();
            break;
          case "days":
            comparison = getDays(a) - getDays(b);
            break;
        }

        if (comparison !== 0) {
          return comparison * multiplier;
        }

        // Secondary sort to stabilize ordering
        return parseLocalDate(a.start_date).getTime() - parseLocalDate(b.start_date).getTime();
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

  const handleMove = (absence: Absence) => {
    setMovingAbsence(absence);
    setMoveData({
      start_date: absence.start_date,
      end_date: absence.end_date,
    });
    setShowMoveDialog(true);
  };

  const handleMoveSubmit = () => {
    if (!movingAbsence) return;

    updateAbsenceMutation.mutate({
      id: movingAbsence.id,
      updates: {
        start_date: moveData.start_date,
        end_date: moveData.end_date,
      },
    });
    setShowMoveDialog(false);
    setMovingAbsence(null);
  };

  // Checkbox handlers for bulk actions
  const handleToggleAbsence = (absenceId: number) => {
    const newSelected = new Set(selectedAbsenceIds);
    if (newSelected.has(absenceId)) {
      newSelected.delete(absenceId);
    } else {
      newSelected.add(absenceId);
    }
    setSelectedAbsenceIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAbsenceIds.size === paginatedAbsences.length) {
      setSelectedAbsenceIds(new Set());
    } else {
      const allIds = new Set(paginatedAbsences.map((a) => a.id));
      setSelectedAbsenceIds(allIds);
    }
  };

  const handleBulkDelete = () => {
    if (selectedAbsenceIds.size === 0) return;

    if (
      confirm(
        `${selectedAbsenceIds.size} Abwesenheit(en) löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      )
    ) {
      const count = selectedAbsenceIds.size;
      Promise.all(
        Array.from(selectedAbsenceIds).map((id) =>
          deleteAbsenceMutation.mutate(id),
        ),
      ).finally(() => {
        setSelectedAbsenceIds(new Set());
        toast({
          title: "Gelöscht",
          description: `${count} Abwesenheit(en) wurden gelöscht.`,
        });
      });
    }
  };

  const handleBulkApprove = () => {
    if (selectedAbsenceIds.size === 0) return;

    const count = selectedAbsenceIds.size;
    Promise.all(
      Array.from(selectedAbsenceIds).map((id) =>
        updateAbsenceMutation.mutate({
          id,
          updates: { status: "approved" },
        }),
      ),
    ).finally(() => {
      setSelectedAbsenceIds(new Set());
      toast({
        title: "Genehmigt",
        description: `${count} Abwesenheit(en) wurden genehmigt.`,
      });
    });
  };

  const handleBulkDecline = () => {
    if (selectedAbsenceIds.size === 0) return;

    const count = selectedAbsenceIds.size;
    Promise.all(
      Array.from(selectedAbsenceIds).map((id) =>
        updateAbsenceMutation.mutate({
          id,
          updates: { status: "declined" },
        }),
      ),
    ).finally(() => {
      setSelectedAbsenceIds(new Set());
      toast({
        title: "Abgelehnt",
        description: `${count} Abwesenheit(en) wurden abgelehnt.`,
      });
    });
  };

  // PDF Export Functions
  const handleExportPDF = (type: string) => {
    const currentYear = new Date().getFullYear();
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    let url = '';

    switch (type) {
      case 'admin-yearly':
        url = `${apiBaseUrl}/api/v2/vacation-pdf/admin-yearly?year=${currentYear}`;
        break;
      case 'overview':
        url = `${apiBaseUrl}/api/v2/vacation-pdf/overview?year=${currentYear}`;
        break;
      case 'yearly-calendar':
        url = `${apiBaseUrl}/api/v2/vacation-pdf/yearly-calendar?year=${currentYear}`;
        break;
      case 'yearly-calendar-grid':
        url = `${apiBaseUrl}/api/v2/vacation-pdf/yearly-calendar-grid?year=${currentYear}`;
        break;
      default:
        return;
    }

    // Open PDF in new window
    window.open(url, '_blank');

    toast({
      title: "PDF wird erstellt",
      description: "Das PDF wird in einem neuen Tab geöffnet.",
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Urlaubsplanung"
        description="Verwalten Sie Urlaubsanträge und Abwesenheiten"
        actions={
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  PDF Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportPDF('admin-yearly')}>
                  Jahresplanung (Admin)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF('overview')}>
                  Übersicht (Alle Mitarbeiter)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF('yearly-calendar')}>
                  Jahreskalender
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF('yearly-calendar-grid')}>
                  Jahreskalender (Grid Layout)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={() => setShowBulkModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Schnell-Eingabe
            </Button>
            <Button
              onClick={() => setShowMultistepModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Mehrstufige Planung
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAbsenceModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Einzelne Abwesenheit
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
                  parseLocalDate(absence.end_date),
                  parseLocalDate(absence.start_date)
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

      {/* Merged Filters and Options Card */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 min-w-[200px]">
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
                  <SelectValue placeholder="Wählen..." />
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

      {/* List View */}
      <Collapsible open={isListExpanded} onOpenChange={setIsListExpanded}>
        <Card>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/50 transition-colors border-b">
              <CardTitle className="text-base">Abwesenheiten Liste</CardTitle>
              <ChevronDown
                className={`h-5 w-5 transition-transform duration-200 ${isListExpanded ? "rotate-180" : ""
                  }`}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6">
              {/* Bulk Actions Bar */}
              {selectedAbsenceIds.size > 0 && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedAbsenceIds.size} Abwesenheit(en) ausgewählt
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkApprove}
                      className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Genehmigen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkDecline}
                      className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Ablehnen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkDelete}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Löschen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedAbsenceIds(new Set())}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedAbsenceIds.size > 0 &&
                            selectedAbsenceIds.size === paginatedAbsences.length
                            ? true
                            : selectedAbsenceIds.size > 0
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
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
                        colSpan={9}
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
                            parseLocalDate(absence.end_date),
                            parseLocalDate(absence.start_date),
                          ) + 1;
                        const employeeName = getEmployeeDisplayName(absence.employee_id);
                        const showGroupHeader = groupByEmployee && absence.employee_id !== lastEmployeeId;
                        lastEmployeeId = absence.employee_id;

                        return (
                          <Fragment key={absence.id}>
                            {showGroupHeader && (
                              <TableRow className="bg-muted/30">
                                <TableCell />
                                <TableCell colSpan={8} className="font-medium">
                                  {employeeName}
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow className={editingId === absence.id ? "bg-muted/50" : ""}>
                              <TableCell className="w-12">
                                <Checkbox
                                  checked={selectedAbsenceIds.has(absence.id)}
                                  onCheckedChange={() =>
                                    handleToggleAbsence(absence.id)
                                  }
                                />
                              </TableCell>
                              <TableCell>{employeeName}</TableCell>
                              <TableCell>
                                {editingId === absence.id ? (
                                  <Select
                                    value={editingData.absence_type_id || absence.absence_type_id}
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
                                      {absenceTypesArray.map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                          {type.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    style={{
                                      borderColor: typeInfo.color,
                                      color: typeInfo.color,
                                    }}
                                  >
                                    {typeInfo.name}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {editingId === absence.id ? (
                                  <Select
                                    value={editingData.status || absence.status}
                                    onValueChange={(value) =>
                                      setEditingData({
                                        ...editingData,
                                        status: value,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="requested">Beantragt</SelectItem>
                                      <SelectItem value="approved">Genehmigt</SelectItem>
                                      <SelectItem value="declined">Abgelehnt</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  (() => {
                                    const statusInfo = getStatusInfo(absence.status);
                                    return (
                                      <Badge className={statusInfo.className} variant="secondary">
                                        <span className="flex items-center gap-1">
                                          {statusInfo.icon}
                                          {statusInfo.label}
                                        </span>
                                      </Badge>
                                    );
                                  })()
                                )}
                              </TableCell>
                              <TableCell>
                                {editingId === absence.id ? (
                                  <Input
                                    type="date"
                                    value={
                                      editingData.start_date
                                        ? format(parseLocalDate(editingData.start_date), "yyyy-MM-dd")
                                        : format(parseLocalDate(absence.start_date), "yyyy-MM-dd")
                                    }
                                    onChange={(e) =>
                                      setEditingData({
                                        ...editingData,
                                        start_date: e.target.value,
                                      })
                                    }
                                  />
                                ) : (
                                  format(parseLocalDate(absence.start_date), "dd.MM.yyyy")
                                )}
                              </TableCell>
                              <TableCell>
                                {editingId === absence.id ? (
                                  <Input
                                    type="date"
                                    value={
                                      editingData.end_date
                                        ? format(parseLocalDate(editingData.end_date), "yyyy-MM-dd")
                                        : format(parseLocalDate(absence.end_date), "yyyy-MM-dd")
                                    }
                                    onChange={(e) =>
                                      setEditingData({
                                        ...editingData,
                                        end_date: e.target.value,
                                      })
                                    }
                                  />
                                ) : (
                                  format(parseLocalDate(absence.end_date), "dd.MM.yyyy")
                                )}
                              </TableCell>
                              <TableCell>{days}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {editingId === absence.id ? (
                                  <Input
                                    value={editingData.note || absence.note || ""}
                                    onChange={(e) =>
                                      setEditingData({
                                        ...editingData,
                                        note: e.target.value,
                                      })
                                    }
                                    placeholder="Notiz..."
                                  />
                                ) : (
                                  absence.note || "–"
                                )}
                              </TableCell>
                              <TableCell>
                                {editingId === absence.id ? (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSave(absence.id)}
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
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEdit(absence)}
                                      title="Bearbeiten"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleMove(absence)}
                                      title="Verschieben"
                                    >
                                      <MoveHorizontal className="h-4 w-4 text-primary" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => deleteAbsenceMutation.mutate(absence.id)}
                                      title="Löschen"
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                )}
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Calendar View */}
      <Collapsible open={isCalendarExpanded} onOpenChange={setIsCalendarExpanded}>
        <Card>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base">Kalender</CardTitle>
              <ChevronDown
                className={`h-5 w-5 transition-transform duration-200 ${isCalendarExpanded ? "rotate-180" : ""
                  }`}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <Calendar
                events={calendarEvents}
                setEvents={handleEventsChange}
                mode={calendarMode}
                setMode={setCalendarMode}
                date={currentDate}
                setDate={setCurrentDate}
                calendarIconIsToday={true}
                onEventUpdate={handleEventUpdate}
                onEventDelete={handleEventDelete}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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

      {/* Multistep Vacation Planning Modal */}
      <MultistepVacationPlanningModal
        open={showMultistepModal}
        onOpenChange={setShowMultistepModal}
        employees={activeEmployees}
        absenceTypes={absenceTypesArray}
        existingAbsences={filteredAbsences}
        onSubmit={(absences) => bulkCreateAbsenceMutation.mutate(absences)}
        isLoading={bulkCreateAbsenceMutation.isPending}
      />

      {/* Move Absence Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveHorizontal className="h-5 w-5" />
              Abwesenheit verschieben
            </DialogTitle>
            <DialogDescription>
              Verschieben Sie die Abwesenheit auf neue Daten
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {movingAbsence && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">
                  {getEmployeeDisplayName(movingAbsence.employee_id)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getAbsenceTypeInfo(movingAbsence.absence_type_id).name}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="move_start_date">Von</Label>
                <Input
                  id="move_start_date"
                  type="date"
                  value={moveData.start_date}
                  onChange={(e) =>
                    setMoveData({ ...moveData, start_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="move_end_date">Bis</Label>
                <Input
                  id="move_end_date"
                  type="date"
                  value={moveData.end_date}
                  onChange={(e) =>
                    setMoveData({ ...moveData, end_date: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMoveDialog(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={handleMoveSubmit}
              disabled={updateAbsenceMutation.isPending}
            >
              Verschieben
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
