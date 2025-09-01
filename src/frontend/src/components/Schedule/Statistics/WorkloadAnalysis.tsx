import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Key,
  PieChart as PieChartIcon,
  TrendingUp,
  UserCheck,
  Users
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface WorkloadAnalysisProps {
  workloadStats: {
    employees: Array<{
      employeeId: number;
      hours: number;
      shifts: number;
      name: string;
      group: string;
      isKeyholder: boolean;
    }>;
    avgHours: number;
    minHours: number;
    maxHours: number;
    underWorked: Array<{ name: string; hours: number; }>;
    overWorked: Array<{ name: string; hours: number; }>;
    keyholders: Array<{ name: string; hours: number; shifts: number; }>;
    keyholderCoverage: number;
  };
}

const WORKLOAD_COLORS = {
  normal: '#10b981',
  under: '#f59e0b',
  over: '#ef4444',
  keyholder: '#3b82f6'
};

export function WorkloadAnalysis({ workloadStats }: WorkloadAnalysisProps) {
  const {
    employees,
    avgHours,
    minHours,
    maxHours,
    underWorked,
    overWorked,
    keyholders,
    keyholderCoverage,
  } = workloadStats;

  // Sort employees by hours for better visualization
  const sortedEmployees = [...employees].sort((a, b) => b.hours - a.hours);

  const getWorkloadStatus = (hours: number) => {
    if (hours < avgHours * 0.8) return { variant: "secondary" as const, label: "Unter-arbeitet", color: WORKLOAD_COLORS.under };
    if (hours > avgHours * 1.2) return { variant: "destructive" as const, label: "Über-arbeitet", color: WORKLOAD_COLORS.over };
    return { variant: "default" as const, label: "Normal", color: WORKLOAD_COLORS.normal };
  };

  // Prepare chart data
  const workloadChartData = sortedEmployees.slice(0, 10).map(emp => ({
    name: emp.name.split(' ')[0], // First name only for chart
    fullName: emp.name,
    hours: emp.hours,
    shifts: emp.shifts,
    status: getWorkloadStatus(emp.hours).label,
    color: getWorkloadStatus(emp.hours).color,
    isKeyholder: emp.isKeyholder
  }));

  const workloadDistribution = [
    { name: 'Unter-arbeitet', value: underWorked.length, color: WORKLOAD_COLORS.under },
    { name: 'Normal', value: employees.length - underWorked.length - overWorked.length, color: WORKLOAD_COLORS.normal },
    { name: 'Über-arbeitet', value: overWorked.length, color: WORKLOAD_COLORS.over }
  ];

  const keyholderData = [
    { name: 'Schlüsselinhaber', value: keyholders.length, color: WORKLOAD_COLORS.keyholder },
    { name: 'Andere', value: employees.length - keyholders.length, color: '#94a3b8' }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ø Stunden</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">pro Mitarbeiter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maximum</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{maxHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Stunden</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Minimum</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{minHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Stunden</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mitarbeiter</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">Gesamt</p>
          </CardContent>
        </Card>
      </div>

      {/* Workload Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Arbeitsbelastungsverteilung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={workloadDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1200}
                  >
                    {workloadDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} Mitarbeiter`, '']}
                    labelFormatter={() => ''}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              {workloadDistribution.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-lg font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 10 Employees Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Top 10 Mitarbeiter nach Arbeitsstunden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={workloadChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'hours') return [`${value.toFixed(1)} Stunden`, 'Arbeitszeit'];
                    if (name === 'shifts') return [`${value} Schichten`, 'Anzahl'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => {
                    const emp = workloadChartData.find(d => d.name === label);
                    return emp ? emp.fullName : label;
                  }}
                />
                <Bar
                  dataKey="hours"
                  fill="#8884d8"
                  animationDuration={1500}
                  animationBegin={300}
                />
                <Line
                  type="monotone"
                  dataKey="shifts"
                  stroke="#ff7300"
                  strokeWidth={2}
                  animationDuration={2000}
                  animationBegin={800}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Keyholder Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Schlüsselinhaber-Analyse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium">Schlüsselinhaber-Abdeckung</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">{keyholderCoverage.toFixed(0)}%</span>
                </div>
                <Progress value={keyholderCoverage} className="h-3 mb-2" />
                <div className="text-xs text-muted-foreground">
                  {keyholders.length} von {employees.length} Mitarbeitern
                </div>
              </div>

              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={keyholderData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1000}
                    >
                      {keyholderData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value} Mitarbeiter`, '']}
                      labelFormatter={() => ''}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Schlüsselinhaber-Details:
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {keyholders.map((keyholder, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-blue-50/50 dark:bg-blue-950/10 rounded">
                    <span className="text-sm font-medium">{keyholder.name}</span>
                    <div className="text-xs text-muted-foreground">
                      {keyholder.hours.toFixed(1)}h / {keyholder.shifts} Schichten
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Problem Areas Alert */}
      {(overWorked.length > 0 || underWorked.length > 0) && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertCircle className="h-5 w-5" />
              Arbeitsbelastungs-Probleme
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overWorked.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">
                    Überarbeitet ({overWorked.length} Mitarbeiter):
                  </span>
                </div>
                <div className="text-xs text-red-600 dark:text-red-400 space-y-1">
                  {overWorked.map(emp => (
                    <div key={emp.name} className="flex justify-between">
                      <span>{emp.name}</span>
                      <span>{emp.hours.toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {underWorked.length > 0 && (
              <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    Unterarbeitet ({underWorked.length} Mitarbeiter):
                  </span>
                </div>
                <div className="text-xs text-orange-600 dark:text-orange-400 space-y-1">
                  {underWorked.map(emp => (
                    <div key={emp.name} className="flex justify-between">
                      <span>{emp.name}</span>
                      <span>{emp.hours.toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed Employee List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Detaillierte Mitarbeiter-Übersicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sortedEmployees.map((employee) => {
              const status = getWorkloadStatus(employee.hours);
              const hourPercentage = maxHours > 0 ? (employee.hours / maxHours) * 100 : 0;

              return (
                <div key={employee.employeeId} className="p-3 border rounded-lg hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{employee.name}</span>
                      {employee.isKeyholder && (
                        <Badge variant="outline" className="text-xs">
                          <Key className="h-3 w-3 mr-1" />
                          Schlüssel
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {employee.hours.toFixed(1)}h
                      </span>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{employee.shifts} Schichten</span>
                      <span>Gruppe: {employee.group}</span>
                    </div>
                    <Progress
                      value={hourPercentage}
                      className="h-2"
                      style={{
                        '--progress-foreground': status.color
                      } as React.CSSProperties}
                    />
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
