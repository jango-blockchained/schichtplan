import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { Settings } from "@/types";
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
import React, { useEffect, useState } from "react";

interface IntegrationsAISectionProps {
  settings: Settings["ai_scheduling"] | undefined;
  onAiSchedulingChange: (
    key: keyof NonNullable<Settings["ai_scheduling"]>,
    value: string | number | boolean | Record<string, unknown>,
  ) => void;
  onImmediateUpdate?: () => void;
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

const IntegrationsAISection: React.FC<IntegrationsAISectionProps> = ({
  settings,
  onAiSchedulingChange,
  onImmediateUpdate,
}) => {
  // Parse settings with defaults
  const aiEnabled = settings?.enabled ?? false;
  const provider = (settings?.provider as "openai" | "anthropic" | "gemini") ?? "gemini";
  const model = settings?.model ?? "gemini-pro";
  const temperature = settings?.temperature ?? 0.7;
  const maxTokens = settings?.max_tokens ?? 2048;
  const timeout = settings?.timeout ?? 30;
  const apiKeys = settings?.api_keys ?? { gemini: "", openai: "", anthropic: "" };
  
  const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

    if (aiEnabled) {
      fetchStatus();
      // Refresh every 30 seconds
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [aiEnabled]);

  const handleSettingChange = (key: string, value: unknown) => {
    setHasUnsavedChanges(true);
    onAiSchedulingChange(
      key as keyof NonNullable<Settings["ai_scheduling"]>,
      value as string | number | boolean | Record<string, unknown>
    );
  };

  const handleSave = () => {
    if (onImmediateUpdate) {
      onImmediateUpdate();
      setHasUnsavedChanges(false);
    }
  };

  const getProviderModels = (provider: string) => {
    switch (provider) {
      case "openai":
        return ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"];
      case "anthropic":
        return ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"];
      case "gemini":
        return ["gemini-pro", "gemini-pro-vision"];
      default:
        return [];
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              AI & Integrations
            </CardTitle>
            <CardDescription>
              Configure AI-powered features and external integrations. All
              settings are auto-saved.
            </CardDescription>
          </div>
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Unsaved changes
              </Badge>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Now
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="providers" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Providers
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="general" className="space-y-6">
              {/* Enable AI */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="ai-enabled" className="text-base font-medium">
                    Enable AI Schedule Generation
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow the system to use AI for generating and optimizing
                    schedules
                  </p>
                </div>
                <Switch
                  id="ai-enabled"
                  checked={aiEnabled}
                  onCheckedChange={(checked) =>
                    handleSettingChange("enabled", checked)
                  }
                />
              </div>

              {/* Provider Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Provider Configuration
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Provider</Label>
                    <Select
                      value={provider}
                      onValueChange={(value) =>
                        handleSettingChange("provider", value)
                      }
                      disabled={!aiEnabled}
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
                      value={model}
                      onValueChange={(value) =>
                        handleSettingChange("model", value)
                      }
                      disabled={!aiEnabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getProviderModels(provider).map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Temperature: {temperature.toFixed(1)}</Label>
                  <Slider
                    value={[temperature]}
                    onValueChange={([value]) =>
                      handleSettingChange("temperature", value)
                    }
                    min={0}
                    max={2}
                    step={0.1}
                    disabled={!aiEnabled}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness (0 = deterministic, 2 = very creative)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      value={maxTokens}
                      onChange={(e) =>
                        handleSettingChange("max_tokens", Number(e.target.value))
                      }
                      min={100}
                      max={4096}
                      disabled={!aiEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Timeout (seconds)</Label>
                    <Input
                      type="number"
                      value={timeout}
                      onChange={(e) =>
                        handleSettingChange("timeout", Number(e.target.value))
                      }
                      min={5}
                      max={300}
                      disabled={!aiEnabled}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="providers" className="space-y-6">
              {/* API Keys */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  API Keys
                </h4>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="gemini-api-key">Gemini API Key</Label>
                    <Input
                      id="gemini-api-key"
                      type="password"
                      placeholder="Enter your Gemini API Key"
                      value={apiKeys.gemini || ""}
                      onChange={(e) =>
                        handleSettingChange("api_keys", {
                          ...apiKeys,
                          gemini: e.target.value,
                        })
                      }
                      disabled={!aiEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                    <Input
                      id="openai-api-key"
                      type="password"
                      placeholder="Enter your OpenAI API Key"
                      value={apiKeys.openai || ""}
                      onChange={(e) =>
                        handleSettingChange("api_keys", {
                          ...apiKeys,
                          openai: e.target.value,
                        })
                      }
                      disabled={!aiEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anthropic-api-key">Anthropic API Key</Label>
                    <Input
                      id="anthropic-api-key"
                      type="password"
                      placeholder="Enter your Anthropic API Key"
                      value={apiKeys.anthropic || ""}
                      onChange={(e) =>
                        handleSettingChange("api_keys", {
                          ...apiKeys,
                          anthropic: e.target.value,
                        })
                      }
                      disabled={!aiEnabled}
                    />
                  </div>
                </div>
              </div>

              {/* Provider Status */}
              {aiEnabled && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Provider Status
                      {isLoadingStatus && (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      )}
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsLoadingStatus(true)}
                      className="h-8 w-8 p-0"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>

                  {providerStatus.length > 0 ? (
                    <div className="space-y-2">
                      {providerStatus.map((status) => (
                        <div
                          key={status.provider}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            {status.status === "available" ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : status.status === "unavailable" ? (
                              <Clock className="h-4 w-4 text-yellow-600" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm font-medium capitalize">
                              {status.provider}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {status.has_api_key ? (
                              <Badge variant="secondary" className="text-xs">
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                No API Key
                              </Badge>
                            )}
                            {status.response_time && (
                              <span className="text-xs text-muted-foreground">
                                {status.response_time}ms
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                      No provider status available. Check your API keys and try
                      refreshing.
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              {/* System Health */}
              {aiEnabled && systemHealth && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    System Health
                  </h4>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {systemHealth.status === "healthy" ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : systemHealth.status === "degraded" ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="text-base font-medium">
                        System Status: {systemHealth.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Last checked:{" "}
                      {new Date(systemHealth.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Placeholder for future system settings */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Additional system settings (caching, rate limiting, etc.) will
                  be available in a future update.
                </p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default IntegrationsAISection;
