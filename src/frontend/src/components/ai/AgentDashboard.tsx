import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { aiService, type Agent } from "@/services/aiService";
import {
    Activity,
    AlertCircle,
    BarChart3,
    Bot,
    Calendar,
    CheckCircle,
    Clock,
    MessageSquare,
    Pause,
    Play,
    RefreshCw,
    Settings,
    TrendingUp,
    Users,
    Workflow,
    Zap
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface AgentInteraction {
  id: string;
  agent_id: string;
  request: string;
  response: string;
  timestamp: Date;
  duration: number;
  status: "success" | "error";
  tools_used: string[];
}

interface LocalAgent extends Agent {
  current_task?: {
    id: string;
    description: string;
    progress: number;
    estimated_completion: Date;
  };
  metrics: {
    requests_today: number;
    success_rate_24h: number;
    avg_response_time_24h: number;
  };
}

export const AgentDashboard: React.FC = () => {
  const [agents, setAgents] = useState<LocalAgent[]>([]);
  const [recentInteractions, setRecentInteractions] = useState<AgentInteraction[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<LocalAgent | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiAgents = await aiService.getAgents();
      // Convert API agents to local format with additional fields
      const localAgents: LocalAgent[] = apiAgents.map(agent => ({
        ...agent,
        metrics: {
          requests_today: Math.floor(Math.random() * 100),
          success_rate_24h: agent.performance.success_rate,
          avg_response_time_24h: agent.performance.avg_response_time
        }
      }));
      setAgents(localAgents);
    } catch (error) {
      console.warn("Failed to load agents from API, using mock data:", error);
      // Fallback to mock data
      loadMockAgents();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMockAgents = () => {
    // Fallback mock data
    setAgents([
      {
        id: "schedule_optimizer",
        name: "Schedule Optimizer Agent",
        type: "schedule_optimizer",
        status: "active",
        description: "Specialized in schedule optimization, conflict resolution, and workload balancing",
        capabilities: [
          "Schedule Conflict Detection",
          "Workload Optimization",
          "Coverage Analysis",
          "Constraint Validation",
          "Employee Assignment"
        ],
        performance: {
          total_requests: 1247,
          successful_requests: 1205,
          average_response_time: 2.3,
          uptime_percentage: 99.2,
          last_activity: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
        },
        current_task: {
          id: "opt_001",
          description: "Optimizing weekly schedule for conflicts",
          progress: 75,
          estimated_completion: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes from now
        },
        metrics: {
          requests_today: 23,
          success_rate_24h: 96.5,
          avg_response_time_24h: 2.1
        }
      },
      {
        id: "employee_manager",
        name: "Employee Manager Agent",
        type: "employee_manager",
        status: "active",
        description: "Manages employee availability, preferences, and workload distribution",
        capabilities: [
          "Availability Analysis",
          "Workload Distribution",
          "Preference Management",
          "Fair Assignment",
          "Skills Matching"
        ],
        performance: {
          total_requests: 892,
          successful_requests: 847,
          average_response_time: 1.8,
          uptime_percentage: 98.7,
          last_activity: new Date(Date.now() - 12 * 60 * 1000) // 12 minutes ago
        },
        metrics: {
          requests_today: 18,
          success_rate_24h: 94.8,
          avg_response_time_24h: 1.9
        }
      },
      {
        id: "workflow_coordinator",
        name: "Workflow Coordinator",
        type: "workflow_coordinator",
        status: "processing",
        description: "Orchestrates multi-step workflows and coordinates between agents",
        capabilities: [
          "Workflow Orchestration",
          "Agent Coordination",
          "Task Sequencing",
          "Decision Logic",
          "Error Recovery"
        ],
        performance: {
          total_requests: 456,
          successful_requests: 441,
          average_response_time: 4.2,
          uptime_percentage: 97.8,
          last_activity: new Date()
        },
        current_task: {
          id: "wf_003",
          description: "Running comprehensive optimization workflow",
          progress: 45,
          estimated_completion: new Date(Date.now() + 8 * 60 * 1000) // 8 minutes from now
        },
        metrics: {
          requests_today: 7,
          success_rate_24h: 98.2,
          avg_response_time_24h: 3.8
        }
      }
    ]);

    // Initialize recent interactions
    setRecentInteractions([
      {
        id: "int_001",
        agent_id: "schedule_optimizer",
        request: "Optimize schedule for next week",
        response: "Successfully optimized schedule with 3 conflict resolutions",
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        duration: 2.3,
        status: "success",
        tools_used: ["analyze_schedule_conflicts", "optimize_coverage"]
      },
      {
        id: "int_002",
        agent_id: "employee_manager",
        request: "Analyze workload distribution",
        response: "Identified workload imbalances, recommended redistributions",
        timestamp: new Date(Date.now() - 12 * 60 * 1000),
        duration: 1.8,
        status: "success",
        tools_used: ["get_employee_availability", "analyze_workload"]
      },
      {
        id: "int_003",
        agent_id: "workflow_coordinator",
        request: "Execute comprehensive optimization",
        response: "Workflow in progress: 45% complete",
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        duration: 0.5,
        status: "success",
        tools_used: ["execute_workflow", "coordinate_agents"]
      }
    ]);
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleToggleAgent = async (agentId: string, enabled: boolean) => {
    try {
      await aiService.toggleAgent(agentId, enabled);
      await loadAgents(); // Reload agents
      toast.success(`Agent ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error("Failed to toggle agent:", error);
      toast.error("Failed to toggle agent");
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "processing":
        return "secondary";
      case "idle":
        return "outline";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case "schedule_optimizer":
        return <Calendar className="h-5 w-5" />;
      case "employee_manager":
        return <Users className="h-5 w-5" />;
      case "workflow_coordinator":
        return <Workflow className="h-5 w-5" />;
      case "analytics":
        return <BarChart3 className="h-5 w-5" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  const handleAgentAction = async (agentId: string, action: "start" | "pause" | "restart") => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAgents(prev => prev.map(agent => 
        agent.id === agentId 
          ? { 
              ...agent, 
              status: action === "pause" ? "idle" : "active",
              performance: {
                ...agent.performance,
                last_activity: new Date()
              }
            }
          : agent
      ));
      
      toast.success(`Agent ${action} successful`);
    } catch {
      toast.error(`Failed to ${action} agent`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    }).format(timestamp);
  };

  const formatDuration = (seconds: number) => {
    return `${seconds.toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Agent Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Card 
            key={agent.id} 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selectedAgent?.id === agent.id && "ring-2 ring-primary"
            )}
            onClick={() => setSelectedAgent(agent)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getAgentIcon(agent.type)}
                  <CardTitle className="text-sm">{agent.name}</CardTitle>
                </div>
                <Badge variant={getStatusBadgeVariant(agent.status)}>
                  {agent.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {agent.description}
              </p>
              
              {/* Current Task */}
              {agent.current_task && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Current Task</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {agent.current_task.description}
                  </p>
                  <Progress value={agent.current_task.progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{agent.current_task.progress}% complete</span>
                    <span>{formatTimestamp(agent.current_task.estimated_completion)}</span>
                  </div>
                </div>
              )}

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Success Rate</p>
                  <p className="font-semibold">{agent.metrics.success_rate_24h}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Avg Response</p>
                  <p className="font-semibold">{agent.metrics.avg_response_time_24h}s</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Requests Today</p>
                  <p className="font-semibold">{agent.metrics.requests_today}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Uptime</p>
                  <p className="font-semibold">{agent.performance.uptime_percentage}%</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAgentAction(agent.id, agent.status === "active" ? "pause" : "start");
                  }}
                  disabled={isLoading}
                >
                  {agent.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAgentAction(agent.id, "restart");
                  }}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle settings
                  }}
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed View */}
      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="interactions" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Recent Interactions
          </TabsTrigger>
          <TabsTrigger value="capabilities" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Capabilities
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="performance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>System Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {agents.map((agent) => (
                    <div key={agent.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getAgentIcon(agent.type)}
                          <span className="text-sm font-medium">{agent.name}</span>
                        </div>
                        <Badge variant="outline">
                          {agent.performance.uptime_percentage}% uptime
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Total Requests</p>
                          <p className="font-semibold">{agent.performance.total_requests}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Success Rate</p>
                          <p className="font-semibold">
                            {Math.round((agent.performance.successful_requests / agent.performance.total_requests) * 100)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Response</p>
                          <p className="font-semibold">{agent.performance.average_response_time}s</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Active Tasks */}
              <Card>
                <CardHeader>
                  <CardTitle>Active Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {agents.filter(agent => agent.current_task).map((agent) => (
                      <div key={agent.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getAgentIcon(agent.type)}
                            <span className="text-sm font-medium">{agent.name}</span>
                          </div>
                          <Badge variant="secondary">
                            {agent.current_task!.progress}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {agent.current_task!.description}
                        </p>
                        <Progress value={agent.current_task!.progress} className="h-2" />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>ETA: {formatTimestamp(agent.current_task!.estimated_completion)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="interactions">
            <Card>
              <CardHeader>
                <CardTitle>Recent Agent Interactions</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {recentInteractions.map((interaction) => {
                      const agent = agents.find(a => a.id === interaction.agent_id);
                      return (
                        <div key={interaction.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {agent && getAgentIcon(agent.type)}
                              <span className="font-medium">{agent?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {interaction.status === "success" ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              <Badge variant="outline">
                                {formatDuration(interaction.duration)}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium">Request:</p>
                              <p className="text-sm text-muted-foreground">{interaction.request}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Response:</p>
                              <p className="text-sm text-muted-foreground">{interaction.response}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Settings className="h-3 w-3" />
                              <span>Tools: {interaction.tools_used.join(", ")}</span>
                            </div>
                            <span>{formatTimestamp(interaction.timestamp)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capabilities">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {agents.map((agent) => (
                <Card key={agent.id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      {getAgentIcon(agent.type)}
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {agent.description}
                    </p>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-2">Capabilities:</h4>
                      <div className="space-y-1">
                        {agent.capabilities.map((capability, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="text-sm">{capability}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge variant={getStatusBadgeVariant(agent.status)}>
                          {agent.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
