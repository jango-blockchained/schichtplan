import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
    Activity,
    BarChart3,
    Calendar,
    Clock,
    TrendingUp,
    Users
} from "lucide-react";
import {
    Area,
    AreaChart,
    Bar,
    CartesianGrid,
    ComposedChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';

interface WeeklyBreakdownProps {
    weeklyBreakdown: Array<{
        weekStart: Date;
        weekEnd: Date;
        weekNumber: string;
        hours: number;
        shifts: number;
        employees: number;
    }>;
}

export function WeeklyBreakdown({ weeklyBreakdown }: WeeklyBreakdownProps) {
    if (weeklyBreakdown.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Wöchentliche Aufschlüsselung
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Keine Daten für wöchentliche Aufschlüsselung verfügbar.
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Calculate totals and averages
    const totalHours = weeklyBreakdown.reduce((sum, week) => sum + week.hours, 0);
    const totalShifts = weeklyBreakdown.reduce((sum, week) => sum + week.shifts, 0);
    const avgHoursPerWeek = totalHours / weeklyBreakdown.length;
    const avgShiftsPerWeek = totalShifts / weeklyBreakdown.length;
    const maxHours = Math.max(...weeklyBreakdown.map(w => w.hours));
    const maxShifts = Math.max(...weeklyBreakdown.map(w => w.shifts));
    const minHours = Math.min(...weeklyBreakdown.map(w => w.hours));

    // Prepare chart data
    const chartData = weeklyBreakdown.map(week => ({
        week: `KW ${week.weekNumber}`,
        fullWeek: `KW ${week.weekNumber} (${format(week.weekStart, 'dd.MM.', { locale: de })} - ${format(week.weekEnd, 'dd.MM.', { locale: de })})`,
        hours: week.hours,
        shifts: week.shifts,
        employees: week.employees,
        avgHoursPerShift: week.shifts > 0 ? week.hours / week.shifts : 0,
        avgHoursPerEmployee: week.employees > 0 ? week.hours / week.employees : 0
    }));

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gesamt Stunden</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalHours.toFixed(0)}</div>
                        <p className="text-xs text-muted-foreground">Alle Wochen</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gesamt Schichten</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalShifts}</div>
                        <p className="text-xs text-muted-foreground">Alle Wochen</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ø Stunden/Woche</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{avgHoursPerWeek.toFixed(1)}</div>
                        <p className="text-xs text-muted-foreground">Durchschnitt</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ø Schichten/Woche</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{avgShiftsPerWeek.toFixed(1)}</div>
                        <p className="text-xs text-muted-foreground">Durchschnitt</p>
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Hours Trend Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Wöchentliche Stundenentwicklung
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="week"
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    formatter={(value: number, name: string) => {
                                        if (name === 'hours') return [`${value.toFixed(1)} Stunden`, 'Arbeitszeit'];
                                        return [value, name];
                                    }}
                                    labelFormatter={(label) => {
                                        const week = chartData.find(d => d.week === label);
                                        return week ? week.fullWeek : label;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="hours"
                                    stroke="#8884d8"
                                    fill="#8884d8"
                                    fillOpacity={0.3}
                                    animationDuration={2000}
                                    animationBegin={300}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Combined Metrics Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Wöchentliche Kennzahlen
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="week"
                                    tick={{ fontSize: 12 }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                                <Tooltip
                                    formatter={(value: number, name: string) => {
                                        switch (name) {
                                            case 'hours': return [`${value.toFixed(1)}h`, 'Stunden'];
                                            case 'shifts': return [`${value} Schichten`, 'Anzahl'];
                                            case 'employees': return [`${value} Mitarbeiter`, 'Anzahl'];
                                            case 'avgHoursPerShift': return [`${value.toFixed(1)}h`, 'Ø pro Schicht'];
                                            case 'avgHoursPerEmployee': return [`${value.toFixed(1)}h`, 'Ø pro MA'];
                                            default: return [value, name];
                                        }
                                    }}
                                    labelFormatter={(label) => {
                                        const week = chartData.find(d => d.week === label);
                                        return week ? week.fullWeek : label;
                                    }}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="hours"
                                    fill="#8884d8"
                                    animationDuration={1500}
                                    animationBegin={200}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="shifts"
                                    stroke="#ff7300"
                                    strokeWidth={2}
                                    animationDuration={2000}
                                    animationBegin={600}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="employees"
                                    stroke="#00ff00"
                                    strokeWidth={2}
                                    animationDuration={2000}
                                    animationBegin={1000}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Weekly Details with Enhanced Cards */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Detaillierte Wochenübersicht
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {weeklyBreakdown.map((week, index) => {
                            const hoursPercentage = maxHours > 0 ? (week.hours / maxHours) * 100 : 0;
                            const shiftsPercentage = maxShifts > 0 ? (week.shifts / maxShifts) * 100 : 0;
                            const isPeakWeek = week.hours === maxHours;
                            const isLowWeek = week.hours === minHours;

                            return (
                                <div
                                    key={index}
                                    className={`p-4 border rounded-lg space-y-3 transition-all duration-300 hover:shadow-md ${isPeakWeek ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20' :
                                            isLowWeek ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-950/20' :
                                                'hover:border-blue-300'
                                        }`}
                                >
                                    {/* Week Header */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium flex items-center gap-2">
                                                KW {week.weekNumber}
                                                {isPeakWeek && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Peak</span>}
                                                {isLowWeek && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Low</span>}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {format(week.weekStart, 'dd.MM.', { locale: de })} - {format(week.weekEnd, 'dd.MM.', { locale: de })}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold">{week.hours.toFixed(1)}h</div>
                                            <div className="text-xs text-muted-foreground">{week.shifts} Schichten</div>
                                        </div>
                                    </div>

                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                            <div className="text-sm font-bold text-blue-600">{week.employees}</div>
                                            <div className="text-xs text-muted-foreground">MA</div>
                                        </div>
                                        <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded">
                                            <div className="text-sm font-bold text-green-600">{(week.hours / Math.max(week.shifts, 1)).toFixed(1)}h</div>
                                            <div className="text-xs text-muted-foreground">Ø/Schicht</div>
                                        </div>
                                        <div className="p-2 bg-purple-50 dark:bg-purple-950/20 rounded">
                                            <div className="text-sm font-bold text-purple-600">{(week.hours / Math.max(week.employees, 1)).toFixed(1)}h</div>
                                            <div className="text-xs text-muted-foreground">Ø/MA</div>
                                        </div>
                                    </div>

                                    {/* Progress Bars */}
                                    <div className="space-y-2">
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span>Stunden</span>
                                                <span>{hoursPercentage.toFixed(0)}% vom Max</span>
                                            </div>
                                            <Progress
                                                value={hoursPercentage}
                                                className="h-2"
                                                style={{
                                                    '--progress-foreground': isPeakWeek ? '#10b981' : '#8884d8'
                                                } as React.CSSProperties}
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span>Schichten</span>
                                                <span>{shiftsPercentage.toFixed(0)}% vom Max</span>
                                            </div>
                                            <Progress
                                                value={shiftsPercentage}
                                                className="h-2"
                                                style={{
                                                    '--progress-foreground': '#ff7300'
                                                } as React.CSSProperties}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Trend Analysis Summary */}
            {weeklyBreakdown.length > 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Trend-Analyse
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                                <div className="text-sm text-muted-foreground mb-1">Stärkste Woche</div>
                                <div className="text-lg font-bold text-green-600">
                                    KW {weeklyBreakdown.find(w => w.hours === maxHours)?.weekNumber}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {maxHours.toFixed(1)} Stunden
                                </div>
                            </div>

                            <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                                <div className="text-sm text-muted-foreground mb-1">Schwächste Woche</div>
                                <div className="text-lg font-bold text-orange-600">
                                    KW {weeklyBreakdown.find(w => w.hours === minHours)?.weekNumber}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {minHours.toFixed(1)} Stunden
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                                <div className="text-sm text-muted-foreground mb-1">Durchschnitt</div>
                                <div className="text-lg font-bold text-blue-600">
                                    {avgHoursPerWeek.toFixed(1)}h
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    pro Woche
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
