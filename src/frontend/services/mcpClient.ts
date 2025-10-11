/**
 * MCP Client Service for Frontend Integration
 * 
 * This service provides the foundation for integrating all MCP (Model Context Protocol)
 * functionality into the frontend, including AI agents, workflow coordination,
 * schedule generation, and ML optimization features.
 */

// Types for MCP integration
export interface MCPHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical' | 'error';
  timestamp: string;
  service_info: {
    name: string;
    version: string;
    mode: string;
  };
  components: {
    [componentName: string]: {
      status: string;
      initialized: boolean;
      [key: string]: unknown;
    };
  };
  tools: {
    [toolName: string]: boolean;
  };
  capabilities: {
    [capabilityName: string]: boolean;
  };
}

export interface MCPToolInfo {
  available_tools: Array<{
    name: string;
    description: string;
    category: string;
    parameters: Record<string, unknown>;
  }>;
  categories: {
    [categoryName: string]: unknown[];
  };
  total_count: number;
}

export interface MCPAgentStatus {
  ai_orchestrator_initialized: boolean;
  agent_registry_initialized: boolean;
  workflow_coordinator_initialized: boolean;
  conversation_manager_initialized: boolean;
  full_ai_capabilities: boolean;
  [key: string]: unknown;
}

export interface MCPStatusDashboard {
  overview: {
    service_status: string;
    total_tools: number;
    ai_capabilities: number;
    active_components: number;
  };
  health: MCPHealthStatus;
  tools: MCPToolInfo;
  ai_agents: MCPAgentStatus;
  metrics: {
    uptime: string;
    response_time: string;
    success_rate: string;
    error_rate: string;
  };
}

export interface MCPRequest {
  tool: string;
  parameters: Record<string, unknown>;
  conversation_id?: string;
  user_id?: string;
  session_id?: string;
}

export interface MCPResponse {
  status: 'success' | 'error' | 'basic';
  result?: unknown;
  error?: string;
  conversation_id?: string;
  workflow_used?: boolean;
  agent_used?: string;
  basic_mode?: boolean;
  ai_systems_available?: boolean;
}

/**
 * Event callback types
 */
export type MCPEventCallback<T = unknown> = (data: T) => void;
export type MCPErrorCallback = (error: Error) => void;

/**
 * MCP Client Service Class
 * 
 * Handles all communication with the MCP backend and provides
 * a unified interface for frontend components to access AI features.
 */
export class MCPClientService {
  private baseUrl: string;
  private isConnected: boolean = false;
  private healthCheckInterval: number | null = null;
  private connectionRetryTimeout: number | null = null;
  private currentStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  private lastHealthCheck: MCPHealthStatus | null = null;
  
  // Event handlers
  private eventHandlers: Map<string, MCPEventCallback[]> = new Map();

  constructor(baseUrl: string = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL || 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Event handling methods
   */
  on(event: string, callback: MCPEventCallback): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
  }

  off(event: string, callback: MCPEventCallback): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Initialize the MCP client and start health monitoring
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing MCP Client Service...');
      
      // Perform initial health check
      await this.performHealthCheck();
      
      // Start continuous health monitoring
      this.startHealthMonitoring();
      
      // Set up connection recovery
      this.setupConnectionRecovery();
      
