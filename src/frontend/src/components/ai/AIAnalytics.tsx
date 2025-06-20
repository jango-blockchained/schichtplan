import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar, 
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  Activity,
  Zap,
  Download,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  change: number;
  trend: "up" | "down" | "stable";
  description: string;
  category: "performance" | "usage" | "quality" | "efficiency";
}

interface AIInsight {
  id: string;
  title: string;
  description: string;
  type: "optimization" | "warning" | "success" | "info";
  confidence: number;
  impact: "high" | "medium" | "low";
  recommended_actions: string[];
  generated_at: Date;
}

export const AIAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");

  useEffect(() => {
    // Initialize analytics data
    setMetrics([
      {
        id: "ai_response_time",
        name: "AI Response Time",
        value: 2.3,
        unit: "seconds",
        change: -12.5,
        trend: "down",
        description: "Average response time for AI requests",
        category: "performance"
      },
      {
        id: "optimization_success_rate",
        name: "Optimization Success Rate",
        value: 96.8,
        unit: "%",
        change: 4.2,
        trend: "up",
        description: "Percentage of successful schedule optimizations",
        category: "quality"
      },
      {
        id: "agent_utilization",
        name: "Agent Utilization",
        value: 78.5,
        unit: "%",
        change: 8.3,
        trend: "up",
        description: "Average utilization across all AI agents",
        category: "efficiency"
      },
      {
        id: "workflow_completion_rate",
        name: "Workflow Completion Rate",
        value: 94.2,
        unit: "%",
        change: -2.1,
        trend: "down",
        description: "Percentage of workflows completed successfully",
        category: "quality"
      },
      {
        id: "user_satisfaction",
        name: "User Satisfaction",
        value: 4.7,
        unit: "/5",
        change: 6.8,
        trend: "up",
        description: "Average user satisfaction rating",
        category: "quality"
      },
      {
        id: "cost_per_optimization",
        name: "Cost per Optimization",
        value: 0.23,
        unit: "€",
        change: -15.2,
        trend: "down",
        description: "Average cost per schedule optimization",
        category: "efficiency"
      },
      {
        id: "conflicts_resolved",
        name: "Conflicts Resolved",
        value: 247,
        unit: "conflicts",
        change: 23.4,
        trend: "up",
        description: "Total conflicts resolved this period",
        category: "performance"
      },
      {
        id: "processing_accuracy",
        name: "Processing Accuracy",
        value: 99.2,
        unit: "%",
        change: 1.8,
        trend: "up",
        description: "Accuracy of AI processing and recommendations",
        category: "quality"
      }
    ]);

    setInsights([
      {
        id: "insight_001",
        title: "Schedule Optimization Opportunity",
        description: "Analysis shows 15% improvement potential in workload distribution for next week. Implementing recommended changes could reduce overtime costs by €320.",
        type: "optimization",
        confidence: 0.89,
        impact: "high",
        recommended_actions: [
          "Redistribute 8 shifts from high-workload employees",
          "Utilize cross-trained employees for better coverage",
          "Implement suggested break time optimizations"
        ],
        generated_at: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        id: "insight_002",
        title: "Agent Performance Alert",
        description: "ScheduleOptimizerAgent showing increased response times (avg 3.2s vs normal 2.1s). May indicate capacity limits or need for optimization.",
        type: "warning",
        confidence: 0.76,
        impact: "medium",
        recommended_actions: [
          "Review agent workload distribution",
          "Consider scaling agent resources",
          "Analyze recent complex requests"
        ],
        generated_at: new Date(Date.now() - 4 * 60 * 60 * 1000)
      },
      {
        id: "insight_003",
        title: "Employee Satisfaction Trend",
        description: "Employee satisfaction with AI-generated schedules has increased by 12% this month. Positive feedback indicates effective preference matching.",
        type: "success",
        confidence: 0.94,
        impact: "high",
        recommended_actions: [
          "Continue current optimization strategies",
          "Document successful patterns for replication",
          "Consider expanding preference-based optimization"
        ],
        generated_at: new Date(Date.now() - 6 * 60 * 60 * 1000)
      },
      {
        id: "insight_004",
        title: "Workflow Efficiency Improvement",
        description: "Comprehensive optimization workflows are completing 18% faster due to recent agent coordination improvements.",
        type: "info",
        confidence: 0.82,
        impact: "medium",
        recommended_actions: [
          "Monitor continued performance improvements",
          "Apply coordination patterns to other workflows",
          "Update workflow templates with optimizations"
        ],
        generated_at: new Date(Date.now() - 8 * 60 * 60 * 1000)
      }
    ]);
  }, []);

  const handleRefreshData = async () => {
    setIsLoading(true);
    try {
      // Simulate data refresh
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update metrics with new values
      setMetrics(prev => prev.map(metric => ({
        ...metric,
        value: metric.value + (Math.random() - 0.5) * metric.value * 0.1,
        change: (Math.random() - 0.5) * 20
      })));
      
      toast.success("Analytics data refreshed");
    } catch {
      toast.error("Failed to refresh data");
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "optimization":
        return <Target className="h-5 w-5 text-blue-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "info":
        return <Activity className="h-5 w-5 text-blue-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getInsightBadgeVariant = (type: string) => {
    switch (type) {
      case "optimization":
        return "default";
      case "warning":
        return "destructive";
      case "success":
        return "secondary";
      case "info":
        return "outline";
      default:
        return "outline";
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-yellow-500";
      case "low":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "performance":
        return <Zap className="h-4 w-4" />;
      case "quality":
        return <CheckCircle className="h-4 w-4" />;
      case "efficiency":
        return <Target className="h-4 w-4" />;
      case "usage":
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === "%" || unit === "/5") {
      return value.toFixed(1);
    } else if (unit === "€") {
      return value.toFixed(2);
    } else if (unit === "seconds") {
      return value.toFixed(1);
    } else {
      return Math.round(value).toString();
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Analytics & Insights</h2>
          <p className="text-muted-foreground">
            Real-time analytics and AI-generated insights for your scheduling system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTimeRange("24h")} 
                  className={cn(timeRange === "24h" && "bg-primary text-primary-foreground")}>
            24h
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTimeRange("7d")}
                  className={cn(timeRange === "7d" && "bg-primary text-primary-foreground")}>
            7d
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTimeRange("30d")}
                  className={cn(timeRange === "30d" && "bg-primary text-primary-foreground")}>
            30d
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefreshData} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {metrics.slice(0, 4).map((metric) => (
                <Card key={metric.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(metric.category)}
                        <span className="text-sm font-medium">{metric.name}</span>
                      </div>
                      {getTrendIcon(metric.trend)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">
                        {formatValue(metric.value, metric.unit)} {metric.unit}
                      </p>
                      <div className="flex items-center gap-1 text-sm">
                        <span className={cn(
                          metric.change > 0 ? "text-green-500" : metric.change < 0 ? "text-red-500" : "text-gray-500"
                        )}>
                          {metric.change > 0 ? "+" : ""}{metric.change.toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground">vs last period</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* AI Insights Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Latest AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.slice(0, 3).map((insight) => (
                    <div key={insight.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{insight.title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getImpactColor(insight.impact)}>
                              {insight.impact} impact
                            </Badge>
                            <Badge variant={getInsightBadgeVariant(insight.type)}>
                              {insight.type}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{insight.description}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Confidence: {Math.round(insight.confidence * 100)}%</span>
                          <span>{formatTimestamp(insight.generated_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {metrics.filter(m => m.category === "performance").map((metric) => (
                      <div key={metric.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{metric.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {formatValue(metric.value, metric.unit)} {metric.unit}
                            </span>
                            {getTrendIcon(metric.trend)}
                          </div>
                        </div>
                        <Progress value={metric.value} className="h-2" />
                        <p className="text-xs text-muted-foreground">{metric.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quality Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Quality Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {metrics.filter(m => m.category === "quality").map((metric) => (
                      <div key={metric.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{metric.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {formatValue(metric.value, metric.unit)} {metric.unit}
                            </span>
                            {getTrendIcon(metric.trend)}
                          </div>
                        </div>
                        <Progress value={metric.value} className="h-2" />
                        <p className="text-xs text-muted-foreground">{metric.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Efficiency Metrics */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Efficiency Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {metrics.filter(m => m.category === "efficiency").map((metric) => (
                      <div key={metric.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{metric.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {formatValue(metric.value, metric.unit)} {metric.unit}
                            </span>
                            {getTrendIcon(metric.trend)}
                          </div>
                        </div>
                        <Progress value={metric.value} className="h-2" />
                        <p className="text-xs text-muted-foreground">{metric.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights">
            <div className="space-y-4">
              {insights.map((insight) => (
                <Card key={insight.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getInsightIcon(insight.type)}
                        <CardTitle className="text-lg">{insight.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getImpactColor(insight.impact)}>
                          {insight.impact} impact
                        </Badge>
                        <Badge variant={getInsightBadgeVariant(insight.type)}>
                          {insight.type}
                        </Badge>
                        <Badge variant="outline">
                          {Math.round(insight.confidence * 100)}% confidence
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">{insight.description}</p>
                    
                    <div>
                      <h4 className="font-medium mb-2">Recommended Actions:</h4>
                      <ul className="space-y-1">
                        {insight.recommended_actions.map((action, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground pt-3 border-t">
                      <span>Generated {formatTimestamp(insight.generated_at)}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                        <Button size="sm">
                          Apply Recommendations
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="trends">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                      <p>Performance trend chart would be displayed here</p>
                      <p className="text-sm">Integration with chart library needed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Usage Patterns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-2" />
                      <p>Usage pattern chart would be displayed here</p>
                      <p className="text-sm">Integration with chart library needed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Response Time Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-2" />
                      <p>Response time trend chart would be displayed here</p>
                      <p className="text-sm">Integration with chart library needed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
