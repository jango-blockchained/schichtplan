/**
 * FloatingSuggestionsPanel Component
 * A floating panel that shows AI suggestions contextually
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAIContext } from "@/contexts/AIContext";
import { cn } from "@/lib/utils";
import { MessageSquare, Sparkles, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { SmartSuggestions } from "./SmartSuggestions";

interface FloatingSuggestionsPanelProps {
  className?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  autoShow?: boolean;
  showDelay?: number;
}

export const FloatingSuggestionsPanel: React.FC<
  FloatingSuggestionsPanelProps
> = ({
  className,
  position = "bottom-right",
  autoShow = true,
  showDelay = 10000, // 10 seconds
}) => {
  const { pageContext } = useAIContext();
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasNewSuggestions, setHasNewSuggestions] = useState(false);

  // Position styles
  const getPositionStyles = () => {
    switch (position) {
      case "bottom-right":
        return "bottom-4 right-4";
      case "bottom-left":
        return "bottom-4 left-4";
      case "top-right":
        return "top-4 right-4";
      case "top-left":
        return "top-4 left-4";
      default:
        return "bottom-4 right-4";
    }
  };

  // Auto-show logic
  useEffect(() => {
    if (!autoShow) return;

    const timer = setTimeout(() => {
      // Only show if user has been active on certain pages
      const relevantPages = [
        "/schedule",
        "/employees",
        "/dashboard",
        "/analytics",
      ];
      if (relevantPages.some((page) => pageContext.route.includes(page))) {
        setIsVisible(true);
        setHasNewSuggestions(true);
      }
    }, showDelay);

    return () => clearTimeout(timer);
  }, [autoShow, showDelay, pageContext.route]);

  // Hide when navigating to irrelevant pages
  useEffect(() => {
    const irrelevantPages = ["/login", "/settings", "/profile"];
    if (irrelevantPages.some((page) => pageContext.route.includes(page))) {
      setIsVisible(false);
    }
  }, [pageContext.route]);

  // Global events to control visibility from UnifiedFloatingMenu
  useEffect(() => {
    const open = () => {
      setIsVisible(true);
      setHasNewSuggestions(true);
    };
    const toggle = () => setIsVisible((v) => !v);
    window.addEventListener("open-suggestions-panel", open as EventListener);
    window.addEventListener(
      "toggle-suggestions-panel",
      toggle as EventListener,
    );
    return () => {
      window.removeEventListener(
        "open-suggestions-panel",
        open as EventListener,
      );
      window.removeEventListener(
        "toggle-suggestions-panel",
        toggle as EventListener,
      );
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setHasNewSuggestions(false);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  // When hidden, render nothing (UnifiedFloatingMenu will control opening)
  if (!isVisible) return null;

  return (
    <Card
      className={cn(
        "fixed z-50 shadow-xl border-2 transition-all duration-200 max-w-sm",
        getPositionStyles(),
        isMinimized ? "w-12 h-12" : "w-80",
        className,
      )}
    >
      {isMinimized ? (
        <Button
          onClick={handleMinimize}
          variant="ghost"
          size="sm"
          className="w-full h-full p-0"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm">AI Suggestions</span>
              {hasNewSuggestions && (
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                onClick={handleMinimize}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <MessageSquare className="h-3 w-3" />
              </Button>
              <Button
                onClick={handleClose}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <CardContent className="p-0">
            <SmartSuggestions
              maxSuggestions={3}
              autoRefresh={true}
              refreshInterval={60000} // 1 minute
              className="border-0 shadow-none"
            />
          </CardContent>
        </>
      )}
    </Card>
  );
};
