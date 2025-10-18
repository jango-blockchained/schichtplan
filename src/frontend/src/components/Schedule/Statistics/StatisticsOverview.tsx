import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  BarChart3,
  Clock,
  Coffee,
  Target,
  Users,
} from "lucide-react";
import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface StatisticsOverviewProps {
  basicStats: {
    totalSchedules: number;
    totalEmployees: number;
    totalHours: number;
    avgHoursPerShift: number;
    shiftsWithBreaks: number;
    breakCoverage: number;
  };
}

export const StatisticsOverview = React.memo(function StatisticsOverview({
  basicStats,
}: StatisticsOverviewProps) {
  // Prepare data for charts
  const overviewData = [
    {
      name: "Schichten",
      value: basicStats.totalSchedules,
      icon: Activity,
      color: "#0088FE",
    },
    {
      name: "Mitarbeiter",
      value: basicStats.totalEmployees,
      icon: Users,
      color: "#00C49F",
    },
    {
      name: "Stunden",
      value: basicStats.totalHours.toFixed(1),
      icon: Clock,
      color: "#FFBB28",
    },
  ];

  const breakData = [
    { name: "Mit Pause", value: basicStats.shiftsWithBreaks, color: "#00C49F" },
    {
      name: "Ohne Pause",
      value: basicStats.totalSchedules - basicStats.shiftsWithBreaks,
      color: "#FF8042",
    },
  ];

  const efficiencyData = [
    {
      metric: "Ø Schichtlänge",
      value: basicStats.avgHoursPerShift,
      target: 8.0,
      unit: "h",
    },
    {
      metric: "Stunden/Mitarbeiter",
      value:
        basicStats.totalEmployees > 0
          ? basicStats.totalHours / basicStats.totalEmployees
          : 0,
      target: 40.0,
      unit: "h",
    },
    {
      metric: "Schichten/Mitarbeiter",
      value:
        basicStats.totalEmployees > 0
          ? basicStats.totalSchedules / basicStats.totalEmployees
          : 0,
      target: 5.0,
      unit: "",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {overviewData.map((item, index) => {
          const Icon = item.icon;
          return (
            <Card key={index} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {item.name}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold"
                  style={{ color: item.color }}
                >
                  {item.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.name === "Schichten" && "Aktive Zuweisungen"}
                  {item.name === "Mitarbeiter" && "Eingeplant"}
                  {item.name === "Stunden" &&
                    `Ø ${basicStats.avgHoursPerShift.toFixed(1)}h pro Schicht`}
                </p>
              </CardContent>
              {/* Animated background gradient */}
              <div
                className="absolute inset-0 opacity-5 animate-pulse"
                style={{
                  background: `linear-gradient(45deg, ${item.color}, transparent)`,
                }}
              />
            </Card>
          );
        })}
      </div>

      {/* Break Coverage with Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            Pausenabdeckung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  {basicStats.breakCoverage.toFixed(0)}%
                </div>
                <Badge
                  variant={
                    basicStats.breakCoverage >= 80
                      ? "default"
                      : basicStats.breakCoverage >= 50
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {basicStats.breakCoverage >= 80
                    ? "Gut"
                    : basicStats.breakCoverage >= 50
                      ? "Okay"
                      : "Niedrig"}
                </Badge>
              </div>
              <Progress value={basicStats.breakCoverage} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {basicStats.shiftsWithBreaks} von {basicStats.totalSchedules}{" "}
                Schichten haben Pausen
              </p>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1000}
                  >
                    {breakData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} Schichten`, ""]}
                    labelFormatter={() => ""}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Efficiency Metrics with Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Planungseffizienz
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {efficiencyData.map((metric, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{metric.metric}:</span>
                    <span className="font-medium">
                      {metric.value.toFixed(1)}
                      {metric.unit}
                      {metric.target && (
                        <span className="text-muted-foreground ml-1">
                          / {metric.target}
                          {metric.unit}
                        </span>
                      )}
                    </span>
                  </div>
                  {metric.target && (
                    <Progress
                      value={Math.min(
                        (metric.value / metric.target) * 100,
                        100,
                      )}
                      className="h-2"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={efficiencyData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="metric"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}${efficiencyData.find((d) => d.metric === name)?.unit || ""}`,
                      "Wert",
                    ]}
                  />
                  <Bar
                    dataKey="value"
                    fill="#8884d8"
                    animationDuration={1500}
                    animationBegin={300}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Übersicht Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[
                  { name: "Schichten", value: basicStats.totalSchedules },
                  { name: "Mitarbeiter", value: basicStats.totalEmployees },
                  { name: "Stunden", value: basicStats.totalHours },
                  { name: "Pausen %", value: basicStats.breakCoverage },
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "Stunden")
                      return [`${value.toFixed(1)}h`, name];
                    if (name === "Pausen %")
                      return [`${value.toFixed(0)}%`, name];
                    return [value, name];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.3}
                  animationDuration={2000}
                  animationBegin={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
