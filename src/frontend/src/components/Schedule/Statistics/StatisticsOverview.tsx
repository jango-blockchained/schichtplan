import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Activity,
    BarChart3,
    Clock,
    Coffee,
    Users
} from "lucide-react";

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

export function StatisticsOverview({ basicStats }: StatisticsOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Total Schedules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gesamt Schichten</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{basicStats.totalSchedules}</div>
          <p className="text-xs text-muted-foreground">
            Aktive Schichtzuweisungen
          </p>
        </CardContent>
      </Card>

      {/* Total Employees */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mitarbeiter</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{basicStats.totalEmployees}</div>
          <p className="text-xs text-muted-foreground">
            Eingeplante Mitarbeiter
          </p>
        </CardContent>
      </Card>

      {/* Total Hours */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gesamt Stunden</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{basicStats.totalHours.toFixed(1)}</div>
          <p className="text-xs text-muted-foreground">
            Ø {basicStats.avgHoursPerShift.toFixed(1)}h pro Schicht
          </p>
        </CardContent>
      </Card>

      {/* Break Coverage */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pausenabdeckung</CardTitle>
          <Coffee className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">{basicStats.breakCoverage.toFixed(0)}%</div>
            <Badge variant={basicStats.breakCoverage >= 80 ? "default" : basicStats.breakCoverage >= 50 ? "secondary" : "destructive"}>
              {basicStats.breakCoverage >= 80 ? "Gut" : basicStats.breakCoverage >= 50 ? "Okay" : "Niedrig"}
            </Badge>
          </div>
          <div className="mt-2">
            <Progress value={basicStats.breakCoverage} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {basicStats.shiftsWithBreaks} von {basicStats.totalSchedules} Schichten
          </p>
        </CardContent>
      </Card>

      {/* Efficiency Indicator */}
      <Card className="md:col-span-2 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Planungseffizienz</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Durchschnittliche Schichtlänge:</span>
              <span className="font-medium">{basicStats.avgHoursPerShift.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Stunden pro Mitarbeiter:</span>
              <span className="font-medium">
                {basicStats.totalEmployees > 0 
                  ? (basicStats.totalHours / basicStats.totalEmployees).toFixed(1) 
                  : 0}h
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Schichten pro Mitarbeiter:</span>
              <span className="font-medium">
                {basicStats.totalEmployees > 0 
                  ? (basicStats.totalSchedules / basicStats.totalEmployees).toFixed(1) 
                  : 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
