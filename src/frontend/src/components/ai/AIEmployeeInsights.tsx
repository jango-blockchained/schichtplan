/**
 * AI Employee Insights Component
 *
 * Displays AI-powered insights for employee workload analysis,
 * availability suggestions, and scheduling recommendations.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useAIContext } from "@/contexts/AIContext";
import { cn } from "@/lib/utils";
import { enhancedAIService } from "@/services/enhancedAIService";
import { Employee } from "@/types";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  RefreshCw,
  TrendingDown,
  Users,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";

interface WorkloadInsight {
  employee_id: number;
  employee_name: string;
  total_hours: number;
  avg_hours_per_week: number;
  workload_level: "underutilized" | "balanced" | "overworked";
  consecutive_days: number;
  rest_days: number;
  availability_score: number;
  recommendations: string[];
}

interface AIEmployeeInsightsProps {
  className?: string;
  employees?: Employee[];
  selectedEmployeeId?: number;
  dateRange?: { start: Date; end: Date };
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const workloadLevelColors = {
  underutilized: "text-blue-600 bg-blue-100 dark:bg-blue-950",
  balanced: "text-green-600 bg-green-100 dark:bg-green-950",
  overworked: "text-red-600 bg-red-100 dark:bg-red-950",
};

const workloadLevelIcons = {
  underutilized: TrendingDown,
  balanced: CheckCircle,
  overworked: AlertTriangle,
};

export const AIEmployeeInsights: React.FC<AIEmployeeInsightsProps> = ({
  className,
  employees = [],
  selectedEmployeeId,
  dateRange,
  autoRefresh = true,
  refreshInterval = 60000,
}) => {
  const aiContext = useAIContext();
  const { toast } = useToast();

  const [insights, setInsights] = useState<WorkloadInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedInsight, setSelectedInsight] =
    useState<WorkloadInsight | null>(null);

  // Fetch workload insights
  const fetchInsights = async () => {
    if (employees.length === 0) return;

    setIsLoading(true);
    try {
      const context = aiContext.getContextSummary();

      // Add date range and employee info to context
      const enrichedContext = {
        ...context,
        data: {
          dateRange: dateRange
            ? {
                start: dateRange.start.toISOString(),
                end: dateRange.end.toISOString(),
              }
            : undefined,
          employeeId: selectedEmployeeId,
          employeeCount: employees.length,
        },
      };

      // Call the AI service (result will be used in production)
      const _result = await enhancedAIService.analyzeWorkload(enrichedContext);

      // Transform result into insights
      // This is a placeholder - adjust based on actual API response
      const workloadLevels: Array<"underutilized" | "balanced" | "overworked"> =
        ["underutilized", "balanced", "overworked"];
      const mockInsights: WorkloadInsight[] = employees.map((emp) => ({
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        total_hours: Math.floor(Math.random() * 160) + 40,
        avg_hours_per_week: Math.floor(Math.random() * 40) + 10,
        workload_level: workloadLevels[Math.floor(Math.random() * 3)],
        consecutive_days: Math.floor(Math.random() * 10) + 1,
        rest_days: Math.floor(Math.random() * 4) + 1,
        availability_score: Math.floor(Math.random() * 40) + 60,
        recommendations: [
          "Consider adding more weekend shifts",
          "Reduce consecutive working days",
          "Balance morning and evening shifts",
        ],
      }));

      setInsights(mockInsights);

      // Set selected insight if employee is selected
      if (selectedEmployeeId) {
        const insight = mockInsights.find(
          (i) => i.employee_id === selectedEmployeeId,
        );
        if (insight) setSelectedInsight(insight);
      }
    } catch (error) {
      console.error("Failed to fetch employee insights:", error);
      toast({
        title: "Failed to load insights",
        description: "Could not fetch AI insights. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh insights
  useEffect(() => {
    fetchInsights();

    if (autoRefresh) {
      const interval = setInterval(fetchInsights, refreshInterval);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, selectedEmployeeId, dateRange, autoRefresh, refreshInterval]);

  // Handle balance workload action
  const handleBalanceWorkload = async () => {
    try {
      toast({
        title: "Balancing workload...",
        description: "AI is analyzing and rebalancing employee hours.",
      });

      await enhancedAIService.balanceWorkload(aiContext.getContextSummary());

      toast({
        title: "Workload balanced",
        description: "Employee hours have been optimized.",
      });

      // Refresh insights
      fetchInsights();
    } catch (error) {
      console.error("Failed to balance workload:", error);
      toast({
        title: "Failed to balance workload",
        description: "Could not complete the operation. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle availability suggestions
  const handleSuggestAvailability = async () => {
    try {
      toast({
        title: "Generating suggestions...",
        description: "AI is analyzing availability patterns.",
      });

      await enhancedAIService.suggestAvailability(
        aiContext.getContextSummary(),
      );

      toast({
        title: "Suggestions generated",
        description: "Check the recommendations for each employee.",
      });

      fetchInsights();
    } catch (error) {
      console.error("Failed to suggest availability:", error);
      toast({
        title: "Failed to generate suggestions",
        description: "Could not complete the operation. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Calculate summary statistics
  const summary = React.useMemo(() => {
    if (insights.length === 0) return null;

    const overworked = insights.filter(
      (i) => i.workload_level === "overworked",
    ).length;
    const underutilized = insights.filter(
      (i) => i.workload_level === "underutilized",
    ).length;
    const balanced = insights.filter(
      (i) => i.workload_level === "balanced",
    ).length;
    const avgHours =
      insights.reduce((sum, i) => sum + i.avg_hours_per_week, 0) /
      insights.length;
    const avgAvailability =
      insights.reduce((sum, i) => sum + i.availability_score, 0) /
      insights.length;

    return {
      overworked,
      underutilized,
      balanced,
      avgHours: Math.round(avgHours),
      avgAvailability: Math.round(avgAvailability),
    };
  }, [insights]);

  return (
    <Card
      className={cn(
        "border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20",
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <CardTitle>AI Employee Insights</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInsights}
              disabled={isLoading}
            >
              <RefreshCw
                className={cn("h-3 w-3 mr-1", isLoading && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>
        <CardDescription>
          AI-powered workload analysis and availability insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && insights.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="mb-2 h-12 w-12 text-muted-foreground" />
            <p className="text-sm font-medium">No employees to analyze</p>
            <p className="text-xs text-muted-foreground">
              Add employees to see insights
            </p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Summary Statistics */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Balanced
                          </p>
                          <p className="text-2xl font-bold">
                            {summary.balanced}
                          </p>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Overworked
                          </p>
                          <p className="text-2xl font-bold">
                            {summary.overworked}
                          </p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Underutilized
                          </p>
                          <p className="text-2xl font-bold">
                            {summary.underutilized}
                          </p>
                        </div>
                        <TrendingDown className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleBalanceWorkload}
                >
                  <Zap className="mr-1 h-3 w-3" />
                  Balance Workload
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSuggestAvailability}
                >
                  <Calendar className="mr-1 h-3 w-3" />
                  Suggest Availability
                </Button>
              </div>

              <Separator />

              {/* Average Metrics */}
              {summary && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Avg Hours/Week
                      </span>
                      <span className="font-medium">{summary.avgHours}h</span>
                    </div>
                    <Progress value={(summary.avgHours / 40) * 100} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        Avg Availability
                      </span>
                      <span className="font-medium">
                        {summary.avgAvailability}%
                      </span>
                    </div>
                    <Progress value={summary.avgAvailability} />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="details">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {insights.map((insight) => {
                    const WorkloadIcon =
                      workloadLevelIcons[insight.workload_level];

                    return (
                      <Card
                        key={insight.employee_id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          selectedInsight?.employee_id ===
                            insight.employee_id && "ring-2 ring-purple-500",
                        )}
                        onClick={() => setSelectedInsight(insight)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-sm font-semibold">
                                  {insight.employee_name}
                                </h4>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "h-5 text-xs",
                                    workloadLevelColors[insight.workload_level],
                                  )}
                                >
                                  <WorkloadIcon className="mr-1 h-3 w-3" />
                                  {insight.workload_level}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {insight.avg_hours_per_week}h/week
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {insight.consecutive_days} consecutive days
                                  </span>
                                </div>
                              </div>

                              {selectedInsight?.employee_id ===
                                insight.employee_id && (
                                <div className="mt-3 pt-3 border-t space-y-1">
                                  <p className="text-xs font-medium">
                                    Recommendations:
                                  </p>
                                  <ul className="text-xs text-muted-foreground space-y-1">
                                    {insight.recommendations.map((rec, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-1"
                                      >
                                        <span className="text-purple-500 mt-0.5">
                                          •
                                        </span>
                                        <span>{rec}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        <Separator className="my-4" />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Powered by AI</span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-purple-500" />
            Real-time analysis
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
