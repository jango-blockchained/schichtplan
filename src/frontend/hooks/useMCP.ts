/**
 * React Hooks for MCP Integration
 * 
 * Provides convenient React hooks for integrating MCP functionality
 * into frontend components with automatic state management and
 * real-time updates.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    GlobalMCPService,
    MCPAgentStatus,
    MCPClientService,
    MCPHealthStatus,
    MCPRequest,
    MCPResponse,
    MCPStatusDashboard,
    MCPToolInfo
} from '../services/mcpClient';

/**
 * Message type for conversation interface
 */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    status?: string;
    workflowUsed?: boolean;
    agentUsed?: string;
    basicMode?: boolean;
  };
}

/**
 * Hook for managing MCP connection and health status
 */
export const useMCPConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [healthStatus, setHealthStatus] = useState<MCPHealthStatus | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mcpClientRef = useRef<MCPClientService | null>(null);

  useEffect(() => {
    const initializeMCP = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        
        const client = await GlobalMCPService.getInstance();
        mcpClientRef.current = client;
        
        // Set up event listeners
        const handleConnected = (health: unknown) => {
          const healthData = health as MCPHealthStatus;
          setIsConnected(true);
          setStatus('connected');
          setHealthStatus(healthData);
          setError(null);
        };
        
        const handleDisconnected = () => {
          setIsConnected(false);
          setStatus('disconnected');
        };
        
        const handleError = (error: unknown) => {
          setError(error as Error);
          setStatus('error');
          setIsConnected(false);
        };
        
        const handleHealthUpdate = (health: unknown) => {
          const healthData = health as MCPHealthStatus;
          setHealthStatus(healthData);
          setIsConnected(['healthy', 'degraded'].includes(healthData.status));
        };
        
        client.on('connected', handleConnected);
        client.on('disconnected', handleDisconnected);
        client.on('error', handleError);
        client.on('healthUpdate', handleHealthUpdate);
        
        // Get initial status
        const connectionStatus = client.getConnectionStatus();
        setIsConnected(connectionStatus.isConnected);
        setStatus(connectionStatus.status as 'connected' | 'disconnected' | 'error');
        setHealthStatus(connectionStatus.lastHealthCheck);
        
        // Cleanup function
        return () => {
          client.off('connected', handleConnected);
          client.off('disconnected', handleDisconnected);
          client.off('error', handleError);
          client.off('healthUpdate', handleHealthUpdate);
        };
        
      } catch (error) {
        console.error('Failed to initialize MCP connection:', error);
        setError(error as Error);
        setStatus('error');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeMCP();
  }, []);

  const reconnect = useCallback(async () => {
    if (mcpClientRef.current) {
      try {
        await mcpClientRef.current.performHealthCheck();
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }
  }, []);

  return {
    isConnected,
    status,
    healthStatus,
    isInitializing,
    error,
    reconnect,
    mcpClient: mcpClientRef.current,
  };
};

/**
 * Hook for MCP status dashboard data
 */
