import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { aiService, type WorkflowExecution, type WorkflowTemplate } from "@/services/aiService";
import {
    AlertCircle,
    BarChart3,
    CheckCircle,
    Clock,
    Download,
    Eye,
    Pause,
    Play,
    Plus,
    RefreshCw,
    Square,
    Users,
    Workflow,
    Zap
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  agent: string;
  tools: string[];
  depends_on?: string[];
  estimated_duration: number;
}

interface LocalWorkflowTemplate extends Omit<WorkflowTemplate, 'steps'> {
  category: "optimization" | "analysis" | "management" | "compliance";
  complexity: "low" | "medium" | "high";
  required_inputs: string[];
  agents_involved: string[];
  steps: WorkflowStep[];
}

interface ActiveWorkflow extends Omit<WorkflowExecution, 'status'> {
  status: "running" | "paused" | "completed" | "failed" | "pending";
  current_step?: string;
  completed_steps: string[];
  failed_steps: string[];
  results?: Record<string, string | number>;
}

export const WorkflowOrchestrator: React.FC = () => {
  const [workflowTemplates, setWorkflowTemplates] = useState<LocalWorkflowTemplate[]>([]);
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflow[]>([]);
  const [customParameters, setCustomParameters] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  const loadWorkflowTemplates = useCallback(async () => {
    try {
      const templates = await aiService.getWorkflowTemplates();
      // Convert API templates to local format
      const localTemplates: LocalWorkflowTemplate[] = templates.map(template => ({
        ...template,
        category: "optimization" as const,
        complexity: template.difficulty as "low" | "medium" | "high",
        required_inputs: ["start_date", "end_date"],
        agents_involved: ["ScheduleOptimizerAgent"],
        steps: []
      }));
      setWorkflowTemplates(localTemplates);
    } catch (error) {
      console.warn("Failed to load workflow templates from API, using mock data:", error);
      loadMockTemplates();
    }
  }, []);

  const loadActiveWorkflows = useCallback(async () => {
    try {
      const executions = await aiService.getWorkflowExecutions();
      const activeWorkflowsData: ActiveWorkflow[] = executions.map(execution => ({
        ...execution,
        completed_steps: [],
        failed_steps: []
      }));
      setActiveWorkflows(activeWorkflowsData);
    } catch (error) {
      console.warn("Failed to load active workflows from API:", error);
    }
  }, []);

  const loadMockTemplates = () => {
    // Fallback to mock templates
    setWorkflowTemplates([
      {
        id: "comprehensive_optimization",
        name: "Comprehensive Schedule Optimization",
        description: "Complete end-to-end schedule optimization including conflict resolution, coverage analysis, and workload balancing",
        category: "optimization",
        estimated_duration: 480, // 8 minutes
        difficulty: "high",
        complexity: "high",
        required_inputs: ["start_date", "end_date"],
        agents_involved: ["ScheduleOptimizerAgent", "EmployeeManagerAgent", "WorkflowCoordinator"],
        steps: [
          {
            id: "analyze_current",
            name: "Analyze Current Schedule",
            description: "Analyze existing schedule for conflicts and coverage gaps",
            agent: "ScheduleOptimizerAgent",
            tools: ["analyze_schedule_conflicts", "get_coverage_requirements"],
            estimated_duration: 120
          },
          {
            id: "employee_analysis",
            name: "Employee Availability Analysis",
            description: "Analyze employee availability and workload distribution",
            agent: "EmployeeManagerAgent",
            tools: ["get_employee_availability", "analyze_workload_distribution"],
            estimated_duration: 90
          },
          {
            id: "optimize_schedule",
            name: "Schedule Optimization",
            description: "Apply optimization algorithms to create improved schedule",
            agent: "ScheduleOptimizerAgent",
            tools: ["optimize_schedule_ai", "validate_constraints"],
            depends_on: ["analyze_current", "employee_analysis"],
            estimated_duration: 180
          },
          {
            id: "validate_results",
            name: "Validation & Quality Check",
            description: "Validate optimized schedule and ensure quality standards",
            agent: "WorkflowCoordinator",
            tools: ["validate_schedule", "check_coverage"],
            depends_on: ["optimize_schedule"],
            estimated_duration: 90
          }
        ]
      },
      {
        id: "employee_workload_analysis",
        name: "Employee Workload Analysis",
        description: "Analyze workload distribution across employees and identify imbalances",
        category: "analysis",
        estimated_duration: 240,
        difficulty: "medium",
        complexity: "medium",
        required_inputs: ["analysis_period"],
        agents_involved: ["EmployeeManagerAgent"],
        steps: [
          {
            id: "collect_data",
            name: "Collect Employee Data",
            description: "Gather current employee schedules and availability data",
            agent: "EmployeeManagerAgent",
            tools: ["get_employee_availability", "get_schedule_statistics"],
            estimated_duration: 60
          },
          {
            id: "analyze_workload",
            name: "Analyze Workload Distribution",
            description: "Calculate workload metrics and identify imbalances",
            agent: "EmployeeManagerAgent",
            tools: ["analyze_workload_distribution", "calculate_fairness_metrics"],
            depends_on: ["collect_data"],
            estimated_duration: 120
          },
          {
            id: "generate_recommendations",
            name: "Generate Recommendations",
            description: "Create actionable recommendations for workload balancing",
            agent: "EmployeeManagerAgent",
            tools: ["generate_workload_recommendations"],
            depends_on: ["analyze_workload"],
            estimated_duration: 60
          }
        ]
      }
    ]);

    // Mock active workflows
    setActiveWorkflows([
      {
        id: "exec_001",
        template_id: "comprehensive_optimization",
        name: "Comprehensive Schedule Optimization - June 2025",
        status: "running",
        progress: 65,
        start_time: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        end_time: undefined,
        inputs: { start_date: "2025-06-23", end_date: "2025-06-29" },
        current_step: "optimize_schedule",
        completed_steps: ["analyze_current", "employee_analysis"],
        failed_steps: []
      },
      {
        id: "exec_002",
        template_id: "employee_workload_analysis",
        name: "Employee Workload Analysis - Q2 2025",
        status: "completed",
        progress: 100,
        start_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        inputs: { analysis_period: "Q2 2025" },
        completed_steps: ["collect_data", "analyze_workload", "generate_recommendations"],
        failed_steps: [],
        results: {
          employees_analyzed: 12,
          imbalances_found: 3,
          recommendations_generated: 8
        }
      }
    ]);
  };

  useEffect(() => {
    loadWorkflowTemplates();
    loadActiveWorkflows();
  }, [loadWorkflowTemplates, loadActiveWorkflows]);

  const handleCreateWorkflow = async (templateId: string) => {
    setIsCreating(true);
    try {
      const template = workflowTemplates.find(t => t.id === templateId);
      if (!template) {
        throw new Error("Template not found");
      }

      const inputs = { ...customParameters };
      const execution = await aiService.executeWorkflow(templateId, inputs);
      
      const newActiveWorkflow: ActiveWorkflow = {
        ...execution,
        completed_steps: [],
        failed_steps: []
      };

      setActiveWorkflows(prev => [...prev, newActiveWorkflow]);
      toast.success(`Workflow "${template.name}" started successfully`);
    } catch (error) {
      console.error("Failed to create workflow:", error);
      toast.error("Failed to start workflow");
    } finally {
      setIsCreating(false);
    }
  };

  const handleWorkflowAction = async (workflowId: string, action: "pause" | "resume" | "stop") => {
    try {
      setActiveWorkflows(prev => prev.map(wf => 
        wf.id === workflowId 
          ? { 
              ...wf, 
              status: action === "pause" ? "paused" : action === "resume" ? "running" : "completed"
            }
          : wf
      ));
      
      toast.success(`Workflow ${action} successful`);
    } catch (error) {
      console.error(`Failed to ${action} workflow:`, error);
      toast.error(`Failed to ${action} workflow`);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "running":
        return "default";
      case "completed":
        return "secondary";
      case "failed":
        return "destructive";
      case "paused":
        return "outline";
      case "pending":
        return "outline";
      default:
        return "outline";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "optimization":
        return <Zap className="h-4 w-4" />;
      case "analysis":
        return <BarChart3 className="h-4 w-4" />;
      case "management":
        return <Users className="h-4 w-4" />;
      case "compliance":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Workflow className="h-4 w-4" />;
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case "low":
        return "text-green-600";
      case "medium":
        return "text-yellow-600";
      case "high":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workflow Orchestrator</h2>
          <p className="text-muted-foreground">
            Create and manage AI-powered workflows for schedule optimization and analysis
          </p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="active">Active Workflows</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4">
            {workflowTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {getCategoryIcon(template.category)}
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                    <Badge variant="outline" className={getComplexityColor(template.complexity)}>
                      {template.complexity}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>~{Math.ceil(template.estimated_duration / 60)} minutes</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{template.agents_involved.length} agents</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Steps:</Label>
                      <div className="space-y-1">
                        {template.steps.map((step, index) => (
                          <div key={step.id} className="flex items-center space-x-2 text-sm">
                            <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">
                              {index + 1}
                            </Badge>
                            <span>{step.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {template.required_inputs.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Required Inputs:</Label>
                        <div className="space-y-2">
                          {template.required_inputs.map((input) => (
                            <div key={input} className="flex items-center space-x-2">
                              <Label htmlFor={input} className="text-sm capitalize">
                                {input.replace(/_/g, ' ')}:
                              </Label>
                              <Textarea
                                id={input}
                                placeholder={`Enter ${input.replace(/_/g, ' ')}`}
                                value={customParameters[input] || ""}
                                onChange={(e) => setCustomParameters(prev => ({
                                  ...prev,
                                  [input]: e.target.value
                                }))}
                                className="flex-1 min-h-[32px] max-h-[80px]"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      <Button
                        onClick={() => handleCreateWorkflow(template.id)}
                        disabled={isCreating}
                        size="sm"
                      >
                        {isCreating ? (
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Start Workflow
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <div className="grid gap-4">
            {activeWorkflows.filter(wf => wf.status === "running" || wf.status === "paused" || wf.status === "pending").map((workflow) => (
              <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Workflow className="h-5 w-5" />
                        <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Started: {new Date(workflow.start_time).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(workflow.status)}>
                      {workflow.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{workflow.progress}%</span>
                      </div>
                      <Progress value={workflow.progress} className="w-full" />
                    </div>

                    {workflow.current_step && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Current: {workflow.current_step}</span>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      {workflow.status === "running" && (
                        <Button
                          onClick={() => handleWorkflowAction(workflow.id, "pause")}
                          variant="outline"
                          size="sm"
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                      )}
                      {workflow.status === "paused" && (
                        <Button
                          onClick={() => handleWorkflowAction(workflow.id, "resume")}
                          variant="outline"
                          size="sm"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Resume
                        </Button>
                      )}
                      <Button
                        onClick={() => handleWorkflowAction(workflow.id, "stop")}
                        variant="destructive"
                        size="sm"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {activeWorkflows.filter(wf => wf.status === "running" || wf.status === "paused" || wf.status === "pending").length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active workflows. Start a workflow from the Templates tab.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="grid gap-4">
            {activeWorkflows.filter(wf => wf.status === "completed" || wf.status === "failed").map((workflow) => (
              <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {workflow.status === "completed" ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Completed: {workflow.end_time ? new Date(workflow.end_time).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(workflow.status)}>
                      {workflow.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workflow.results && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Results:</Label>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(workflow.results).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export Results
                      </Button>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Run Again
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {activeWorkflows.filter(wf => wf.status === "completed" || wf.status === "failed").length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No workflow history available.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Details Modal would go here */}
    </div>
  );
};
