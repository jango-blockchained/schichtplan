/**
 * Global AI Assistant Component
 *
 * Omnipresent AI assistant accessible from any page in the application.
 * Provides context-aware help, suggestions, and conversational interface.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { useAIContext } from "@/contexts/AIContext";
import { cn } from "@/lib/utils";
import { enhancedAIService } from "@/services/enhancedAIService";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  MessageSquare,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { ConversationalAIChat } from "./ConversationalAIChat";

// ============================================================================
// Types
// ============================================================================

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

interface GlobalAIAssistantProps {
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const GlobalAIAssistant: React.FC<GlobalAIAssistantProps> = ({
  className,
}) => {
  const aiContext = useAIContext();
  const { toast } = useToast();

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [activeSuggestions, setActiveSuggestions] = useState(0);
  const [showPulse, setShowPulse] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Get context-aware quick actions based on current page
  useEffect(() => {
    const actions = getQuickActionsForPage(
      aiContext.pageContext.route,
      aiContext,
      toast,
      setIsProcessing,
    );
    setQuickActions(actions);
  }, [aiContext, toast]);

  // Count active (non-dismissed) suggestions
  useEffect(() => {
    const count = 0; // TODO: Get from aiContext when suggestions are implemented
    setActiveSuggestions(count);

    // Show pulse animation when new suggestions appear
    if (count > activeSuggestions) {
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 3000);
    }
  }, [activeSuggestions]);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Handle global keyboard shortcut (Cmd/Ctrl + /)
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        // Don't close if clicking the floating button
        if (!target.closest("[data-ai-button]")) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };

  const handleQuickAction = async (action: QuickAction) => {
    try {
      await action.handler();
    } catch (error) {
      console.error("Quick action failed:", error);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div
        data-ai-button
        className={cn("fixed bottom-6 right-6 z-50", className)}
      >
        <Button
          size="lg"
          onClick={handleToggle}
          className={cn(
            "rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-all duration-300",
            "bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700",
            showPulse && "animate-pulse",
          )}
          aria-label="Toggle AI Assistant"
        >
          <Bot className="h-6 w-6 text-white" />
          {activeSuggestions > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full text-xs"
            >
              {activeSuggestions}
            </Badge>
          )}
        </Button>

        {!isOpen && (
          <div className="absolute bottom-16 right-0 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
            Press Cmd+/ to open
          </div>
        )}
      </div>

      {/* Slide-out Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className={cn(
            "fixed right-0 top-0 h-screen z-40 transition-all duration-300 ease-in-out",
            "bg-background border-l border-border shadow-2xl",
            isMinimized ? "w-16" : "w-[450px]",
          )}
          style={{
            transform: isOpen ? "translateX(0)" : "translateX(100%)",
          }}
        >
          {isMinimized ? (
            /* Minimized View */
            <div className="h-full flex flex-col items-center justify-start pt-4 gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMinimize}
                className="rounded-full"
              >
                <ChevronDown className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>

              <Separator />

              <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <Bot className="h-5 w-5" />
                <span className="writing-mode-vertical-rl">AI Assistant</span>
              </div>
            </div>
          ) : (
            /* Full View */
            <div className="h-full flex flex-col">
              {/* Header */}
              <CardHeader className="flex-shrink-0 pb-3 space-y-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-600/20 to-blue-600/20">
                      <Bot className="h-5 w-5 text-purple-600" />
                    </div>
                    <span>AI Assistant</span>
                  </CardTitle>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleMinimize}
                      className="h-8 w-8"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsOpen(false)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Context Banner */}
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3 w-3" />
                      <span className="font-medium">Context:</span>
                      <span>{aiContext.pageContext.pageTitle}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <Separator />

              {/* Quick Actions */}
              {quickActions.length > 0 && (
                <>
                  <div className="flex-shrink-0 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      Quick Actions
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {quickActions.map((action) => (
                        <Button
                          key={action.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickAction(action)}
                          disabled={!action.enabled}
                          className="h-auto py-2 flex-col items-start gap-1 text-left"
                        >
                          <div className="flex items-center gap-2 w-full">
                            {action.icon}
                            <span className="text-xs font-medium">
                              {action.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground leading-tight">
                            {action.description}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* AI Suggestions */}
              {activeSuggestions > 0 && (
                <>
                  <div className="flex-shrink-0 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Lightbulb className="h-4 w-4 text-orange-600" />
                      Suggestions ({activeSuggestions})
                    </div>
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-sm text-muted-foreground">
                        <p>
                          AI suggestions will appear here based on your current
                          context.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <Separator />
                </>
              )}

              {/* Main Chat Area */}
              <div className="flex-1 min-h-0 p-4">
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 text-sm font-medium mb-3">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    Conversation
                  </div>
                  <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full">
                      <ConversationalAIChat />
                    </ScrollArea>
                  </div>
                </div>
              </div>

              {/* Footer Hint */}
              <div className="flex-shrink-0 p-2 bg-muted/30 border-t border-border">
                <p className="text-xs text-center text-muted-foreground">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                    Cmd+/
                  </kbd>{" "}
                  to toggle •{" "}
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                    Esc
                  </kbd>{" "}
                  to close
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backdrop (subtle, doesn't block interaction) */}
      {isOpen && !isMinimized && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-30 pointer-events-none" />
      )}
    </>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function getQuickActionsForPage(
  route: string,
  aiContext: any,
  toast: any,
  setIsProcessing: (value: boolean) => void,
): QuickAction[] {
  // Schedule page actions
  if (route.includes("/schedule") || route.includes("/calendar")) {
    return [
      {
        id: "optimize-schedule",
        label: "Optimize",
        icon: <Sparkles className="h-3 w-3" />,
        description: "AI-optimize current schedule",
        handler: async () => {
          try {
            setIsProcessing(true);
            toast({
              title: "Optimizing Schedule",
              description: "AI is analyzing your schedule...",
            });

            const context = aiContext.getContextSummary();
            const task = await enhancedAIService.optimizeSchedule({
              context,
            });

            toast({
              title: "Optimization Started",
              description: `Task ${task.id} is running in the background.`,
            });

            // Poll for completion
            await enhancedAIService.waitForTask(task.id, (progress) => {
              console.log(`Optimization progress: ${progress.progress}%`);
            });

            toast({
              title: "Optimization Complete",
              description: "Your schedule has been optimized!",
            });
          } catch (error) {
            toast({
              title: "Optimization Failed",
              description: String(error),
              variant: "destructive",
            });
          } finally {
            setIsProcessing(false);
          }
        },
        enabled: true,
      },
      {
        id: "fix-conflicts",
        label: "Fix Conflicts",
        icon: <Zap className="h-3 w-3" />,
        description: "Resolve scheduling conflicts",
        handler: async () => {
          try {
            setIsProcessing(true);
            toast({
              title: "Resolving Conflicts",
              description: "AI is identifying and fixing conflicts...",
            });

            const context = aiContext.getContextSummary();
            const result = await enhancedAIService.resolveConflicts({
              context,
            });

            toast({
              title: "Conflicts Resolved",
              description: `Background task ${result.id} started.`,
            });
          } catch (error) {
            toast({
              title: "Conflict Resolution Failed",
              description: String(error),
              variant: "destructive",
            });
          } finally {
            setIsProcessing(false);
          }
        },
        enabled: true,
      },
      {
        id: "balance-workload",
        label: "Balance Load",
        icon: <Bot className="h-3 w-3" />,
        description: "Balance employee workload",
        handler: async () => {
          try {
            setIsProcessing(true);
            toast({
              title: "Balancing Workload",
              description: "AI is analyzing employee workloads...",
            });

            const context = aiContext.getContextSummary();
            await enhancedAIService.balanceWorkload(context);

            toast({
              title: "Workload Balanced",
              description: `Workload balancing completed successfully.`,
            });
          } catch (error) {
            toast({
              title: "Workload Balancing Failed",
              description: String(error),
              variant: "destructive",
            });
          } finally {
            setIsProcessing(false);
          }
        },
        enabled: true,
      },
      {
        id: "suggest-assignments",
        label: "Suggest",
        icon: <Lightbulb className="h-3 w-3" />,
        description: "Get assignment suggestions",
        handler: async () => {
          try {
            setIsProcessing(true);
            toast({
              title: "Getting Suggestions",
              description: "AI is analyzing optimal assignments...",
            });

            const context = aiContext.getContextSummary();
            await enhancedAIService.getAssignmentSuggestions(context);

            toast({
              title: "Suggestions Ready",
              description: `Assignment suggestions generated successfully.`,
            });
          } catch (error) {
            toast({
              title: "Failed to Get Suggestions",
              description: String(error),
              variant: "destructive",
            });
          } finally {
            setIsProcessing(false);
          }
        },
        enabled: true,
      },
    ];
  }

  // Employee page actions
  if (route.includes("/employee")) {
    return [
      {
        id: "analyze-workload",
        label: "Analyze",
        icon: <Sparkles className="h-3 w-3" />,
        description: "Analyze employee workload",
        handler: async () => {
          try {
            setIsProcessing(true);
            toast({
              title: "Analyzing Workload",
              description: "AI is reviewing employee workloads...",
            });

            const context = aiContext.getContextSummary();
            await enhancedAIService.analyzeWorkload(context);

            toast({
              title: "Analysis Complete",
              description: `Workload analysis completed successfully.`,
            });
          } catch (error) {
            toast({
              title: "Analysis Failed",
              description: String(error),
              variant: "destructive",
            });
          } finally {
            setIsProcessing(false);
          }
        },
        enabled: true,
      },
      {
        id: "suggest-availability",
        label: "Availability",
        icon: <Lightbulb className="h-3 w-3" />,
        description: "Suggest optimal availability",
        handler: async () => {
          try {
            setIsProcessing(true);
            toast({
              title: "Getting Suggestions",
              description: "AI is analyzing optimal availability...",
            });

            const context = aiContext.getContextSummary();
            await enhancedAIService.suggestAvailability(context);

            toast({
              title: "Suggestions Ready",
              description: `Availability suggestions generated successfully.`,
            });
          } catch (error) {
            toast({
              title: "Failed to Get Suggestions",
              description: String(error),
              variant: "destructive",
            });
          } finally {
            setIsProcessing(false);
          }
        },
        enabled: true,
      },
    ];
  }

  // Default actions for other pages
  return [
    {
      id: "ask-ai",
      label: "Ask AI",
      icon: <MessageSquare className="h-3 w-3" />,
      description: "Ask AI about this page",
      handler: async () => {
        toast({
          title: "AI Assistant Ready",
          description: "Type your question in the chat below!",
        });
      },
      enabled: true,
    },
    {
      id: "get-help",
      label: "Get Help",
      icon: <Lightbulb className="h-3 w-3" />,
      description: "Get contextual help",
      handler: async () => {
        try {
          setIsProcessing(true);
          const context = aiContext.getContextSummary();

          toast({
            title: "Getting Help",
            description: `Learning about ${context.page}...`,
          });

          await enhancedAIService.sendContextualMessage({
            message: `What can I do on the ${context.page} page?`,
            context,
          });

          toast({
            title: "Help Ready",
            description: "Check the chat for guidance!",
          });
        } catch (error) {
          toast({
            title: "Failed to Get Help",
            description: String(error),
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      },
      enabled: true,
    },
  ];
}

export default GlobalAIAssistant;
