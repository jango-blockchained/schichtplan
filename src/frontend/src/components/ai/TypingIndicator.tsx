import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  aiService,
  type TypingIndicator as TypingIndicatorEvent,
} from "@/services/aiService";
import { Bot, Loader2, User } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface TypingIndicatorProps {
  conversationId: string;
  currentUserId: string;
  className?: string;
}

interface TypingState {
  users: TypingIndicatorEvent[];
  isTyping: boolean;
}

export const TypingIndicatorComponent: React.FC<TypingIndicatorProps> = ({
  conversationId,
  currentUserId,
  className,
}) => {
  const [typingState, setTypingState] = useState<TypingState>({
    users: [],
    isTyping: false,
  });

  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastTypingRef = useRef<Date>(new Date());

  useEffect(() => {
    // Subscribe to typing indicators
    const handleTypingUpdate = (data: TypingIndicatorEvent) => {
      if (
        data.conversation_id !== conversationId ||
        data.user_id === currentUserId
      ) {
        return;
      }

      setTypingState((prev) => {
        const otherUsers = prev.users.filter((u) => u.user_id !== data.user_id);

        if (data.is_typing) {
          return {
            ...prev,
            users: [...otherUsers, data],
          };
        } else {
          return {
            ...prev,
            users: otherUsers,
          };
        }
      });
    };

    aiService.on("ws:typing_indicator", handleTypingUpdate);

    return () => {
      aiService.off("ws:typing_indicator", handleTypingUpdate);
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    // Clean up old typing indicators
    const cleanup = setInterval(() => {
      const now = new Date();
      setTypingState((prev) => ({
        ...prev,
        users: prev.users.filter((user) => {
          const timeDiff = now.getTime() - new Date(user.timestamp).getTime();
          return timeDiff < 5000; // Remove indicators older than 5 seconds
        }),
      }));
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  const startTyping = () => {
    if (!typingState.isTyping) {
      setTypingState((prev) => ({ ...prev, isTyping: true }));
      aiService.sendTypingIndicator(conversationId, true);
    }

    lastTypingRef.current = new Date();

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = () => {
    if (typingState.isTyping) {
      setTypingState((prev) => ({ ...prev, isTyping: false }));
      aiService.sendTypingIndicator(conversationId, false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const getUserIcon = (userId: string) => {
    if (userId.includes("agent") || userId.includes("ai")) {
      return <Bot className="h-3 w-3" />;
    }
    return <User className="h-3 w-3" />;
  };

  const getUserName = (userId: string) => {
    if (userId.includes("agent")) {
      return "AI Agent";
    }
    if (userId.includes("ai")) {
      return "AI Assistant";
    }
    return `User ${userId.slice(-4)}`;
  };

  // Expose typing control methods
  React.useImperativeHandle(React.createRef(), () => ({
    startTyping,
    stopTyping,
  }));

  if (typingState.users.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">
          {typingState.users.length === 1 ? (
            <>{getUserName(typingState.users[0].user_id)} tippt...</>
          ) : (
            <>{typingState.users.length} Personen tippen...</>
          )}
        </span>
      </div>

      <div className="flex gap-1">
        {typingState.users.slice(0, 3).map((user) => (
          <Badge
            key={user.user_id}
            variant="outline"
            className="text-xs flex items-center gap-1 h-5"
          >
            {getUserIcon(user.user_id)}
            {getUserName(user.user_id)}
          </Badge>
        ))}
        {typingState.users.length > 3 && (
          <Badge variant="outline" className="text-xs h-5">
            +{typingState.users.length - 3}
          </Badge>
        )}
      </div>
    </div>
  );
};

// Hook to use typing indicator functionality
export const useTypingIndicator = (conversationId: string) => {
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const startTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      aiService.sendTypingIndicator(conversationId, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = React.useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      aiService.sendTypingIndicator(conversationId, false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [conversationId, isTyping]);

  useEffect(() => {
    return () => {
      stopTyping();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTyping]);

  return { startTyping, stopTyping, isTyping };
};

export default TypingIndicatorComponent;

// Lightweight proxy component used by ConversationalAIChatEnhanced
export const TypingIndicatorInline: React.FC<{
  users: string[];
  aiThinking?: boolean;
}> = ({ users, aiThinking }) => {
  // Render a compact indicator combining users and AI thinking
  if ((users?.length ?? 0) === 0 && !aiThinking) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>
        {aiThinking ? "AI denkt" : null}
        {aiThinking && users?.length ? " • " : ""}
        {users?.length
          ? `${users.length} tippt${users.length > 1 ? "en" : ""}`
          : null}
      </span>
    </div>
  );
};

// Backwards-compatible export for tests and older imports (test suite expects a lightweight API)
// Backwards-compatible export for tests and older imports
// Provide a legacy wrapper that accepts (typing, users, className)
export const TypingIndicator: React.FC<{
  typing: boolean;
  users?: string[] | undefined;
  className?: string;
}> = ({ typing, users, className }) => {
  if (!typing && (!users || users.length === 0)) return null;
  return (
    <div className={className}>
      <TypingIndicatorInline users={users ?? []} aiThinking={false} />
    </div>
  );
};
