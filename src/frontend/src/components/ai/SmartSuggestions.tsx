/**
 * SmartSuggestions Component
 * Provides proactive AI assistance and context-aware suggestions
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIContext } from "@/contexts/AIContext";
import { cn } from "@/lib/utils";
import { aiService } from "@/services/aiService";
import {
    Brain,
    Clock,
    Lightbulb,
    MessageSquare,
    Sparkles,
    Target,
    TrendingUp,
    Users,
    X
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface AISuggestion {
    id: string;
    type: 'action' | 'insight' | 'optimization' | 'alert' | 'question';
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'schedule' | 'employee' | 'coverage' | 'efficiency' | 'general';
    actionable: boolean;
    actionLabel?: string;
    metadata?: {
        confidence?: number;
        impact?: string;
        timeframe?: string;
        related_items?: string[];
    };
    timestamp: Date;
}

interface SmartSuggestionsProps {
    className?: string;
    maxSuggestions?: number;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
    className,
    maxSuggestions = 5,
    autoRefresh = true,
    refreshInterval = 30000 // 30 seconds
}) => {
    const { pageContext, getContextSummary } = useAIContext();
    const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // Generate mock suggestions for fallback
    const generateMockSuggestions = useCallback((): AISuggestion[] => {
        const mockSuggestions: AISuggestion[] = [
            {
                id: '1',
                type: 'optimization',
                title: 'Optimize Shift Coverage',
                description: 'Consider adjusting shifts to improve weekend coverage by 15%',
                priority: 'medium',
                category: 'coverage',
                actionable: true,
                actionLabel: 'View Optimization',
                metadata: {
                    confidence: 0.85,
                    impact: '15% improvement',
                    timeframe: 'This week'
                },
                timestamp: new Date()
            },
            {
                id: '2',
                type: 'insight',
                title: 'Employee Availability Pattern',
                description: 'Sarah is most productive on Tuesday mornings',
                priority: 'low',
                category: 'employee',
                actionable: false,
                metadata: {
                    confidence: 0.92,
                    related_items: ['Sarah Johnson']
                },
                timestamp: new Date()
            },
            {
                id: '3',
                type: 'alert',
                title: 'Upcoming Shortage',
                description: 'Potential staffing shortage on Friday evening',
                priority: 'high',
                category: 'schedule',
                actionable: true,
                actionLabel: 'Find Replacement',
                metadata: {
                    confidence: 0.78,
                    impact: 'Critical',
                    timeframe: 'Friday 6-10 PM'
                },
                timestamp: new Date()
            }
        ];

        return mockSuggestions.slice(0, maxSuggestions);
    }, [maxSuggestions]);

    // Generate suggestions based on current context
    const generateSuggestions = useCallback(async () => {
        setIsLoading(true);
        try {
            const contextSummary = getContextSummary();

            // Call AI service to generate suggestions
            const response = await aiService.generateSuggestions({
                context: contextSummary,
                page: pageContext.route,
                maxSuggestions
            });

            if (response.success && response.suggestions) {
                setSuggestions(response.suggestions);
            }
        } catch (error) {
            console.error('Failed to generate AI suggestions:', error);
            // Fallback to mock suggestions if AI service fails
            setSuggestions(generateMockSuggestions());
        } finally {
            setIsLoading(false);
        }
    }, [pageContext, maxSuggestions, getContextSummary, generateMockSuggestions]);

    // Handle suggestion action
    const handleSuggestionAction = async (suggestion: AISuggestion) => {
        try {
            // Remove the suggestion from the list
            setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));

            // Execute the suggested action
            if (suggestion.actionLabel === 'View Optimization') {
                // Navigate to optimization view or open optimization panel
                toast.success('Opening schedule optimization...');
            } else if (suggestion.actionLabel === 'Find Replacement') {
                // Open employee search or replacement finder
                toast.success('Opening replacement finder...');
            }

            // Track that this suggestion was acted upon
            await aiService.trackSuggestionAction(suggestion.id, 'accepted');
        } catch (error) {
            console.error('Failed to handle suggestion action:', error);
            toast.error('Failed to execute suggestion');
        }
    };

    // Dismiss suggestion
    const dismissSuggestion = async (suggestionId: string) => {
        setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
        try {
            await aiService.trackSuggestionAction(suggestionId, 'dismissed');
        } catch (error) {
            console.error('Failed to track suggestion dismissal:', error);
        }
    };

    // Get icon for suggestion type
    const getSuggestionIcon = (type: AISuggestion['type']) => {
        switch (type) {
            case 'action':
                return <Target className="h-4 w-4" />;
            case 'insight':
                return <Lightbulb className="h-4 w-4" />;
            case 'optimization':
                return <TrendingUp className="h-4 w-4" />;
            case 'alert':
                return <Clock className="h-4 w-4" />;
            case 'question':
                return <MessageSquare className="h-4 w-4" />;
            default:
                return <Brain className="h-4 w-4" />;
        }
    };

    // Get color for priority
    const getPriorityColor = (priority: AISuggestion['priority']) => {
        switch (priority) {
            case 'urgent':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'high':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Get category icon
    const getCategoryIcon = (category: AISuggestion['category']) => {
        switch (category) {
            case 'schedule':
                return <Clock className="h-3 w-3" />;
            case 'employee':
                return <Users className="h-3 w-3" />;
            case 'coverage':
                return <Target className="h-3 w-3" />;
            case 'efficiency':
                return <TrendingUp className="h-3 w-3" />;
            default:
                return <Brain className="h-3 w-3" />;
        }
    };

    // Auto-refresh suggestions
    useEffect(() => {
        if (autoRefresh) {
            generateSuggestions();
            const interval = setInterval(generateSuggestions, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, refreshInterval, pageContext]);

    // Generate initial suggestions
    useEffect(() => {
        generateSuggestions();
    }, []);

    if (suggestions.length === 0 && !isLoading) {
        return null;
    }

    return (
        <Card className={cn("w-full max-w-md", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Sparkles className="h-4 w-4" />
                        AI Suggestions
                        {isLoading && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="h-6 w-6 p-0"
                    >
                        {isMinimized ? <MessageSquare className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </Button>
                </div>
            </CardHeader>

            {!isMinimized && (
                <CardContent className="pt-0">
                    <ScrollArea className="h-80">
                        <div className="space-y-3">
                            {suggestions.map((suggestion) => (
                                <div
                                    key={suggestion.id}
                                    className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {getSuggestionIcon(suggestion.type)}
                                            <span className="font-medium text-sm">{suggestion.title}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => dismissSuggestion(suggestion.id)}
                                            className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>

                                    <p className="text-xs text-muted-foreground mb-2">
                                        {suggestion.description}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="secondary"
                                                className={cn("text-xs", getPriorityColor(suggestion.priority))}
                                            >
                                                {suggestion.priority}
                                            </Badge>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                {getCategoryIcon(suggestion.category)}
                                                <span className="capitalize">{suggestion.category}</span>
                                            </div>
                                        </div>

                                        {suggestion.actionable && suggestion.actionLabel && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleSuggestionAction(suggestion)}
                                                className="text-xs h-6"
                                            >
                                                {suggestion.actionLabel}
                                            </Button>
                                        )}
                                    </div>

                                    {suggestion.metadata && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            {suggestion.metadata.confidence && (
                                                <div>Confidence: {Math.round(suggestion.metadata.confidence * 100)}%</div>
                                            )}
                                            {suggestion.metadata.impact && (
                                                <div>Impact: {suggestion.metadata.impact}</div>
                                            )}
                                            {suggestion.metadata.timeframe && (
                                                <div>Timeframe: {suggestion.metadata.timeframe}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {suggestions.length === 0 && !isLoading && (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                    No suggestions available at the moment
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            )}
        </Card>
    );
};
