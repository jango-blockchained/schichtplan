import { ConversationMessage } from '@/components/ai/ConversationPanel';
import { aiService } from '@/services/aiService';
import { useCallback, useEffect, useState } from 'react';

interface AIConversationHook {
  messages: ConversationMessage[];
  currentInput: string;
  isLoading: boolean;
  sessionId: string;
  setCurrentInput: (input: string) => void;
  sendMessage: () => Promise<void>;
  clearConversation: () => void;
  addSystemMessage: (content: string, metadata?: Record<string, unknown>) => void;
}

const STORAGE_KEY = 'ai-conversation-messages';
const SESSION_KEY = 'ai-conversation-session';

export function useAIConversation(
  onSendPrompt?: (prompt: string) => Promise<{ message?: string } | Record<string, unknown>>
): AIConversationHook {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => {
    // Try to restore session or create new one
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      return stored;
    }
    const newSession = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(SESSION_KEY, newSession);
    return newSession;
  });

  // Load messages from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          const messagesWithDates = parsed.map((m) => {
            const msg = m as Partial<ConversationMessage> & { timestamp?: string | number | Date };
            return {
              id: typeof msg.id === 'string' ? msg.id : `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: (msg.type as ConversationMessage['type']) ?? 'system',
              content: typeof msg.content === 'string' ? msg.content : '',
              timestamp: new Date(msg.timestamp ?? Date.now()),
              metadata: msg.metadata,
            } as ConversationMessage;
          });
          setMessages(messagesWithDates);
        }
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  }, []);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save conversation history:', error);
    }
  }, [messages]);

  const addMessage = useCallback((message: Omit<ConversationMessage, 'id' | 'timestamp'>) => {
    const newMessage: ConversationMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const addSystemMessage = useCallback((content: string, metadata?: Record<string, unknown>) => {
    addMessage({
      type: 'system',
      content,
      metadata,
    });
  }, [addMessage]);

  const sendMessage = useCallback(async () => {
    if (!currentInput.trim() || isLoading) return;

    const userMessage = currentInput.trim();
    setCurrentInput('');
    setIsLoading(true);

    // Add user message
    addMessage({
      type: 'user',
      content: userMessage,
    });

    try {
      if (onSendPrompt) {
        // Call the provided prompt handler
        const result = await onSendPrompt(userMessage);
        
        // Add AI response
        addMessage({
          type: 'ai',
          content: (result as { message?: string })?.message ?? 'Anweisung wurde verarbeitet und ausgeführt.',
          metadata: {
            prompt: userMessage,
            generationResult: result,
          },
        });
      } else {
        // Default: send to backend AI chat API
        const resp = await aiService.sendChatMessage({
          message: userMessage,
          conversation_id: sessionId,
        });
    addMessage({
          type: 'ai',
          content: resp.response,
          metadata: {
            prompt: userMessage,
      ...resp.metadata,
          },
        });
      }
    } catch (error) {
      // Add error message
      addMessage({
        type: 'ai',
        content: 'Entschuldigung, bei der Verarbeitung Ihrer Anfrage ist ein Fehler aufgetreten.',
        metadata: {
          prompt: userMessage,
          error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentInput, isLoading, onSendPrompt, addMessage, sessionId]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setCurrentInput('');
    // Create new session
    const newSession = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(SESSION_KEY, newSession);
    localStorage.removeItem(STORAGE_KEY);
    
    // Add welcome message
    addMessage({
      type: 'system',
      content: 'Neue Unterhaltung gestartet. Stellen Sie Fragen zur Schichtplanung oder bitten Sie um Optimierungen.',
    });
  }, [addMessage]);

  return {
    messages,
    currentInput,
    isLoading,
    sessionId,
    setCurrentInput,
    sendMessage,
    clearConversation,
    addSystemMessage,
  };
}