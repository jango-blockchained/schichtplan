/**
 * Enhanced AI Service with Streaming and Context-Aware Features
 *
 * Extends the base AI service with:
 * - Server-Sent Events (SSE) streaming
 * - Context-aware requests
 * - Background task management
 * - Proactive suggestions
 * - Retry logic with exponential backoff
 * - Circuit breaker for reliability
 * - Request deduplication
 * - Rate limiting
 */

import { aiService } from "./aiService";
import {
  CircuitBreaker,
  DEFAULT_RETRY_CONFIG,
  RateLimiter,
  RequestCache,
  retryAsync,
  RetryConfig,
} from "@/utils/aiRetry";
import {
  validateChatRequest,
  validateStreamChunk,
  ValidationError,
} from "@/utils/aiValidation";

// ============================================================================
// Types
// ============================================================================

export interface StreamChunk {
  type: "content" | "metadata" | "error" | "done";
  content?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ContextualChatRequest {
  message: string;
  conversation_id?: string;
  context?: PageContextSummary;
  stream?: boolean;
}

export interface PageContextSummary {
  current_page: string;
  page_name: string;
  current_view: string;
  selected_items: Array<{
    type: string;
    id: string | number;
    label: string;
  }>;
  recent_actions: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
  suggestions_count?: number;
  user_intent?: string;
}

export interface BackgroundTask {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  result?: unknown;
  error?: string;
  started_at: string;
  completed_at?: string;
}

export interface ProactiveSuggestion {
  id: string;
  type: "warning" | "info" | "action" | "insight";
  title: string;
  description: string;
  action?: {
    label: string;
    endpoint: string;
    parameters?: Record<string, unknown>;
  };
  priority: "low" | "medium" | "high";
  context: PageContextSummary;
  created_at: string;
}

export interface OptimizationRequest {
  context: PageContextSummary;
  start_date?: string;
  end_date?: string;
  optimization_goals?: string[];
  constraints?: Record<string, unknown>;
}

export interface ConflictResolutionRequest {
  context: PageContextSummary;
  conflict_ids?: string[];
  auto_resolve?: boolean;
}

// ============================================================================
// Enhanced AI Service Class
// ============================================================================

class EnhancedAIService {
  private baseService = aiService;
  private activeStreams: Map<string, AbortController> = new Map();
  private taskPollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  // Reliability and performance utilities
  private circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 60s recovery
  private requestCache = new RequestCache(5000); // 5 second TTL
  private rateLimiter = new RateLimiter(20, 1); // 20 requests, 1 per second refill
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;

  // Access base URL and headers via private methods
  private get baseURL(): string {
    return "/api/v2";
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
    };
  }

  // ==========================================================================
  // Streaming Methods
  // ==========================================================================

