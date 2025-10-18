/**
 * AI Service for connecting frontend to backend AI endpoints
 */

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

interface ChatRequest {
  message: string;
  conversation_id?: string;
  context?: any;
}

interface ChatResponse {
  response: string;
  conversation_id: string;
  suggestions?: string[];
  metadata?: Record<string, unknown>;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  description: string;
  status: "active" | "inactive" | "maintenance";
  capabilities: string[];
  performance: {
    total_requests: number;
    success_rate: number;
    avg_response_time: number;
    last_active: string;
  };
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    required_inputs: string[];
    outputs: string[];
  }>;
  estimated_duration: number;
  difficulty: "low" | "medium" | "high";
}

interface WorkflowExecution {
  id: string;
  template_id: string;
  name: string;
  status: "pending" | "running" | "paused" | "completed" | "failed";
  progress: number;
  start_time: string;
  end_time?: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
}

interface MCPTool {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    default?: unknown;
  }>;
  status: "available" | "unavailable" | "deprecated";
  last_used?: string;
  usage_count: number;
}

interface AnalyticsData {
  overview: {
    total_conversations: number;
    total_workflows: number;
    total_tools_used: number;
    avg_response_time: number;
  };
  trends: Array<{
    date: string;
    conversations: number;
    workflows: number;
    tools_used: number;
  }>;
  top_agents: Array<{
    agent_id: string;
    name: string;
    usage_count: number;
    success_rate: number;
  }>;
  workflow_performance: Array<{
    template_id: string;
    name: string;
    execution_count: number;
    avg_duration: number;
    success_rate: number;
  }>;
}

interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  execution_time: number;
}

interface AISettings {
  providers: {
    gemini_api_key?: string;
    openai_api_key?: string;
    anthropic_api_key?: string;
  };
  agents: {
    schedule_agent_enabled: boolean;
    analytics_agent_enabled: boolean;
    notification_agent_enabled: boolean;
  };
  workflow: {
    auto_approval_enabled: boolean;
    max_concurrent_workflows: number;
  };
  chat: {
    max_conversation_length: number;
    enable_suggestions: boolean;
    enable_feedback: boolean;
  };
  voice: {
    enabled: boolean;
    language: string;
    voice_commands: boolean;
  };
  files: {
    upload_enabled: boolean;
    max_file_size: number;
    allowed_types: string[];
  };
  realtime: {
    typing_indicators: boolean;
    live_updates: boolean;
    websocket_enabled: boolean;
  };
}

interface FileUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string | ArrayBuffer;
  processed: boolean;
  analysis?: Record<string, unknown>;
}

interface VoiceCommand {
  id: string;
  transcript: string;
  confidence: number;
  timestamp: Date;
  action?: string;
  parameters?: Record<string, unknown>;
}

interface TypingIndicator {
  user_id: string;
  conversation_id: string;
  is_typing: boolean;
  timestamp: Date;
}

interface LiveUpdate {
  id: string;
  type:
    | "workflow_progress"
    | "agent_status"
    | "system_event"
    | "conversation_update";
  data: Record<string, unknown>;
  timestamp: Date;
}

interface WorkflowStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  progress: number;
  result?: unknown;
  error?: string;
  start_time?: string;
  end_time?: string;
}

import { io, Socket } from "socket.io-client";

type EventHandler = (data: unknown) => void;

