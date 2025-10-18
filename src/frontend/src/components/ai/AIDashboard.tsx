import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Brain,
  CheckCircle2,
  FileText,
  Headphones,
  MessageSquare,
  Settings,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { AgentDashboard } from "./AgentDashboard";
import AIConfiguration from "./AIConfiguration";
import { ConversationalAIChat } from "./ConversationalAIChat";
import FileUploadComponent from "./FileUploadComponent";
import { MCPToolsPanel } from "./MCPToolsPanel";
import VoiceInput from "./VoiceInput";
import WorkflowExecutor from "./WorkflowExecutor";

interface AIDashboardProps {
  className?: string;
}

interface SystemStatus {
  ai_providers: {
    gemini: boolean;
    openai: boolean;
    anthropic: boolean;
  };
  features: {
    voice: boolean;
    file_upload: boolean;
    realtime: boolean;
    workflows: boolean;
  };
  agents: {
    active: number;
    total: number;
  };
  conversations: {
    active: number;
    today: number;
  };
}

export const AIDashboard: React.FC<AIDashboardProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState("chat");
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    ai_providers: {
      gemini: true,
      openai: false,
      anthropic: false,
    },
    features: {
      voice: true,
      file_upload: true,
      realtime: true,
      workflows: true,
    },
    agents: {
      active: 3,
      total: 5,
    },
    conversations: {
      active: 2,
      today: 12,
    },
  });

  const [quickActions, setQuickActions] = useState([
    {
      id: "optimize-schedule",
      title: "Schichtplan optimieren",
      description: "KI-gestützte Optimierung des aktuellen Schichtplans",
      icon: <Zap className="h-4 w-4" />,
      action: () => handleQuickAction("optimize-schedule"),
      enabled: true,
    },
    {
      id: "analyze-workload",
      title: "Arbeitsbelastung analysieren",
      description: "Detaillierte Analyse der Mitarbeiterauslastung",
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => handleQuickAction("analyze-workload"),
      enabled: true,
    },
    {
      id: "voice-command",
      title: "Sprachsteuerung",
      description: "Befehle per Sprache ausführen",
      icon: <Headphones className="h-4 w-4" />,
      action: () => handleQuickAction("voice-command"),
      enabled: systemStatus.features.voice,
    },
    {
      id: "upload-data",
      title: "Daten hochladen",
      description: "CSV oder Excel-Dateien für Analyse hochladen",
      icon: <Upload className="h-4 w-4" />,
      action: () => handleQuickAction("upload-data"),
      enabled: systemStatus.features.file_upload,
    },
  ]);

  useEffect(() => {
    // Load system status on mount
    loadSystemStatus();
  }, []);

  const loadSystemStatus = async () => {
    // In a real implementation, this would fetch from the API
    // For now, we'll simulate the status
    setSystemStatus((prev) => ({
      ...prev,
      // Update status based on actual system state
    }));
  };

  const handleQuickAction = (actionId: string) => {
    switch (actionId) {
      case "optimize-schedule":
        setActiveTab("workflows");
        break;
      case "analyze-workload":
        setActiveTab("analytics");
        break;
      case "voice-command":
        setActiveTab("chat");
        // Focus on voice input in chat
        break;
      case "upload-data":
        setActiveTab("files");
        break;
      default:
        break;
    }
  };

  const getProviderCount = () => {
    return Object.values(systemStatus.ai_providers).filter(Boolean).length;
  };

  const getFeatureCount = () => {
    return Object.values(systemStatus.features).filter(Boolean).length;
  };

  return (
    <div className={cn("space-y-6 p-6", className)}>
      {/* Header with System Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            AI Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Künstliche Intelligenz für intelligente Schichtplanung
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm">{getProviderCount()}/3 AI Provider</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <span className="text-sm">
              {systemStatus.agents.active}/{systemStatus.agents.total} Agents
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple-500" />
            <span className="text-sm">
              {systemStatus.conversations.active} Active
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Card
            key={action.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              !action.enabled && "opacity-50 cursor-not-allowed",
            )}
            onClick={action.enabled ? action.action : undefined}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {action.icon}
                <h3 className="font-medium text-sm">{action.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {action.description}
              </p>
              {!action.enabled && (
                <Badge variant="secondary" className="mt-2 text-xs">
                  Deaktiviert
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main AI Interface */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Config
          </TabsTrigger>
        </TabsList>

        {/* Conversational AI Chat */}
        <TabsContent value="chat" className="space-y-4">
          <ConversationalAIChat />
        </TabsContent>

        {/* AI Agents Dashboard */}
        <TabsContent value="agents" className="space-y-4">
          <AgentDashboard />
        </TabsContent>

        {/* Workflow Execution */}
        <TabsContent value="workflows" className="space-y-4">
          <WorkflowExecutor />
        </TabsContent>

        {/* MCP Tools */}
        <TabsContent value="tools" className="space-y-4">
          <MCPToolsPanel />
        </TabsContent>

        {/* Analytics & Insights */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Analytics & Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">Analytics Dashboard</h3>
                  <p className="text-sm text-muted-foreground">
                    Detaillierte KI-Leistungsanalysen und Einblicke werden hier
                    angezeigt
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* File Management */}
        <TabsContent value="files" className="space-y-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  File Upload & Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FileUploadComponent
                  onFilesUploaded={(files) => {
                    console.log("Files uploaded:", files);
                  }}
                  onFileAnalyzed={(fileId, analysis) => {
                    console.log("File analyzed:", fileId, analysis);
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5" />
                  Voice Input
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VoiceInput
                  onTranscript={(text) => {
                    console.log("Voice transcript:", text);
                  }}
                  onCommand={(command) => {
                    console.log("Voice command:", command);
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Configuration */}
        <TabsContent value="config" className="space-y-4">
          <AIConfiguration />
        </TabsContent>
      </Tabs>

      {/* Status Bar */}
      <div className="fixed bottom-4 right-4 left-4 bg-background/80 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>AI System Online</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="h-3 w-3" />
              <span>Gemini 1.5 Pro</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3" />
              <span>{systemStatus.conversations.today} Gespräche heute</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {getFeatureCount()}/4 Features
            </Badge>
            <Button variant="ghost" size="sm" onClick={loadSystemStatus}>
              <Activity className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIDashboard;
