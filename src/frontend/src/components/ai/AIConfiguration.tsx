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
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { aiService, type AISettings } from "@/services/aiService";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Settings,
  Shield,
  TestTube,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

interface AIConfigurationProps {
  className?: string;
}

interface ProviderStatus {
  openai: "connected" | "disconnected" | "testing" | "error";
  anthropic: "connected" | "disconnected" | "testing" | "error";
  gemini: "connected" | "disconnected" | "testing" | "error";
}

export const AIConfiguration: React.FC<AIConfigurationProps> = ({
  className,
}) => {
  const [settings, setSettings] = useState<AISettings>({
    providers: {
      gemini_api_key: "",
      openai_api_key: "",
      anthropic_api_key: "",
    },
    agents: {
      schedule_agent_enabled: true,
      analytics_agent_enabled: true,
      notification_agent_enabled: true,
    },
    workflow: {
      auto_approval_enabled: false,
      max_concurrent_workflows: 3,
    },
    chat: {
      max_conversation_length: 100,
      enable_suggestions: true,
      enable_feedback: true,
    },
    voice: {
      enabled: true,
      language: "de-DE",
      voice_commands: true,
    },
    files: {
      upload_enabled: true,
      max_file_size: 50,
      allowed_types: ["pdf", "csv", "json", "txt", "xlsx"],
    },
    realtime: {
      typing_indicators: true,
      live_updates: true,
      websocket_enabled: true,
    },
  });

  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({
    openai: "disconnected",
    anthropic: "disconnected",
    gemini: "disconnected",
  });

  const [showApiKeys, setShowApiKeys] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    setHasChanges(true);
  }, [settings]);

  const loadSettings = async () => {
    try {
      const currentSettings = await aiService.getSettings();
      setSettings(currentSettings);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Einstellungen konnten nicht geladen werden");
    }
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      await aiService.updateSettings(settings);
      setHasChanges(false);
      toast.success("Einstellungen gespeichert");

      // Test all providers after saving
      testAllProviders();
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Fehler beim Speichern der Einstellungen");
    } finally {
      setIsLoading(false);
    }
  };

  const testProvider = async (provider: "openai" | "anthropic" | "gemini") => {
    setProviderStatus((prev) => ({ ...prev, [provider]: "testing" }));

    try {
      const result = await aiService.testAIProvider(provider);

      if (result.success) {
        setProviderStatus((prev) => ({ ...prev, [provider]: "connected" }));
        toast.success(
          `${provider.toUpperCase()} verbunden (${result.response_time}ms)`,
        );
      } else {
        setProviderStatus((prev) => ({ ...prev, [provider]: "error" }));
        toast.error(`${provider.toUpperCase()} Fehler: ${result.error}`);
      }
    } catch (error) {
      setProviderStatus((prev) => ({ ...prev, [provider]: "error" }));
      toast.error(`${provider.toUpperCase()} Test fehlgeschlagen`);
    }
  };

  const testAllProviders = async () => {
    const providers: ("openai" | "anthropic" | "gemini")[] = [
      "openai",
      "anthropic",
      "gemini",
    ];

    for (const provider of providers) {
      if (settings.providers[`${provider}_api_key`]) {
        await testProvider(provider);
      }
    }
  };

  const getStatusIcon = (status: ProviderStatus[keyof ProviderStatus]) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "testing":
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: ProviderStatus[keyof ProviderStatus]) => {
    switch (status) {
      case "connected":
        return "Verbunden";
      case "testing":
        return "Teste...";
      case "error":
        return "Fehler";
      default:
        return "Nicht verbunden";
    }
  };

  const maskApiKey = (key: string) => {
    if (!key || key.length < 8) return key;
    return key.slice(0, 4) + "•".repeat(key.length - 8) + key.slice(-4);
  };

  const updateSetting = (path: string[], value: any) => {
    setSettings((prev) => {
      const newSettings = { ...prev };
      let current: any = newSettings;

      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }

      current[path[path.length - 1]] = value;
      return newSettings;
    });
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-2xl font-bold">AI Configuration</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSettings} disabled={isLoading}>
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
            />
            Reload
          </Button>
          <Button onClick={saveSettings} disabled={!hasChanges || isLoading}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* AI Providers */}
        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Provider Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* API Key Visibility Toggle */}
              <div className="flex items-center justify-between">
                <Label>Show API Keys</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKeys(!showApiKeys)}
                >
                  {showApiKeys ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <Separator />

              {/* Gemini */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Google Gemini</Label>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(providerStatus.gemini)}
                    <span className="text-sm">
                      {getStatusText(providerStatus.gemini)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testProvider("gemini")}
                      disabled={!settings.providers.gemini_api_key}
                    >
                      <TestTube className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Input
                  type={showApiKeys ? "text" : "password"}
                  placeholder="Gemini API Key"
                  value={
                    showApiKeys
                      ? settings.providers.gemini_api_key
                      : maskApiKey(settings.providers.gemini_api_key || "")
                  }
                  onChange={(e) =>
                    updateSetting(
                      ["providers", "gemini_api_key"],
                      e.target.value,
                    )
                  }
                />
                <Badge variant="outline" className="text-xs">
                  Empfohlen • Kosteneffektiv • Große Kontextfenster
                </Badge>
              </div>

              {/* OpenAI */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">OpenAI</Label>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(providerStatus.openai)}
                    <span className="text-sm">
                      {getStatusText(providerStatus.openai)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testProvider("openai")}
                      disabled={!settings.providers.openai_api_key}
                    >
                      <TestTube className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Input
                  type={showApiKeys ? "text" : "password"}
                  placeholder="OpenAI API Key"
                  value={
                    showApiKeys
                      ? settings.providers.openai_api_key
                      : maskApiKey(settings.providers.openai_api_key || "")
                  }
                  onChange={(e) =>
                    updateSetting(
                      ["providers", "openai_api_key"],
                      e.target.value,
                    )
                  }
                />
                <Badge variant="outline" className="text-xs">
                  Bewährt • Hohe Qualität • GPT-4 Modelle
                </Badge>
              </div>

              {/* Anthropic */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">
                    Anthropic Claude
                  </Label>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(providerStatus.anthropic)}
                    <span className="text-sm">
                      {getStatusText(providerStatus.anthropic)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testProvider("anthropic")}
                      disabled={!settings.providers.anthropic_api_key}
                    >
                      <TestTube className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Input
                  type={showApiKeys ? "text" : "password"}
                  placeholder="Anthropic API Key"
                  value={
                    showApiKeys
                      ? settings.providers.anthropic_api_key
                      : maskApiKey(settings.providers.anthropic_api_key || "")
                  }
                  onChange={(e) =>
                    updateSetting(
                      ["providers", "anthropic_api_key"],
                      e.target.value,
                    )
                  }
                />
                <Badge variant="outline" className="text-xs">
                  Präzise • Sicherheitsfokussiert • Claude Modelle
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Agents */}
        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                AI Agent Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Schedule Optimizer Agent</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatische Schichtplanoptimierung und -vorschläge
                  </p>
                </div>
                <Switch
                  checked={settings.agents.schedule_agent_enabled}
                  onCheckedChange={(checked) =>
                    updateSetting(["agents", "schedule_agent_enabled"], checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Analytics Agent</Label>
                  <p className="text-sm text-muted-foreground">
                    Datenanalyse und Berichtserstellung
                  </p>
                </div>
                <Switch
                  checked={settings.agents.analytics_agent_enabled}
                  onCheckedChange={(checked) =>
                    updateSetting(
                      ["agents", "analytics_agent_enabled"],
                      checked,
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Notification Agent</Label>
                  <p className="text-sm text-muted-foreground">
                    Intelligente Benachrichtigungen und Erinnerungen
                  </p>
                </div>
                <Switch
                  checked={settings.agents.notification_agent_enabled}
                  onCheckedChange={(checked) =>
                    updateSetting(
                      ["agents", "notification_agent_enabled"],
                      checked,
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Settings */}
        <TabsContent value="workflow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Workflow Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Approval</Label>
                  <p className="text-sm text-muted-foreground">
                    Workflows automatisch ohne Benutzerbestätigung ausführen
                  </p>
                </div>
                <Switch
                  checked={settings.workflow.auto_approval_enabled}
                  onCheckedChange={(checked) =>
                    updateSetting(
                      ["workflow", "auto_approval_enabled"],
                      checked,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Max Concurrent Workflows:{" "}
                  {settings.workflow.max_concurrent_workflows}
                </Label>
                <Slider
                  value={[settings.workflow.max_concurrent_workflows]}
                  onValueChange={([value]) =>
                    updateSetting(
                      ["workflow", "max_concurrent_workflows"],
                      value,
                    )
                  }
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Maximale Anzahl gleichzeitig laufender Workflows
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features */}
        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Voice Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Voice Input</Label>
                  <Switch
                    checked={settings.voice.enabled}
                    onCheckedChange={(checked) =>
                      updateSetting(["voice", "enabled"], checked)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={settings.voice.language}
                    onValueChange={(value) =>
                      updateSetting(["voice", "language"], value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de-DE">Deutsch</SelectItem>
                      <SelectItem value="en-US">English</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                      <SelectItem value="fr-FR">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Voice Commands</Label>
                  <Switch
                    checked={settings.voice.voice_commands}
                    onCheckedChange={(checked) =>
                      updateSetting(["voice", "voice_commands"], checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">File Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>File Upload</Label>
                  <Switch
                    checked={settings.files.upload_enabled}
                    onCheckedChange={(checked) =>
                      updateSetting(["files", "upload_enabled"], checked)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max File Size: {settings.files.max_file_size}MB</Label>
                  <Slider
                    value={[settings.files.max_file_size]}
                    onValueChange={([value]) =>
                      updateSetting(["files", "max_file_size"], value)
                    }
                    max={100}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Advanced Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>
                  Max Conversation Length:{" "}
                  {settings.chat.max_conversation_length}
                </Label>
                <Slider
                  value={[settings.chat.max_conversation_length]}
                  onValueChange={([value]) =>
                    updateSetting(["chat", "max_conversation_length"], value)
                  }
                  max={1000}
                  min={10}
                  step={10}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Real-time Typing Indicators</Label>
                <Switch
                  checked={settings.realtime.typing_indicators}
                  onCheckedChange={(checked) =>
                    updateSetting(["realtime", "typing_indicators"], checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Live Updates</Label>
                <Switch
                  checked={settings.realtime.live_updates}
                  onCheckedChange={(checked) =>
                    updateSetting(["realtime", "live_updates"], checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>WebSocket Connection</Label>
                <Switch
                  checked={settings.realtime.websocket_enabled}
                  onCheckedChange={(checked) =>
                    updateSetting(["realtime", "websocket_enabled"], checked)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIConfiguration;
