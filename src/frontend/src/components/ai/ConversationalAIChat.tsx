import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ScrollArea,
} from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAIContext } from "@/contexts/AIContext";
import { cn } from "@/lib/utils";
import { aiService } from "@/services/aiService";
import { enhancedAIService } from "@/services/enhancedAIService";
import { getSettings } from "@/services/api";
import {
  Bot,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Loader2,
  RotateCcw,
  Send,
  ThumbsDown,
  ThumbsUp,
  User,
  Mic,
  Paperclip,
  FileIcon,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { VoiceInput } from "./VoiceInput";
import { FileUploadComponent } from "./FileUploadComponent";
import type { FileUpload } from "@/services/aiService";

interface ConversationMessage {
  id: string;
  type: "user" | "ai" | "system";
  content: string;
  timestamp: Date;
  feedback?: "positive" | "negative";
  metadata?: {
    agent?: string;
    workflow?: string;
    tools_used?: string[];
    confidence?: number;
    processing_time?: number;
    generationResult?: Record<string, unknown>;
  };
  files?: string[]; // File IDs attached to this message
  voice_command?: boolean; // Whether this message came from voice input
}

interface ConversationSession {
  id: string;
  title: string;
  created_at: Date;
  last_message_at: Date;
  message_count: number;
  ai_provider: "openai" | "anthropic" | "gemini";
  status?: "active" | "inactive" | "archived";
  files?: string[]; // File IDs in this session
}

export const ConversationalAIChat: React.FC = () => {
  const { pageContext, getContextString } = useAIContext();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSession, setCurrentSession] =
    useState<ConversationSession | null>(null);
  const [aiProvider, setAiProvider] = useState<"openai" | "anthropic" | "gemini">("gemini");
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileUpload[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingMessageRef = useRef<ConversationMessage | null>(null);

  // Load AI provider from settings
  useEffect(() => {
    const loadAISettings = async () => {
      try {
        const settings = await getSettings();
        if (settings.ai_scheduling?.provider) {
          setAiProvider(settings.ai_scheduling.provider as "openai" | "anthropic" | "gemini");
        }
      } catch (error) {
        console.warn("Failed to load AI settings, using default provider:", error);
      }
    };
    loadAISettings();
  }, []);

  // Initialize WebSocket connection for real-time features
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        await aiService.connectWebSocket();
        setIsConnected(true);
        
        // Listen for WebSocket events
        aiService.on('websocket:connected', () => {
          setIsConnected(true);
          console.log('WebSocket connected');
        });
        
        aiService.on('websocket:disconnected', () => {
          setIsConnected(false);
          console.log('WebSocket disconnected');
        });

        if (currentSession?.id) {
          aiService.joinConversation(currentSession.id, 'user');
        }
      } catch (error) {
        console.warn('WebSocket initialization failed:', error);
        setIsConnected(false);
      }
    };

    initializeWebSocket();

    return () => {
      if (currentSession?.id) {
        aiService.leaveConversation(currentSession.id);
      }
      aiService.disconnect();
    };
  }, [currentSession?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize with a context-aware welcome message
    // Build dynamic welcome based on current page context
    let welcomeContent =
      "Welcome to the AI-powered scheduling assistant! I can help you optimize schedules, manage employees, resolve conflicts, and much more.";

    if (pageContext.route.includes("schedule")) {
      welcomeContent =
        "Welcome! I can help you analyze, optimize, and manage your schedules efficiently. Let me know what scheduling challenges you'd like to tackle.";
    } else if (pageContext.route.includes("employee")) {
      welcomeContent =
        "Welcome! I'm here to help you with employee management, workload balancing, and availability planning. What would you like to focus on?";
    } else if (pageContext.route.includes("coverage")) {
      welcomeContent =
        "Welcome! I can assist with coverage analysis, gap identification, and optimization. How can I help improve your coverage?";
    }

    // Add schedule context if available
    if (pageContext.scheduleContext?.start_date) {
      welcomeContent += `\n\nI see you're working with a schedule from ${pageContext.scheduleContext.start_date} to ${pageContext.scheduleContext.end_date}. `;
      if (pageContext.scheduleContext.current_conflicts) {
        welcomeContent += `There are ${pageContext.scheduleContext.current_conflicts} conflict(s) to address.`;
      } else {
        welcomeContent += "The schedule looks good so far.";
      }
    }

    welcomeContent +=
      "\n\nWhat would you like to work on today? Feel free to describe your scheduling challenge or ask me any questions.";

    const welcomeMessage: ConversationMessage = {
      id: "welcome",
      type: "system",
      content: welcomeContent,
      timestamp: new Date(),
      metadata: {
        agent: "system",
        confidence: 1.0,
      },
    };
    setMessages([welcomeMessage]);

    // Create initial session
    const initialSession: ConversationSession = {
      id: "session-1",
      title: "New Conversation",
      created_at: new Date(),
      last_message_at: new Date(),
      message_count: 1,
      status: "active",
      ai_provider: aiProvider, // Use loaded AI provider
    };
    setCurrentSession(initialSession);
  }, [pageContext, getContextString, aiProvider]);

  const handleSendMessage = async () => {
    if (!currentInput.trim() || isLoading || isStreaming) return;

    const userMessage: ConversationMessage = {
      id: `msg-${Date.now()}-user`,
      type: "user",
      content: currentInput.trim(),
      timestamp: new Date(),
      files: attachedFiles.map(f => f.id),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentInput("");
    setIsStreaming(true);
    setIsLoading(true);

    // Clear attached files after sending
    const currentFiles = [...attachedFiles];
    setAttachedFiles([]);

    try {
      // Prepare message with context
      const contextSummary = getContextString();
      let messageWithContext = contextSummary
        ? `Context:\n${contextSummary}\n\nUser: ${userMessage.content}`
        : userMessage.content;

      // Add file context if files are attached
      if (currentFiles.length > 0) {
        messageWithContext += `\n\nAttached files: ${currentFiles.map(f => f.name).join(', ')}`;
      }

      // Initialize streaming AI message
      const streamingMessageId = `msg-${Date.now()}-ai`;
      const initialAIMessage: ConversationMessage = {
        id: streamingMessageId,
        type: "ai",
        content: "",
        timestamp: new Date(),
        metadata: {
          agent: "streaming",
        },
      };

      streamingMessageRef.current = initialAIMessage;
      setMessages((prev) => [...prev, initialAIMessage]);

      // Use streaming from enhanced AI service
      try {
        const streamGenerator = enhancedAIService.streamChat({
          message: messageWithContext,
          conversation_id: currentSession?.id,
          context: {
            current_page: pageContext.route,
            page_name: pageContext.pageTitle,
            current_view: pageContext.viewMode,
            selected_items: Object.entries(pageContext.selectedItems).map(([type, id]) => ({
              type,
              id: String(id),
              label: `${type}: ${String(id)}`,
            })),
            recent_actions: [],
          },
          stream: true,
        });

        let fullContent = "";
        let metadata: Record<string, unknown> = {};

        for await (const chunk of streamGenerator) {
          if (chunk.type === "content" && chunk.content) {
            fullContent += chunk.content;
            
            // Update the streaming message
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageId
                  ? { ...msg, content: fullContent }
                  : msg
              )
            );
          } else if (chunk.type === "metadata" && chunk.metadata) {
            metadata = { ...metadata, ...chunk.metadata };
          } else if (chunk.type === "error") {
            throw new Error(chunk.error || "Streaming error");
          } else if (chunk.type === "done") {
            // Finalize the message with complete metadata
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageId
                  ? { 
                      ...msg, 
                      content: fullContent,
                      metadata: {
                        agent: metadata.agent as string,
                        workflow: metadata.workflow as string,
                        tools_used: metadata.tools_used as string[],
                        confidence: metadata.confidence as number,
                        processing_time: metadata.processing_time as number,
                      }
                    }
                  : msg
              )
            );
          }
        }

        // Update session
        if (currentSession) {
          setCurrentSession((prev) =>
            prev
              ? {
                ...prev,
                last_message_at: new Date(),
                message_count: prev.message_count + 2,
              }
              : null
          );
        }

        toast.success("AI response generated successfully");
      } catch (streamError) {
        console.warn("Streaming failed, falling back to regular API:", streamError);
        
        // Fallback to non-streaming API
        const response = await aiService.sendChatMessage({
          message: messageWithContext,
          conversation_id: currentSession?.id,
          context: pageContext,
        });

        const aiMessage: ConversationMessage = {
          id: streamingMessageId,
          type: "ai",
          content: response.response,
          timestamp: new Date(),
          metadata: {
            agent: response.metadata?.agent as string,
            workflow: response.metadata?.workflow as string,
            tools_used: response.metadata?.tools_used as string[],
            confidence: response.metadata?.confidence as number,
            processing_time: response.metadata?.processing_time as number,
          },
        };

        setMessages((prev) =>
          prev.map((msg) => (msg.id === streamingMessageId ? aiMessage : msg))
        );

        // Update session
        if (currentSession) {
          setCurrentSession((prev) =>
            prev
              ? {
                ...prev,
                last_message_at: new Date(),
                message_count: prev.message_count + 2,
              }
              : null
          );
        }

        toast.success("AI response generated successfully");
      }
    } catch (error) {
      // Fallback to simulated response if all else fails
      console.warn("AI API failed completely, falling back to simulation:", error);
      try {
        const response = await simulateAIResponse(userMessage.content);

        const aiMessage: ConversationMessage = {
          id: `msg-${Date.now()}-ai`,
          type: "ai",
          content: response.content,
          timestamp: new Date(),
          metadata: {
            agent: response.agent,
            workflow: response.workflow,
            tools_used: response.tools_used,
            confidence: response.confidence,
            processing_time: response.processing_time,
          },
        };

        setMessages((prev) => [...prev, aiMessage]);

        // Update session
        if (currentSession) {
          setCurrentSession((prev) =>
            prev
              ? {
                ...prev,
                last_message_at: new Date(),
                message_count: prev.message_count + 2,
              }
              : null
          );
        }

        toast.success("AI response generated (offline mode)");
      } catch (fallbackError) {
        toast.error("Failed to get AI response");
        console.error("AI response error:", fallbackError);
        
        // Remove the failed streaming message
        if (streamingMessageRef.current) {
          setMessages((prev) => prev.filter(msg => msg.id !== streamingMessageRef.current?.id));
        }
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      streamingMessageRef.current = null;
    }
  };

  const simulateAIResponse = async (
    userInput: string,
  ): Promise<{
    content: string;
    agent: string;
    workflow?: string;
    tools_used: string[];
    confidence: number;
    processing_time: number;
  }> => {
    // Simulate processing time
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000),
    );

    const lowerInput = userInput.toLowerCase();

    if (lowerInput.includes("schedule") || lowerInput.includes("optimize")) {
      return {
        content:
          "I'll help you optimize the schedule. Let me analyze the current situation and identify potential improvements. I've detected several areas where we can enhance efficiency:\n\n1. **Workload Balance**: There are some employees with uneven shift distributions\n2. **Coverage Gaps**: I found 3 time periods that need better coverage\n3. **Conflict Resolution**: 2 scheduling conflicts need attention\n\nWould you like me to:\n- Run a comprehensive optimization workflow?\n- Focus on a specific time period?\n- Address particular employee assignments?",
        agent: "ScheduleOptimizerAgent",
        workflow: "schedule_analysis",
        tools_used: [
          "analyze_schedule_conflicts",
          "get_coverage_requirements",
          "get_employee_availability",
        ],
        confidence: 0.92,
        processing_time: 2.3,
      };
    } else if (
      lowerInput.includes("employee") ||
      lowerInput.includes("workload")
    ) {
      return {
        content:
          "I'm analyzing employee workload and availability patterns. Here's what I found:\n\n**Current Workload Analysis:**\n- 12 employees total\n- Average workload: 38.5 hours/week\n- 3 employees are above recommended hours\n- 2 employees have availability conflicts\n\n**Recommendations:**\n- Redistribute 6 hours from overloaded employees\n- Consider cross-training for better flexibility\n- Review availability preferences\n\nShould I create a detailed workload redistribution plan?",
        agent: "EmployeeManagerAgent",
        tools_used: [
          "get_employee_availability",
          "analyze_workload_distribution",
        ],
        confidence: 0.88,
        processing_time: 1.8,
      };
    } else if (
      lowerInput.includes("workflow") ||
      lowerInput.includes("automation")
    ) {
      return {
        content:
          "I can set up automated workflows for your scheduling needs. Available workflow templates:\n\n🔄 **Comprehensive Optimization**\n- Full schedule analysis and optimization\n- Multi-agent coordination\n- Constraint validation\n\n⚡ **Quick Conflict Resolution**\n- Identify and resolve scheduling conflicts\n- Automated employee reassignment\n\n📊 **Weekly Analytics**\n- Generate insights and recommendations\n- Performance tracking\n\nWhich workflow would you like me to execute?",
        agent: "WorkflowCoordinator",
        workflow: "workflow_discovery",
        tools_used: ["list_available_workflows", "get_workflow_templates"],
        confidence: 0.95,
        processing_time: 1.2,
      };
    } else {
      return {
        content:
          "I understand you're looking for help with your scheduling needs. I can assist with:\n\n• **Schedule Optimization** - Improve efficiency and coverage\n• **Employee Management** - Balance workloads and preferences\n• **Conflict Resolution** - Identify and fix scheduling issues\n• **Analytics & Insights** - Generate reports and recommendations\n• **Workflow Automation** - Set up automated processes\n\nWhat specific area would you like to focus on first?",
        agent: "BaseAgent",
        tools_used: ["general_assistance"],
        confidence: 0.85,
        processing_time: 0.8,
      };
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFeedback = (
    messageId: string,
    feedback: "positive" | "negative",
  ) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, feedback } : msg)),
    );
    toast.success(`Feedback recorded: ${feedback}`);
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Message copied to clipboard");
  };

  const clearConversation = () => {
    setMessages([]);
    setCurrentSession(null);
    setAttachedFiles([]);
    toast.success("Conversation cleared");
  };

  const handleExportConversation = async () => {
    if (!currentSession?.id || messages.length === 0) {
      toast.error("No conversation to export");
      return;
    }

    try {
      const blob = await aiService.exportConversation(currentSession.id, "json");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation-${currentSession.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Conversation exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export conversation");
    }
  };

  const handleVoiceTranscript = (text: string, confidence: number) => {
    setCurrentInput(text);
    setShowVoiceInput(false);
    toast.success(`Voice input received (${Math.round(confidence * 100)}% confidence)`);
  };

  const handleFilesUploaded = (files: FileUpload[]) => {
    setAttachedFiles((prev) => [...prev, ...files]);
    setShowFileUpload(false);
    toast.success(`${files.length} file(s) attached`);
  };

  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter(f => f.id !== fileId));
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(timestamp);
  };

  const getAgentIcon = (agent?: string) => {
    switch (agent) {
      case "ScheduleOptimizerAgent":
        return "🗓️";
      case "EmployeeManagerAgent":
        return "👥";
      case "WorkflowCoordinator":
        return "⚡";
      case "system":
        return "🤖";
      default:
        return "🧠";
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Main Chat Interface - Full Width */}
      <Card className="flex flex-col h-full border-0 shadow-none rounded-none md:rounded-lg md:border md:shadow-sm">
        {/* Header - Sticky top */}
        <CardHeader className="flex-shrink-0 pb-2 md:pb-3 border-b sticky top-0 z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 animate-pulse">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base md:text-lg">AI Assistant</CardTitle>
                <p className="text-xs text-muted-foreground">Powered by {aiProvider.toUpperCase()}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="outline" onClick={clearConversation} className="h-8 px-2 gap-1">
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Clear</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportConversation} className="h-8 px-2 gap-1">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Export</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Messages Area - Optimized */}
        <CardContent className="flex-1 flex flex-col p-0 min-h-0 bg-gradient-to-b from-background/50 to-background">
          <ScrollArea className="flex-1 px-3 md:px-6 py-4 md:py-6">
            <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    message.type === "user" ? "flex-row-reverse" : "",
                  )}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {message.type === "user" ? (
                      <Avatar className="h-8 w-8 md:h-10 md:w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar className="h-8 w-8 md:h-10 md:w-10 bg-gradient-to-br from-primary/60 to-primary/30">
                        <AvatarFallback className="text-sm bg-transparent">
                          {getAgentIcon(message.metadata?.agent)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={cn("flex-1 flex flex-col gap-2", message.type === "user" ? "items-end" : "items-start")}>
                    {/* Sender Info */}
                    <div className={cn("text-xs font-medium text-muted-foreground flex items-center gap-2", message.type === "user" ? "flex-row-reverse" : "")}>
                      <span>{message.type === "user" ? "You" : message.metadata?.agent || "AI"}</span>
                      {message.type === "ai" && message.metadata?.confidence && (
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(message.metadata.confidence * 100)}%
                        </Badge>
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div className={cn("max-w-2xl rounded-xl px-4 py-3 shadow-sm", message.type === "user" ? "bg-primary text-primary-foreground rounded-br-none" : message.type === "system" ? "bg-muted border border-border rounded-bl-none" : "bg-card border border-border/50 rounded-bl-none")}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {message.content}
                      </div>

                      {/* AI Message Metadata */}
                      {message.type === "ai" && message.metadata && (
                        <div className="mt-3 pt-3 border-t border-current/10 space-y-1.5">
                          {message.metadata.tools_used && message.metadata.tools_used.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {message.metadata.tools_used.map((tool) => (
                                <Badge key={tool} variant="outline" className="text-xs">
                                  {tool.replace(/_/g, " ")}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {message.metadata.processing_time && (
                            <div className="text-xs opacity-75 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{message.metadata.processing_time.toFixed(2)}s</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Message Footer - Actions & Timestamp */}
                    <div className={cn("text-xs text-muted-foreground flex items-center gap-2", message.type === "user" ? "flex-row-reverse" : "")}>
                      <span>{formatTimestamp(message.timestamp)}</span>
                      {message.type === "ai" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 hover:text-foreground"
                            onClick={() => copyToClipboard(message.content)}
                            title="Copy message"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn("h-6 w-6 p-0", message.feedback === "positive" && "text-green-500")}
                            onClick={() => handleFeedback(message.id, "positive")}
                            title="Helpful"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn("h-6 w-6 p-0", message.feedback === "negative" && "text-red-500")}
                            onClick={() => handleFeedback(message.id, "negative")}
                            title="Not helpful"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Avatar className="h-8 w-8 md:h-10 md:w-10 bg-gradient-to-br from-primary/60 to-primary/30">
                    <AvatarFallback className="text-sm bg-transparent">🤖</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-muted-foreground mb-2">AI Assistant</div>
                    <div className="bg-card border border-border/50 rounded-xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area - Sticky bottom */}
          <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3 md:p-4 flex-shrink-0">
            <div className="max-w-4xl mx-auto space-y-3">
              {/* Attached Files Display */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg">
                  {attachedFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-md border">
                      <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{file.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-4 w-4 p-0"
                        onClick={() => removeAttachedFile(file.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Voice Input Modal */}
              {showVoiceInput && (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Voice Input</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowVoiceInput(false)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <VoiceInput
                    onTranscript={handleVoiceTranscript}
                    disabled={isLoading}
                  />
                </div>
              )}

              {/* File Upload Modal */}
              {showFileUpload && (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Upload Files</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowFileUpload(false)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <FileUploadComponent
                    onFilesUploaded={handleFilesUploaded}
                    maxFiles={5}
                    maxFileSize={10}
                  />
                </div>
              )}

              {/* Input Controls */}
              <div className="flex gap-2">
                {/* Action Buttons - Left Side */}
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowVoiceInput(!showVoiceInput)}
                    disabled={isLoading}
                    className="h-12 px-3"
                    title="Voice input"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowFileUpload(!showFileUpload)}
                    disabled={isLoading}
                    className="h-12 px-3"
                    title="Attach files"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </div>

                {/* Text Input */}
                <Textarea
                  ref={inputRef}
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about scheduling, employees, or workflows..."
                  className="min-h-12 max-h-24 resize-none text-sm"
                  disabled={isLoading || isStreaming}
                />

                {/* Send Button */}
                <Button
                  onClick={handleSendMessage}
                  disabled={!currentInput.trim() || isLoading || isStreaming}
                  className="h-12 px-4 flex-shrink-0 rounded-lg"
                  title="Send message (Enter)"
                >
                  {isLoading || isStreaming ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>

              {/* Status Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground gap-2">
                <span className="flex items-center gap-1">
                  <span>↵ Enter to send</span>
                  <span className="opacity-50">•</span>
                  <span>Shift+↵ for new line</span>
                  {isStreaming && (
                    <>
                      <span className="opacity-50">•</span>
                      <span className="text-primary font-medium">Streaming...</span>
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={cn("h-3 w-3 flex-shrink-0", isConnected ? "text-green-500" : "text-muted-foreground")} />
                  <span className="font-medium">{isConnected ? "Connected" : "Disconnected"}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
