import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    AlertCircle,
    Key,
    TrendingUp,
    UserCheck,
    Users
} from "lucide-react";

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
    if (hours < avgHours * 0.8) return { variant: "secondary" as const, label: "Unter-arbeitet" };
    if (hours > avgHours * 1.2) return { variant: "destructive" as const, label: "Über-arbeitet" };
    return { variant: "default" as const, label: "Normal" };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Arbeitsbelastung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{avgHours.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Ø Stunden</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{maxHours.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Maximum</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{minHours.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Minimum</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{employees.length}</div>
            <div className="text-xs text-muted-foreground">Mitarbeiter</div>
          </div>
        </div>

        {/* Keyholder Coverage */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Schlüsselinhaber-Abdeckung</span>
            </div>
            <span className="text-sm font-bold">{keyholderCoverage.toFixed(0)}%</span>
          </div>
          <Progress value={keyholderCoverage} className="h-2 mb-2" />
          <div className="text-xs text-muted-foreground">
            {keyholders.length} Schlüsselinhaber von {employees.length} Mitarbeitern
          </div>
        </div>

        {/* Problem Areas */}
        {(overWorked.length > 0 || underWorked.length > 0) && (
          <div className="space-y-2">
            {overWorked.length > 0 && (
              <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">
                    Überarbeitet ({overWorked.length}):
                  </span>
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">
                  {overWorked.map(emp => `${emp.name} (${emp.hours.toFixed(1)}h)`).join(', ')}
                </div>
              </div>
            )}

            {underWorked.length > 0 && (
              <div className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    Unterarbeitet ({underWorked.length}):
                  </span>
                </div>
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  {underWorked.map(emp => `${emp.name} (${emp.hours.toFixed(1)}h)`).join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Employee List */}
        {sortedEmployees.length > 0 && (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            <h5 className="text-sm font-medium mb-2">Mitarbeiter-Übersicht:</h5>
            {sortedEmployees.map((employee) => {
              const status = getWorkloadStatus(employee.hours);
              const hourPercentage = maxHours > 0 ? (employee.hours / maxHours) * 100 : 0;
              
              return (
                <div key={employee.employeeId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{employee.name}</span>
                      {employee.isKeyholder && (
                        <Key className="h-3 w-3 text-blue-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {employee.hours.toFixed(1)}h ({employee.shifts} Schichten)
                      </span>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={hourPercentage} className="h-1" />
                  <div className="text-xs text-muted-foreground">
                    Gruppe: {employee.group}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Keyholder Details */}
        {keyholders.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4" />
              <span className="text-sm font-medium">Schlüsselinhaber-Details:</span>
            </div>
            <div className="space-y-1">
              {keyholders.map((keyholder, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{keyholder.name}</span>
                  <span>{keyholder.hours.toFixed(1)}h ({keyholder.shifts} Schichten)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
