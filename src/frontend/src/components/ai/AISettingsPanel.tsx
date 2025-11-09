import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSettings, updateSettings, type Settings } from "@/services/api";
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  Clock,
  Database,
  Info,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Shield,
  Zap,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

interface AISettings {
  provider: "openai" | "anthropic" | "gemini";
  model: string;
  temperature: number;
  max_tokens: number;
  timeout: number;
  fallback_enabled: boolean;
  fallback_providers: string[];
  rate_limit: number;
  cache_enabled: boolean;
  cache_ttl: number;
  logging_level: "debug" | "info" | "warning" | "error";
  conversation_persistence: boolean;
  max_conversation_history: number;
}

interface ProviderStatus {
  provider: string;
  status: "available" | "unavailable" | "error";
  has_api_key: boolean;
  last_checked: string;
  response_time?: number;
  error?: string;
}

interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy" | "critical" | "error";
  timestamp: string;
  services: {
    [serviceName: string]: {
      status: string;
      initialized: boolean;
      [key: string]: unknown;
    };
  };
  providers: ProviderStatus[];
}

interface SystemSettings {
  mcp_server_url: string;
  mcp_server_timeout: number;
  health_check_interval: number;
  auto_scaling_enabled: boolean;
  max_system_load: number;
  maintenance_mode: boolean;
}

interface AgentSettings {
  schedule_optimizer: {
    enabled: boolean;
    max_concurrent_requests: number;
    optimization_algorithms: string[];
    constraint_weights: {
      workload_balance: number;
      coverage_requirements: number;
      employee_preferences: number;
      cost_optimization: number;
    };
  };
  employee_manager: {
    enabled: boolean;
    max_concurrent_requests: number;
    preference_weight: number;
    availability_check_strict: boolean;
  };
  workflow_coordinator: {
    enabled: boolean;
    max_parallel_workflows: number;
    workflow_timeout: number;
    auto_recovery: boolean;
  };
}

