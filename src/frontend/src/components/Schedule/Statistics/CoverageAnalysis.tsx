import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
    AlertTriangle,
    Calendar,
    Target,
    TrendingUp,
    BarChart3,
    Activity
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    ReferenceLine,
    ComposedChart,
    Cell
} from 'recharts';

interface CoverageAnalysisProps {
  dailyCoverageStats: {
    avgCoverage: number;
    coverageByDay: { date: Date; coverage: number; dayName: string }[];
    minCoverage: number;
    maxCoverage: number;
  };
}

export function CoverageAnalysis({ dailyCoverageStats }: CoverageAnalysisProps) {
  const { avgCoverage, coverageByDay, minCoverage, maxCoverage } = dailyCoverageStats;

  // Find days with lowest and highest coverage
  const worstDay = coverageByDay.find(d => d.coverage === minCoverage);
  const bestDay = coverageByDay.find(d => d.coverage === maxCoverage);
  const daysWithNoCoverage = coverageByDay.filter(d => d.coverage === 0);

  const getCoverageStatus = (coverage: number) => {
    if (coverage === 0) return { variant: "destructive" as const, label: "Keine Besetzung" };
    if (coverage < avgCoverage * 0.5) return { variant: "destructive" as const, label: "Kritisch" };
    if (coverage < avgCoverage * 0.8) return { variant: "secondary" as const, label: "Niedrig" };
    return { variant: "default" as const, label: "Normal" };
  };

  // Prepare chart data
  const chartData = coverageByDay.map(day => ({
    date: format(day.date, 'dd.MM', { locale: de }),
    fullDate: format(day.date, 'EEEE, dd.MM.', { locale: de }),
    coverage: day.coverage,
    dayName: day.dayName,
    status: getCoverageStatus(day.coverage).label,
    statusColor: day.coverage === 0 ? '#ef4444' :
                 day.coverage < avgCoverage * 0.5 ? '#ef4444' :
                 day.coverage < avgCoverage * 0.8 ? '#f59e0b' : '#10b981'
  }));

  // Coverage distribution data
  const coverageRanges = [
    { range: '0', count: daysWithNoCoverage.length, color: '#ef4444' },
    { range: '1-2', count: coverageByDay.filter(d => d.coverage >= 1 && d.coverage <= 2).length, color: '#f59e0b' },
    { range: '3-5', count: coverageByDay.filter(d => d.coverage >= 3 && d.coverage <= 5).length, color: '#3b82f6' },
    { range: '6+', count: coverageByDay.filter(d => d.coverage >= 6).length, color: '#10b981' }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ø Besetzung</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCoverage.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Mitarbeiter pro Tag
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maximum</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{maxCoverage}</div>
            <p className="text-xs text-muted-foreground">
              {bestDay ? format(bestDay.date, 'EEE dd.MM.', { locale: de }) : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Minimum</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${minCoverage === 0 ? 'text-red-600' : 'text-orange-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${minCoverage === 0 ? 'text-red-600' : 'text-orange-600'}`}>
              {minCoverage}
            </div>
            <p className="text-xs text-muted-foreground">
              {worstDay ? format(worstDay.date, 'EEE dd.MM.', { locale: de }) : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Coverage Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tägliche Besetzungsentwicklung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [`${value} Mitarbeiter`, 'Besetzung']}
                  labelFormatter={(label) => {
                    const day = chartData.find(d => d.date === label);
                    return day ? day.fullDate : label;
                  }}
                />
                <ReferenceLine y={avgCoverage} stroke="#666" strokeDasharray="5 5" label="Ø" />
                <Bar
                  dataKey="coverage"
                  fill="#8884d8"
                  animationDuration={1500}
                  animationBegin={300}
                />
                <Line
                  type="monotone"
                  dataKey="coverage"
                  stroke="#ff7300"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  animationDuration={2000}
                  animationBegin={800}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Coverage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Besetzungsverteilung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coverageRanges} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [`${value} Tage`, 'Anzahl']}
                  labelFormatter={(label) => `${label} Mitarbeiter`}
                />
                <Bar
                  dataKey="count"
                  animationDuration={1200}
                  animationBegin={400}
                >
                  {coverageRanges.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Critical Days Alert */}
      {(daysWithNoCoverage.length > 0 || worstDay) && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertTriangle className="h-5 w-5" />
              Kritische Tage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bestDay && (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Beste Abdeckung:</span>
                </div>
                <div className="text-sm font-medium">
                  {format(bestDay.date, 'EEEE, dd.MM.', { locale: de })} ({bestDay.coverage} Mitarbeiter)
                </div>
              </div>
            )}

            {worstDay && worstDay.coverage > 0 && (
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">Niedrigste Abdeckung:</span>
                </div>
                <div className="text-sm font-medium">
                  {format(worstDay.date, 'EEEE, dd.MM.', { locale: de })} ({worstDay.coverage} Mitarbeiter)
                </div>
              </div>
            )}

            {daysWithNoCoverage.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">
                    Tage ohne Besetzung ({daysWithNoCoverage.length}):
                  </span>
                </div>
                <div className="text-sm text-red-600 dark:text-red-400">
                  {daysWithNoCoverage.map(day =>
                    format(day.date, 'dd.MM.', { locale: de })
                  ).join(', ')}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed Daily View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Tägliche Übersicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {coverageByDay.map((day, index) => {
              const status = getCoverageStatus(day.coverage);
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border hover:shadow-sm transition-shadow"
                  style={{
                    borderColor: status.variant === 'destructive' ? '#ef4444' :
                               status.variant === 'secondary' ? '#f59e0b' : '#10b981',
                    backgroundColor: status.variant === 'destructive' ? '#fef2f2' :
                                   status.variant === 'secondary' ? '#fffbeb' : '#f0fdf4'
                  }}
                >
                  <div>
                    <div className="text-sm font-medium">
                      {format(day.date, 'EEE dd.MM.', { locale: de })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {day.dayName}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">
                      {day.coverage}
                    </span>
                    <Badge variant={status.variant} className="text-xs">
                      {status.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
