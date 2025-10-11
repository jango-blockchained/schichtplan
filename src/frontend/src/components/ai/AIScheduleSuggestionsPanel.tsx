/**
 * AI Schedule Suggestions Panel
 * 
 * Displays proactive AI-generated suggestions for schedule optimization,
 * conflict resolution, and workload balancing.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAIContext } from "@/contexts/AIContext";
import { cn } from "@/lib/utils";
import { enhancedAIService, ProactiveSuggestion } from "@/services/enhancedAIService";
import {
    AlertTriangle,
    CheckCircle,
    Info,
    Lightbulb,
    X,
    Zap
} from "lucide-react";
import React, { useEffect, useState } from "react";

interface AIScheduleSuggestionsPanelProps {
    className?: string;
    dateRange?: { start: Date; end: Date };
    scheduleId?: number;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

const typeIcons = {
    warning: AlertTriangle,
    info: Info,
    action: Zap,
    insight: Lightbulb,
};

const priorityColors = {
    high: "border-destructive text-destructive",
    medium: "border-orange-500 text-orange-500",
    low: "border-blue-500 text-blue-500",
};

export const AIScheduleSuggestionsPanel: React.FC<AIScheduleSuggestionsPanelProps> = ({
    className,
    dateRange,
    scheduleId,
    autoRefresh = true,
    refreshInterval = 60000, // 60 seconds
}) => {
    const aiContext = useAIContext();
    const { toast } = useToast();

    const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

    // Fetch suggestions
    const fetchSuggestions = async () => {
        setIsLoading(true);
        try {
            const context = aiContext.getContextSummary();

            // Add date range and schedule info to context
            const enrichedContext = {
                ...context,
                data: {
                    dateRange: dateRange ? {
                        start: dateRange.start.toISOString(),
                        end: dateRange.end.toISOString(),
                    } : undefined,
                    scheduleId,
                },
            };

            const result = await enhancedAIService.getProactiveSuggestions(enrichedContext);

            // Filter out dismissed suggestions
            const filteredSuggestions = result.filter(
                (s) => !dismissedSuggestions.has(s.id)
            );

            setSuggestions(filteredSuggestions);
        } catch (error) {
            console.error("Failed to fetch AI suggestions:", error);
            toast({
                title: "Failed to load suggestions",
                description: "Could not fetch AI suggestions. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-refresh suggestions
    useEffect(() => {
        fetchSuggestions();

        if (autoRefresh) {
            const interval = setInterval(fetchSuggestions, refreshInterval);
            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange, scheduleId, autoRefresh, refreshInterval, dismissedSuggestions]);

    // Handle suggestion action
    const handleAction = async (suggestion: ProactiveSuggestion) => {
        if (!suggestion.action) return;

        try {
            toast({
                title: "Executing action...",
                description: suggestion.action.label,
            });

            // Execute the action based on type
            const actionType = suggestion.action.endpoint;

            if (actionType.includes("optimize")) {
                await enhancedAIService.optimizeSchedule({
                    context: aiContext.getContextSummary(),
                    ...suggestion.action.parameters,
                });
            } else if (actionType.includes("conflict")) {
                await enhancedAIService.resolveConflicts({
                    context: aiContext.getContextSummary(),
                    ...suggestion.action.parameters,
                });
            } else if (actionType.includes("workload")) {
                await enhancedAIService.balanceWorkload(aiContext.getContextSummary());
            }

            toast({
                title: "Action completed",
                description: "The operation completed successfully.",
            });

            // Refresh suggestions
            fetchSuggestions();
        } catch (error) {
            console.error("Failed to execute action:", error);
            toast({
                title: "Action failed",
                description: "Could not execute the action. Please try again.",
                variant: "destructive",
            });
        }
    };

    // Dismiss suggestion
    const handleDismiss = async (suggestionId: string) => {
        try {
            await enhancedAIService.dismissSuggestion(suggestionId);
            setDismissedSuggestions((prev) => new Set([...prev, suggestionId]));
            setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));

            toast({
                title: "Suggestion dismissed",
                description: "This suggestion won't appear again.",
            });
        } catch (error) {
            console.error("Failed to dismiss suggestion:", error);
        }
    };

    // Visible suggestions (not dismissed)
    const visibleSuggestions = suggestions.filter(
        (s) => !dismissedSuggestions.has(s.id)
    );

    const highPrioritySuggestions = visibleSuggestions.filter(
        (s) => s.priority === "high"
    ).length;

    if (isCollapsed) {
        return (
            <Card className={cn("border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20", className)}>
                <CardHeader className="cursor-pointer" onClick={() => setIsCollapsed(false)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            <CardTitle className="text-base">AI Suggestions</CardTitle>
                            {highPrioritySuggestions > 0 && (
                                <Badge variant="destructive" className="h-5 text-xs">
                                    {highPrioritySuggestions}
                                </Badge>
                            )}
                        </div>
                        <Button variant="ghost" size="sm">
                            Show
                        </Button>
                    </div>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className={cn("border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20", className)}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <CardTitle>AI Suggestions</CardTitle>
                        {visibleSuggestions.length > 0 && (
                            <Badge variant="secondary" className="h-5 text-xs">
                                {visibleSuggestions.length}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchSuggestions}
                            disabled={isLoading}
                        >
                            {isLoading ? "Loading..." : "Refresh"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsCollapsed(true)}
                        >
                            Hide
                        </Button>
                    </div>
                </div>
                <CardDescription>
                    AI-powered recommendations to improve your schedule
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading && suggestions.length === 0 ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-full" />
                            </div>
                        ))}
                    </div>
                ) : visibleSuggestions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle className="mb-2 h-12 w-12 text-green-500" />
                        <p className="text-sm font-medium">All good!</p>
                        <p className="text-xs text-muted-foreground">
                            No suggestions at the moment
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-3">
                            {visibleSuggestions.map((suggestion) => {
                                const TypeIcon = typeIcons[suggestion.type];

                                return (
                                    <Card
                                        key={suggestion.id}
                                        className={cn(
                                            "border-l-4 transition-all hover:shadow-md",
                                            priorityColors[suggestion.priority]
                                        )}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1">
                                                    <div className={cn(
                                                        "rounded-full p-2",
                                                        suggestion.priority === "high" && "bg-destructive/10",
                                                        suggestion.priority === "medium" && "bg-orange-500/10",
                                                        suggestion.priority === "low" && "bg-blue-500/10"
                                                    )}>
                                                        <TypeIcon className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-sm font-semibold">
                                                                {suggestion.title}
                                                            </h4>
                                                            <Badge
                                                                variant="outline"
                                                                className="h-5 text-xs"
                                                            >
                                                                {suggestion.priority}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {suggestion.description}
                                                        </p>
                                                        {suggestion.action && (
                                                            <div className="flex items-center gap-2 pt-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant={
                                                                        suggestion.priority === "high"
                                                                            ? "default"
                                                                            : "outline"
                                                                    }
                                                                    onClick={() => handleAction(suggestion)}
                                                                >
                                                                    <Zap className="mr-1 h-3 w-3" />
                                                                    {suggestion.action.label}
                                                                </Button>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {suggestion.context.page_name || "Impact varies"}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => handleDismiss(suggestion.id)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}

                <Separator className="my-4" />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <PriorityIcon className="h-3 w-3" />
                        <span>
                            {highPrioritySuggestions} high priority
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span>Powered by AI</span>
                        <Zap className="h-3 w-3 text-purple-500" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
