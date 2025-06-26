import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Target, 
  TrendingUp,
  AlertTriangle 
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Tägliche Abdeckung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{avgCoverage.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Ø Besetzung</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{maxCoverage}</div>
            <div className="text-xs text-muted-foreground">Maximum</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${minCoverage === 0 ? 'text-red-600' : 'text-orange-600'}`}>
              {minCoverage}
            </div>
            <div className="text-xs text-muted-foreground">Minimum</div>
          </div>
        </div>

        {/* Coverage Range Info */}
        <div className="space-y-2">
          {bestDay && (
            <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 rounded">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-600" />
                <span className="text-sm">Beste Abdeckung:</span>
              </div>
              <div className="text-sm font-medium">
                {format(bestDay.date, 'EEEE, dd.MM.', { locale: de })} ({bestDay.coverage} Mitarbeiter)
              </div>
            </div>
          )}

          {worstDay && worstDay.coverage > 0 && (
            <div className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="text-sm">Niedrigste Abdeckung:</span>
              </div>
              <div className="text-sm font-medium">
                {format(worstDay.date, 'EEEE, dd.MM.', { locale: de })} ({worstDay.coverage} Mitarbeiter)
              </div>
            </div>
          )}

          {daysWithNoCoverage.length > 0 && (
            <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded">
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
        </div>

        {/* Daily Coverage List */}
        {coverageByDay.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            <h5 className="text-sm font-medium mb-2">Tägliche Übersicht:</h5>
            {coverageByDay.map((day, index) => {
              const status = getCoverageStatus(day.coverage);
              return (
                <div key={index} className="flex items-center justify-between py-1">
                  <span className="text-sm">
                    {format(day.date, 'EEE dd.MM.', { locale: de })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {day.coverage} Mitarbeiter
                    </span>
                    <Badge variant={status.variant}>
                      {status.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
