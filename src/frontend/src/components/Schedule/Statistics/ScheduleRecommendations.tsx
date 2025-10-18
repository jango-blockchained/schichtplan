import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Coffee,
  Info,
  TrendingUp,
  Users,
} from "lucide-react";

interface ScheduleRecommendationsProps {
  basicStats: {
    breakCoverage: number;
    avgHoursPerShift: number;
  };
  workloadStats: {
    overWorked: Array<{ name: string; hours: number }>;
    underWorked: Array<{ name: string; hours: number }>;
    keyholderCoverage: number;
  };
  dailyCoverageStats: {
    minCoverage: number;
    avgCoverage: number;
  };
  shiftTypeStats: {
    early: number;
    mid: number;
    late: number;
  };
}

export function ScheduleRecommendations({
  basicStats,
  workloadStats,
  dailyCoverageStats,
  shiftTypeStats,
}: ScheduleRecommendationsProps) {
  const recommendations = [];

  // Break coverage recommendations
  if (basicStats.breakCoverage < 50) {
    recommendations.push({
      type: "warning" as const,
      icon: Coffee,
      title: "Pausenabdeckung verbessern",
      description: `Nur ${basicStats.breakCoverage.toFixed(0)}% der Schichten haben Pausen eingeplant.`,
      action: "Mehr Pausenzeiten in die Schichtplanung einbeziehen.",
      priority: "high" as const,
    });
  } else if (basicStats.breakCoverage < 80) {
    recommendations.push({
      type: "info" as const,
      icon: Coffee,
      title: "Pausenabdeckung optimieren",
      description: `${basicStats.breakCoverage.toFixed(0)}% Pausenabdeckung ist okay, aber ausbaufähig.`,
      action: "Pausenzeiten bei längeren Schichten konsequent einplanen.",
      priority: "medium" as const,
    });
  }

  // Workload distribution recommendations
  if (workloadStats.overWorked.length > 0) {
    recommendations.push({
      type: "error" as const,
      icon: AlertCircle,
      title: "Arbeitsverteilung überprüfen",
      description: `${workloadStats.overWorked.length} Mitarbeiter sind überarbeitet.`,
      action: `Schichten gleichmäßiger verteilen: ${workloadStats.overWorked.map((emp) => emp.name).join(", ")}`,
      priority: "high" as const,
    });
  }

  if (
    workloadStats.underWorked.length > 0 &&
    workloadStats.overWorked.length > 0
  ) {
    recommendations.push({
      type: "info" as const,
      icon: TrendingUp,
      title: "Arbeitsausgleich optimieren",
      description: `${workloadStats.underWorked.length} Mitarbeiter sind unterarbeitet, während andere überarbeitet sind.`,
      action:
        "Schichten von über- zu unterarbeiteten Mitarbeitern umverteilen.",
      priority: "medium" as const,
    });
  }

  // Coverage recommendations
  if (dailyCoverageStats.minCoverage === 0) {
    recommendations.push({
      type: "error" as const,
      icon: AlertTriangle,
      title: "Unbesetzte Tage gefunden",
      description: "Es gibt Tage ohne jegliche Personalbesetzung.",
      action: "Mindestbesetzung für alle Öffnungstage sicherstellen.",
      priority: "high" as const,
    });
  } else if (
    dailyCoverageStats.minCoverage < 2 &&
    dailyCoverageStats.avgCoverage >= 2
  ) {
    recommendations.push({
      type: "warning" as const,
      icon: Users,
      title: "Kritische Unterbesetzung",
      description: `Minimale Besetzung beträgt nur ${dailyCoverageStats.minCoverage} Mitarbeiter.`,
      action: "Mindestbesetzung von 2 Mitarbeitern pro Tag anstreben.",
      priority: "high" as const,
    });
  }

  // Keyholder recommendations
  if (workloadStats.keyholderCoverage < 30) {
    recommendations.push({
      type: "warning" as const,
      icon: Users,
      title: "Schlüsselinhaber-Abdeckung niedrig",
      description: `Nur ${workloadStats.keyholderCoverage.toFixed(0)}% der eingeplanten Mitarbeiter sind Schlüsselinhaber.`,
      action:
        "Mehr Schlüsselinhaber einplanen oder weitere Mitarbeiter zu Schlüsselinhabern ernennen.",
      priority: "medium" as const,
    });
  }

  // Shift distribution recommendations
  const totalShifts =
    shiftTypeStats.early + shiftTypeStats.mid + shiftTypeStats.late;
  if (totalShifts > 0) {
    const earlyPercentage = (shiftTypeStats.early / totalShifts) * 100;
    const latePercentage = (shiftTypeStats.late / totalShifts) * 100;

    if (earlyPercentage < 10 && shiftTypeStats.early > 0) {
      recommendations.push({
        type: "info" as const,
        icon: Clock,
        title: "Frühschichten unterrepräsentiert",
        description: `Nur ${earlyPercentage.toFixed(0)}% sind Frühschichten.`,
        action:
          "Mehr Frühschichten einplanen falls nötig für bessere Abdeckung.",
        priority: "low" as const,
      });
    }

    if (latePercentage < 10 && shiftTypeStats.late > 0) {
      recommendations.push({
        type: "info" as const,
        icon: Clock,
        title: "Spätschichten unterrepräsentiert",
        description: `Nur ${latePercentage.toFixed(0)}% sind Spätschichten.`,
        action:
          "Mehr Spätschichten einplanen falls erweiterte Öffnungszeiten erforderlich.",
        priority: "low" as const,
      });
    }
  }

  // Average shift length recommendations
  if (basicStats.avgHoursPerShift > 10) {
    recommendations.push({
      type: "warning" as const,
      icon: Clock,
      title: "Sehr lange Schichten",
      description: `Durchschnittliche Schichtlänge beträgt ${basicStats.avgHoursPerShift.toFixed(1)} Stunden.`,
      action:
        "Schichten aufteilen oder zusätzliche Pausen einplanen bei Schichten über 8 Stunden.",
      priority: "medium" as const,
    });
  } else if (basicStats.avgHoursPerShift < 4) {
    recommendations.push({
      type: "info" as const,
      icon: Clock,
      title: "Sehr kurze Schichten",
      description: `Durchschnittliche Schichtlänge beträgt nur ${basicStats.avgHoursPerShift.toFixed(1)} Stunden.`,
      action:
        "Längere Schichten kombinieren für bessere Effizienz falls möglich.",
      priority: "low" as const,
    });
  }

  // Sort recommendations by priority
  const sortedRecommendations = recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  if (sortedRecommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Empfehlungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-600">
            <Info className="h-4 w-4" />
            <span className="text-sm">
              Keine Empfehlungen - Ihr Schichtplan sieht gut aus!
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getBackgroundColor = (type: string) => {
    switch (type) {
      case "error":
        return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800";
      case "warning":
        return "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800";
      default:
        return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800";
    }
  };

  const getTextColor = (type: string) => {
    switch (type) {
      case "error":
        return "text-red-700 dark:text-red-300";
      case "warning":
        return "text-orange-700 dark:text-orange-300";
      default:
        return "text-blue-700 dark:text-blue-300";
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case "error":
        return "text-red-600";
      case "warning":
        return "text-orange-600";
      default:
        return "text-blue-600";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Empfehlungen ({sortedRecommendations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedRecommendations.map((recommendation, index) => {
          const Icon = recommendation.icon;
          return (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getBackgroundColor(recommendation.type)}`}
            >
              <div className="flex items-start gap-3">
                <Icon
                  className={`h-5 w-5 mt-0.5 flex-shrink-0 ${getIconColor(recommendation.type)}`}
                />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h5
                      className={`text-sm font-medium ${getTextColor(recommendation.type)}`}
                    >
                      {recommendation.title}
                    </h5>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        recommendation.priority === "high"
                          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          : recommendation.priority === "medium"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {recommendation.priority === "high"
                        ? "Hoch"
                        : recommendation.priority === "medium"
                          ? "Mittel"
                          : "Niedrig"}
                    </span>
                  </div>
                  <p className={`text-sm ${getTextColor(recommendation.type)}`}>
                    {recommendation.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Empfehlung:</strong> {recommendation.action}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
