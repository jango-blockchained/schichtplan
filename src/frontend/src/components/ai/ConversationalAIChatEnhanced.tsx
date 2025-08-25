import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { aiService } from '@/services/aiService';
import { Bot, Loader2, Mic, Send, Upload, User } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

// Enhanced imports for new features
import { FileUploadComponent } from '@/components/ai/FileUploadComponent';
import { TypingIndicator } from '@/components/ai/TypingIndicator';
import { VoiceInput } from '@/components/ai/VoiceInput';

interface Message {
    id: string;
    content: string;
    type: 'user' | 'ai' | 'system';
    timestamp: string;
    metadata?: {
        confidence?: number;
        source?: string;
        tools_used?: string[];
        processing_time?: number;
    };
}

interface ConversationalAIChatProps {
    conversationId?: string;
    onNewConversation?: (id: string) => void;
    className?: string;
}

export const ConversationalAIChat: React.FC<ConversationalAIChatProps> = ({
    conversationId,
    onNewConversation,
    className
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [currentConversationId, setCurrentConversationId] = useState(
        conversationId || `conv_${Date.now()}`
    );

    // Enhanced state for new features
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
    const [showFileUpload, setShowFileUpload] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [aiThinking, setAiThinking] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout>();

    // Auto-scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Initialize WebSocket connection
    useEffect(() => {
        const initializeConnection = async () => {
            try {
                // Connect to real-time features
                await aiService.connectWebSocket();
                setIsConnected(true);

                // Join conversation room
                aiService.joinConversation(currentConversationId, 'user');

                // Set up event listeners
                aiService.on('typing_indicator', (data) => {
                    if (data.conversation_id === currentConversationId) {
                        if (data.is_typing && data.user_id !== 'user') {
                            setTypingUsers(prev => [...prev.filter(u => u !== data.user_id), data.user_id]);
                        } else {
                            setTypingUsers(prev => prev.filter(u => u !== data.user_id));
                        }
                    }
                });

                aiService.on('ai_thinking', (data) => {
                    if (data.conversation_id === currentConversationId) {
                        setAiThinking(data.is_thinking);
                    }
                });

                aiService.on('new_message', (data) => {
                    if (data.conversation_id === currentConversationId) {
                        setMessages(prev => [...prev, data.message]);
                    }
                });

            } catch (error) {
                console.error('Failed to initialize AI chat:', error);
            }
        };

        initializeConnection();

        // Cleanup on unmount
        return () => {
            aiService.leaveConversation(currentConversationId);
            aiService.disconnect();
        };
    }, [currentConversationId]);

    // Handle typing indicators
    const handleInputChange = (value: string) => {
        setInput(value);

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Start typing
        if (!isTyping && value.length > 0) {
            setIsTyping(true);
            aiService.startTyping(currentConversationId, 'user');
        }

        // Stop typing after delay
        typingTimeoutRef.current = setTimeout(() => {
            if (isTyping) {
                setIsTyping(false);
                aiService.stopTyping(currentConversationId, 'user');
            }
        }, 1000);
    };

    // Send message
    const sendMessage = async (content: string, metadata?: any) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = {
            id: `msg_${Date.now()}`,
            content: content.trim(),
            type: 'user',
            timestamp: new Date().toISOString(),
            metadata
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Stop typing indicator
        if (isTyping) {
            setIsTyping(false);
            aiService.stopTyping(currentConversationId, 'user');
        }

        try {
            // Send AI thinking indicator
            aiService.setAiThinking(currentConversationId, true);

            const response = await aiService.sendMessage(content, {
                conversation_id: currentConversationId,
                include_metadata: true,
                ...metadata
            });

            // Stop AI thinking
            aiService.setAiThinking(currentConversationId, false);

            const aiMessage: Message = {
                id: `msg_${Date.now()}_ai`,
                content: response.message || response.response || 'Sorry, I could not process your request.',
                type: 'ai',
                timestamp: new Date().toISOString(),
                metadata: response.metadata
            };

            setMessages(prev => [...prev, aiMessage]);

        } catch (error) {
            console.error('Failed to send message:', error);

            // Stop AI thinking on error
            aiService.setAiThinking(currentConversationId, false);

            const errorMessage: Message = {
                id: `msg_${Date.now()}_error`,
                content: 'Sorry, there was an error processing your message. Please try again.',
                type: 'system',
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle voice input
    const handleVoiceCommand = async (transcript: string, confidence: number) => {
        await sendMessage(transcript, {
            source: 'voice',
            confidence,
            input_type: 'speech'
        });
    };

    // Handle file upload
    const handleFileUpload = async (file: File) => {
        try {
            setIsLoading(true);

            const uploadResult = await aiService.uploadFile(file);

            const fileMessage: Message = {
                id: `msg_${Date.now()}_file`,
                content: `📁 Uploaded file: ${file.name}`,
                type: 'user',
                timestamp: new Date().toISOString(),
                metadata: {
                    file_id: uploadResult.id,
                    file_name: file.name,
                    file_size: file.size,
                    input_type: 'file'
                }
            };

            setMessages(prev => [...prev, fileMessage]);

            // Auto-analyze if it's a data file
            if (['csv', 'xlsx', 'json'].some(ext => file.name.toLowerCase().endsWith(ext))) {
                const analysis = await aiService.analyzeFile(uploadResult.id);

                const analysisMessage: Message = {
                    id: `msg_${Date.now()}_analysis`,
                    content: `📊 File Analysis:\n${analysis.analysis.summary}\n\nInsights:\n${analysis.analysis.insights.join('\n')}`,
                    type: 'ai',
                    timestamp: new Date().toISOString(),
                    metadata: {
                        source: 'file_analysis',
                        file_id: uploadResult.id,
                        analysis_type: 'automatic'
                    }
                };

                setMessages(prev => [...prev, analysisMessage]);
            }

        } catch (error) {
            console.error('File upload error:', error);

            const errorMessage: Message = {
                id: `msg_${Date.now()}_file_error`,
                content: 'Sorry, there was an error uploading your file. Please try again.',
                type: 'system',
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    // Format timestamp
    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Card className={`h-full flex flex-col ${className}`}>
            <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5" />
                        AI Assistant
                        {isConnected && (
                            <Badge variant="outline" className="text-green-600">
                                Connected
                            </Badge>
                        )}
                    </CardTitle>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                            className={isVoiceEnabled ? 'bg-blue-50' : ''}
                        >
                            <Mic className="w-4 h-4" />
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFileUpload(!showFileUpload)}
                            className={showFileUpload ? 'bg-blue-50' : ''}
                        >
                            <Upload className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Enhanced features panel */}
                {(isVoiceEnabled || showFileUpload) && (
                    <>
                        <Separator />
                        <div className="space-y-3">
                            {isVoiceEnabled && (
                                <VoiceInput
                                    onVoiceCommand={handleVoiceCommand}
                                    isEnabled={isVoiceEnabled}
                                    conversationId={currentConversationId}
                                />
                            )}

                            {showFileUpload && (
                                <FileUploadComponent
                                    onFileUpload={handleFileUpload}
                                    maxSize={50 * 1024 * 1024} // 50MB
                                    acceptedTypes={[
                                        'text/plain',
                                        'text/csv',
                                        'application/json',
                                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                        'application/vnd.ms-excel'
                                    ]}
                                />
                            )}
                        </div>
                    </>
                )}
            </CardHeader>

            <CardContent className="flex-1 flex flex-col min-h-0 p-0">
                {/* Messages area */}
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                        {messages.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>Start a conversation with the AI assistant</p>
                                <p className="text-sm mt-2">
                                    Try voice commands, upload files, or just type your message
                                </p>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'
                                        }`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-lg p-3 ${message.type === 'user'
                                                ? 'bg-blue-500 text-white'
                                                : message.type === 'ai'
                                                    ? 'bg-gray-100 text-gray-900'
                                                    : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                                            }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {message.type === 'user' ? (
                                                <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            ) : message.type === 'ai' ? (
                                                <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            ) : null}

                                            <div className="flex-1">
                                                <div className="whitespace-pre-wrap">{message.content}</div>

                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-xs opacity-70">
                                                        {formatTime(message.timestamp)}
                                                    </span>

                                                    {message.metadata && (
                                                        <div className="flex gap-1">
                                                            {message.metadata.confidence && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {Math.round(message.metadata.confidence * 100)}%
                                                                </Badge>
                                                            )}
                                                            {message.metadata.source && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {message.metadata.source}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Typing indicators */}
                        {(typingUsers.length > 0 || aiThinking) && (
                            <div className="flex justify-start">
                                <TypingIndicator
                                    users={typingUsers}
                                    aiThinking={aiThinking}
                                    conversationId={currentConversationId}
                                />
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Input area */}
                <div className="flex-shrink-0 p-4 border-t">
                    <div className="flex gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type your message..."
                            disabled={isLoading}
                            className="flex-1"
                        />
                        <Button
                            onClick={() => sendMessage(input)}
                            disabled={isLoading || !input.trim()}
                            size="icon"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