      console.log('✅ MCP Client Service initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize MCP Client Service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Perform health check against MCP backend
   */
  async performHealthCheck(): Promise<MCPHealthStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/mcp/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      const healthStatus: MCPHealthStatus = await response.json();
      this.lastHealthCheck = healthStatus;
      
      // Update connection status based on health
      const wasConnected = this.isConnected;
      this.isConnected = ['healthy', 'degraded'].includes(healthStatus.status);
      this.currentStatus = this.isConnected ? 'connected' : 'error';
      
      // Emit connection status changes
      if (wasConnected !== this.isConnected) {
        this.emit(this.isConnected ? 'connected' : 'disconnected', healthStatus);
      }
      
      this.emit('healthUpdate', healthStatus);
      return healthStatus;
      
    } catch (error) {
      console.error('❌ MCP Health check failed:', error);
      this.isConnected = false;
      this.currentStatus = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get comprehensive status dashboard data
   */
  async getStatusDashboard(): Promise<MCPStatusDashboard> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/mcp/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Status dashboard request failed: ${response.status}`);
      }

      const dashboard: MCPStatusDashboard = await response.json();
      this.emit('dashboardUpdate', dashboard);
      return dashboard;
      
    } catch (error) {
      console.error('❌ Failed to get status dashboard:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Discover available MCP tools
   */
  async discoverTools(): Promise<MCPToolInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/mcp/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Tool discovery failed: ${response.status}`);
      }

      const toolInfo: MCPToolInfo = await response.json();
      this.emit('toolsDiscovered', toolInfo);
      return toolInfo;
      
    } catch (error) {
      console.error('❌ Tool discovery failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get AI agent status
   */
  async getAgentStatus(): Promise<MCPAgentStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/mcp/agents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Agent status request failed: ${response.status}`);
      }

      const agentStatus: MCPAgentStatus = await response.json();
      this.emit('agentStatusUpdate', agentStatus);
      return agentStatus;
      
    } catch (error) {
      console.error('❌ Failed to get agent status:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Execute an MCP tool request
   */
  async executeToolRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      if (!this.isConnected) {
        throw new Error('MCP service is not connected');
      }
  const response = await fetch(`${this.baseUrl}/api/v2/mcp/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        // Fallback to execute-tool endpoint
        const fallback = await fetch(`${this.baseUrl}/api/v2/mcp/execute-tool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: request.tool, parameters: request.parameters }),
        });
        if (!fallback.ok) {
          // Final fallback to test-tool endpoint available in backend
          const testFallback = await fetch(`${this.baseUrl}/api/v2/mcp/test-tool`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_name: request.tool, parameters: request.parameters }),
          });
          if (!testFallback.ok) {
            throw new Error(`Tool execution failed: ${response.status}`);
          }
          const data = await testFallback.json();
          const result: MCPResponse = {
            status: data.status === 'success' ? 'success' : 'error',
            result: data.result,
            error: data.error,
          } as MCPResponse;
          this.emit('toolExecuted', { request, result });
          return result;
        }
        const data = await fallback.json();
        const result: MCPResponse = {
          status: data.status === 'success' ? 'success' : 'error',
          result: data.result,
          error: data.error,
        } as MCPResponse;
        this.emit('toolExecuted', { request, result });
        return result;
      }

      const result: MCPResponse = await response.json();
      this.emit('toolExecuted', { request, result });
      return result;
      
    } catch (error) {
      console.error('❌ Tool execution failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Execute a tool by name with parameters (convenience method)
   */
  async executeTool(
    toolName: string, 
    parameters: Record<string, unknown> = {},
    conversationId?: string
  ): Promise<MCPResponse> {
    const request: MCPRequest = {
      tool: toolName,
      parameters,
      conversation_id: conversationId,
    };
    return this.executeToolRequest(request);
  }

  /**
   * Send a conversational request to the AI system
   */
  async sendConversationRequest(
    message: string,
    conversationId?: string,
    userId?: string,
    sessionId?: string
  ): Promise<MCPResponse> {
    try {
      const request: MCPRequest = {
        tool: 'conversation',
        parameters: {
          user_input: message,
          conversation_id: conversationId,
          user_id: userId,
          session_id: sessionId,
        },
      };

      return await this.executeToolRequest(request);
      
    } catch (error) {
      console.error('❌ Conversation request failed:', error);
      throw error;
    }
  }

  /**
   * Start continuous health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = window.setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch {
        // Health check failures are already handled in performHealthCheck
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Set up connection recovery mechanism
   */
  private setupConnectionRecovery(): void {
    this.on('disconnected', () => {
      if (this.connectionRetryTimeout) {
        clearTimeout(this.connectionRetryTimeout);
      }

      // Attempt to reconnect after 5 seconds
      this.connectionRetryTimeout = window.setTimeout(async () => {
        console.log('🔄 Attempting to reconnect to MCP service...');
        try {
          await this.performHealthCheck();
          console.log('✅ MCP service reconnected');
        } catch {
          console.log('❌ Reconnection attempt failed, will retry...');
          this.setupConnectionRecovery(); // Retry
        }
      }, 5000);
    });

    this.on('error', (error) => {
      console.error('MCP Client Error:', error);
    });

    this.on('connected', (health) => {
      console.log('🟢 MCP Service Connected:', (health as MCPHealthStatus).service_info);
    });

    this.on('disconnected', () => {
      console.log('🔴 MCP Service Disconnected');
    });
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    status: string;
    lastHealthCheck: MCPHealthStatus | null;
  } {
    return {
      isConnected: this.isConnected,
      status: this.currentStatus,
      lastHealthCheck: this.lastHealthCheck,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
      this.connectionRetryTimeout = null;
    }

    this.eventHandlers.clear();
    console.log('🧹 MCP Client Service destroyed');
  }
}

/**
 * Global MCP Client Service Instance
 * 
 * Provides a singleton pattern for accessing MCP functionality
 * throughout the frontend application.
 */
export class GlobalMCPService {
  private static instance: MCPClientService | null = null;

  static async getInstance(baseUrl?: string): Promise<MCPClientService> {
    if (!GlobalMCPService.instance) {
      GlobalMCPService.instance = new MCPClientService(baseUrl);
      await GlobalMCPService.instance.initialize();
    }
    return GlobalMCPService.instance;
  }

  static getInstanceSync(): MCPClientService | null {
    return GlobalMCPService.instance;
  }

  static destroy(): void {
    if (GlobalMCPService.instance) {
      GlobalMCPService.instance.destroy();
      GlobalMCPService.instance = null;
    }
  }
}

// Export a default instance factory
export const createMCPClient = (baseUrl?: string): MCPClientService => {
  return new MCPClientService(baseUrl);
};

export default MCPClientService;
