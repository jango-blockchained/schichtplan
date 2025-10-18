/**
 * AI Conversation Service for multi-step schedule generation
 */

import { api } from "./api";

export interface ConversationContext {
  start_date: string;
  end_date: string;
  generation_type?: "interactive" | "auto";
  version_id?: number;
  preferences?: Record<string, any>;
}

export interface ConversationResponse {
  status: "success" | "error";
  conversation_id?: string;
  state?: string;
  message?: string;
  error_code?: string;
  next_actions?: string[];
  analysis?: any;
  recommendations?: any;
  generation_result?: any;
  adjustments_applied?: number;
}

export interface ConversationModification {
  date: string;
  employee_id: number;
  action: "add" | "remove" | "modify";
  reason?: string;
  shift_id?: number;
}

class AIConversationService {
  private conversationId: string | null = null;

  /**
   * Start a new conversation for schedule generation
   */
  async startConversation(
    context: ConversationContext,
  ): Promise<ConversationResponse> {
    try {
      const response = await api.post<ConversationResponse>(
        "/api/v2/ai-conversation/conversation",
        {
          action: "start_conversation",
          context,
        },
      );

      if (response.data.status === "success" && response.data.conversation_id) {
        this.conversationId = response.data.conversation_id;
      }

      return response.data;
    } catch (error) {
      console.error("Failed to start conversation:", error);
      throw error;
    }
  }

  /**
   * Analyze the current schedule state
   */
  async analyzeCurrentState(include?: string[]): Promise<ConversationResponse> {
    if (!this.conversationId) {
      throw new Error("No active conversation");
    }

    try {
      const response = await api.post<ConversationResponse>(
        "/api/v2/ai-conversation/conversation",
        {
          action: "analyze_current_state",
          conversation_id: this.conversationId,
          include: include || [
            "conflicts",
            "coverage_gaps",
            "workload_distribution",
          ],
        },
      );

      return response.data;
    } catch (error) {
      console.error("Failed to analyze current state:", error);
      throw error;
    }
  }

  /**
   * Get AI recommendations based on analysis
   */
  async getRecommendations(
    optimizationGoals?: string[],
  ): Promise<ConversationResponse> {
    if (!this.conversationId) {
      throw new Error("No active conversation");
    }

    try {
      const response = await api.post<ConversationResponse>(
        "/api/v2/ai-conversation/conversation",
        {
          action: "get_recommendations",
          conversation_id: this.conversationId,
          optimization_goals: optimizationGoals || [
            "fairness",
            "coverage",
            "preferences",
          ],
        },
      );

      return response.data;
    } catch (error) {
      console.error("Failed to get recommendations:", error);
      throw error;
    }
  }

  /**
   * Generate schedule based on recommendations
   */
  async generateSchedule(
    applyRecommendations: boolean = true,
    constraints?: any,
  ): Promise<ConversationResponse> {
    if (!this.conversationId) {
      throw new Error("No active conversation");
    }

    try {
      const response = await api.post<ConversationResponse>(
        "/api/v2/ai-conversation/conversation",
        {
          action: "generate_schedule",
          conversation_id: this.conversationId,
          apply_recommendations: applyRecommendations,
          constraints,
        },
      );

      return response.data;
    } catch (error) {
      console.error("Failed to generate schedule:", error);
      throw error;
    }
  }

  /**
   * Adjust the generated schedule
   */
  async adjustSchedule(
    modifications: ConversationModification[],
    regenerateAffected: boolean = true,
  ): Promise<ConversationResponse> {
    if (!this.conversationId) {
      throw new Error("No active conversation");
    }

    try {
      const response = await api.post<ConversationResponse>(
        "/api/v2/ai-conversation/conversation",
        {
          action: "adjust_schedule",
          conversation_id: this.conversationId,
          modifications,
          regenerate_affected: regenerateAffected,
        },
      );

      return response.data;
    } catch (error) {
      console.error("Failed to adjust schedule:", error);
      throw error;
    }
  }

  /**
   * Finalize the schedule
   */
  async finalizeSchedule(): Promise<ConversationResponse> {
    if (!this.conversationId) {
      throw new Error("No active conversation");
    }

    try {
      const response = await api.post<ConversationResponse>(
        "/api/v2/ai-conversation/conversation",
        {
          action: "finalize_schedule",
          conversation_id: this.conversationId,
        },
      );

      return response.data;
    } catch (error) {
      console.error("Failed to finalize schedule:", error);
      throw error;
    }
  }

  /**
   * Cancel the current conversation
   */
  async cancelConversation(): Promise<ConversationResponse> {
    if (!this.conversationId) {
      throw new Error("No active conversation");
    }

    try {
      const response = await api.post<ConversationResponse>(
        "/api/v2/ai-conversation/conversation",
        {
          action: "cancel_conversation",
          conversation_id: this.conversationId,
        },
      );

      this.conversationId = null;
      return response.data;
    } catch (error) {
      console.error("Failed to cancel conversation:", error);
      throw error;
    }
  }

  /**
   * Get conversation status
   */
  async getConversationStatus(): Promise<any> {
    if (!this.conversationId) {
      throw new Error("No active conversation");
    }

    try {
      const response = await api.get(
        `/api/v2/ai-conversation/conversation/${this.conversationId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get conversation status:", error);
      throw error;
    }
  }

  /**
   * Preview optimized data
   */
  async previewOptimizedData(
    startDate: string,
    endDate: string,
    constraints?: any,
  ): Promise<any> {
    try {
      const response = await api.post(
        "/api/v2/ai-conversation/conversation/preview-optimized-data",
        {
          start_date: startDate,
          end_date: endDate,
          constraints,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to preview optimized data:", error);
      throw error;
    }
  }

  /**
   * Reset the conversation
   */
  reset() {
    this.conversationId = null;
  }

  /**
   * Get current conversation ID
   */
  getConversationId(): string | null {
    return this.conversationId;
  }
}

// Export singleton instance
export const aiConversationService = new AIConversationService();

// Export class for testing
export { AIConversationService };
