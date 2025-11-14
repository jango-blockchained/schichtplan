/**
 * AI Provider Status Badge
 * 
 * Shows the current AI provider status and allows quick switching
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { aiService } from "@/services/aiService";
import { updateSettings } from "@/services/api";
import { CheckCircle2, AlertCircle, Loader2, Settings } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

interface AIProviderStatusProps {
  currentProvider: "openai" | "anthropic" | "gemini";
  onProviderChange?: (provider: "openai" | "anthropic" | "gemini") => void;
  className?: string;
}

type ProviderStatus = "available" | "unavailable" | "testing" | "unknown";

interface ProviderInfo {
  name: string;
  status: ProviderStatus;
  responseTime?: number;
  lastTested?: Date;
}

export const AIProviderStatus: React.FC<AIProviderStatusProps> = ({
  currentProvider,
  onProviderChange,
  className,
}) => {
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({
    openai: { name: "OpenAI (ChatGPT)", status: "unknown" },
    anthropic: { name: "Anthropic (Claude)", status: "unknown" },
    gemini: { name: "Google (Gemini)", status: "unknown" },
  });
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    // Test current provider on mount
    testProvider(currentProvider);
  }, [currentProvider]);

  const testProvider = async (provider: "openai" | "anthropic" | "gemini") => {
    setProviders(prev => ({
      ...prev,
      [provider]: { ...prev[provider], status: "testing" as ProviderStatus },
    }));

    try {
      const result = await aiService.testAIProvider(provider);
      
      setProviders(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          status: result.success ? "available" : "unavailable",
          responseTime: result.response_time,
          lastTested: new Date(),
        },
      }));
    } catch (error) {
      console.error(`Failed to test ${provider}:`, error);
      setProviders(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          status: "unavailable" as ProviderStatus,
          lastTested: new Date(),
        },
      }));
    }
  };

  const testAllProviders = async () => {
    setIsTesting(true);
    
    try {
      await Promise.all([
        testProvider("openai"),
        testProvider("anthropic"),
        testProvider("gemini"),
      ]);
      toast.success("Provider status checked");
    } catch (error) {
      toast.error("Failed to test providers");
    } finally {
      setIsTesting(false);
    }
  };

  const switchProvider = async (provider: "openai" | "anthropic" | "gemini") => {
    if (provider === currentProvider) return;

    try {
      // Test provider before switching
      const result = await aiService.testAIProvider(provider);
      
      if (!result.success) {
        toast.error(`${providers[provider].name} is not available`);
        return;
      }

      // Update backend settings
      await updateSettings({
        ai_scheduling: {
          provider,
        },
      } as any);

      // Notify parent component
      if (onProviderChange) {
        onProviderChange(provider);
      }

      toast.success(`Switched to ${providers[provider].name}`);
    } catch (error) {
      console.error("Failed to switch provider:", error);
      toast.error("Failed to switch provider");
    }
  };

  const getStatusIcon = (status: ProviderStatus) => {
    switch (status) {
      case "available":
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "unavailable":
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      case "testing":
        return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
      default:
        return <AlertCircle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: ProviderStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "available":
        return "default";
      case "unavailable":
        return "destructive";
      case "testing":
        return "secondary";
      default:
        return "outline";
    }
  };

  const currentProviderInfo = providers[currentProvider];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          <Badge variant={getStatusVariant(currentProviderInfo.status)} className="gap-1 cursor-pointer">
            {getStatusIcon(currentProviderInfo.status)}
            <span className="text-xs">{currentProvider.toUpperCase()}</span>
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>AI Provider</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={testAllProviders}
            disabled={isTesting}
            className="h-6 px-2"
          >
            {isTesting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Settings className="h-3 w-3" />
            )}
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {Object.entries(providers).map(([key, info]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => switchProvider(key as any)}
            disabled={info.status === "testing" || info.status === "unavailable"}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {getStatusIcon(info.status)}
              <div>
                <div className="font-medium text-sm">{info.name}</div>
                {info.responseTime && (
                  <div className="text-xs text-muted-foreground">
                    {info.responseTime.toFixed(0)}ms
                  </div>
                )}
              </div>
            </div>
            {key === currentProvider && (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Click to test and switch providers
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
