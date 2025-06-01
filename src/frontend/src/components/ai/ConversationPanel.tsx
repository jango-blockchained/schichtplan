import React, { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MessageCircle, 
  Send, 
  Bot, 
  User, 
  Loader2,
  RotateCcw,
  Settings,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConversationMessage {
  id: string;
  type: "user" | "ai" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    prompt?: string;
    generationResult?: any;
    error?: string;
  };
}

interface ConversationPanelProps {
  messages: ConversationMessage[];
  currentInput: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onClearConversation: () => void;
  isLoading: boolean;
  className?: string;
}

export function ConversationPanel({
  messages,
  currentInput,
  onInputChange,
  onSendMessage,
  onClearConversation,
  isLoading,
  className,
}: ConversationPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (currentInput.trim() && !isLoading) {
        onSendMessage();
      }
    }
  };

  const getMessageIcon = (type: ConversationMessage['type']) => {
    switch (type) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'ai':
        return <Bot className="h-4 w-4" />;
      case 'system':
        return <Settings className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getMessageColor = (type: ConversationMessage['type']) => {
    switch (type) {
      case 'user':
        return "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800";
      case 'ai':
        return "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800";
      case 'system':
        return "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800";
      default:
        return "bg-gray-50 border-gray-200 dark:bg-gray-950 dark:border-gray-800";
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTypeLabel = (type: ConversationMessage['type']) => {
    switch (type) {
      case 'user':
        return 'Sie';
      case 'ai':
        return 'KI-Assistent';
      case 'system':
        return 'System';
      default:
        return 'Unbekannt';
    }
  };

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            KI-Unterhaltung
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {messages.length} Nachrichten
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearConversation}
              disabled={messages.length === 0 || isLoading}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 px-4 pb-4"
        >
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">Starten Sie eine Unterhaltung mit dem KI-Assistenten</p>
                <p className="text-xs mt-1">
                  Stellen Sie Fragen zur Schichtplanung oder bitten Sie um Optimierungen
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    getMessageColor(message.type)
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getMessageIcon(message.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {formatTypeLabel(message.type)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                      {message.metadata?.error && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
                          <strong>Fehler:</strong> {message.metadata.error}
                        </div>
                      )}
                      {message.metadata?.generationResult && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300">
                          <strong>Ergebnis:</strong> {JSON.stringify(message.metadata.generationResult, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                <div className="flex-1">
                  <div className="text-sm font-medium">KI-Assistent</div>
                  <div className="text-sm text-muted-foreground">
                    Verarbeitet Ihre Anfrage...
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Input Area */}
        <div className="p-4">
          <div className="flex gap-2">
            <Textarea
              value={currentInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Schreiben Sie eine Nachricht an den KI-Assistenten..."
              className="flex-1 min-h-[40px] max-h-32 resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={onSendMessage}
              disabled={!currentInput.trim() || isLoading}
              size="sm"
              className="self-end"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> zum Senden, 
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs ml-1">Shift+Enter</kbd> für neue Zeile
          </div>
        </div>
      </CardContent>
    </Card>
  );
}