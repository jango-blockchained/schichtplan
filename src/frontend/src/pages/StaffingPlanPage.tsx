import { StaffingHeatmap } from "@/components/StaffingHeatmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { PageLayout } from "@/layouts";
import {
  getStaffingHeatmap,
  getStaffingStatistics,
  type HeatmapDataPoint,
  type StaffingStatisticsResponse,
} from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

type ViewMode = "month" | "quarter" | "year";

export default function StaffingPlanPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [heatmapMetric, setHeatmapMetric] = useState<
    "total_absent" | "on_vacation" | "present" | "absent"
  >("total_absent");

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    let start: Date;
    let end: Date;

    switch (viewMode) {
      case "month":
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
        break;
      case "quarter":
        start = startOfMonth(subMonths(currentDate, 1));
        end = endOfMonth(addMonths(currentDate, 1));
        break;
      case "year":
        start = new Date(currentDate.getFullYear(), 0, 1);
        end = new Date(currentDate.getFullYear(), 11, 31);
        break;
    }

    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  }, [currentDate, viewMode]);

  // Fetch staffing statistics
  const { data: statistics, isLoading: statsLoading } =
    useQuery<StaffingStatisticsResponse>({
      queryKey: ["staffingStatistics", dateRange.start, dateRange.end],
      queryFn: () => getStaffingStatistics(dateRange.start, dateRange.end),
    });

  // Fetch heatmap data
  const { data: heatmapData, isLoading: heatmapLoading } = useQuery<{
    data: HeatmapDataPoint[];
    metric: string;
    scale: { min: number; max: number };
  }>({
    queryKey: [
      "staffingHeatmap",
      dateRange.start,
      dateRange.end,
      heatmapMetric,
    ],
    queryFn: () =>
      getStaffingHeatmap(dateRange.start, dateRange.end, heatmapMetric),
  });

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!statistics?.daily_stats) {
      return {
        avgPresent: 0,
        avgVacation: 0,
        avgAbsent: 0,
        maxAbsent: 0,
        minPresent: 0,
      };
    }

    const stats = statistics.daily_stats;
    const avgPresent =
      stats.reduce((sum, day) => sum + day.present, 0) / stats.length;
    const avgVacation =
      stats.reduce((sum, day) => sum + day.on_vacation, 0) / stats.length;
    const avgAbsent =
      stats.reduce((sum, day) => sum + day.absent, 0) / stats.length;
    const maxAbsent = Math.max(...stats.map((day) => day.total_absent));
    const minPresent = Math.min(...stats.map((day) => day.present));

    return {
      avgPresent: Math.round(avgPresent * 10) / 10,
      avgVacation: Math.round(avgVacation * 10) / 10,
      avgAbsent: Math.round(avgAbsent * 10) / 10,
      maxAbsent,
      minPresent,
    };
  }, [statistics]);

  // Navigation handlers
  const navigatePrevious = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case "quarter":
        setCurrentDate(subMonths(currentDate, 3));
        break;
      case "year":
        setCurrentDate(
          new Date(currentDate.getFullYear() - 1, currentDate.getMonth())
        );
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case "quarter":
        setCurrentDate(addMonths(currentDate, 3));
        break;
      case "year":
        setCurrentDate(
          new Date(currentDate.getFullYear() + 1, currentDate.getMonth())
        );
        break;
    }
  };

  const getDisplayTitle = () => {
    switch (viewMode) {
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: de });
      case "quarter":
        return `${format(subMonths(currentDate, 1), "MMM", { locale: de })} - ${format(
          addMonths(currentDate, 1),
          "MMM yyyy",
          { locale: de }
        )}`;
      case "year":
        return format(currentDate, "yyyy");
    }
  };

  return (
    <PageLayout
      title="Belegungsplan"
      description="Übersicht über Mitarbeiteranwesenheit und Abwesenheiten"
      breadcrumbs={[
        { href: "/", label: "Dashboard" },
        { label: "Belegungsplan", isCurrentPage: true },
      ]}
      headerActions={
        <div className="flex items-center gap-2">
          <Select
            value={viewMode}
            onValueChange={(value) => setViewMode(value as ViewMode)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monat</SelectItem>
              <SelectItem value="quarter">Quartal</SelectItem>
              <SelectItem value="year">Jahr</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                onClick={navigatePrevious}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">{getDisplayTitle()}</h2>
              </div>
              <Button variant="outline" size="icon" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Aktive Mitarbeiter
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics?.total_active_employees || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Gesamt im System
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ø Anwesend
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgPresent}</div>
              <p className="text-xs text-muted-foreground">
                Durchschnitt pro Tag
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ø Im Urlaub
              </CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgVacation}</div>
              <p className="text-xs text-muted-foreground">
                Durchschnitt pro Tag
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Max. Abwesend
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.maxAbsent}</div>
              <p className="text-xs text-muted-foreground">
                Höchste Abwesenheit
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Heatmap Visualization */}
        {heatmapData && !heatmapLoading && (
          <StaffingHeatmap
            data={heatmapData.data}
            title="Belegungsheatmap"
            description="Visuelle Darstellung der Mitarbeiterbelegung"
            metric={heatmapMetric}
            onMetricChange={(metric) =>
              setHeatmapMetric(
                metric as "total_absent" | "on_vacation" | "present" | "absent"
              )
            }
            minValue={heatmapData.scale.min}
            maxValue={heatmapData.scale.max}
          />
        )}

        {/* Daily Statistics Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tägliche Statistiken</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Lade Daten...
              </div>
            ) : statistics?.daily_stats && statistics.daily_stats.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Anwesend</TableHead>
                    <TableHead className="text-right">Im Urlaub</TableHead>
                    <TableHead className="text-right">Abwesend</TableHead>
                    <TableHead className="text-right">Gesamt Abwesend</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statistics.daily_stats.map((day) => {
                    const presentPercentage =
                      (day.present / day.total_active) * 100;
                    const statusColor =
                      presentPercentage >= 80
                        ? "bg-green-100 text-green-700"
                        : presentPercentage >= 60
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700";

                    return (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">
                          {format(new Date(day.date), "dd.MM.yyyy", {
                            locale: de,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {day.present}
                        </TableCell>
                        <TableCell className="text-right">
                          {day.on_vacation}
                        </TableCell>
                        <TableCell className="text-right">
                          {day.absent}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {day.total_absent}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColor}>
                            {Math.round(presentPercentage)}% verfügbar
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Keine Daten für den gewählten Zeitraum
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
