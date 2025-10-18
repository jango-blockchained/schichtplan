/**
 * AISearchInput Component
 * Enhanced search input with AI-powered suggestions and natural language processing
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIContext } from "@/contexts/AIContext";
import { cn } from "@/lib/utils";
import { aiService } from "@/services/aiService";
import {
    Bot,
    Calendar,
    Search,
    Sparkles,
    Target,
    Users
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

export interface SearchSuggestion {
    id: string;
    type: 'query' | 'entity' | 'action' | 'filter';
    text: string;
    description?: string;
    category: 'schedule' | 'employee' | 'coverage' | 'general';
    confidence: number;
    metadata?: {
        entity_type?: string;
        entity_id?: string;
        action_type?: string;
        filter_type?: string;
    };
}

interface AISearchInputProps {
    placeholder?: string;
    onSearch: (query: string, suggestions?: SearchSuggestion[]) => void;
    onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
    className?: string;
    showSuggestions?: boolean;
    maxSuggestions?: number;
    debounceMs?: number;
}

export const AISearchInput: React.FC<AISearchInputProps> = ({
    placeholder = "Search with AI assistance...",
    onSearch,
    onSuggestionSelect,
    className,
    showSuggestions = true,
    maxSuggestions = 5,
    debounceMs = 300
}) => {
    const { pageContext, getContextString } = useAIContext();
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showPopover, setShowPopover] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    // Generate fallback suggestions when AI service is unavailable
    const generateFallbackSuggestions = useCallback((searchQuery: string): SearchSuggestion[] => {
        const query = searchQuery.toLowerCase();
        const fallbackSuggestions: SearchSuggestion[] = [];

        // Employee-related suggestions
        if (query.includes('employee') || query.includes('staff') || query.includes('person')) {
            fallbackSuggestions.push({
                id: 'emp-1',
                type: 'entity',
                text: `Find employees with "${searchQuery}"`,
                description: 'Search employee database',
                category: 'employee',
                confidence: 0.8,
                metadata: { entity_type: 'employee', action_type: 'search' }
            });
        }

        // Schedule-related suggestions
        if (query.includes('schedule') || query.includes('shift') || query.includes('time')) {
            fallbackSuggestions.push({
                id: 'sched-1',
                type: 'entity',
                text: `Find schedules containing "${searchQuery}"`,
                description: 'Search schedule database',
                category: 'schedule',
                confidence: 0.8,
                metadata: { entity_type: 'schedule', action_type: 'search' }
            });
        }

        // Coverage-related suggestions
        if (query.includes('coverage') || query.includes('available') || query.includes('free')) {
            fallbackSuggestions.push({
                id: 'cov-1',
                type: 'filter',
                text: `Show coverage for "${searchQuery}"`,
                description: 'Filter by availability',
                category: 'coverage',
                confidence: 0.7,
                metadata: { filter_type: 'coverage', action_type: 'filter' }
            });
        }

        return fallbackSuggestions.slice(0, maxSuggestions);
    }, [maxSuggestions]);

    // Generate AI-powered search suggestions
    const generateSuggestions = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setSuggestions([]);
            return;
        }

        setIsLoading(true);
        try {
            const contextSummary = getContextString();

            const response = await aiService.generateSearchSuggestions({
                query: searchQuery,
                context: contextSummary,
                page: pageContext.route,
                max_suggestions: maxSuggestions
            });

            if (response.success && response.suggestions) {
                setSuggestions(response.suggestions);
                setShowPopover(true);
            }
        } catch (error) {
            console.error('Failed to generate search suggestions:', error);
            // Fallback to basic suggestions
            setSuggestions(generateFallbackSuggestions(searchQuery));
            setShowPopover(true);
        } finally {
            setIsLoading(false);
        }
    }, [pageContext.route, maxSuggestions, getContextString, generateFallbackSuggestions]);

    // Debounced search
    useEffect(() => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        if (query.trim()) {
            const timer = setTimeout(() => {
                generateSuggestions(query);
            }, debounceMs);

            setDebounceTimer(timer);
        } else {
            setSuggestions([]);
            setShowPopover(false);
        }

        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [query, debounceMs, generateSuggestions, debounceTimer]);

    // Handle search submission
    const handleSearch = (searchQuery: string = query) => {
        if (searchQuery.trim()) {
            onSearch(searchQuery, suggestions);
            setShowPopover(false);
            setQuery(searchQuery);
        }
    };

    // Handle suggestion selection
    const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
        setQuery(suggestion.text);
        setShowPopover(false);

        if (onSuggestionSelect) {
            onSuggestionSelect(suggestion);
        } else {
            // Default behavior: perform search with suggestion
            handleSearch(suggestion.text);
        }
    };

    // Handle key events
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        } else if (e.key === 'Escape') {
            setShowPopover(false);
        }
    };

    // Get category icon
    const getCategoryIcon = (category: SearchSuggestion['category']) => {
        switch (category) {
            case 'schedule':
                return <Calendar className="h-3 w-3" />;
            case 'employee':
                return <Users className="h-3 w-3" />;
            case 'coverage':
                return <Target className="h-3 w-3" />;
            default:
                return <Search className="h-3 w-3" />;
        }
    };

    // Get type color
    const getTypeColor = (type: SearchSuggestion['type']) => {
        switch (type) {
            case 'query':
                return 'bg-blue-100 text-blue-800';
            case 'entity':
                return 'bg-green-100 text-green-800';
            case 'action':
                return 'bg-purple-100 text-purple-800';
            case 'filter':
                return 'bg-orange-100 text-orange-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className={cn("relative w-full", className)}>
            <Popover open={showPopover && showSuggestions} onOpenChange={setShowPopover}>
                <PopoverTrigger asChild>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={placeholder}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-10 pr-10"
                        />
                        {isLoading && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                        {query && !isLoading && (
                            <Button
                                onClick={() => handleSearch()}
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                            >
                                <Sparkles className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </PopoverTrigger>

                {showSuggestions && (
                    <PopoverContent className="w-full p-0" align="start">
                        <ScrollArea className="h-80">
                            <div className="p-2">
                                {suggestions.length > 0 ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                                            <Bot className="h-3 w-3" />
                                            AI-Powered Suggestions
                                        </div>
                                        {suggestions.map((suggestion) => (
                                            <button
                                                key={suggestion.id}
                                                onClick={() => handleSuggestionSelect(suggestion)}
                                                className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors group"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {getCategoryIcon(suggestion.category)}
                                                            <span className="text-sm font-medium">{suggestion.text}</span>
                                                        </div>
                                                        {suggestion.description && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {suggestion.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 ml-2">
                                                        <Badge
                                                            variant="secondary"
                                                            className={cn("text-xs", getTypeColor(suggestion.type))}
                                                        >
                                                            {suggestion.type}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            {Math.round(suggestion.confidence * 100)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : query.length >= 2 && !isLoading ? (
                                    <div className="text-center py-4 text-sm text-muted-foreground">
                                        No suggestions found
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-sm text-muted-foreground">
                                        Start typing to see AI suggestions...
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </PopoverContent>
                )}
            </Popover>
        </div>
    );
};
