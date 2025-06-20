import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    Bot,
    CheckCircle2,
    Clock,
    Copy,
    Download,
    Loader2,
    MessageSquare,
    RotateCcw,
    Send,
    Settings,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    User
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ConversationMessage {
  id: string;
  type: "user" | "ai" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    agent?: string;
    workflow?: string;
    tools_used?: string[];
    confidence?: number;
    processing_time?: number;
  };
  feedback?: "positive" | "negative" | null;
}

interface ConversationSession {
  id: string;
  title: string;
  created_at: Date;
  last_message_at: Date;
  message_count: number;
  status: "active" | "archived";
}

export const ConversationalAIChat: React.FC = () => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [aiProvider] = useState<"openai" | "anthropic" | "gemini">("openai");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize with a welcome message
    const welcomeMessage: ConversationMessage = {
      id: "welcome",
      type: "system",
      content: "Welcome to the AI-powered scheduling assistant! I can help you optimize schedules, manage employees, resolve conflicts, and much more. What would you like to work on today?",
      timestamp: new Date(),
      metadata: {
        agent: "system",
        confidence: 1.0
      }
    };
    setMessages([welcomeMessage]);

    // Create initial session
    const initialSession: ConversationSession = {
      id: "session-1",
      title: "New Conversation",
      created_at: new Date(),
      last_message_at: new Date(),
      message_count: 1,
      status: "active"
    };
    setCurrentSession(initialSession);
    setSessions([initialSession]);
  }, []);

  const handleSendMessage = async () => {
    if (!currentInput.trim() || isLoading) return;

    const userMessage: ConversationMessage = {
      id: `msg-${Date.now()}-user`,
      type: "user",
      content: currentInput.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentInput("");
    setIsLoading(true);

    try {
      // Simulate AI response - In real implementation, this would call the backend
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
          processing_time: response.processing_time
        }
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Update session
      if (currentSession) {
        setCurrentSession(prev => prev ? {
          ...prev,
          last_message_at: new Date(),
          message_count: prev.message_count + 2
        } : null);
      }

      toast.success("AI response generated successfully");
    } catch (error) {
      toast.error("Failed to get AI response");
      console.error("AI response error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const simulateAIResponse = async (userInput: string): Promise<{
    content: string;
    agent: string;
    workflow?: string;
    tools_used: string[];
    confidence: number;
    processing_time: number;
  }> => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes("schedule") || lowerInput.includes("optimize")) {
      return {
        content: "I'll help you optimize the schedule. Let me analyze the current situation and identify potential improvements. I've detected several areas where we can enhance efficiency:\n\n1. **Workload Balance**: There are some employees with uneven shift distributions\n2. **Coverage Gaps**: I found 3 time periods that need better coverage\n3. **Conflict Resolution**: 2 scheduling conflicts need attention\n\nWould you like me to:\n- Run a comprehensive optimization workflow?\n- Focus on a specific time period?\n- Address particular employee assignments?",
        agent: "ScheduleOptimizerAgent",
        workflow: "schedule_analysis",
        tools_used: ["analyze_schedule_conflicts", "get_coverage_requirements", "get_employee_availability"],
        confidence: 0.92,
        processing_time: 2.3
      };
    } else if (lowerInput.includes("employee") || lowerInput.includes("workload")) {
      return {
        content: "I'm analyzing employee workload and availability patterns. Here's what I found:\n\n**Current Workload Analysis:**\n- 12 employees total\n- Average workload: 38.5 hours/week\n- 3 employees are above recommended hours\n- 2 employees have availability conflicts\n\n**Recommendations:**\n- Redistribute 6 hours from overloaded employees\n- Consider cross-training for better flexibility\n- Review availability preferences\n\nShould I create a detailed workload redistribution plan?",
        agent: "EmployeeManagerAgent",
        tools_used: ["get_employee_availability", "analyze_workload_distribution"],
        confidence: 0.88,
        processing_time: 1.8
      };
    } else if (lowerInput.includes("workflow") || lowerInput.includes("automation")) {
      return {
        content: "I can set up automated workflows for your scheduling needs. Available workflow templates:\n\n🔄 **Comprehensive Optimization**\n- Full schedule analysis and optimization\n- Multi-agent coordination\n- Constraint validation\n\n⚡ **Quick Conflict Resolution**\n- Identify and resolve scheduling conflicts\n- Automated employee reassignment\n\n📊 **Weekly Analytics**\n- Generate insights and recommendations\n- Performance tracking\n\nWhich workflow would you like me to execute?",
        agent: "WorkflowCoordinator",
        workflow: "workflow_discovery",
        tools_used: ["list_available_workflows", "get_workflow_templates"],
        confidence: 0.95,
        processing_time: 1.2
      };
    } else {
      return {
        content: "I understand you're looking for help with your scheduling needs. I can assist with:\n\n• **Schedule Optimization** - Improve efficiency and coverage\n• **Employee Management** - Balance workloads and preferences\n• **Conflict Resolution** - Identify and fix scheduling issues\n• **Analytics & Insights** - Generate reports and recommendations\n• **Workflow Automation** - Set up automated processes\n\nWhat specific area would you like to focus on first?",
        agent: "BaseAgent",
        tools_used: ["general_assistance"],
        confidence: 0.85,
        processing_time: 0.8
      };
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFeedback = (messageId: string, feedback: "positive" | "negative") => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback } : msg
    ));
    toast.success(`Feedback recorded: ${feedback}`);
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Message copied to clipboard");
  };

  const clearConversation = () => {
    setMessages([]);
    setCurrentSession(null);
    toast.success("Conversation cleared");
  };

  const newConversation = () => {
    const newSession: ConversationSession = {
      id: `session-${Date.now()}`,
      title: "New Conversation",
      created_at: new Date(),
      last_message_at: new Date(),
      message_count: 0,
      status: "active"
    };
    
    setCurrentSession(newSession);
    setSessions(prev => [newSession, ...prev]);
    setMessages([]);
    toast.success("New conversation started");
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
      {/* Conversation Sidebar */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Conversations</CardTitle>
            <Button size="sm" variant="outline" onClick={newConversation}>
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2 p-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-colors",
                    currentSession?.id === session.id 
                      ? "bg-primary/10 border-primary border" 
                      : "bg-muted/50 hover:bg-muted"
                  )}
                  onClick={() => setCurrentSession(session)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">
                      {session.title}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {session.message_count}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(session.last_message_at)}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Chat Interface */}
      <Card className="lg:col-span-3 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>AI Assistant</CardTitle>
              <Badge variant="outline" className="text-xs">
                {aiProvider.toUpperCase()}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={clearConversation}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Messages Area */}
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 max-w-[80%]",
                    message.type === "user" ? "ml-auto" : ""
                  )}
                >
                  {message.type !== "user" && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="text-xs">
                        {getAgentIcon(message.metadata?.agent)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={cn(
                    "flex-1 space-y-2",
                    message.type === "user" ? "text-right" : ""
                  )}>
                    <div
                      className={cn(
                        "rounded-lg p-3 text-sm",
                        message.type === "user"
                          ? "bg-primary text-primary-foreground ml-auto"
                          : message.type === "system"
                          ? "bg-muted border border-border"
                          : "bg-muted/50 border border-border"
                      )}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      
                      {/* Message Metadata */}
                      {message.metadata && message.type === "ai" && (
                        <div className="mt-3 pt-2 border-t border-border/50 space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Bot className="h-3 w-3" />
                            <span>Agent: {message.metadata.agent}</span>
                            {message.metadata.confidence && (
                              <Badge variant="outline" className="text-xs">
                                {Math.round(message.metadata.confidence * 100)}% confidence
                              </Badge>
                            )}
                          </div>
                          
                          {message.metadata.tools_used && message.metadata.tools_used.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Settings className="h-3 w-3" />
                              <span>Tools: {message.metadata.tools_used.join(", ")}</span>
                            </div>
                          )}
                          
                          {message.metadata.processing_time && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{message.metadata.processing_time}s</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Message Actions */}
                    <div className={cn(
                      "flex items-center gap-1",
                      message.type === "user" ? "justify-end" : ""
                    )}>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(message.timestamp)}
                      </span>
                      
                      {message.type === "ai" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(message.content)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              "h-6 w-6 p-0",
                              message.feedback === "positive" && "text-green-500"
                            )}
                            onClick={() => handleFeedback(message.id, "positive")}
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              "h-6 w-6 p-0",
                              message.feedback === "negative" && "text-red-500"
                            )}
                            onClick={() => handleFeedback(message.id, "negative")}
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {message.type === "user" && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="text-xs">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="text-xs">
                      🤖
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="bg-muted/50 border border-border rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          AI is thinking...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about scheduling, optimization, or employee management..."
                className="min-h-[60px] resize-none"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!currentInput.trim() || isLoading}
                className="h-[60px] px-4"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span>AI System Online</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