export const useMCPDashboard = (refreshInterval: number = 60000) => {
  const [dashboard, setDashboard] = useState<MCPStatusDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { mcpClient } = useMCPConnection();

  const fetchDashboard = useCallback(async () => {
    if (!mcpClient) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const dashboardData = await mcpClient.getStatusDashboard();
      setDashboard(dashboardData);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [mcpClient]);

  useEffect(() => {
    if (mcpClient) {
      fetchDashboard();
      
      // Set up dashboard update listener
      const handleDashboardUpdate = (dashboardData: unknown) => {
        setDashboard(dashboardData as MCPStatusDashboard);
      };
      
      mcpClient.on('dashboardUpdate', handleDashboardUpdate);
      
      // Set up refresh interval
      const interval = setInterval(fetchDashboard, refreshInterval);
      
      return () => {
        mcpClient.off('dashboardUpdate', handleDashboardUpdate);
        clearInterval(interval);
      };
    }
  }, [mcpClient, fetchDashboard, refreshInterval]);

  return {
    dashboard,
    isLoading,
    error,
    refresh: fetchDashboard,
  };
};

/**
 * Hook for MCP tool discovery and management
 */
export const useMCPTools = () => {
  const [tools, setTools] = useState<MCPToolInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { mcpClient } = useMCPConnection();

  const discoverTools = useCallback(async () => {
    if (!mcpClient) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const toolInfo = await mcpClient.discoverTools();
      setTools(toolInfo);
    } catch (error) {
      console.error('Failed to discover tools:', error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [mcpClient]);

  useEffect(() => {
    if (mcpClient) {
      discoverTools();
      
      // Set up tools discovery listener
      const handleToolsDiscovered = (toolInfo: unknown) => {
        setTools(toolInfo as MCPToolInfo);
      };
      
      mcpClient.on('toolsDiscovered', handleToolsDiscovered);
      
      return () => {
        mcpClient.off('toolsDiscovered', handleToolsDiscovered);
      };
    }
  }, [mcpClient, discoverTools]);

  const executeToolRequest = useCallback(async (request: MCPRequest): Promise<MCPResponse> => {
    if (!mcpClient) {
      throw new Error('MCP client not available');
    }
    
    return await mcpClient.executeToolRequest(request);
  }, [mcpClient]);

  return {
    tools,
    isLoading,
    error,
    refresh: discoverTools,
    executeToolRequest,
  };
};

/**
 * Hook for AI conversation management
 */
export const useMCPConversation = (conversationId?: string) => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { mcpClient } = useMCPConnection();

  const sendMessage = useCallback(async (message: string, userId?: string, sessionId?: string) => {
    if (!mcpClient) {
      throw new Error('MCP client not available');
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Add user message to state
      const userMessage: ConversationMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Send to MCP service
      const response = await mcpClient.sendConversationRequest(
        message,
        conversationId,
        userId,
        sessionId
      );
      
      // Add assistant response to state
      const assistantMessage: ConversationMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: String(response.result || response.error || 'No response received'),
        timestamp: new Date(),
        metadata: {
          status: response.status,
          workflowUsed: response.workflow_used,
          agentUsed: response.agent_used,
          basicMode: response.basic_mode,
        },
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      return response;
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error as Error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [mcpClient, conversationId]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearConversation,
  };
};

/**
 * Hook for MCP AI agent status
 */
export const useMCPAgents = () => {
  const [agents, setAgents] = useState<MCPAgentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { mcpClient } = useMCPConnection();

  const fetchAgentStatus = useCallback(async () => {
    if (!mcpClient) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const agentStatus = await mcpClient.getAgentStatus();
      setAgents(agentStatus);
    } catch (error) {
      console.error('Failed to fetch agent status:', error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [mcpClient]);

  useEffect(() => {
    if (mcpClient) {
      fetchAgentStatus();
      
      // Set up agent status update listener
      const handleAgentStatusUpdate = (agentStatus: unknown) => {
        setAgents(agentStatus as MCPAgentStatus);
      };
      
      mcpClient.on('agentStatusUpdate', handleAgentStatusUpdate);
      
      return () => {
        mcpClient.off('agentStatusUpdate', handleAgentStatusUpdate);
      };
    }
  }, [mcpClient, fetchAgentStatus]);

  return {
    agents,
    isLoading,
    error,
    refresh: fetchAgentStatus,
  };
};

/**
 * Hook for MCP error handling and retry logic
 */
export const useMCPErrorHandler = () => {
  const [errors, setErrors] = useState<Error[]>([]);
  const { mcpClient } = useMCPConnection();

  useEffect(() => {
    if (mcpClient) {
      const handleError = (error: unknown) => {
        setErrors(prev => [...prev, error as Error]);
      };
      
      mcpClient.on('error', handleError);
      
      return () => {
        mcpClient.off('error', handleError);
      };
    }
  }, [mcpClient]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const retryLastOperation = useCallback(async () => {
    if (mcpClient) {
      try {
        await mcpClient.performHealthCheck();
      } catch (error) {
        console.error('Retry failed:', error);
      }
    }
  }, [mcpClient]);

  return {
    errors,
    clearErrors,
    retryLastOperation,
    hasErrors: errors.length > 0,
    latestError: errors[errors.length - 1] || null,
  };
};
