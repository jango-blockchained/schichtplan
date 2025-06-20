/**
 * AI Service for connecting frontend to backend AI endpoints
 */

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatRequest {
  message: string;
  conversation_id?: string;
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
  status: 'active' | 'inactive' | 'maintenance';
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
  difficulty: 'low' | 'medium' | 'high';
}

interface WorkflowExecution {
  id: string;
  template_id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
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
  status: 'available' | 'unavailable' | 'deprecated';
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
}

class AIService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/ai${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`AI Service request failed:`, error);
      throw error;
    }
  }

  // Chat methods
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getChatHistory(conversationId: string): Promise<ChatMessage[]> {
    return this.request<ChatMessage[]>(`/chat/history/${conversationId}`);
  }

  // Agent methods
  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('/agents');
  }

  async getAgent(agentId: string): Promise<Agent> {
    return this.request<Agent>(`/agents/${agentId}`);
  }

  async toggleAgent(agentId: string, enabled: boolean): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/agents/${agentId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  // Workflow methods
  async getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    return this.request<WorkflowTemplate[]>('/workflows/templates');
  }

  async executeWorkflow(templateId: string, inputs: Record<string, unknown>): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>('/workflows/execute', {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId, inputs }),
    });
  }

  async getWorkflowExecutions(): Promise<WorkflowExecution[]> {
    return this.request<WorkflowExecution[]>('/workflows/executions');
  }

  async getWorkflowExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>(`/workflows/executions/${executionId}`);
  }

  // MCP Tools methods
  async getMCPTools(): Promise<MCPTool[]> {
    return this.request<MCPTool[]>('/tools');
  }

  async executeMCPTool(toolId: string, parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    return this.request<ToolExecutionResult>('/tools/execute', {
      method: 'POST',
      body: JSON.stringify({ tool_id: toolId, parameters }),
    });
  }

  // Analytics methods
  async getAnalytics(startDate?: string, endDate?: string): Promise<AnalyticsData> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<AnalyticsData>(`/analytics${query}`);
  }

  // Settings methods
  async getSettings(): Promise<AISettings> {
    return this.request<AISettings>('/settings');
  }

  async updateSettings(settings: Partial<AISettings>): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }
}

export const aiService = new AIService();
export type {
    AISettings, Agent, AnalyticsData, ChatMessage,
    ChatRequest,
    ChatResponse, MCPTool, ToolExecutionResult, WorkflowExecution, WorkflowTemplate
};

