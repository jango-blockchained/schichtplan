import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Moon,
  PieChart,
  Sun,
  Sunrise
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface ShiftDistributionStatsProps {
  shiftTypeStats: {
    early: number;
    mid: number;
    late: number;
  };
  totalSchedules: number;
}

const SHIFT_DATA = [
  { name: 'Früh', key: 'early', icon: Sunrise, color: '#FFBB28', label: 'vor 10:00' },
  { name: 'Tag', key: 'mid', icon: Sun, color: '#00C49F', label: '10:00-18:00' },
  { name: 'Spät', key: 'late', icon: Moon, color: '#8884D8', label: 'ab 18:00' }
];

export function ShiftDistributionStats({
  shiftTypeStats,
  totalSchedules
}: ShiftDistributionStatsProps) {
  const pieData = SHIFT_DATA.map(item => ({
    name: item.name,
    value: shiftTypeStats[item.key as keyof typeof shiftTypeStats],
    color: item.color,
    percentage: totalSchedules > 0 ? (shiftTypeStats[item.key as keyof typeof shiftTypeStats] / totalSchedules) * 100 : 0
  }));

  const barData = SHIFT_DATA.map(item => ({
    name: item.name,
    count: shiftTypeStats[item.key as keyof typeof shiftTypeStats],
    percentage: totalSchedules > 0 ? (shiftTypeStats[item.key as keyof typeof shiftTypeStats] / totalSchedules) * 100 : 0,
    color: item.color
  }));

  return (
    <div className="space-y-6">
      {/* Progress Bars View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Schichtverteilung - Detailansicht
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {SHIFT_DATA.map((item, index) => {
            const Icon = item.icon;
            const count = shiftTypeStats[item.key as keyof typeof shiftTypeStats];
            const percentage = totalSchedules > 0 ? (count / totalSchedules) * 100 : 0;

            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: item.color }} />
                    <span className="text-sm font-medium">{item.name} ({item.label})</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-bold">{count}</span>
                    <span className="text-muted-foreground ml-1">
                      ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                </div>
                <Progress
                  value={percentage}
                  className="h-3"
                  style={{
                    '--progress-background': item.color + '20',
                    '--progress-foreground': item.color
                  } as React.CSSProperties}
                />
              </div>
            );
          })}

          {/* Summary */}
          <div className="pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              {SHIFT_DATA.map((item, index) => {
                const Icon = item.icon;
                const count = shiftTypeStats[item.key as keyof typeof shiftTypeStats];
                return (
                  <div key={index}>
                    <div className="text-2xl font-bold" style={{ color: item.color }}>
                      {count}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Icon className="h-3 w-3" />
                      {item.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pie Chart View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Schichtverteilung - Kreisdiagramm
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={1200}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} Schichten (${pieData.find(d => d.name === name)?.percentage.toFixed(0)}%)`,
                    name
                  ]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span style={{ color: pieData.find(d => d.name === value)?.color }}>{value}</span>}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Schichtverteilung - Balkendiagramm
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'count') return [`${value} Schichten`, 'Anzahl'];
                    if (name === 'percentage') return [`${value.toFixed(1)}%`, 'Prozent'];
                    return [value, name];
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#8884d8"
                  animationDuration={1500}
                  animationBegin={200}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SHIFT_DATA.map((item, index) => {
          const Icon = item.icon;
          const count = shiftTypeStats[item.key as keyof typeof shiftTypeStats];
          const percentage = totalSchedules > 0 ? (count / totalSchedules) * 100 : 0;

          return (
            <Card key={index} className="relative overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: item.color }} />
                  {item.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: item.color }}>
                  {count}
                </div>
                <p className="text-xs text-muted-foreground">
                  {percentage.toFixed(1)}% der Schichten
                </p>
                <div className="mt-2">
                  <Progress
                    value={percentage}
                    className="h-1"
                    style={{
                      '--progress-foreground': item.color
                    } as React.CSSProperties}
                  />
                </div>
              </CardContent>
              {/* Animated background */}
              <div
                className="absolute inset-0 opacity-5 animate-pulse"
                style={{
                  background: `linear-gradient(135deg, ${item.color}, transparent)`
                }}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