  /**
   * Stream chat responses using Server-Sent Events with retry and validation
   */
  async *streamChat(
    request: ContextualChatRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const streamId = `stream-${Date.now()}`;
    const controller = new AbortController();
    this.activeStreams.set(streamId, controller);

    try {
      // Validate request
      try {
        validateChatRequest({
          message: request.message,
          conversation_id: request.conversation_id,
          context: request.context,
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          yield {
            type: "error",
            error: `Validation error: ${error.message}`,
          };
          return;
        }
        throw error;
      }

      // Check rate limit
      if (!(await this.rateLimiter.waitForTokens(1, 5000))) {
        yield {
          type: "error",
          error: "Rate limit exceeded. Please try again later.",
        };
        return;
      }

      // Execute with circuit breaker
      const response = await this.circuitBreaker.execute(async () => {
        return await fetch(`${this.baseURL}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.headers,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
          credentials: "include",
        });
      });

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body not readable");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          yield { type: "done" };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              yield { type: "done" };
              break;
            }

            try {
              const parsedChunk = JSON.parse(data);
              const validatedChunk = validateStreamChunk(parsedChunk);
              yield validatedChunk;
            } catch (error) {
              console.warn("Failed to parse or validate SSE data:", data, error);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name !== "AbortError") {
          console.error("Stream error:", error);
          yield {
            type: "error",
            error: error.message || "Streaming failed",
          };
        }
      } else {
        yield {
          type: "error",
          error: "Unknown streaming error",
        };
      }
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Cancel an active stream
   */
  cancelStream(streamId: string): void {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Cancel all active streams
   */
  cancelAllStreams(): void {
    for (const [, controller] of this.activeStreams) {
      controller.abort();
    }
    this.activeStreams.clear();
  }

  // ==========================================================================
  // Context-Aware Methods
  // ==========================================================================

  /**
   * Send a context-aware chat message with retry and deduplication
   * Automatically includes page context and enriches the prompt
   */
  async sendContextualMessage(request: ContextualChatRequest) {
    // Validate request
    const validated = validateChatRequest({
      message: request.message,
      conversation_id: request.conversation_id,
      context: request.context,
    });

    // Check rate limit
    if (!(await this.rateLimiter.waitForTokens(1, 5000))) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    // Enrich message with context if provided
    let enrichedMessage = validated.message;

    if (request.context) {
      const contextStr = this.formatContextForAI(request.context);
      enrichedMessage = `${contextStr}\n\nUser: ${validated.message}`;
    }

    // Use request deduplication for identical requests
    return this.requestCache.deduplicate(
      "/chat",
      { message: enrichedMessage, conversation_id: validated.conversation_id },
      async () => {
        // Execute with retry and circuit breaker
        return await retryAsync(
          async () => {
            return await this.circuitBreaker.execute(async () => {
              return await this.baseService.sendChatMessage({
                message: enrichedMessage,
                conversation_id: validated.conversation_id,
              });
            });
          },
          this.retryConfig,
          (attempt, error) => {
            console.warn(
              `Chat request retry attempt ${attempt + 1}`,
              error,
            );
          },
        );
      },
    );
  }

  /**
   * Format context for AI consumption
   */
  private formatContextForAI(context: PageContextSummary): string {
    const parts = [`Context: ${context.page_name}`];

    if (context.current_view) {
      parts.push(`View: ${context.current_view}`);
    }

    if (context.selected_items.length > 0) {
      parts.push(
        `Selected: ${context.selected_items
          .map((item) => `${item.type}=${item.label}`)
          .join(", ")}`,
      );
    }

    if (context.recent_actions.length > 0) {
      const recentAction =
        context.recent_actions[context.recent_actions.length - 1];
      parts.push(`Recent action: ${recentAction.description}`);
    }

    if (context.user_intent) {
      parts.push(`Intent: ${context.user_intent}`);
    }

    return parts.join(" | ");
  }

  // ==========================================================================
  // Background Task Management
  // ==========================================================================

  /**
   * Start a long-running AI task in the background
   */
  async startBackgroundTask(
    taskType: string,
    parameters: Record<string, unknown>,
  ): Promise<BackgroundTask> {
    const response = await fetch(`${this.baseURL}/tasks/background`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify({ task_type: taskType, parameters }),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to start task: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get task progress
   */
  async getTaskProgress(taskId: string): Promise<BackgroundTask> {
    return fetch(`${this.baseURL}/tasks/${taskId}/progress`, {
      headers: this.headers,
      credentials: "include",
    }).then((r) => r.json());
  }

  /**
   * Poll task progress until completion
   */
  async waitForTask(
    taskId: string,
    onProgress?: (task: BackgroundTask) => void,
    pollInterval: number = 1000,
  ): Promise<BackgroundTask> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const task = await this.getTaskProgress(taskId);

          if (onProgress) {
            onProgress(task);
          }

          if (task.status === "completed") {
            clearInterval(interval);
            this.taskPollingIntervals.delete(taskId);
            resolve(task);
          } else if (task.status === "failed") {
            clearInterval(interval);
            this.taskPollingIntervals.delete(taskId);
            reject(new Error(task.error || "Task failed"));
          }
        } catch (error) {
          clearInterval(interval);
          this.taskPollingIntervals.delete(taskId);
          reject(error);
        }
      }, pollInterval);

      this.taskPollingIntervals.set(taskId, interval);
    });
  }

  /**
   * Cancel a background task
   */
  async cancelTask(taskId: string): Promise<void> {
    const interval = this.taskPollingIntervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.taskPollingIntervals.delete(taskId);
    }

    await fetch(`${this.baseURL}/tasks/${taskId}/cancel`, {
      method: "POST",
      headers: this.headers,
      credentials: "include",
    });
  }

  // ==========================================================================
  // Proactive Suggestions
  // ==========================================================================

  /**
   * Get proactive AI suggestions based on current context
   */
  async getProactiveSuggestions(
    context: PageContextSummary,
  ): Promise<ProactiveSuggestion[]> {
    const response = await fetch(`${this.baseURL}/suggestions/proactive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify({ context }),
      credentials: "include",
    });

    if (!response.ok) {
      console.warn("Failed to get proactive suggestions:", response.statusText);
      return [];
    }

    return response.json();
  }

  /**
   * Dismiss a suggestion
   */
  async dismissSuggestion(suggestionId: string): Promise<void> {
    await fetch(`${this.baseURL}/suggestions/${suggestionId}/dismiss`, {
      method: "POST",
      headers: this.headers,
      credentials: "include",
    });
  }

  // ==========================================================================
  // Quick Actions
  // ==========================================================================

  /**
   * Optimize schedule using AI
   */
  async optimizeSchedule(
    request: OptimizationRequest,
  ): Promise<BackgroundTask> {
    return this.startBackgroundTask(
      "optimize_schedule",
      (request as unknown) as Record<string, unknown>,
    );
  }

  /**
   * Fix scheduling conflicts
   */
  async resolveConflicts(
    request: ConflictResolutionRequest,
  ): Promise<BackgroundTask> {
    return this.startBackgroundTask(
      "resolve_conflicts",
      (request as unknown) as Record<string, unknown>,
    );
  }

  /**
   * Balance employee workload
   */
  async balanceWorkload(context: PageContextSummary): Promise<BackgroundTask> {
    return this.startBackgroundTask("balance_workload", { context });
  }

  /**
   * Get assignment suggestions
   */
  async getAssignmentSuggestions(context: PageContextSummary) {
    return this.sendContextualMessage({
      message: "Suggest optimal employee assignments for the current schedule",
      context,
    });
  }

  /**
   * Analyze employee workload
   */
  async analyzeWorkload(context: PageContextSummary) {
    return this.sendContextualMessage({
      message: "Analyze employee workload and identify any issues",
      context,
    });
  }

  /**
   * Suggest optimal availability
   */
  async suggestAvailability(context: PageContextSummary) {
    return this.sendContextualMessage({
      message: "Suggest optimal availability patterns for selected employees",
      context,
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if streaming is supported
   */
  isStreamingSupported(): boolean {
    return (
      typeof ReadableStream !== "undefined" &&
      typeof TextDecoder !== "undefined"
    );
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Get active task count
   */
  getActiveTaskCount(): number {
    return this.taskPollingIntervals.size;
  }

  /**
   * Cleanup all active operations
   */
  cleanup(): void {
    this.cancelAllStreams();

    for (const [, interval] of this.taskPollingIntervals) {
      clearInterval(interval);
    }
    this.taskPollingIntervals.clear();
  }

  /**
   * Get current service health status
   */
  getHealthStatus() {
    return {
      circuitBreaker: this.circuitBreaker.getState(),
      rateLimiter: {
        availableTokens: this.rateLimiter.getAvailableTokens(),
      },
      activeStreams: this.activeStreams.size,
      activeTasks: this.taskPollingIntervals.size,
    };
  }

  /**
   * Reset all service utilities (useful for testing or recovery)
   */
  reset() {
    this.circuitBreaker.reset();
    this.rateLimiter.reset();
    this.requestCache.clear();
    this.cleanup();
    console.info("Enhanced AI Service reset");
  }

  /**
   * Clear expired cache entries (should be called periodically)
   */
  clearExpiredCache() {
    this.requestCache.clearExpired();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const enhancedAIService = new EnhancedAIService();

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    enhancedAIService.cleanup();
  });

  // Periodically clear expired cache entries (every 60 seconds)
  setInterval(() => {
    enhancedAIService.clearExpiredCache();
  }, 60000);
}

export default enhancedAIService;
