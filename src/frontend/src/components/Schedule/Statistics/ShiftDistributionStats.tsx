import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Sunrise, 
  Sun, 
  Moon,
  PieChart 
} from "lucide-react";

interface ShiftDistributionStatsProps {
  shiftTypeStats: {
    early: number;
    mid: number;
    late: number;
  };
  totalSchedules: number;
}

export function ShiftDistributionStats({ 
  shiftTypeStats, 
  totalSchedules 
}: ShiftDistributionStatsProps) {
  const earlyPercentage = totalSchedules > 0 ? (shiftTypeStats.early / totalSchedules) * 100 : 0;
  const midPercentage = totalSchedules > 0 ? (shiftTypeStats.mid / totalSchedules) * 100 : 0;
  const latePercentage = totalSchedules > 0 ? (shiftTypeStats.late / totalSchedules) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Schichtverteilung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Early Shifts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sunrise className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Früh (vor 10:00)</span>
            </div>
            <div className="text-sm">
              <span className="font-bold">{shiftTypeStats.early}</span>
              <span className="text-muted-foreground ml-1">
                ({earlyPercentage.toFixed(0)}%)
              </span>
            </div>
          </div>
          <Progress value={earlyPercentage} className="h-2" />
        </div>

        {/* Mid Shifts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Tag (10:00-18:00)</span>
            </div>
            <div className="text-sm">
              <span className="font-bold">{shiftTypeStats.mid}</span>
              <span className="text-muted-foreground ml-1">
                ({midPercentage.toFixed(0)}%)
              </span>
            </div>
          </div>
          <Progress value={midPercentage} className="h-2" />
        </div>

        {/* Late Shifts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Spät (ab 18:00)</span>
            </div>
            <div className="text-sm">
              <span className="font-bold">{shiftTypeStats.late}</span>
              <span className="text-muted-foreground ml-1">
                ({latePercentage.toFixed(0)}%)
              </span>
            </div>
          </div>
          <Progress value={latePercentage} className="h-2" />
        </div>

        {/* Summary */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-orange-500">{shiftTypeStats.early}</div>
              <div className="text-xs text-muted-foreground">Früh</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-500">{shiftTypeStats.mid}</div>
              <div className="text-xs text-muted-foreground">Tag</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-500">{shiftTypeStats.late}</div>
              <div className="text-xs text-muted-foreground">Spät</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
