/**
 * MCP Status Dashboard Component
 * 
 * A React component that demonstrates the MCP integration
 * by displaying real-time health status, tools, and agent information.
 */

import React from 'react';
import { useMCPAgents, useMCPConnection, useMCPDashboard, useMCPTools } from '../hooks/useMCP';

// Status indicator component
const StatusIndicator: React.FC<{ status: string; label: string }> = ({ status, label }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'running':
        return 'text-green-600 bg-green-100';
      case 'degraded':
      case 'disconnected':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
      case 'error':
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${getStatusColor(status).replace('text-', 'bg-').replace('bg-', 'bg-')}`} />
      {label}: {status}
    </div>
  );
};

// Loading spinner component
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// Error display component
const ErrorDisplay: React.FC<{ error: Error; onRetry?: () => void }> = ({ error, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-md p-4">
    <div className="flex">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">Error</h3>
        <div className="mt-2 text-sm text-red-700">
          <p>{error.message}</p>
        </div>
        {onRetry && (
          <div className="mt-4">
            <button
              onClick={onRetry}
              className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

// Main MCP dashboard component
export const MCPStatusDashboard: React.FC = () => {
  const { isConnected, status, healthStatus, isInitializing, error: connectionError, reconnect } = useMCPConnection();
  const { dashboard, isLoading: dashboardLoading, error: dashboardError, refresh: refreshDashboard } = useMCPDashboard();
  const { tools, isLoading: toolsLoading, error: toolsError, refresh: refreshTools } = useMCPTools();
  const { agents, isLoading: agentsLoading, error: agentsError, refresh: refreshAgents } = useMCPAgents();

  if (isInitializing) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">MCP Status Dashboard</h2>
        <LoadingSpinner />
        <p className="text-center text-gray-600 mt-2">Initializing MCP connection...</p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">MCP Status Dashboard</h2>
        <ErrorDisplay error={connectionError} onRetry={reconnect} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">MCP Status Dashboard</h2>
        <div className="flex items-center space-x-4">
          <StatusIndicator status={status} label="Connection" />
          {healthStatus && <StatusIndicator status={healthStatus.status} label="Health" />}
        </div>
      </div>

      {/* Overview Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Service Status</dt>
                  <dd className="text-lg font-medium text-gray-900">{dashboard.overview.service_status}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Tools</dt>
                  <dd className="text-lg font-medium text-gray-900">{dashboard.overview.total_tools}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">AI Capabilities</dt>
                  <dd className="text-lg font-medium text-gray-900">{dashboard.overview.ai_capabilities}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Components</dt>
                  <dd className="text-lg font-medium text-gray-900">{dashboard.overview.active_components}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Health Status Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Component Health</h3>
          </div>
          <div className="p-6">
            {healthStatus ? (
              <div className="space-y-4">
                {Object.entries(healthStatus.components).map(([componentName, componentInfo]) => (
                  <div key={componentName} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {componentName.replace('_', ' ')}
                    </span>
                    <StatusIndicator status={componentInfo.status} label="" />
                  </div>
                ))}
              </div>
            ) : (
              <LoadingSpinner />
            )}
          </div>
        </div>

        {/* Tools Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Available Tools</h3>
            <button
              onClick={refreshTools}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              disabled={toolsLoading}
            >
              {toolsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="p-6">
            {toolsError ? (
              <ErrorDisplay error={toolsError} onRetry={refreshTools} />
            ) : tools ? (
              <div className="space-y-3">
                {Object.entries(tools.categories).map(([category, categoryTools]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {category.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-500">
                      {Array.isArray(categoryTools) ? categoryTools.length : 0} tools
                    </span>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">Total</span>
                    <span className="text-sm font-bold text-gray-900">{tools.total_count} tools</span>
                  </div>
                </div>
              </div>
            ) : (
              <LoadingSpinner />
            )}
          </div>
        </div>

        {/* AI Agents Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">AI Agents Status</h3>
            <button
              onClick={refreshAgents}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              disabled={agentsLoading}
            >
              {agentsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="p-6">
            {agentsError ? (
              <ErrorDisplay error={agentsError} onRetry={refreshAgents} />
            ) : agents ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">AI Orchestrator</span>
                  <StatusIndicator 
                    status={agents.ai_orchestrator_initialized ? 'running' : 'unavailable'} 
                    label="" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Agent Registry</span>
                  <StatusIndicator 
                    status={agents.agent_registry_initialized ? 'running' : 'unavailable'} 
                    label="" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Workflow Coordinator</span>
                  <StatusIndicator 
                    status={agents.workflow_coordinator_initialized ? 'running' : 'unavailable'} 
                    label="" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Conversation Manager</span>
                  <StatusIndicator 
                    status={agents.conversation_manager_initialized ? 'running' : 'unavailable'} 
                    label="" 
                  />
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">Full AI Capabilities</span>
                    <StatusIndicator 
                      status={agents.full_ai_capabilities ? 'enabled' : 'limited'} 
                      label="" 
                    />
                  </div>
                </div>
              </div>
            ) : (
              <LoadingSpinner />
            )}
          </div>
        </div>

        {/* Performance Metrics Section */}
        {dashboard && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
              <button
                onClick={refreshDashboard}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                disabled={dashboardLoading}
              >
                {dashboardLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="p-6">
              {dashboardError ? (
                <ErrorDisplay error={dashboardError} onRetry={refreshDashboard} />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Uptime</span>
                    <span className="text-sm text-gray-900">{dashboard.metrics.uptime}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Response Time</span>
                    <span className="text-sm text-gray-900">{dashboard.metrics.response_time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Success Rate</span>
                    <span className="text-sm text-green-600">{dashboard.metrics.success_rate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Error Rate</span>
                    <span className="text-sm text-red-600">{dashboard.metrics.error_rate}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MCPStatusDashboard;
