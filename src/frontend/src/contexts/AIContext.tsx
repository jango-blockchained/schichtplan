/**
 * AI Context Provider for capturing and managing page context
 * This enables the AI to understand what the user is currently viewing
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export interface PageContext {
    route: string;
    pageTitle: string;
    selectedItems: Record<string, unknown>;
    filters: Record<string, unknown>;
    viewMode: string;
    dateRange?: {
        start: Date;
        end: Date;
    };
    searchQuery?: string;
    customData: Record<string, unknown>;
}

export interface AIContextType {
    pageContext: PageContext;
    updateContext: (updates: Partial<PageContext>) => void;
    addSelectedItem: (key: string, value: unknown) => void;
    removeSelectedItem: (key: string) => void;
    setFilter: (key: string, value: unknown) => void;
    clearFilters: () => void;
    setCustomData: (key: string, value: unknown) => void;
    getContextSummary: () => string;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const useAIContext = () => {
    const context = useContext(AIContext);
    if (!context) {
        throw new Error('useAIContext must be used within an AIContextProvider');
    }
    return context;
};

interface AIContextProviderProps {
    children: React.ReactNode;
}

export const AIContextProvider: React.FC<AIContextProviderProps> = ({ children }) => {
    const location = useLocation();

    const [pageContext, setPageContext] = useState<PageContext>({
        route: location.pathname,
        pageTitle: document.title || 'Schichtplan',
        selectedItems: {},
        filters: {},
        viewMode: 'default',
        customData: {}
    });

    // Update route when location changes
    useEffect(() => {
        setPageContext(prev => ({
            ...prev,
            route: location.pathname,
            pageTitle: document.title || 'Schichtplan'
        }));
    }, [location.pathname]);

    // Listen for page title changes
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setPageContext(prev => ({
                ...prev,
                pageTitle: document.title || 'Schichtplan'
            }));
        });

        observer.observe(document.querySelector('title') || document.head, {
            subtree: true,
            childList: true,
            characterData: true
        });

        return () => observer.disconnect();
    }, []);

    const updateContext = (updates: Partial<PageContext>) => {
        setPageContext(prev => ({ ...prev, ...updates }));
    };

    const addSelectedItem = (key: string, value: unknown) => {
        setPageContext(prev => ({
            ...prev,
            selectedItems: { ...prev.selectedItems, [key]: value }
        }));
    };

    const removeSelectedItem = (key: string) => {
        setPageContext(prev => {
            const newSelectedItems = { ...prev.selectedItems };
            delete newSelectedItems[key];
            return { ...prev, selectedItems: newSelectedItems };
        });
    };

    const setFilter = (key: string, value: unknown) => {
        setPageContext(prev => ({
            ...prev,
            filters: { ...prev.filters, [key]: value }
        }));
    };

    const clearFilters = () => {
        setPageContext(prev => ({ ...prev, filters: {} }));
    };

    const setCustomData = (key: string, value: unknown) => {
        setPageContext(prev => ({
            ...prev,
            customData: { ...prev.customData, [key]: value }
        }));
    };

    const getContextSummary = (): string => {
        const context = pageContext;
        let summary = `Current page: ${context.pageTitle} (${context.route})\n`;

        if (Object.keys(context.selectedItems).length > 0) {
            summary += `Selected items: ${Object.entries(context.selectedItems)
                .map(([key, value]) => `${key}=${String(value)}`)
                .join(', ')}\n`;
        }

        if (Object.keys(context.filters).length > 0) {
            summary += `Active filters: ${Object.entries(context.filters)
                .map(([key, value]) => `${key}=${String(value)}`)
                .join(', ')}\n`;
        }

        if (context.dateRange) {
            summary += `Date range: ${context.dateRange.start.toLocaleDateString()} - ${context.dateRange.end.toLocaleDateString()}\n`;
        }

        if (context.searchQuery) {
            summary += `Search query: "${context.searchQuery}"\n`;
        }

        if (context.viewMode !== 'default') {
            summary += `View mode: ${context.viewMode}\n`;
        }

        return summary.trim();
    };

    const value: AIContextType = {
        pageContext,
        updateContext,
        addSelectedItem,
        removeSelectedItem,
        setFilter,
        clearFilters,
        setCustomData,
        getContextSummary
    };

    return (
        <AIContext.Provider value={value}>
            {children}
        </AIContext.Provider>
    );
};</content >
    <parameter name="filePath">/home/jango/Git/maike2/schichtplan/src/frontend/src/contexts/AIContext.tsx
