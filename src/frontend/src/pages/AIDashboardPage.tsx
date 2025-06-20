import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Activity,
    AlertCircle,
    BarChart3,
    Bot,
    Calendar,
    CheckCircle,
    Clock,
    MessageSquare,
    Settings,
    Sparkles,
    TrendingUp,
    Users,
    Workflow,
    Zap
} from "lucide-react";
import React, { useEffect, useState } from "react";

// Import AI components
import { AgentDashboard } from "@/components/ai/AgentDashboard";
import { AIAnalytics } from "@/components/ai/AIAnalytics";
import { AISettingsPanel } from "@/components/ai/AISettingsPanel";
import { ConversationalAIChat } from "@/components/ai/ConversationalAIChat";
import { MCPToolsPanel } from "@/components/ai/MCPToolsPanel";
import { WorkflowOrchestrator } from "@/components/ai/WorkflowOrchestrator";

interface AICapability {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive" | "processing";
  icon: React.ReactNode;
  stats: {
    usage: number;
    success_rate: number;
    avg_response_time: number;
  };
}

const AIDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [aiCapabilities, setAiCapabilities] = useState<AICapability[]>([]);
  const [systemHealth, setSystemHealth] = useState({
    status: "healthy" as "healthy" | "warning" | "error",
    agents: 3,
    activeWorkflows: 2,
    conversations: 12,
    uptime: "99.9%"
  });

  useEffect(() => {
    // Initialize AI capabilities data
    setAiCapabilities([
      {
        id: "conversational_ai",
        name: "Conversational AI",
        description: "Multi-turn conversations with state persistence",
        status: "active",
        icon: <MessageSquare className="h-4 w-4" />,
        stats: { usage: 89, success_rate: 96, avg_response_time: 1.2 }
      },
      {
        id: "agent_system",
        name: "AI Agent System",
        description: "Specialized agents for different scheduling tasks",
        status: "active",
        icon: <Bot className="h-4 w-4" />,
        stats: { usage: 76, success_rate: 94, avg_response_time: 2.1 }
      },
      {
        id: "workflow_orchestration",
        name: "Workflow Orchestration",
        description: "Multi-step workflow automation",
        status: "active",
        icon: <Workflow className="h-4 w-4" />,
        stats: { usage: 65, success_rate: 98, avg_response_time: 3.4 }
      },
      {
        id: "schedule_optimization",
        name: "Schedule Optimization",
        description: "AI-powered schedule optimization and conflict resolution",
        status: "active",
        icon: <Calendar className="h-4 w-4" />,
        stats: { usage: 92, success_rate: 97, avg_response_time: 2.8 }
      },
      {
        id: "employee_management",
        name: "Employee Management",
        description: "Intelligent employee assignment and workload analysis",
        status: "active",
        icon: <Users className="h-4 w-4" />,
        stats: { usage: 71, success_rate: 95, avg_response_time: 1.8 }
      },
      {
        id: "analytics_insights",
        name: "Analytics & Insights",
        description: "AI-driven analytics and business intelligence",
        status: "processing",
        icon: <BarChart3 className="h-4 w-4" />,
        stats: { usage: 58, success_rate: 92, avg_response_time: 4.2 }
      }
    ]);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "inactive":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "processing":
        return "secondary";
      case "inactive":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Dashboard
          </h1>
          <p className="text-muted-foreground">
            Advanced AI-powered scheduling system with conversational interface and intelligent automation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={systemHealth.status === "healthy" ? "default" : "destructive"} className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            System {systemHealth.status === "healthy" ? "Healthy" : "Issues"}
          </Badge>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Active Agents</p>
                <p className="text-2xl font-bold">{systemHealth.agents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Workflow className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Running Workflows</p>
                <p className="text-2xl font-bold">{systemHealth.activeWorkflows}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Active Conversations</p>
                <p className="text-2xl font-bold">{systemHealth.conversations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">System Uptime</p>
                <p className="text-2xl font-bold">{systemHealth.uptime}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Capabilities Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            AI Capabilities Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiCapabilities.map((capability) => (
              <Card key={capability.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {capability.icon}
                    <span className="font-medium">{capability.name}</span>
                  </div>
                  {getStatusIcon(capability.status)}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {capability.description}
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Usage:</span>
                    <span>{capability.stats.usage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <span>{capability.stats.success_rate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Response:</span>
                    <span>{capability.stats.avg_response_time}s</span>
                  </div>
                </div>
                <Badge 
                  variant={getStatusBadgeVariant(capability.status)} 
                  className="mt-2 w-full justify-center"
                >
                  {capability.status.charAt(0).toUpperCase() + capability.status.slice(1)}
                </Badge>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main AI Interface Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            AI Chat
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Tools
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <Calendar className="h-4 w-4 mr-2" />
                    Optimize Current Schedule
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Analyze Employee Workload
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Workflow className="h-4 w-4 mr-2" />
                    Run Comprehensive Analysis
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generate Insights Report
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent AI Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                      <Bot className="h-4 w-4 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Schedule optimization completed</p>
                        <p className="text-xs text-muted-foreground">2 minutes ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">New conversation started</p>
                        <p className="text-xs text-muted-foreground">5 minutes ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                      <Workflow className="h-4 w-4 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Workflow execution finished</p>
                        <p className="text-xs text-muted-foreground">12 minutes ago</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="chat">
            <ConversationalAIChat />
          </TabsContent>

          <TabsContent value="agents">
            <AgentDashboard />
          </TabsContent>

          <TabsContent value="workflows">
            <WorkflowOrchestrator />
          </TabsContent>

          <TabsContent value="analytics">
            <AIAnalytics />
          </TabsContent>

          <TabsContent value="tools">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MCPToolsPanel />
              <AISettingsPanel />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default AIDashboardPage;