export const AISettingsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  
  // Fetch settings using React Query (unified approach)
  const { data: settings, isLoading: isLoadingSettings } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Mutation for updating settings (unified approach)
  const mutation = useMutation<Settings, Error, Settings>({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      toast.success("AI settings saved successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save AI settings: ${error.message}`);
    },
  });

  // Local state for status polling
  const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Get AI settings from the unified settings object
  const aiScheduling = settings?.ai_scheduling || {};
  
  // Debounced update function (unified approach)
  const debouncedUpdateSettings = useDebouncedCallback(
    (updatedSettings: Settings) => {
      mutation.mutate(updatedSettings);
    },
    2000 // 2 second debounce like UnifiedSettingsPage
  );

  // Helper to update AI settings
  const updateAISettings = (updates: Partial<Settings["ai_scheduling"]>) => {
    if (!settings) return;
    
    const updatedSettings: Settings = {
      ...settings,
      ai_scheduling: {
        ...aiScheduling,
        ...updates,
      },
    };
    
    debouncedUpdateSettings(updatedSettings);
  };

  // Fetch provider status and system health
  useEffect(() => {
    const fetchStatus = async () => {
      setIsLoadingStatus(true);
      try {
        // Fetch provider status
        const providerResponse = await fetch("/api/v2/ai/services/status");
        if (providerResponse.ok) {
          const providerData = await providerResponse.json();
          setProviderStatus(providerData.providers || []);
        }

        // Fetch system health
        const healthResponse = await fetch("/api/v2/ai/health");
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          setSystemHealth(healthData);
        }
      } catch (error) {
        console.error("Failed to fetch AI status:", error);
      } finally {
        setIsLoadingStatus(false);
      }
    };

    fetchStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Helper function for immediate save (no debounce)
  const handleImmediateSave = () => {
    if (!settings) return;
    
    debouncedUpdateSettings.cancel(); // Cancel any pending debounced updates
    mutation.mutate(settings);
  };

  const getProviderModels = (provider: string) => {
    switch (provider) {
      case "openai":
        return ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"];
      case "anthropic":
        return ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"];
      case "gemini":
        return ["gemini-pro", "gemini-1.5-pro", "gemini-1.5-flash"];
      default:
        return [];
    }
  };

  if (isLoadingSettings) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading AI settings...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            AI Settings
          </CardTitle>
          <div className="flex items-center gap-2">
            {mutation.isPending && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Saving...
              </Badge>
            )}
            <Button
              size="sm"
              onClick={handleImmediateSave}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ai">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Agents
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="ai" className="space-y-4">
              {/* AI Provider Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Provider Configuration
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={aiScheduling.provider || "gemini"}
                      onValueChange={(value) =>
                        updateAISettings({ provider: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select
                      value={aiScheduling.model || "gemini-pro"}
                      onValueChange={(value) =>
                        updateAISettings({ model: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getProviderModels(aiScheduling.provider || "gemini").map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Temperature: {aiScheduling.temperature || 0.7}</Label>
                  <Slider
                    value={[aiScheduling.temperature || 0.7]}
                    onValueChange={([value]) =>
                      updateAISettings({ temperature: value })
                    }
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness in AI responses (0 = deterministic, 2 =
                    very creative)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      value={aiScheduling.max_tokens || 2048}
                      onChange={(e) =>
                        updateAISettings({ max_tokens: Number(e.target.value) })
                      }
                      min={100}
                      max={4096}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Timeout (seconds)</Label>
                    <Input
                      type="number"
                      value={aiScheduling.timeout || 30}
                      onChange={(e) =>
                        updateAISettings({ timeout: Number(e.target.value) })
                      }
                      min={5}
                      max={300}
                    />
                  </div>
                </div>
              </div>

              {/* Fallback and Reliability */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Fallback & Reliability
                </h4>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Fallback Providers</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically switch to backup providers if primary fails
                    </p>
                  </div>
                  <Switch
                    checked={aiScheduling.fallback_enabled ?? true}
                    onCheckedChange={(checked) =>
                      updateAISettings({ fallback_enabled: checked })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rate Limit (requests/minute)</Label>
                    <Input
                      type="number"
                      value={aiScheduling.rate_limit || 100}
                      onChange={(e) =>
                        updateAISettings({ rate_limit: Number(e.target.value) })
                      }
                      min={1}
                      max={1000}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Logging Level</Label>
                    <Select
                      value={aiScheduling.logging_level || "info"}
                      onValueChange={(value) =>
                        updateAISettings({ logging_level: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debug">Debug</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Conversation Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Conversation Management
                </h4>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Conversation Persistence</Label>
                    <p className="text-xs text-muted-foreground">
                      Save conversation state between sessions
                    </p>
                  </div>
                  <Switch
                    checked={aiScheduling.conversation_persistence ?? true}
                    onCheckedChange={(checked) =>
                      updateAISettings({ conversation_persistence: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Conversation History</Label>
                  <Input
                    type="number"
                    value={aiScheduling.max_conversation_history || 50}
                    onChange={(e) =>
                      updateAISettings({ max_conversation_history: Number(e.target.value) })
                    }
                    min={10}
                    max={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of messages to keep in conversation history
                  </p>
                </div>
              </div>
            </TabsContent>
                  </div>

                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select
                      value={aiSettings.model}
                      onValueChange={(value) =>
                        setAISettings((prev) => ({ ...prev, model: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getProviderModels(aiSettings.provider).map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Temperature: {aiSettings.temperature}</Label>
                  <Slider
                    value={[aiSettings.temperature]}
                    onValueChange={([value]) =>
                      setAISettings((prev) => ({ ...prev, temperature: value }))
                    }
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness in AI responses (0 = deterministic, 2 =
                    very creative)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      value={aiSettings.max_tokens}
                      onChange={(e) =>
                        setAISettings((prev) => ({
                          ...prev,
                          max_tokens: Number(e.target.value),
                        }))
                      }
                      min={100}
                      max={4096}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Timeout (seconds)</Label>
                    <Input
                      type="number"
                      value={aiSettings.timeout}
                      onChange={(e) =>
                        setAISettings((prev) => ({
                          ...prev,
                          timeout: Number(e.target.value),
                        }))
                      }
                      min={5}
                      max={300}
                    />
                  </div>
                </div>
              </div>

              {/* Fallback and Reliability */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Fallback & Reliability
                </h4>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Fallback Providers</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically switch to backup providers if primary fails
                    </p>
                  </div>
                  <Switch
                    checked={aiSettings.fallback_enabled}
                    onCheckedChange={(checked) =>
                      setAISettings((prev) => ({
                        ...prev,
                        fallback_enabled: checked,
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rate Limit (requests/minute)</Label>
                    <Input
                      type="number"
                      value={aiSettings.rate_limit}
                      onChange={(e) =>
                        setAISettings((prev) => ({
                          ...prev,
                          rate_limit: Number(e.target.value),
                        }))
                      }
                      min={1}
                      max={1000}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Logging Level</Label>
                    <Select
                      value={aiSettings.logging_level}
                      onValueChange={(
                        value: "debug" | "info" | "warning" | "error",
                      ) =>
                        setAISettings((prev) => ({
                          ...prev,
                          logging_level: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debug">Debug</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Conversation Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Conversation Management
                </h4>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Conversation Persistence</Label>
                    <p className="text-xs text-muted-foreground">
                      Save conversation state between sessions
                    </p>
                  </div>
                  <Switch
                    checked={aiSettings.conversation_persistence}
                    onCheckedChange={(checked) =>
                      setAISettings((prev) => ({
                        ...prev,
                        conversation_persistence: checked,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Conversation History</Label>
                  <Input
                    type="number"
                    value={aiSettings.max_conversation_history}
                    onChange={(e) =>
                      setAISettings((prev) => ({
                        ...prev,
                        max_conversation_history: Number(e.target.value),
                      }))
                    }
                    min={10}
                    max={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of messages to keep in conversation history
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="agents" className="space-y-4">
              {/* Schedule Optimizer Agent */}
              <div className="space-y-3 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Schedule Optimizer Agent
                  </h4>
                  <Switch
                    checked={agentSettings.schedule_optimizer.enabled}
                    onCheckedChange={(checked) =>
                      setAgentSettings((prev) => ({
                        ...prev,
                        schedule_optimizer: {
                          ...prev.schedule_optimizer,
                          enabled: checked,
                        },
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Concurrent Requests</Label>
                    <Input
                      type="number"
                      value={
                        agentSettings.schedule_optimizer.max_concurrent_requests
                      }
                      onChange={(e) =>
                        setAgentSettings((prev) => ({
                          ...prev,
                          schedule_optimizer: {
                            ...prev.schedule_optimizer,
                            max_concurrent_requests: Number(e.target.value),
                          },
                        }))
                      }
                      min={1}
                      max={10}
                      disabled={!agentSettings.schedule_optimizer.enabled}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Constraint Weights</Label>
                  {Object.entries(
                    agentSettings.schedule_optimizer.constraint_weights,
                  ).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>
                          {key
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                        <span>{(value as number).toFixed(1)}</span>
                      </div>
                      <Slider
                        value={[value as number]}
                        onValueChange={([newValue]) =>
                          setAgentSettings((prev) => ({
                            ...prev,
                            schedule_optimizer: {
                              ...prev.schedule_optimizer,
                              constraint_weights: {
                                ...prev.schedule_optimizer.constraint_weights,
                                [key]: newValue,
                              },
                            },
                          }))
                        }
                        min={0}
                        max={1}
                        step={0.1}
                        disabled={!agentSettings.schedule_optimizer.enabled}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Employee Manager Agent */}
              <div className="space-y-3 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Employee Manager Agent
                  </h4>
                  <Switch
                    checked={agentSettings.employee_manager.enabled}
                    onCheckedChange={(checked) =>
                      setAgentSettings((prev) => ({
                        ...prev,
                        employee_manager: {
                          ...prev.employee_manager,
                          enabled: checked,
                        },
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Concurrent Requests</Label>
                    <Input
                      type="number"
                      value={
                        agentSettings.employee_manager.max_concurrent_requests
                      }
                      onChange={(e) =>
                        setAgentSettings((prev) => ({
                          ...prev,
                          employee_manager: {
                            ...prev.employee_manager,
                            max_concurrent_requests: Number(e.target.value),
                          },
                        }))
                      }
                      min={1}
                      max={10}
                      disabled={!agentSettings.employee_manager.enabled}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Preference Weight:{" "}
                    {agentSettings.employee_manager.preference_weight}
                  </Label>
                  <Slider
                    value={[agentSettings.employee_manager.preference_weight]}
                    onValueChange={([value]) =>
                      setAgentSettings((prev) => ({
                        ...prev,
                        employee_manager: {
                          ...prev.employee_manager,
                          preference_weight: value,
                        },
                      }))
                    }
                    min={0}
                    max={1}
                    step={0.1}
                    disabled={!agentSettings.employee_manager.enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Strict Availability Check</Label>
                    <p className="text-xs text-muted-foreground">
                      Enforce strict availability constraints
                    </p>
                  </div>
                  <Switch
                    checked={
                      agentSettings.employee_manager.availability_check_strict
                    }
                    onCheckedChange={(checked) =>
                      setAgentSettings((prev) => ({
                        ...prev,
                        employee_manager: {
                          ...prev.employee_manager,
                          availability_check_strict: checked,
                        },
                      }))
                    }
                    disabled={!agentSettings.employee_manager.enabled}
                  />
                </div>
              </div>

              {/* Workflow Coordinator */}
              <div className="space-y-3 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Workflow Coordinator</h4>
                  <Switch
                    checked={agentSettings.workflow_coordinator.enabled}
                    onCheckedChange={(checked) =>
                      setAgentSettings((prev) => ({
                        ...prev,
                        workflow_coordinator: {
                          ...prev.workflow_coordinator,
                          enabled: checked,
                        },
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Parallel Workflows</Label>
                    <Input
                      type="number"
                      value={
                        agentSettings.workflow_coordinator
                          .max_parallel_workflows
                      }
                      onChange={(e) =>
                        setAgentSettings((prev) => ({
                          ...prev,
                          workflow_coordinator: {
                            ...prev.workflow_coordinator,
                            max_parallel_workflows: Number(e.target.value),
                          },
                        }))
                      }
                      min={1}
                      max={10}
                      disabled={!agentSettings.workflow_coordinator.enabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Workflow Timeout (seconds)</Label>
                    <Input
                      type="number"
                      value={
                        agentSettings.workflow_coordinator.workflow_timeout
                      }
                      onChange={(e) =>
                        setAgentSettings((prev) => ({
                          ...prev,
                          workflow_coordinator: {
                            ...prev.workflow_coordinator,
                            workflow_timeout: Number(e.target.value),
                          },
                        }))
                      }
                      min={60}
                      max={3600}
                      disabled={!agentSettings.workflow_coordinator.enabled}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Recovery</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically recover from workflow failures
                    </p>
                  </div>
                  <Switch
                    checked={agentSettings.workflow_coordinator.auto_recovery}
                    onCheckedChange={(checked) =>
                      setAgentSettings((prev) => ({
                        ...prev,
                        workflow_coordinator: {
                          ...prev.workflow_coordinator,
                          auto_recovery: checked,
                        },
                      }))
                    }
                    disabled={!agentSettings.workflow_coordinator.enabled}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="system" className="space-y-4">
              {/* MCP Server Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  MCP Server Configuration
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Server URL</Label>
                    <Input
                      value={systemSettings.mcp_server_url}
                      onChange={(e) =>
                        setSystemSettings((prev) => ({
                          ...prev,
                          mcp_server_url: e.target.value,
                        }))
                      }
                      placeholder="http://localhost:8001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Server Timeout (seconds)</Label>
                    <Input
                      type="number"
                      value={systemSettings.mcp_server_timeout}
                      onChange={(e) =>
                        setSystemSettings((prev) => ({
                          ...prev,
                          mcp_server_timeout: Number(e.target.value),
                        }))
                      }
                      min={5}
                      max={300}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Health Check Interval (seconds)</Label>
                  <Input
                    type="number"
                    value={systemSettings.health_check_interval}
                    onChange={(e) =>
                      setSystemSettings((prev) => ({
                        ...prev,
                        health_check_interval: Number(e.target.value),
                      }))
                    }
                    min={10}
                    max={600}
                  />
                </div>
              </div>

              {/* System Performance */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Performance & Scaling
                </h4>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Scaling</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically scale resources based on load
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.auto_scaling_enabled}
                    onCheckedChange={(checked) =>
                      setSystemSettings((prev) => ({
                        ...prev,
                        auto_scaling_enabled: checked,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Max System Load (%): {systemSettings.max_system_load}
                  </Label>
                  <Slider
                    value={[systemSettings.max_system_load]}
                    onValueChange={([value]) =>
                      setSystemSettings((prev) => ({
                        ...prev,
                        max_system_load: value,
                      }))
                    }
                    min={50}
                    max={100}
                    step={5}
                  />
                </div>
              </div>

              {/* Maintenance */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Maintenance
                </h4>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Maintenance Mode</Label>
                    <p className="text-xs text-muted-foreground">
                      Put system in maintenance mode (blocks new requests)
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.maintenance_mode}
                    onCheckedChange={(checked) =>
                      setSystemSettings((prev) => ({
                        ...prev,
                        maintenance_mode: checked,
                      }))
                    }
                  />
                </div>

                {systemSettings.maintenance_mode && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">
                        Maintenance Mode Active
                      </span>
                    </div>
                    <p className="text-xs text-yellow-700 mt-1">
                      System is in maintenance mode. New AI requests will be
                      blocked.
                    </p>
                  </div>
                )}
              </div>

              {/* Status Information */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  System Status
                  {isLoadingStatus && (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsLoadingStatus(true);
                      // Trigger status refresh by updating the useEffect dependency
                      setTimeout(() => setIsLoadingStatus(false), 1000);
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </h4>

                {/* System Health Status */}
                {systemHealth && (
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {systemHealth.status === "healthy" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : systemHealth.status === "degraded" ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm font-medium">
                        System Health: {systemHealth.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last checked:{" "}
                      {new Date(systemHealth.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                )}

                {/* Provider Status */}
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-muted-foreground">
                    AI Providers
                  </h5>
                  {providerStatus.length > 0 ? (
                    providerStatus.map((provider) => (
                      <div
                        key={provider.provider}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded"
                      >
                        <div className="flex items-center gap-2">
                          {provider.status === "available" ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : provider.status === "unavailable" ? (
                            <Clock className="h-3 w-3 text-yellow-600" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                          )}
                          <span className="text-xs font-medium capitalize">
                            {provider.provider}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {provider.has_api_key ? (
                            <Badge variant="secondary" className="text-xs">
                              API Key
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              No Key
                            </Badge>
                          )}
                          {provider.response_time && (
                            <span className="text-xs text-muted-foreground">
                              {provider.response_time}ms
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                      No provider status available
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};
