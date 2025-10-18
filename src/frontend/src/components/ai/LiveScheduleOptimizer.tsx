/**
 * LiveScheduleOptimizer Component
 * Provides real-time schedule optimization with AI-powered conflict detection
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { aiService } from "@/services/aiService";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface OptimizationSuggestion {
  id: string;
  type: "conflict" | "efficiency" | "coverage" | "workload";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  impact: {
    metric: string;
    current: number;
    optimized: number;
    improvement: number;
  };
  timeframe: string;
  actionable: boolean;
  autoFixable: boolean;
  relatedShifts: string[];
  confidence: number;
  timestamp: Date;
}

export interface OptimizationResult {
  success: boolean;
  optimizedSchedule?: unknown;
  suggestions: OptimizationSuggestion[];
  metrics: {
    totalConflicts: number;
    coverageGaps: number;
    workloadImbalance: number;
    efficiency: number;
  };
  processingTime: number;
}

interface LiveScheduleOptimizerProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onOptimizationComplete?: (result: OptimizationResult) => void;
}

export const LiveScheduleOptimizer: React.FC<LiveScheduleOptimizerProps> = ({
  className,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  onOptimizationComplete,
}) => {
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastOptimized, setLastOptimized] = useState<Date | null>(null);
  const [metrics, setMetrics] = useState({
    totalConflicts: 0,
    coverageGaps: 0,
    workloadImbalance: 0,
    efficiency: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Generate optimization suggestions
  const generateOptimization = useCallback(async () => {
    setIsLoading(true);
    try {
      // Call AI service to optimize schedule
      const response = await aiService.optimizeScheduleWithAI({
        week_start: new Date().toISOString().split("T")[0],
        optimization_goals: [
          "minimize_conflicts",
          "improve_coverage",
          "balance_workload",
        ],
        constraints: {
          max_hours_per_employee: 40,
          min_rest_between_shifts: 8,
          required_skills: [],
          budget_limit: null,
        },
        preferences: {
          prioritize_employee_preferences: true,
          avoid_overtime: true,
          maintain_coverage: true,
        },
      });

      if (response.success) {
        // Convert API response to our expected format
        const mockSuggestions: OptimizationSuggestion[] =
          response.recommendations.map((rec, index) => ({
            id: `opt-${index}`,
            type: "efficiency" as const,
            title: "Optimization Opportunity",
            description: rec,
            severity: "medium" as const,
            impact: {
              metric: "Efficiency",
              current: 75,
              optimized: 85,
              improvement: 10,
            },
            timeframe: "Next week",
            actionable: true,
            autoFixable: true,
            relatedShifts: [],
            confidence: 0.8,
            timestamp: new Date(),
          }));

        setSuggestions(mockSuggestions);
        setMetrics({
          totalConflicts:
            response.improvements.find((imp) => imp.metric.includes("conflict"))
              ?.before || 0,
          coverageGaps:
            response.improvements.find((imp) => imp.metric.includes("coverage"))
              ?.before || 0,
          workloadImbalance:
            response.improvements.find((imp) => imp.metric.includes("workload"))
              ?.before || 0,
          efficiency: 85, // Mock value
        });
        setLastOptimized(new Date());

        if (onOptimizationComplete) {
          const result: OptimizationResult = {
            success: response.success,
            optimizedSchedule: response.optimized_schedule,
            suggestions: mockSuggestions,
            metrics: {
              totalConflicts:
                response.improvements.find((imp) =>
                  imp.metric.includes("conflict"),
                )?.before || 0,
              coverageGaps:
                response.improvements.find((imp) =>
                  imp.metric.includes("coverage"),
                )?.before || 0,
              workloadImbalance:
                response.improvements.find((imp) =>
                  imp.metric.includes("workload"),
                )?.before || 0,
              efficiency: 85,
            },
            processingTime: 1000, // Mock value
          };
          onOptimizationComplete(result);
        }
      }
    } catch (error) {
      console.error("Failed to generate optimization:", error);
      toast.error("Failed to generate schedule optimization");
    } finally {
      setIsLoading(false);
    }
  }, [onOptimizationComplete]);

  // Apply optimization suggestion
  const applyOptimization = async (suggestion: OptimizationSuggestion) => {
    setIsOptimizing(true);
    try {
      // Mark suggestion as being processed
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === suggestion.id ? { ...s, actionable: false } : s,
        ),
      );

      // Here you would call the actual optimization API
      // For now, we'll simulate the optimization
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Remove the suggestion from the list
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));

      toast.success(`Applied optimization: ${suggestion.title}`);

      // Refresh suggestions after applying
      setTimeout(() => generateOptimization(), 1000);
    } catch (error) {
      console.error("Failed to apply optimization:", error);
      toast.error("Failed to apply optimization");

      // Restore the suggestion
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === suggestion.id ? { ...s, actionable: true } : s,
        ),
      );
    } finally {
      setIsOptimizing(false);
    }
  };

  // Get severity color
  const getSeverityColor = (severity: OptimizationSuggestion["severity"]) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Get type icon
  const getTypeIcon = (type: OptimizationSuggestion["type"]) => {
    switch (type) {
      case "conflict":
        return <AlertTriangle className="h-4 w-4" />;
      case "efficiency":
        return <TrendingUp className="h-4 w-4" />;
      case "coverage":
        return <Users className="h-4 w-4" />;
      case "workload":
        return <Clock className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  // Auto-refresh optimization
  useEffect(() => {
    if (autoRefresh) {
      generateOptimization();
      const interval = setInterval(generateOptimization, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, generateOptimization]);

  // Initial load
  useEffect(() => {
    generateOptimization();
  }, [generateOptimization]);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4" />
            Live Schedule Optimization
            {isLoading && (
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastOptimized && (
              <span className="text-xs text-muted-foreground">
                Last: {lastOptimized.toLocaleTimeString()}
              </span>
            )}
            <Button
              onClick={generateOptimization}
              disabled={isLoading}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              <RefreshCw
                className={cn("h-3 w-3", isLoading && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Metrics Overview */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-2 bg-muted/50 rounded">
            <div className="flex items-center gap-2">
              {metrics.totalConflicts > 0 ? (
                <AlertTriangle className="h-3 w-3 text-red-500" />
              ) : (
                <CheckCircle className="h-3 w-3 text-green-500" />
              )}
              <span className="text-xs font-medium">Conflicts</span>
            </div>
            <p className="text-lg font-bold">{metrics.totalConflicts}</p>
          </div>

          <div className="p-2 bg-muted/50 rounded">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3 text-blue-500" />
              <span className="text-xs font-medium">Coverage</span>
            </div>
            <p className="text-lg font-bold">{metrics.coverageGaps}</p>
          </div>
        </div>

        {/* Efficiency Indicator */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Efficiency</span>
            <span className="text-xs text-muted-foreground">
              {metrics.efficiency}%
            </span>
          </div>
          <Progress value={metrics.efficiency} className="h-2" />
        </div>

        {/* Suggestions */}
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {suggestions.length > 0 ? (
              suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(suggestion.type)}
                      <span className="font-medium text-sm">
                        {suggestion.title}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        getSeverityColor(suggestion.severity),
                      )}
                    >
                      {suggestion.severity}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground mb-2">
                    {suggestion.description}
                  </p>

                  {/* Impact */}
                  <div className="mb-2 p-2 bg-background rounded text-xs">
                    <div className="font-medium mb-1">
                      {suggestion.impact.metric}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Current: {suggestion.impact.current}</span>
                      <span>Optimized: {suggestion.impact.optimized}</span>
                      <span className="text-green-600 font-medium">
                        +{suggestion.impact.improvement}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {suggestion.timeframe} •{" "}
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </div>

                    {suggestion.actionable && (
                      <Button
                        onClick={() => applyOptimization(suggestion)}
                        disabled={isOptimizing}
                        size="sm"
                        variant="outline"
                        className="text-xs h-6"
                      >
                        {isOptimizing ? (
                          <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          "Apply"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Analyzing schedule...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Schedule is optimized!
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
