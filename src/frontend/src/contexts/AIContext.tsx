/**
 * AI Context Provider for capturing and managing page context
 * This enables the AI to understand what the user is currently viewing
 */

import { PageContextSummary } from "@/services/enhancedAIService";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

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
  // Enhanced scheduling context
  scheduleContext?: {
    start_date?: string;
    end_date?: string;
    selected_version_id?: number;
    coverage_metrics?: {
      current_coverage: number;
      required_coverage: number;
      gaps_identified: number;
    };
    employee_count?: number;
    current_conflicts?: number;
    last_update?: string;
  };
}

export interface AIContextType {
  pageContext: PageContext;
  updateContext: (updates: Partial<PageContext>) => void;
  addSelectedItem: (key: string, value: unknown) => void;
  removeSelectedItem: (key: string) => void;
  setFilter: (key: string, value: unknown) => void;
  clearFilters: () => void;
  setCustomData: (key: string, value: unknown) => void;
  updateScheduleContext: (
    updates: Partial<PageContext["scheduleContext"]>,
  ) => void;
  getContextSummary: () => PageContextSummary;
  getContextString: () => string; // Helper for legacy code
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const useAIContext = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAIContext must be used within an AIContextProvider");
  }
  return context;
};

interface AIContextProviderProps {
  children: React.ReactNode;
}

export const AIContextProvider: React.FC<AIContextProviderProps> = ({
  children,
}) => {
  const location = useLocation();

  const [pageContext, setPageContext] = useState<PageContext>({
    route: location.pathname,
    pageTitle: document.title || "Schichtplan",
    selectedItems: {},
    filters: {},
    viewMode: "default",
    customData: {},
    scheduleContext: {
      current_conflicts: 0,
      employee_count: 0,
      coverage_metrics: {
        current_coverage: 0,
        required_coverage: 0,
        gaps_identified: 0,
      },
    },
  });

  // Update route when location changes
  useEffect(() => {
    setPageContext((prev) => ({
      ...prev,
      route: location.pathname,
      pageTitle: document.title || "Schichtplan",
    }));
  }, [location.pathname]);

  // Listen for page title changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setPageContext((prev) => ({
        ...prev,
        pageTitle: document.title || "Schichtplan",
      }));
    });

    observer.observe(document.querySelector("title") || document.head, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  const updateContext = (updates: Partial<PageContext>) => {
    setPageContext((prev) => ({ ...prev, ...updates }));
  };

  const addSelectedItem = (key: string, value: unknown) => {
    setPageContext((prev) => ({
      ...prev,
      selectedItems: { ...prev.selectedItems, [key]: value },
    }));
  };

  const removeSelectedItem = (key: string) => {
    setPageContext((prev) => {
      const newSelectedItems = { ...prev.selectedItems };
      delete newSelectedItems[key];
      return { ...prev, selectedItems: newSelectedItems };
    });
  };

  const setFilter = (key: string, value: unknown) => {
    setPageContext((prev) => ({
      ...prev,
      filters: { ...prev.filters, [key]: value },
    }));
  };

  const clearFilters = () => {
    setPageContext((prev) => ({ ...prev, filters: {} }));
  };

  const setCustomData = (key: string, value: unknown) => {
    setPageContext((prev) => ({
      ...prev,
      customData: { ...prev.customData, [key]: value },
    }));
  };

  // New method to update schedule-specific context
  const updateScheduleContext = (
    updates: Partial<PageContext["scheduleContext"]>,
  ) => {
    setPageContext((prev) => ({
      ...prev,
      scheduleContext: { ...prev.scheduleContext, ...updates },
    }));
  };

  const getContextSummary = (): PageContextSummary => {
    const context = pageContext;

    // Convert selected items to the expected format
    const selected_items = Object.entries(context.selectedItems).map(
      ([key, value]) => ({
        type: key,
        id: String(value),
        label: `${key}: ${String(value)}`,
      }),
    );

    // Convert filters to recent actions format
    const recent_actions = Object.entries(context.filters).map(
      ([key, value]) => ({
        type: "filter",
        description: `Filter ${key}: ${String(value)}`,
        timestamp: new Date().toISOString(),
      }),
    );

    // Add search query as a recent action if present
    if (context.searchQuery) {
      recent_actions.push({
        type: "search",
        description: `Search: "${context.searchQuery}"`,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      current_page: context.route,
      page_name: context.pageTitle,
      current_view: context.viewMode,
      selected_items,
      recent_actions,
    };
  };

  const getContextString = (): string => {
    const context = pageContext;
    let summary = `Current page: ${context.pageTitle} (${context.route})\n`;

    if (Object.keys(context.selectedItems).length > 0) {
      summary += `Selected items: ${Object.entries(context.selectedItems)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(", ")}\n`;
    }

    if (Object.keys(context.filters).length > 0) {
      summary += `Active filters: ${Object.entries(context.filters)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(", ")}\n`;
    }

    if (context.dateRange) {
      summary += `Date range: ${context.dateRange.start.toLocaleDateString()} - ${context.dateRange.end.toLocaleDateString()}\n`;
    }

    if (context.searchQuery) {
      summary += `Search query: "${context.searchQuery}"\n`;
    }

    if (context.viewMode !== "default") {
      summary += `View mode: ${context.viewMode}\n`;
    }

    // Add schedule context if available
    if (context.scheduleContext) {
      const sc = context.scheduleContext;
      if (sc.start_date || sc.end_date) {
        summary += `Schedule period: ${sc.start_date || "N/A"} to ${sc.end_date || "N/A"
          }\n`;
      }
      if (sc.employee_count) {
        summary += `Active employees: ${sc.employee_count}\n`;
      }
      if (sc.current_conflicts) {
        summary += `Current conflicts: ${sc.current_conflicts}\n`;
      }
      if (sc.coverage_metrics) {
        const { current_coverage, required_coverage, gaps_identified } =
          sc.coverage_metrics;
        if (current_coverage || required_coverage) {
          summary += `Coverage: ${current_coverage}/${required_coverage} `;
          if (gaps_identified) {
            summary += `(${gaps_identified} gaps identified)\n`;
          } else {
            summary += "(optimal)\n";
          }
        }
      }
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
    updateScheduleContext,
    getContextSummary,
    getContextString,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};
