import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  aiService,
  type WorkflowExecution,
  type WorkflowStep,
  type WorkflowTemplate,
} from "@/services/aiService";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Pause,
  Play,
  Square,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

interface WorkflowExecutorProps {
  className?: string;
}

interface ExecutionState {
  templates: WorkflowTemplate[];
  executions: WorkflowExecution[];
  currentExecution: WorkflowExecution | null;
  steps: WorkflowStep[];
  isLoading: boolean;
}

export const WorkflowExecutor: React.FC<WorkflowExecutorProps> = ({
  className,
}) => {
  const [state, setState] = useState<ExecutionState>({
    templates: [],
    executions: [],
    currentExecution: null,
    steps: [],
    isLoading: false,
  });

  const [selectedTemplate, setSelectedTemplate] =
    useState<WorkflowTemplate | null>(null);
  const [executionInputs, setExecutionInputs] = useState<
    Record<string, unknown>
  >({});

  useEffect(() => {
    loadTemplates();
    loadExecutions();
  }, []);

  useEffect(() => {
    // Subscribe to live workflow updates
    const handleWorkflowUpdate = (data: {
      execution_id: string;
      status: string;
      progress: number;
      step_id?: string;
      step_status?: string;
    }) => {
      setState((prev) => ({
        ...prev,
        executions: prev.executions.map((exec) =>
          exec.id === data.execution_id
            ? { ...exec, status: data.status as any, progress: data.progress }
            : exec,
        ),
        currentExecution:
          prev.currentExecution?.id === data.execution_id
            ? {
                ...prev.currentExecution,
                status: data.status as any,
                progress: data.progress,
              }
            : prev.currentExecution,
      }));

      if (data.step_id && state.currentExecution?.id === data.execution_id) {
        loadWorkflowSteps(data.execution_id);
      }
    };

    aiService.on("ws:workflow_progress", handleWorkflowUpdate);

    return () => {
      aiService.off("ws:workflow_progress", handleWorkflowUpdate);
    };
  }, [state.currentExecution?.id]);

  const loadTemplates = async () => {
    try {
      const templates = await aiService.getWorkflowTemplates();
      setState((prev) => ({ ...prev, templates }));
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Workflow-Vorlagen konnten nicht geladen werden");
    }
  };

  const loadExecutions = async () => {
    try {
      const executions = await aiService.getWorkflowExecutions();
      setState((prev) => ({ ...prev, executions }));
    } catch (error) {
      console.error("Failed to load executions:", error);
      toast.error("Workflow-Ausführungen konnten nicht geladen werden");
    }
  };

  const loadWorkflowSteps = async (executionId: string) => {
    try {
      const steps = await aiService.getWorkflowSteps(executionId);
      setState((prev) => ({ ...prev, steps }));
    } catch (error) {
      console.error("Failed to load workflow steps:", error);
    }
  };

  const executeWorkflow = async (
    templateId: string,
    inputs: Record<string, unknown>,
  ) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const execution = await aiService.executeWorkflow(templateId, inputs);

      setState((prev) => ({
        ...prev,
        executions: [execution, ...prev.executions],
        currentExecution: execution,
        isLoading: false,
      }));

      await loadWorkflowSteps(execution.id);

      toast.success(`Workflow "${execution.name}" gestartet`);
    } catch (error) {
      console.error("Workflow execution failed:", error);
      toast.error("Workflow-Ausführung fehlgeschlagen");
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const pauseWorkflow = async (executionId: string) => {
    try {
      await aiService.pauseWorkflow(executionId);
      toast.success("Workflow pausiert");
      loadExecutions();
    } catch (error) {
      console.error("Failed to pause workflow:", error);
      toast.error("Workflow konnte nicht pausiert werden");
    }
  };

  const resumeWorkflow = async (executionId: string) => {
    try {
      await aiService.resumeWorkflow(executionId);
      toast.success("Workflow fortgesetzt");
      loadExecutions();
    } catch (error) {
      console.error("Failed to resume workflow:", error);
      toast.error("Workflow konnte nicht fortgesetzt werden");
    }
  };

  const cancelWorkflow = async (executionId: string) => {
    try {
      await aiService.cancelWorkflow(executionId);
      toast.success("Workflow abgebrochen");
      loadExecutions();
    } catch (error) {
      console.error("Failed to cancel workflow:", error);
      toast.error("Workflow konnte nicht abgebrochen werden");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Activity className="h-3 w-3 text-blue-500 animate-pulse" />;
      case "completed":
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "failed":
        return <XCircle className="h-3 w-3 text-red-500" />;
      case "skipped":
        return <ChevronRight className="h-3 w-3 text-gray-400" />;
      default:
        return <Clock className="h-3 w-3 text-yellow-500" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "low":
        return "text-green-600 bg-green-50 border-green-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6", className)}>
      {/* Workflow Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Workflow Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {state.templates.map((template) => (
                <div
                  key={template.id}
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer transition-colors",
                    selectedTemplate?.id === template.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        getDifficultyColor(template.difficulty),
                      )}
                    >
                      {template.difficulty}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground mb-2">
                    {template.description}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(template.estimated_duration)}
                    </span>
                    <span className="text-muted-foreground">
                      {template.steps.length} steps
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {selectedTemplate && (
            <>
              <Separator className="my-4" />
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Quick Execute</h4>
                <Button
                  onClick={() => executeWorkflow(selectedTemplate.id, {})}
                  disabled={state.isLoading}
                  className="w-full"
                >
                  {state.isLoading ? (
                    <>
                      <Activity className="h-4 w-4 animate-spin mr-2" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Execute Now
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Current Execution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Current Execution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {state.currentExecution ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{state.currentExecution.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(state.currentExecution.status)}
                    <span className="text-sm capitalize">
                      {state.currentExecution.status}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1">
                  {state.currentExecution.status === "running" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pauseWorkflow(state.currentExecution!.id)}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  )}

                  {state.currentExecution.status === "paused" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resumeWorkflow(state.currentExecution!.id)}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}

                  {["running", "paused"].includes(
                    state.currentExecution.status,
                  ) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelWorkflow(state.currentExecution!.id)}
                    >
                      <Square className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round(state.currentExecution.progress)}%</span>
                </div>
                <Progress value={state.currentExecution.progress} />
              </div>

              {state.steps.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm">Steps</h5>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {state.steps.map((step, index) => (
                        <div
                          key={step.id}
                          className="flex items-center gap-2 p-2 rounded border"
                        >
                          {getStepStatusIcon(step.status)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {index + 1}. {step.name}
                            </p>
                            {step.progress > 0 && step.status === "running" && (
                              <Progress
                                value={step.progress}
                                className="h-1 mt-1"
                              />
                            )}
                          </div>
                          {step.error && (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active workflow execution</p>
              <p className="text-sm">Select a template to start</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Execution History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {state.executions.map((execution) => (
                <div
                  key={execution.id}
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer transition-colors",
                    state.currentExecution?.id === execution.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30",
                  )}
                  onClick={() => {
                    setState((prev) => ({
                      ...prev,
                      currentExecution: execution,
                    }));
                    loadWorkflowSteps(execution.id);
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">
                      {execution.name}
                    </span>
                    {getStatusIcon(execution.status)}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(execution.start_time).toLocaleString()}
                    </span>
                    <span>{Math.round(execution.progress)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkflowExecutor;
