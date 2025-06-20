import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "optimization" | "analysis" | "management" | "compliance";
  estimated_duration: number;
  complexity: "low" | "medium" | "high";
  required_inputs: string[];
  agents_involved: string[];
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  agent: string;
  tools: string[];
  depends_on?: string[];
  estimated_duration: number;
}

interface ActiveWorkflow {
  id: string;
  template_id: string;
  name: string;
  status: "running" | "paused" | "completed" | "failed" | "pending";
  progress: number;
  started_at: Date;
  estimated_completion?: Date;
  current_step?: string;
  completed_steps: string[];
  failed_steps: string[];
  results?: Record<string, string | number>;
}

export const WorkflowOrchestrator: React.FC = () => {
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflow[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [customParameters, setCustomParameters] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Initialize workflow templates
    setWorkflowTemplates([
      {
        id: "comprehensive_optimization",
        name: "Comprehensive Schedule Optimization",
        description: "Complete end-to-end schedule optimization including conflict resolution, coverage analysis, and workload balancing",
        category: "optimization",
        estimated_duration: 480, // 8 minutes
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
            id: "optimization",
            name: "Schedule Optimization",
            description: "Generate optimized schedule based on analysis",
            agent: "ScheduleOptimizerAgent",
            tools: ["optimize_schedule_ai", "validate_constraints"],
            depends_on: ["analyze_current", "employee_analysis"],
            estimated_duration: 180
          },
          {
            id: "validation",
            name: "Final Validation",
            description: "Validate optimized schedule and generate report",
            agent: "WorkflowCoordinator",
            tools: ["validate_schedule", "generate_report"],
            depends_on: ["optimization"],
            estimated_duration: 90
          }
        ]
      },
      {
        id: "quick_conflict_resolution",
        name: "Quick Conflict Resolution",
        description: "Rapidly identify and resolve scheduling conflicts with minimal disruption",
        category: "optimization",
        estimated_duration: 180, // 3 minutes
        complexity: "medium",
        required_inputs: ["date_range"],
        agents_involved: ["ScheduleOptimizerAgent"],
        steps: [
          {
            id: "detect_conflicts",
            name: "Detect Conflicts",
            description: "Identify all scheduling conflicts in the specified period",
            agent: "ScheduleOptimizerAgent",
            tools: ["analyze_schedule_conflicts"],
            estimated_duration: 60
          },
          {
            id: "resolve_conflicts",
            name: "Resolve Conflicts",
            description: "Automatically resolve conflicts using available solutions",
            agent: "ScheduleOptimizerAgent",
            tools: ["resolve_conflicts", "reassign_shifts"],
            depends_on: ["detect_conflicts"],
            estimated_duration: 120
          }
        ]
      },
      {
        id: "workload_analysis",
        name: "Employee Workload Analysis",
        description: "Comprehensive analysis of employee workload distribution and recommendations",
        category: "analysis",
        estimated_duration: 240, // 4 minutes
        complexity: "medium",
        required_inputs: ["analysis_period"],
        agents_involved: ["EmployeeManagerAgent"],
        steps: [
          {
            id: "collect_data",
            name: "Collect Employee Data",
            description: "Gather employee availability and current assignments",
            agent: "EmployeeManagerAgent",
            tools: ["get_employee_availability", "get_current_assignments"],
            estimated_duration: 60
          },
          {
            id: "analyze_workload",
            name: "Analyze Workload Distribution",
            description: "Analyze current workload distribution patterns",
            agent: "EmployeeManagerAgent",
            tools: ["analyze_workload_distribution", "identify_imbalances"],
            depends_on: ["collect_data"],
            estimated_duration: 120
          },
          {
            id: "generate_recommendations",
            name: "Generate Recommendations",
            description: "Create actionable recommendations for workload improvement",
            agent: "EmployeeManagerAgent",
            tools: ["generate_workload_recommendations"],
            depends_on: ["analyze_workload"],
            estimated_duration: 60
          }
        ]
      },
      {
        id: "compliance_audit",
        name: "Compliance and Policy Audit",
        description: "Comprehensive audit of schedule compliance with labor laws and policies",
        category: "compliance",
        estimated_duration: 300, // 5 minutes
        complexity: "high",
        required_inputs: ["audit_period", "compliance_standards"],
        agents_involved: ["ScheduleOptimizerAgent", "EmployeeManagerAgent"],
        steps: [
          {
            id: "policy_check",
            name: "Policy Compliance Check",
            description: "Check schedule against company policies",
            agent: "ScheduleOptimizerAgent",
            tools: ["validate_policies", "check_break_requirements"],
            estimated_duration: 120
          },
          {
            id: "labor_law_check",
            name: "Labor Law Compliance",
            description: "Verify compliance with labor laws and regulations",
            agent: "EmployeeManagerAgent",
            tools: ["validate_labor_laws", "check_overtime_limits"],
            estimated_duration: 120
          },
          {
            id: "generate_audit_report",
            name: "Generate Audit Report",
            description: "Create comprehensive compliance audit report",
            agent: "WorkflowCoordinator",
            tools: ["generate_compliance_report"],
            depends_on: ["policy_check", "labor_law_check"],
            estimated_duration: 60
          }
        ]
      }
    ]);

    // Initialize active workflows
    setActiveWorkflows([
      {
        id: "wf_001",
        template_id: "comprehensive_optimization",
        name: "Weekly Schedule Optimization",
        status: "running",
        progress: 65,
        started_at: new Date(Date.now() - 5 * 60 * 1000),
        estimated_completion: new Date(Date.now() + 3 * 60 * 1000),
        current_step: "optimization",
        completed_steps: ["analyze_current", "employee_analysis"],
        failed_steps: []
      },
      {
        id: "wf_002",
        template_id: "workload_analysis",
        name: "Monthly Workload Review",
        status: "completed",
        progress: 100,
        started_at: new Date(Date.now() - 30 * 60 * 1000),
        completed_steps: ["collect_data", "analyze_workload", "generate_recommendations"],
        failed_steps: [],
        results: {
          employees_analyzed: 12,
          imbalances_found: 3,
          recommendations_generated: 8
        }
      }
    ]);
  }, []);

  const handleCreateWorkflow = async (templateId: string) => {
    setIsCreating(true);
    try {
      const template = workflowTemplates.find(t => t.id === templateId);
      if (!template) throw new Error("Template not found");

      const newWorkflow: ActiveWorkflow = {
        id: `wf_${Date.now()}`,
        template_id: templateId,
        name: `${template.name} - ${new Date().toLocaleString()}`,
        status: "pending",
        progress: 0,
        started_at: new Date(),
        estimated_completion: new Date(Date.now() + template.estimated_duration * 1000),
        completed_steps: [],
        failed_steps: []
      };

      setActiveWorkflows(prev => [newWorkflow, ...prev]);
      
      // Simulate workflow start
      setTimeout(() => {
        setActiveWorkflows(prev => prev.map(wf => 
          wf.id === newWorkflow.id 
            ? { ...wf, status: "running", current_step: template.steps[0].id }
            : wf
        ));
      }, 1000);

      toast.success(`Workflow "${template.name}" created and started`);
    } catch {
      toast.error("Failed to create workflow");
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
    } catch {
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
        return "text-green-500";
      case "medium":
        return "text-yellow-500";
      case "high":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Active Workflows
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="templates">
            <div className="space-y-6">
              {/* Template Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflowTemplates.map((template) => (
                  <Card 
                    key={template.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      selectedTemplate?.id === template.id && "ring-2 ring-primary"
                    )}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(template.category)}
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                        </div>
                        <Badge variant="outline" className={getComplexityColor(template.complexity)}>
                          {template.complexity}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-semibold">{formatDuration(template.estimated_duration)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Steps</p>
                          <p className="font-semibold">{template.steps.length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Agents</p>
                          <p className="font-semibold">{template.agents_involved.length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Category</p>
                          <p className="font-semibold capitalize">{template.category}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateWorkflow(template.id);
                          }}
                          disabled={isCreating}
                          className="flex-1"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Template Details */}
              {selectedTemplate && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getCategoryIcon(selectedTemplate.category)}
                      {selectedTemplate.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">{selectedTemplate.description}</p>
                    
                    {/* Workflow Steps */}
                    <div>
                      <h4 className="font-medium mb-3">Workflow Steps</h4>
                      <div className="space-y-3">
                        {selectedTemplate.steps.map((step, index) => (
                          <div key={step.id} className="flex items-start gap-3 p-3 rounded-lg border">
                            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{step.name}</p>
                                <Badge variant="outline" className="text-xs">
                                  {formatDuration(step.estimated_duration)}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{step.description}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Agent: {step.agent}</span>
                                <span>•</span>
                                <span>Tools: {step.tools.join(", ")}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Parameters */}
                    <div>
                      <h4 className="font-medium mb-3">Required Parameters</h4>
                      <div className="space-y-3">
                        {selectedTemplate.required_inputs.map((input) => (
                          <div key={input} className="space-y-2">
                            <Label htmlFor={input} className="text-sm">
                              {input.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </Label>
                            <Textarea
                              id={input}
                              placeholder={`Enter ${input.replace(/_/g, " ")}`}
                              value={customParameters[input] || ""}
                              onChange={(e) => setCustomParameters(prev => ({
                                ...prev,
                                [input]: e.target.value
                              }))}
                              className="h-20"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button 
                      onClick={() => handleCreateWorkflow(selectedTemplate.id)}
                      disabled={isCreating}
                      className="w-full"
                    >
                      {isCreating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Creating Workflow...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Create and Start Workflow
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="active">
            <div className="space-y-4">
              {activeWorkflows.filter(wf => wf.status === "running" || wf.status === "paused" || wf.status === "pending").map((workflow) => {
                const template = workflowTemplates.find(t => t.id === workflow.template_id);
                return (
                  <Card key={workflow.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Workflow className="h-5 w-5" />
                          <CardTitle className="text-lg">{workflow.name}</CardTitle>
                        </div>
                        <Badge variant={getStatusBadgeVariant(workflow.status)}>
                          {workflow.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{workflow.progress}%</span>
                        </div>
                        <Progress value={workflow.progress} className="h-2" />
                      </div>

                      {/* Current Step */}
                      {workflow.current_step && template && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Current Step:</p>
                          {template.steps.map((step) => (
                            <div
                              key={step.id}
                              className={cn(
                                "p-2 rounded border text-sm",
                                workflow.current_step === step.id
                                  ? "bg-primary/10 border-primary"
                                  : workflow.completed_steps.includes(step.id)
                                  ? "bg-green-50 border-green-200"
                                  : workflow.failed_steps.includes(step.id)
                                  ? "bg-red-50 border-red-200"
                                  : "bg-muted/50"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{step.name}</span>
                                {workflow.completed_steps.includes(step.id) && (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                )}
                                {workflow.failed_steps.includes(step.id) && (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )}
                                {workflow.current_step === step.id && (
                                  <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                                )}
                              </div>
                              <p className="text-muted-foreground mt-1">{step.description}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Timing */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Started</p>
                          <p className="font-medium">
                            {workflow.started_at.toLocaleTimeString()}
                          </p>
                        </div>
                        {workflow.estimated_completion && (
                          <div>
                            <p className="text-muted-foreground">ETA</p>
                            <p className="font-medium">
                              {workflow.estimated_completion.toLocaleTimeString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {workflow.status === "running" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWorkflowAction(workflow.id, "pause")}
                          >
                            <Pause className="h-3 w-3 mr-1" />
                            Pause
                          </Button>
                        )}
                        {workflow.status === "paused" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWorkflowAction(workflow.id, "resume")}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Resume
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleWorkflowAction(workflow.id, "stop")}
                        >
                          <Square className="h-3 w-3 mr-1" />
                          Stop
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="h-3 w-3 mr-1" />
                          Export
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Workflow History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {activeWorkflows.filter(wf => wf.status === "completed" || wf.status === "failed").map((workflow) => (
                      <div key={workflow.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Workflow className="h-4 w-4" />
                            <span className="font-medium">{workflow.name}</span>
                          </div>
                          <Badge variant={getStatusBadgeVariant(workflow.status)}>
                            {workflow.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Started</p>
                            <p>{workflow.started_at.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Duration</p>
                            <p>
                              {workflow.estimated_completion 
                                ? Math.round((workflow.estimated_completion.getTime() - workflow.started_at.getTime()) / 1000)
                                : "N/A"
                              }s
                            </p>
                          </div>
                        </div>

                        {workflow.results && (
                          <div className="text-sm">
                            <p className="font-medium">Results:</p>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                              {Object.entries(workflow.results).map(([key, value]) => (
                                <div key={key}>
                                  <p className="text-muted-foreground text-xs">
                                    {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                                  </p>
                                  <p className="font-semibold">{String(value)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            View Details
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="h-3 w-3 mr-1" />
                            Download Report
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
