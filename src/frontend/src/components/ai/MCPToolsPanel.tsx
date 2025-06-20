import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type MCPTool } from "@/services/aiService";
import {
    AlertCircle,
    BarChart3,
    Calendar,
    CheckCircle,
    Code,
    Database,
    Download,
    Filter,
    Play,
    RefreshCw,
    Search,
    Settings,
    Users,
    Zap
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

interface LocalMCPTool extends MCPTool {
  average_response_time: number;
}

interface ToolExecution {
  id: string;
  tool_id: string;
  parameters: Record<string, unknown>;
  status: "running" | "completed" | "failed";
  started_at: Date;
  completed_at?: Date;
  result?: unknown;
  error?: string;
}

export const MCPToolsPanel: React.FC = () => {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [executions, setExecutions] = useState<ToolExecution[]>([]);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    // Initialize MCP tools data
    setTools([
      {
        id: "analyze_schedule_conflicts",
        name: "Analyze Schedule Conflicts",
        description: "Identify and analyze conflicts in the current schedule",
        category: "schedule",
        parameters: [
          {
            name: "start_date",
            type: "date",
            required: true,
            description: "Start date for conflict analysis"
          },
          {
            name: "end_date",
            type: "date",
            required: true,
            description: "End date for conflict analysis"
          },
          {
            name: "include_warnings",
            type: "boolean",
            required: false,
            description: "Include potential conflicts as warnings",
            default_value: true
          }
        ],
        status: "available",
        usage_count: 156,
        last_used: new Date(Date.now() - 2 * 60 * 60 * 1000),
        average_response_time: 2.3
      },
      {
        id: "get_employee_availability",
        name: "Get Employee Availability",
        description: "Retrieve employee availability information for scheduling",
        category: "employee",
        parameters: [
          {
            name: "employee_id",
            type: "number",
            required: false,
            description: "Specific employee ID (optional for all employees)"
          },
          {
            name: "start_date",
            type: "date",
            required: true,
            description: "Start date for availability query"
          },
          {
            name: "end_date",
            type: "date",
            required: true,
            description: "End date for availability query"
          }
        ],
        status: "available",
        usage_count: 203,
        last_used: new Date(Date.now() - 30 * 60 * 1000),
        average_response_time: 1.2
      },
      {
        id: "optimize_schedule_ai",
        name: "AI Schedule Optimization",
        description: "Use AI to optimize schedule with advanced algorithms",
        category: "schedule",
        parameters: [
          {
            name: "start_date",
            type: "date",
            required: true,
            description: "Start date for optimization"
          },
          {
            name: "end_date",
            type: "date",
            required: true,
            description: "End date for optimization"
          },
          {
            name: "optimization_goals",
            type: "array",
            required: false,
            description: "List of optimization goals",
            default_value: ["balance_workload", "minimize_conflicts"]
          }
        ],
        status: "available",
        usage_count: 89,
        last_used: new Date(Date.now() - 4 * 60 * 60 * 1000),
        average_response_time: 4.7
      },
      {
        id: "get_schedule_statistics",
        name: "Get Schedule Statistics",
        description: "Generate comprehensive schedule statistics and metrics",
        category: "analysis",
        parameters: [
          {
            name: "start_date",
            type: "date",
            required: true,
            description: "Start date for statistics"
          },
          {
            name: "end_date",
            type: "date",
            required: true,
            description: "End date for statistics"
          },
          {
            name: "include_trends",
            type: "boolean",
            required: false,
            description: "Include trend analysis",
            default_value: true
          }
        ],
        status: "available",
        usage_count: 67,
        last_used: new Date(Date.now() - 6 * 60 * 60 * 1000),
        average_response_time: 3.1
      },
      {
        id: "get_coverage_requirements",
        name: "Get Coverage Requirements",
        description: "Retrieve coverage requirements for scheduling",
        category: "schedule",
        parameters: [
          {
            name: "query_date",
            type: "date",
            required: false,
            description: "Specific date for coverage query (optional)"
          }
        ],
        status: "available",
        usage_count: 134,
        last_used: new Date(Date.now() - 1 * 60 * 60 * 1000),
        average_response_time: 0.8
      },
      {
        id: "mcp_health_check",
        name: "MCP Health Check",
        description: "Check MCP server connectivity and health status",
        category: "system",
        parameters: [],
        status: "available",
        usage_count: 45,
        last_used: new Date(Date.now() - 10 * 60 * 1000),
        average_response_time: 0.3
      }
    ]);

    // Initialize recent executions
    setExecutions([
      {
        id: "exec_001",
        tool_id: "analyze_schedule_conflicts",
        parameters: {
          start_date: "2025-06-23",
          end_date: "2025-06-29",
          include_warnings: true
        },
        status: "completed",
        started_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
        completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + 2300),
        result: {
          conflicts_found: 3,
          warnings: 2,
          recommendations: 5
        }
      },
      {
        id: "exec_002",
        tool_id: "get_employee_availability",
        parameters: {
          start_date: "2025-06-23",
          end_date: "2025-06-29"
        },
        status: "completed",
        started_at: new Date(Date.now() - 30 * 60 * 1000),
        completed_at: new Date(Date.now() - 30 * 60 * 1000 + 1200),
        result: {
          employees_analyzed: 12,
          availability_data: "Retrieved successfully"
        }
      }
    ]);
  }, []);

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesCategory = categoryFilter === "all" || tool.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleExecuteTool = async () => {
    if (!selectedTool) return;

    setIsExecuting(true);
    const executionId = `exec_${Date.now()}`;
    
    const newExecution: ToolExecution = {
      id: executionId,
      tool_id: selectedTool.id,
      parameters,
      status: "running",
      started_at: new Date()
    };

    setExecutions(prev => [newExecution, ...prev]);

    try {
      // Simulate tool execution
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      
      // Update execution with result
      setExecutions(prev => prev.map(exec => 
        exec.id === executionId 
          ? {
              ...exec,
              status: "completed" as const,
              completed_at: new Date(),
              result: {
                success: true,
                message: `Tool ${selectedTool.name} executed successfully`,
                data: generateMockResult(selectedTool.id)
              }
            }
          : exec
      ));

      // Update tool usage statistics
      setTools(prev => prev.map(tool => 
        tool.id === selectedTool.id 
          ? {
              ...tool,
              usage_count: tool.usage_count + 1,
              last_used: new Date()
            }
          : tool
      ));

      toast.success(`Tool "${selectedTool.name}" executed successfully`);
    } catch {
      setExecutions(prev => prev.map(exec => 
        exec.id === executionId 
          ? {
              ...exec,
              status: "failed" as const,
              completed_at: new Date(),
              error: "Tool execution failed"
            }
          : exec
      ));
      toast.error("Tool execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  const generateMockResult = (toolId: string) => {
    switch (toolId) {
      case "analyze_schedule_conflicts":
        return {
          conflicts_found: Math.floor(Math.random() * 5),
          warnings: Math.floor(Math.random() * 8),
          recommendations: Math.floor(Math.random() * 10) + 3
        };
      case "get_employee_availability":
        return {
          employees_analyzed: 12,
          total_hours_available: 480,
          conflicts_detected: Math.floor(Math.random() * 3)
        };
      case "optimize_schedule_ai":
        return {
          optimization_score: 85 + Math.random() * 15,
          improvements_made: Math.floor(Math.random() * 20) + 5,
          conflicts_resolved: Math.floor(Math.random() * 8)
        };
      default:
        return { status: "completed", message: "Tool executed successfully" };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "schedule":
        return <Calendar className="h-4 w-4" />;
      case "employee":
        return <Users className="h-4 w-4" />;
      case "analysis":
        return <BarChart3 className="h-4 w-4" />;
      case "workflow":
        return <Zap className="h-4 w-4" />;
      case "system":
        return <Database className="h-4 w-4" />;
      default:
        return <Code className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "running":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: Date | null) => {
    if (!timestamp) return "Never";
    
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
  };

  const renderParameterInput = (param: MCPParameter) => {
    const value = parameters[param.name];
    
    switch (param.type) {
      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={param.name}
              checked={value as boolean || param.default_value as boolean || false}
              onChange={(e) => setParameters(prev => ({
                ...prev,
                [param.name]: e.target.checked
              }))}
              className="rounded border-gray-300"
            />
            <Label htmlFor={param.name} className="text-sm">
              {param.description}
            </Label>
          </div>
        );
      case "date":
        return (
          <Input
            type="date"
            value={value as string || ""}
            onChange={(e) => setParameters(prev => ({
              ...prev,
              [param.name]: e.target.value
            }))}
            required={param.required}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value as number || ""}
            onChange={(e) => setParameters(prev => ({
              ...prev,
              [param.name]: Number(e.target.value)
            }))}
            required={param.required}
          />
        );
      case "array":
        return (
          <Textarea
            placeholder="Enter comma-separated values"
            value={Array.isArray(value) ? value.join(", ") : ""}
            onChange={(e) => setParameters(prev => ({
              ...prev,
              [param.name]: e.target.value.split(",").map(v => v.trim())
            }))}
            required={param.required}
            className="h-20"
          />
        );
      default:
        return (
          <Input
            type="text"
            value={value as string || ""}
            onChange={(e) => setParameters(prev => ({
              ...prev,
              [param.name]: e.target.value
            }))}
            required={param.required}
          />
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          MCP Tools
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tools">
          <TabsList>
            <TabsTrigger value="tools">Available Tools</TabsTrigger>
            <TabsTrigger value="execute">Execute Tool</TabsTrigger>
            <TabsTrigger value="history">Execution History</TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="tools">
              {/* Search and Filter */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tools..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>

              {/* Category Filter */}
              <div className="flex gap-2 mb-4">
                {["all", "schedule", "employee", "analysis", "workflow", "system"].map((category) => (
                  <Button
                    key={category}
                    size="sm"
                    variant={categoryFilter === category ? "default" : "outline"}
                    onClick={() => setCategoryFilter(category)}
                  >
                    {category === "all" ? "All" : category.charAt(0).toUpperCase() + category.slice(1)}
                  </Button>
                ))}
              </div>

              {/* Tools List */}
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {filteredTools.map((tool) => (
                    <div
                      key={tool.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedTool?.id === tool.id 
                          ? "border-primary bg-primary/5" 
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedTool(tool)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(tool.category)}
                          <span className="font-medium">{tool.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(tool.status)}
                          <Badge variant="outline" className="text-xs">
                            {tool.usage_count} uses
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {tool.description}
                      </p>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Last used: {formatTimestamp(tool.last_used)}</span>
                        <span>Avg response: {tool.average_response_time}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="execute">
              {selectedTool ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      {getCategoryIcon(selectedTool.category)}
                      <h3 className="font-medium">{selectedTool.name}</h3>
                      {getStatusIcon(selectedTool.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTool.description}
                    </p>
                  </div>

                  {selectedTool.parameters.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Parameters</h4>
                      {selectedTool.parameters.map((param) => (
                        <div key={param.name} className="space-y-2">
                          <Label className="text-sm">
                            {param.name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                            {param.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {renderParameterInput(param)}
                          <p className="text-xs text-muted-foreground">
                            {param.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={handleExecuteTool}
                    disabled={isExecuting || selectedTool.status !== "available"}
                    className="w-full"
                  >
                    {isExecuting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Execute Tool
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Code className="h-12 w-12 mx-auto mb-2" />
                  <p>Select a tool to execute</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Recent Executions</span>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
                
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {executions.map((execution) => {
                      const tool = tools.find(t => t.id === execution.tool_id);
                      return (
                        <div key={execution.id} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {tool && getCategoryIcon(tool.category)}
                              <span className="font-medium">{tool?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {execution.status === "completed" && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                              {execution.status === "running" && (
                                <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                              )}
                              {execution.status === "failed" && (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              <Badge variant="outline" className="text-xs">
                                {execution.status}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex justify-between">
                              <span>Started:</span>
                              <span>{execution.started_at.toLocaleTimeString()}</span>
                            </div>
                            {execution.completed_at && (
                              <div className="flex justify-between">
                                <span>Duration:</span>
                                <span>
                                  {Math.round((execution.completed_at.getTime() - execution.started_at.getTime()) / 1000)}s
                                </span>
                              </div>
                            )}
                          </div>

                          {execution.result && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                              <code>{JSON.stringify(execution.result, null, 2)}</code>
                            </div>
                          )}

                          {execution.error && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                              {execution.error}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};
