import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ChevronDown,
  Code,
  Database,
  Download,
  Filter,
  Heart,
  Play,
  RefreshCw,
  Search,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { GlobalMCPService } from "../../../services/mcpClient";

interface LocalMCPTool extends MCPTool {
  average_response_time: number;
  is_favorite?: boolean;
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
  const [tools, setTools] = useState<LocalMCPTool[]>([]);
  const [executions, setExecutions] = useState<ToolExecution[]>([]);
  const [selectedTool, setSelectedTool] = useState<LocalMCPTool | null>(null);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isExecuting, setIsExecuting] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("mcp-tool-favorites");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  useEffect(() => {
    // Load tools from MCP backend
    (async () => {
      try {
        // no-op loading state for now
        const svc = await GlobalMCPService.getInstance(window.location.origin);
        const discovery = await svc.discoverTools();
        const mapped: LocalMCPTool[] = (discovery.available_tools || []).map(
          (t: {
            name: string;
            description: string;
            category?: string;
            parameters?:
            | Record<string, unknown>
            | Array<LocalMCPTool["parameters"][number]>;
          }) => ({
            id: t.name,
            name: t.name,
            description: t.description,
            category: t.category || "general",
            // Map object parameters to array expected by UI
            parameters: Array.isArray(t.parameters)
              ? Array.isArray(t.parameters) &&
                typeof (t.parameters as unknown[])[0] === "string"
                ? // Map array of strings to object descriptors
                ((t.parameters as unknown[] as string[]).map((p) => ({
                  name: p,
                  type: "string",
                  description: "",
                  required: false,
                })) as LocalMCPTool["parameters"])
                : (t.parameters as LocalMCPTool["parameters"])
              : Object.entries(
                (t.parameters || {}) as Record<string, unknown>,
              ).map(([name, def]) => {
                const d = def as {
                  type?: string;
                  description?: string;
                  required?: boolean;
                  default?: unknown;
                };
                return {
                  name,
                  type: d?.type || "string",
                  description: d?.description || "",
                  required: !!d?.required,
                  default: d?.default,
                };
              }),
            status: "available",
            usage_count: 0,
            last_used: undefined,
            average_response_time: 0,
          }),
        );
        setTools(mapped);
        setExecutions([]);
      } catch (e) {
        console.warn("MCP tool discovery failed:", e);
      } finally {
        // done
      }
    })();
  }, []);

  const toggleFavorite = (toolId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(toolId)) {
      newFavorites.delete(toolId);
    } else {
      newFavorites.add(toolId);
    }
    setFavorites(newFavorites);
    localStorage.setItem(
      "mcp-tool-favorites",
      JSON.stringify([...newFavorites]),
    );
  };

  const filteredTools = tools
    .map((tool) => ({ ...tool, is_favorite: favorites.has(tool.id) }))
    .filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || tool.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      // Sort favorites first
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return 0;
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
      started_at: new Date(),
    };

    setExecutions((prev) => [newExecution, ...prev]);

    try {
      // Execute via MCP backend (with fallback handled in service)
      const svc = await GlobalMCPService.getInstance(window.location.origin);
      const res = await svc.executeToolRequest({
        tool: selectedTool.id,
        parameters,
      });

      setExecutions((prev) =>
        prev.map((exec) =>
          exec.id === executionId
            ? {
              ...exec,
              status:
                res.status === "success"
                  ? ("completed" as const)
                  : ("failed" as const),
              completed_at: new Date(),
              result: res.status === "success" ? res.result : undefined,
              error:
                res.status === "success"
                  ? undefined
                  : (res.error as string | undefined),
            }
            : exec,
        ),
      );

      // Update tool usage statistics
      setTools((prev) =>
        prev.map((tool) =>
          tool.id === selectedTool.id
            ? {
              ...tool,
              usage_count: tool.usage_count + 1,
              last_used: new Date().toISOString(),
            }
            : tool,
        ),
      );

      if (res.status === "success") {
        toast.success(`Tool "${selectedTool.name}" executed successfully`);
      } else {
        toast.error(res.error || "Tool execution failed");
      }
    } catch (e) {
      setExecutions((prev) =>
        prev.map((exec) =>
          exec.id === executionId
            ? {
              ...exec,
              status: "failed" as const,
              completed_at: new Date(),
              error: (e as Error).message || "Tool execution failed",
            }
            : exec,
        ),
      );
      toast.error("Tool execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  // Tool result rendering is now based on actual MCP response

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

  const formatTimestamp = (timestamp?: string | Date | null) => {
    if (!timestamp) return "Never";
    const t = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diff = now.getTime() - t.getTime();
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

  const renderParameterInput = (param: LocalMCPTool["parameters"][number]) => {
    const value = parameters[param.name];

    switch (param.type) {
      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={param.name}
              checked={
                (value as boolean) ||
                ("default" in param &&
                  typeof (param as { default?: unknown }).default === "boolean"
                  ? (param as { default?: boolean }).default!
                  : false)
              }
              onChange={(e) =>
                setParameters((prev) => ({
                  ...prev,
                  [param.name]: e.target.checked,
                }))
              }
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
            value={(value as string) || ""}
            onChange={(e) =>
              setParameters((prev) => ({
                ...prev,
                [param.name]: e.target.value,
              }))
            }
            required={param.required}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={(value as number) || ""}
            onChange={(e) =>
              setParameters((prev) => ({
                ...prev,
                [param.name]: Number(e.target.value),
              }))
            }
            required={param.required}
          />
        );
      case "array":
        return (
          <Textarea
            placeholder="Enter comma-separated values"
            value={Array.isArray(value) ? value.join(", ") : ""}
            onChange={(e) =>
              setParameters((prev) => ({
                ...prev,
                [param.name]: e.target.value.split(",").map((v) => v.trim()),
              }))
            }
            required={param.required}
            className="h-20"
          />
        );
      default:
        return (
          <Input
            type="text"
            value={(value as string) || ""}
            onChange={(e) =>
              setParameters((prev) => ({
                ...prev,
                [param.name]: e.target.value,
              }))
            }
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
                {[
                  "all",
                  "schedule",
                  "employee",
                  "analysis",
                  "workflow",
                  "system",
                ].map((category) => (
                  <Button
                    key={category}
                    size="sm"
                    variant={
                      categoryFilter === category ? "default" : "outline"
                    }
                    onClick={() => setCategoryFilter(category)}
                  >
                    {category === "all"
                      ? "All"
                      : category.charAt(0).toUpperCase() + category.slice(1)}
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
                          : "hover:bg-muted/50",
                      )}
                      onClick={() => setSelectedTool(tool)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(tool.category)}
                          <span className="font-medium">{tool.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(tool.id);
                            }}
                          >
                            <Heart
                              className={cn(
                                "h-3 w-3",
                                tool.is_favorite
                                  ? "fill-red-500 text-red-500"
                                  : "text-muted-foreground",
                              )}
                            />
                          </Button>
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
                        <span>
                          Last used: {formatTimestamp(tool.last_used)}
                        </span>
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
                            {param.name
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                            {param.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
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
                    disabled={
                      isExecuting || selectedTool.status !== "available"
                    }
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
                      const tool = tools.find(
                        (t) => t.id === execution.tool_id,
                      );
                      return (
                        <div
                          key={execution.id}
                          className="p-3 rounded-lg border"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {tool && getCategoryIcon(tool.category)}
                              <span className="font-medium">{tool?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {execution.status === "completed" && tool && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    setSelectedTool(tool);
                                    // Pre-fill parameters from this execution
                                    setParameters(execution.parameters);
                                  }}
                                  title="Re-execute with same parameters"
                                >
                                  <Play className="h-3 w-3" />
                                </Button>
                              )}
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
                              <span>
                                {execution.started_at.toLocaleTimeString()}
                              </span>
                            </div>
                            {execution.completed_at && (
                              <div className="flex justify-between">
                                <span>Duration:</span>
                                <span>
                                  {Math.round(
                                    (execution.completed_at.getTime() -
                                      execution.started_at.getTime()) /
                                    1000,
                                  )}
                                  s
                                </span>
                              </div>
                            )}
                          </div>

                          {execution.result && (
                            <Collapsible>
                              <div className="mt-2">
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-between text-xs p-2 h-auto"
                                  >
                                    <span>View Result</span>
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1">
                                  <div className="p-2 bg-muted/50 rounded text-xs max-h-40 overflow-auto">
                                    <pre className="whitespace-pre-wrap">
                                      {typeof execution.result === "object"
                                        ? JSON.stringify(
                                          execution.result,
                                          null,
                                          2,
                                        )
                                        : String(execution.result)}
                                    </pre>
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
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