class AIService {
  private baseUrl: string;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private socket: Socket | null = null;
  private eventHandlers: Map<string, EventHandler[]> = new Map();

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    this.connectWebSocket();
  }

  public async connectWebSocket(): Promise<void> {
    if (this.socket && this.socket.connected) return;
    const url = this.baseUrl; // e.g., http://localhost:5000
    this.socket = io(url, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      this.emit("websocket:connected", { timestamp: new Date() });
    });

    this.socket.on("disconnect", () => {
      this.emit("websocket:disconnected", { timestamp: new Date() });
    });

    // Wire backend events to local event bus with the names the app expects
    this.socket.on("typing_indicator", (data) =>
      this.emit("typing_indicator", data),
    );
    this.socket.on("ai_thinking", (data) => this.emit("ai_thinking", data));
    this.socket.on("new_message", (data) => this.emit("new_message", data));
    this.socket.on("workflow_update", (data) =>
      this.emit("workflow_update", data),
    );
    this.socket.on("file_analysis_complete", (data) =>
      this.emit("file_analysis_complete", data),
    );
    this.socket.on("system_status", (data) => this.emit("system_status", data));
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public joinConversation(conversationId: string, userId: string): void {
    this.socket?.emit("join_conversation", {
      conversation_id: conversationId,
      user_id: userId || "anonymous",
    });
  }

  public leaveConversation(conversationId: string): void {
    this.socket?.emit("leave_conversation", {
      conversation_id: conversationId,
    });
  }

  public startTyping(conversationId: string, userId: string): void {
    this.socket?.emit("typing_start", {
      conversation_id: conversationId,
      user_id: userId || "anonymous",
    });
  }

  public stopTyping(conversationId: string, userId: string): void {
    this.socket?.emit("typing_stop", {
      conversation_id: conversationId,
      user_id: userId || "anonymous",
    });
  }

  public setAiThinking(conversationId: string, isThinking: boolean): void {
    this.socket?.emit("ai_thinking", {
      conversation_id: conversationId,
      is_thinking: isThinking,
    });
  }

  private emit(event: string, data: unknown) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    });
  }

  public on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0,
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v2${endpoint}`;

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        if (response.status >= 500 && retryCount < this.retryAttempts) {
          // Server error, retry with exponential backoff
          const delay = this.retryDelay * Math.pow(2, retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, retryCount + 1);
        }

        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      const err = error as unknown as { code?: string };
      if (
        retryCount < this.retryAttempts &&
        (error instanceof TypeError || err.code === "NETWORK_ERROR")
      ) {
        // Network error, retry
        const delay = this.retryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      console.error(`AI Service request failed:`, error);
      throw error;
    }
  }

  // Chat methods
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Compatibility wrapper used by some components (maps to sendChatMessage)
  async sendMessage(
    content: string,
    options?: { conversation_id?: string; include_metadata?: boolean } & Record<
      string,
      unknown
    >,
  ): Promise<{
    message: string;
    metadata?: Record<string, unknown>;
    conversation_id?: string;
  }> {
    const resp = await this.sendChatMessage({
      message: content,
      conversation_id: options?.conversation_id,
    });
    return {
      message: resp.response,
      metadata: resp.metadata,
      conversation_id: resp.conversation_id,
    };
  }

  async getChatHistory(conversationId: string): Promise<ChatMessage[]> {
    return this.request<ChatMessage[]>(`/chat/history/${conversationId}`);
  }

  // Agent methods
  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>("/agents");
  }

  async getAgent(agentId: string): Promise<Agent> {
    return this.request<Agent>(`/agents/${agentId}`);
  }

  async toggleAgent(
    agentId: string,
    enabled: boolean,
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/agents/${agentId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
  }

  // Workflow methods
  async getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    return this.request<WorkflowTemplate[]>("/workflows/templates");
  }

  async executeWorkflow(
    templateId: string,
    inputs: Record<string, unknown>,
  ): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>("/workflows/execute", {
      method: "POST",
      body: JSON.stringify({ template_id: templateId, inputs }),
    });
  }

  async getWorkflowExecutions(): Promise<WorkflowExecution[]> {
    return this.request<WorkflowExecution[]>("/workflows/executions");
  }

  async getWorkflowExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>(
      `/workflows/executions/${executionId}`,
    );
  }

  // MCP Tools methods
  async getMCPTools(): Promise<MCPTool[]> {
    return this.request<MCPTool[]>("/tools");
  }

  async executeMCPTool(
    toolId: string,
    parameters: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    return this.request<ToolExecutionResult>("/tools/execute", {
      method: "POST",
      body: JSON.stringify({ tool_id: toolId, parameters }),
    });
  }

  // Analytics methods
  async getAnalytics(
    startDate?: string,
    endDate?: string,
  ): Promise<AnalyticsData> {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<AnalyticsData>(`/analytics${query}`);
  }

  // Settings methods
  async getSettings(): Promise<AISettings> {
    return this.request<AISettings>("/settings");
  }

  async updateSettings(
    settings: Partial<AISettings>,
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    });
  }

  // Schedule generation via AI
  async generateSchedule(
    requestData: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    return this.request<{ success: boolean; error?: string }>(
      "/generate_schedule",
      {
        method: "POST",
        body: JSON.stringify(requestData),
      },
    );
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>("/health");
  }

  // Voice Input Methods
  async processVoiceCommand(audioBlob: Blob): Promise<VoiceCommand> {
    const formData = new FormData();
    formData.append("audio", audioBlob);

    const response = await fetch(`${this.baseUrl}/api/v2/voice/command`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Voice processing failed: ${response.status}`);
    }

    return response.json();
  }

  async enableVoiceRecognition(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/voice/enable", {
      method: "POST",
    });
  }

  // File Upload Methods
  async uploadFile(file: File): Promise<FileUpload> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseUrl}/api/v2/files/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`File upload failed: ${response.status}`);
    }

    return response.json();
  }

  async analyzeFile(
    fileId: string,
  ): Promise<{ analysis: Record<string, unknown> }> {
    return this.request<{ analysis: Record<string, unknown> }>(
      `/files/${fileId}/analyze`,
      {
        method: "POST",
      },
    );
  }

  async getUploadedFiles(): Promise<FileUpload[]> {
    return this.request<FileUpload[]>("/files");
  }

  // Real-time Features
  async sendTypingIndicator(
    conversationId: string,
    isTyping: boolean,
  ): Promise<void> {
    if (isTyping) {
      this.startTyping(conversationId, "user");
    } else {
      this.stopTyping(conversationId, "user");
    }
  }

  async subscribeLiveUpdates(conversationId: string): Promise<void> {
    this.joinConversation(conversationId, "user");
  }

  async unsubscribeLiveUpdates(conversationId: string): Promise<void> {
    this.leaveConversation(conversationId);
  }

  // Enhanced Workflow Methods
  async createWorkflow(
    template: Partial<WorkflowTemplate>,
  ): Promise<WorkflowTemplate> {
    return this.request<WorkflowTemplate>("/workflows/templates", {
      method: "POST",
      body: JSON.stringify(template),
    });
  }

  async getWorkflowSteps(executionId: string): Promise<WorkflowStep[]> {
    return this.request<WorkflowStep[]>(
      `/workflows/executions/${executionId}/steps`,
    );
  }

  async pauseWorkflow(executionId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/workflows/executions/${executionId}/pause`,
      {
        method: "POST",
      },
    );
  }

  async resumeWorkflow(executionId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/workflows/executions/${executionId}/resume`,
      {
        method: "POST",
      },
    );
  }

  async cancelWorkflow(executionId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/workflows/executions/${executionId}/cancel`,
      {
        method: "POST",
      },
    );
  }

  // Enhanced MCP Tools Methods
  async getMCPToolCategories(): Promise<string[]> {
    return this.request<string[]>("/tools/categories");
  }

  async searchMCPTools(query: string, category?: string): Promise<MCPTool[]> {
    const params = new URLSearchParams({ query });
    if (category) params.append("category", category);

    return this.request<MCPTool[]>(`/tools/search?${params.toString()}`);
  }

  async getMCPToolUsageHistory(): Promise<
    Array<{
      tool_id: string;
      usage_count: number;
      last_used: string;
      success_rate: number;
    }>
  > {
    return this.request<
      Array<{
        tool_id: string;
        usage_count: number;
        last_used: string;
        success_rate: number;
      }>
    >("/tools/usage-history");
  }

  async validateMCPToolParameters(
    toolId: string,
    parameters: Record<string, unknown>,
  ): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    return this.request<{
      valid: boolean;
      errors?: string[];
    }>(`/tools/${toolId}/validate`, {
      method: "POST",
      body: JSON.stringify({ parameters }),
    });
  }

  // Advanced Analytics
  async getDetailedAnalytics(timeframe: string): Promise<{
    performance: {
      response_times: number[];
      success_rates: number[];
      error_rates: number[];
    };
    usage: {
      peak_hours: number[];
      user_activity: Array<{ user_id: string; sessions: number }>;
      feature_usage: Record<string, number>;
    };
    trends: {
      daily_metrics: Array<{ date: string; metrics: Record<string, number> }>;
      predictions: Array<{
        metric: string;
        trend: "up" | "down" | "stable";
        confidence: number;
      }>;
    };
  }> {
    return this.request<{
      performance: {
        response_times: number[];
        success_rates: number[];
        error_rates: number[];
      };
      usage: {
        peak_hours: number[];
        user_activity: Array<{ user_id: string; sessions: number }>;
        feature_usage: Record<string, number>;
      };
      trends: {
        daily_metrics: Array<{ date: string; metrics: Record<string, number> }>;
        predictions: Array<{
          metric: string;
          trend: "up" | "down" | "stable";
          confidence: number;
        }>;
      };
    }>(`/analytics/detailed?timeframe=${timeframe}`);
  }

  // Schedule Optimization with AI
  async optimizeScheduleWithAI(parameters: {
    week_start: string;
    optimization_goals: string[];
    constraints: Record<string, unknown>;
    preferences: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    optimized_schedule?: unknown;
    improvements: Array<{
      metric: string;
      before: number;
      after: number;
      improvement_percent: number;
    }>;
    recommendations: string[];
  }> {
    return this.request<{
      success: boolean;
      optimized_schedule?: unknown;
      improvements: Array<{
        metric: string;
        before: number;
        after: number;
        improvement_percent: number;
      }>;
      recommendations: string[];
    }>("/schedule/optimize-ai", {
      method: "POST",
      body: JSON.stringify(parameters),
    });
  }

  // Conversation Export
  async exportConversation(
    conversationId: string,
    format: "json" | "txt" | "pdf",
  ): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/api/v2/chat/export/${conversationId}?format=${format}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    return response.blob();
  }

  // AI Provider Testing
  async testAIProvider(provider: "openai" | "anthropic" | "gemini"): Promise<{
    success: boolean;
    response_time: number;
    error?: string;
  }> {
    return this.request<{
      success: boolean;
      response_time: number;
      error?: string;
    }>(`/providers/${provider}/test`, {
      method: "POST",
    });
  }

  // Smart Suggestions
  async generateSuggestions(parameters: {
    context: string;
    page: string;
    maxSuggestions: number;
  }): Promise<{
    success: boolean;
    suggestions: Array<{
      id: string;
      type: "action" | "insight" | "optimization" | "alert" | "question";
      title: string;
      description: string;
      priority: "low" | "medium" | "high" | "urgent";
      category: "schedule" | "employee" | "coverage" | "efficiency" | "general";
      actionable: boolean;
      actionLabel?: string;
      metadata?: {
        confidence?: number;
        impact?: string;
        timeframe?: string;
        related_items?: string[];
      };
    }>;
  }> {
    return this.request<{
      success: boolean;
      suggestions: Array<{
        id: string;
        type: "action" | "insight" | "optimization" | "alert" | "question";
        title: string;
        description: string;
        priority: "low" | "medium" | "high" | "urgent";
        category:
          | "schedule"
          | "employee"
          | "coverage"
          | "efficiency"
          | "general";
        actionable: boolean;
        actionLabel?: string;
        metadata?: {
          confidence?: number;
          impact?: string;
          timeframe?: string;
          related_items?: string[];
        };
      }>;
    }>("/suggestions/generate", {
      method: "POST",
      body: JSON.stringify(parameters),
    });
  }

  // AI Search Suggestions
  async generateSearchSuggestions(parameters: {
    query: string;
    context: string;
    page: string;
    max_suggestions: number;
  }): Promise<{
    success: boolean;
    suggestions: Array<{
      id: string;
      type: "query" | "entity" | "action" | "filter";
      text: string;
      description?: string;
      category: "schedule" | "employee" | "coverage" | "general";
      confidence: number;
      metadata?: {
        entity_type?: string;
        entity_id?: string;
        action_type?: string;
        filter_type?: string;
      };
    }>;
  }> {
    return this.request<{
      success: boolean;
      suggestions: Array<{
        id: string;
        type: "query" | "entity" | "action" | "filter";
        text: string;
        description?: string;
        category: "schedule" | "employee" | "coverage" | "general";
        confidence: number;
        metadata?: {
          entity_type?: string;
          entity_id?: string;
          action_type?: string;
          filter_type?: string;
        };
      }>;
    }>("/search/suggestions", {
      method: "POST",
      body: JSON.stringify(parameters),
    });
  }

  async trackSuggestionAction(
    suggestionId: string,
    action: "accepted" | "dismissed" | "viewed"
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/suggestions/track", {
      method: "POST",
      body: JSON.stringify({ suggestion_id: suggestionId, action }),
    });
  }
}

export const aiService = new AIService();
export type {
    Agent,
    AISettings,
    AnalyticsData,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    FileUpload,
    LiveUpdate,
    MCPTool,
    ToolExecutionResult,
    TypingIndicator,
    VoiceCommand,
    WorkflowExecution,
    WorkflowStep,
    WorkflowTemplate
};

