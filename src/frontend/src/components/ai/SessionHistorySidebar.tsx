/**
 * Session History Sidebar Component
 * 
 * Displays list of conversation sessions with search, filter, and management
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  deleteSession,
  getAllSessions,
  getSessionsByStatus,
  getStorageStats,
  searchSessions,
  type StoredSession,
} from "@/utils/sessionStorage";
import {
  Archive,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

interface SessionHistorySidebarProps {
  currentSessionId?: string;
  onSelectSession: (session: StoredSession) => void;
  onNewSession: () => void;
  onClose?: () => void;
  className?: string;
}

export const SessionHistorySidebar: React.FC<SessionHistorySidebarProps> = ({
  currentSessionId,
  onSelectSession,
  onNewSession,
  onClose,
  className,
}) => {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<StoredSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [storageStats, setStorageStats] = useState(getStorageStats());

  // Load sessions
  useEffect(() => {
    loadSessions();
  }, []);

  // Filter sessions when search or filter changes
  useEffect(() => {
    filterSessions();
  }, [sessions, searchQuery, statusFilter]);

  const loadSessions = () => {
    const allSessions = getAllSessions();
    setSessions(allSessions);
    setStorageStats(getStorageStats());
  };

  const filterSessions = () => {
    let result = sessions;

    // Apply status filter
    if (statusFilter !== "all") {
      result = getSessionsByStatus(statusFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      result = searchSessions(searchQuery);
    }

    setFilteredSessions(result);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm("Are you sure you want to delete this conversation?")) {
      deleteSession(sessionId);
      loadSessions();
      toast.success("Conversation deleted");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "Today";
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-background border-r", className)}>
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Conversations</h2>
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* New Conversation Button */}
        <Button
          onClick={onNewSession}
          className="w-full"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conversations</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Session List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">
                {searchQuery ? "No conversations found" : "No conversations yet"}
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session)}
                className={cn(
                  "group flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                  currentSessionId === session.id && "bg-muted"
                )}
              >
                <div className="flex-shrink-0 mt-1">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-medium truncate">
                      {session.title}
                    </h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{session.message_count} messages</span>
                    <span>•</span>
                    <span>{formatDate(session.last_message_at)}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="capitalize">{session.ai_provider}</span>
                    </div>
                    {session.status === "archived" && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Archive className="h-3 w-3" />
                        <span>Archived</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer - Storage Stats */}
      <div className="p-4 border-t bg-muted/20 text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Total Conversations:</span>
          <span className="font-medium">{storageStats.totalSessions}</span>
        </div>
        <div className="flex justify-between">
          <span>Total Messages:</span>
          <span className="font-medium">{storageStats.totalMessages}</span>
        </div>
        <div className="flex justify-between">
          <span>Storage Used:</span>
          <span className={cn(
            "font-medium",
            storageStats.percentUsed > 80 && "text-destructive"
          )}>
            {storageStats.percentUsed}%
          </span>
        </div>
      </div>
    </div>
  );
};
