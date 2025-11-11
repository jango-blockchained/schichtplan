import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    Bot,
    ChevronUp,
    Loader2,
    Maximize2,
    Minimize2,
    Send,
    X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

/**
 * Minimal AI Assistant - Compact popup that extends to full chat
 * - Starts as small floating card at bottom of page
 * - Can be minimized/maximized with smooth animations
 * - Extends into full ConversationalAIChat when maximized
 */

interface MinimalMessage {
    id: string;
    type: "user" | "ai";
    content: string;
    timestamp: Date;
}

export const MinimalAIAssistant: React.FC<{
    onMaximize?: () => void;
    isOpen?: boolean;
}> = ({ onMaximize, isOpen: externalOpen }) => {
    const [isOpen, setIsOpen] = useState(externalOpen ?? false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<MinimalMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragRef = useRef<HTMLDivElement>(null);
    const dragStart = useRef({ x: 0, y: 0, elementX: 0, elementY: 0 });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (externalOpen !== undefined) {
            setIsOpen(externalOpen);
        }
    }, [externalOpen]);

    // Initialize with welcome message
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const welcomeMessage: MinimalMessage = {
                id: "welcome",
                type: "ai",
                content: "Hi! 👋 I'm your AI assistant. How can I help you with scheduling today?",
                timestamp: new Date(),
            };
            setMessages([welcomeMessage]);
        }
    }, [isOpen, messages.length]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!dragRef.current || e.button !== 0) return;
        const rect = dragRef.current.getBoundingClientRect();
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            elementX: rect.left,
            elementY: rect.top,
        };
        setIsDragging(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragRef.current) return;

            const deltaX = e.clientX - dragStart.current.x;
            const deltaY = e.clientY - dragStart.current.y;

            setPosition({
                x: dragStart.current.elementX + deltaX,
                y: dragStart.current.elementY + deltaY,
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        // Add user message
        const userMessage: MinimalMessage = {
            id: `msg-${Date.now()}`,
            type: "user",
            content: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        // Simulate AI response
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const aiMessage: MinimalMessage = {
            id: `msg-${Date.now()}-ai`,
            type: "ai",
            content:
                "I'm processing your request... For more options, click 'Expand' to open the full AI Assistant.",
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);
        setIsLoading(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleExpand = () => {
        setIsExpanded(true);
        if (onMaximize) {
            onMaximize();
        }
    };

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg hover:shadow-xl transition-all h-12 w-12 p-0"
                title="Open AI Assistant"
            >
                <Bot className="h-6 w-6" />
            </Button>
        );
    }

    return (
        <>
            {/* Minimal Popup - Bottom Right */}
            <div
                ref={dragRef}
                className={cn(
                    "fixed z-40 transition-all duration-300 ease-out",
                    isDragging && "cursor-grabbing",
                    isExpanded ? "inset-0 m-4" : "bottom-6 right-6 w-96 h-96",
                )}
                style={
                    !isExpanded
                        ? {
                            left: position.x > 0 ? `${position.x}px` : "auto",
                            right: position.x <= 0 ? "1.5rem" : "auto",
                            bottom: position.y > 0 ? "auto" : "1.5rem",
                            top: position.y > 0 ? `${position.y}px` : "auto",
                            cursor: isDragging ? "grabbing" : "grab",
                        }
                        : {}
                }
            >
                <Card
                    className={cn(
                        "h-full flex flex-col shadow-2xl border-2 border-primary/20 bg-background/95 backdrop-blur-xl",
                        isExpanded && "rounded-2xl",
                    )}
                >
                    {/* Header - Draggable */}
                    <div
                        onMouseDown={handleMouseDown}
                        className="flex-shrink-0 p-4 border-b border-border/50 flex items-center justify-between cursor-grab hover:bg-muted/30 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 animate-pulse">
                                <Bot className="h-4 w-4 text-primary-foreground" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold truncate">Quick AI</h3>
                                <p className="text-xs text-muted-foreground">Click to drag</p>
                            </div>
                        </div>

                        <div className="flex gap-2 flex-shrink-0">
                            {!isExpanded && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleExpand}
                                    className="h-8 w-8 p-0"
                                    title="Expand to full chat"
                                >
                                    <Maximize2 className="h-4 w-4" />
                                </Button>
                            )}
                            {isExpanded && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setIsExpanded(false)}
                                    className="h-8 w-8 p-0"
                                    title="Minimize"
                                >
                                    <Minimize2 className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsOpen(false)}
                                className="h-8 w-8 p-0"
                                title="Close"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Messages - Scrollable */}
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-3">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300",
                                        message.type === "user" ? "flex-row-reverse" : "",
                                    )}
                                >
                                    {message.type === "ai" && (
                                        <Avatar className="h-6 w-6 flex-shrink-0 bg-gradient-to-br from-primary/60 to-primary/30">
                                            <AvatarFallback className="text-xs bg-transparent">
                                                🤖
                                            </AvatarFallback>
                                        </Avatar>
                                    )}

                                    <div
                                        className={cn(
                                            "max-w-xs rounded-lg px-3 py-2 text-sm",
                                            message.type === "user"
                                                ? "bg-primary text-primary-foreground rounded-br-none"
                                                : "bg-muted border border-border/50 rounded-bl-none",
                                        )}
                                    >
                                        <p className="leading-relaxed break-words">
                                            {message.content}
                                        </p>
                                    </div>

                                    {message.type === "user" && (
                                        <Avatar className="h-6 w-6 flex-shrink-0 bg-primary/20">
                                            <AvatarFallback className="text-xs">You</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex gap-2">
                                    <Avatar className="h-6 w-6 flex-shrink-0 bg-gradient-to-br from-primary/60 to-primary/30">
                                        <AvatarFallback className="text-xs bg-transparent">
                                            🤖
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="bg-muted border border-border/50 rounded-lg px-3 py-2 flex items-center gap-2">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span className="text-xs">Thinking...</span>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="flex-shrink-0 border-t border-border/50 p-3 space-y-2">
                        <div className="flex gap-2">
                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask anything..."
                                className="min-h-8 max-h-16 resize-none text-sm"
                                disabled={isLoading}
                                rows={1}
                            />
                            <Button
                                onClick={handleSendMessage}
                                disabled={!input.trim() || isLoading}
                                size="sm"
                                className="h-8 w-8 p-0 flex-shrink-0"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <button
                            onClick={handleExpand}
                            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50 flex items-center justify-center gap-1"
                        >
                            <ChevronUp className="h-3 w-3" />
                            Expand to full chat
                        </button>
                    </div>
                </Card>
            </div>

            {/* Full Overlay - When Expanded */}
            {isExpanded && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm p-4 flex items-center justify-center">
                    <Card className="w-full h-full max-w-4xl rounded-2xl shadow-2xl border-2 border-primary/20 flex flex-col overflow-hidden">
                        {/* Expanded Header */}
                        <div className="flex-shrink-0 p-6 border-b border-border/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 animate-pulse">
                                    <Bot className="h-5 w-5 text-primary-foreground" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">AI Assistant</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Full Conversation Mode
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsExpanded(false)}
                                className="h-8 w-8 p-0"
                                title="Minimize"
                            >
                                <ChevronUp className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Messages */}
                        <ScrollArea className="flex-1 p-6">
                            <div className="space-y-4 max-w-3xl mx-auto">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                                            message.type === "user" ? "flex-row-reverse" : "",
                                        )}
                                    >
                                        {message.type === "ai" && (
                                            <Avatar className="h-8 w-8 flex-shrink-0 bg-gradient-to-br from-primary/60 to-primary/30">
                                                <AvatarFallback className="text-xs bg-transparent">
                                                    🤖
                                                </AvatarFallback>
                                            </Avatar>
                                        )}

                                        <div
                                            className={cn(
                                                "max-w-2xl rounded-xl px-4 py-3",
                                                message.type === "user"
                                                    ? "bg-primary text-primary-foreground rounded-br-none"
                                                    : "bg-muted border border-border/50 rounded-bl-none",
                                            )}
                                        >
                                            <p className="leading-relaxed break-words text-sm">
                                                {message.content}
                                            </p>
                                        </div>

                                        {message.type === "user" && (
                                            <Avatar className="h-8 w-8 flex-shrink-0 bg-primary/20">
                                                <AvatarFallback className="text-xs">You</AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex gap-3">
                                        <Avatar className="h-8 w-8 flex-shrink-0 bg-gradient-to-br from-primary/60 to-primary/30">
                                            <AvatarFallback className="text-xs bg-transparent">
                                                🤖
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="bg-muted border border-border/50 rounded-xl px-4 py-3 flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-sm">AI is thinking...</span>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>

                        {/* Input */}
                        <div className="flex-shrink-0 border-t border-border/50 p-6 bg-background/95">
                            <div className="max-w-3xl mx-auto flex gap-3">
                                <Textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Ask me anything about scheduling..."
                                    className="resize-none text-sm"
                                    disabled={isLoading}
                                    rows={3}
                                />
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={!input.trim() || isLoading}
                                    className="h-12 px-4 flex-shrink-0"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Send className="h-5 w-5" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};

export default MinimalAIAssistant;
