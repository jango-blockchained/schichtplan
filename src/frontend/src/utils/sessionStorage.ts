/**
 * Session Storage Utility for AI Conversations
 * 
 * Manages persistence of conversation sessions in localStorage
 */

export interface StoredSession {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string;
  message_count: number;
  ai_provider: "openai" | "anthropic" | "gemini";
  status: "active" | "inactive" | "archived";
  messages: Array<{
    id: string;
    type: "user" | "ai" | "system";
    content: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
    files?: string[];
  }>;
  context?: {
    route: string;
    pageTitle: string;
  };
}

const STORAGE_KEY = "ai_conversation_sessions";
const MAX_SESSIONS = 50; // Limit to prevent localStorage overflow
const MAX_MESSAGES_PER_SESSION = 100; // Limit messages per session

/**
 * Get all stored sessions from localStorage
 */
export function getAllSessions(): StoredSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const sessions = JSON.parse(stored) as StoredSession[];
    
    // Sort by last_message_at descending
    return sessions.sort((a, b) => 
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );
  } catch (error) {
    console.error("Failed to load sessions:", error);
    return [];
  }
}

/**
 * Get a specific session by ID
 */
export function getSession(sessionId: string): StoredSession | null {
  const sessions = getAllSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Save or update a session
 */
export function saveSession(session: StoredSession): void {
  try {
    let sessions = getAllSessions();
    
    // Remove existing session with same ID
    sessions = sessions.filter(s => s.id !== session.id);
    
    // Trim messages if too many
    if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
      session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
    }
    
    // Add new/updated session at the beginning
    sessions.unshift(session);
    
    // Limit total sessions
    if (sessions.length > MAX_SESSIONS) {
      sessions = sessions.slice(0, MAX_SESSIONS);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to save session:", error);
    // If storage full, try to clear old sessions
    try {
      const sessions = getAllSessions().slice(0, Math.floor(MAX_SESSIONS / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      // Try saving again
      saveSession(session);
    } catch (retryError) {
      console.error("Failed to save session even after cleanup:", retryError);
      throw new Error("Storage quota exceeded. Please clear some conversations.");
    }
  }
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): void {
  try {
    let sessions = getAllSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to delete session:", error);
  }
}

/**
 * Delete multiple sessions
 */
export function deleteSessions(sessionIds: string[]): void {
  try {
    let sessions = getAllSessions();
    sessions = sessions.filter(s => !sessionIds.includes(s.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to delete sessions:", error);
  }
}

/**
 * Archive a session (mark as archived)
 */
export function archiveSession(sessionId: string): void {
  const session = getSession(sessionId);
  if (session) {
    session.status = "archived";
    saveSession(session);
  }
}

/**
 * Clear all sessions (with confirmation)
 */
export function clearAllSessions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear sessions:", error);
  }
}

/**
 * Export sessions as JSON
 */
export function exportSessions(): Blob {
  const sessions = getAllSessions();
  const json = JSON.stringify(sessions, null, 2);
  return new Blob([json], { type: "application/json" });
}

/**
 * Import sessions from JSON
 */
export function importSessions(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedSessions = JSON.parse(content) as StoredSession[];
        
        // Validate imported data
        if (!Array.isArray(importedSessions)) {
          throw new Error("Invalid format: expected array of sessions");
        }
        
        // Merge with existing sessions (avoid duplicates)
        const existing = getAllSessions();
        const existingIds = new Set(existing.map(s => s.id));
        
        let importedCount = 0;
        for (const session of importedSessions) {
          if (!existingIds.has(session.id)) {
            saveSession(session);
            importedCount++;
          }
        }
        
        resolve(importedCount);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Search sessions by title or content
 */
export function searchSessions(query: string): StoredSession[] {
  const sessions = getAllSessions();
  const lowerQuery = query.toLowerCase();
  
  return sessions.filter(session => {
    // Search in title
    if (session.title.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Search in messages
    return session.messages.some(msg => 
      msg.content.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Get sessions by provider
 */
export function getSessionsByProvider(provider: "openai" | "anthropic" | "gemini"): StoredSession[] {
  const sessions = getAllSessions();
  return sessions.filter(s => s.ai_provider === provider);
}

/**
 * Get sessions by status
 */
export function getSessionsByStatus(status: "active" | "inactive" | "archived"): StoredSession[] {
  const sessions = getAllSessions();
  return sessions.filter(s => s.status === status);
}

/**
 * Get storage statistics
 */
export function getStorageStats(): {
  totalSessions: number;
  totalMessages: number;
  storageUsed: number;
  storageLimit: number;
  percentUsed: number;
} {
  const sessions = getAllSessions();
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
  
  // Estimate storage used (rough approximation)
  const stored = localStorage.getItem(STORAGE_KEY) || "";
  const storageUsed = new Blob([stored]).size;
  
  // Most browsers have 5-10MB localStorage limit
  const storageLimit = 5 * 1024 * 1024; // 5MB conservative estimate
  const percentUsed = (storageUsed / storageLimit) * 100;
  
  return {
    totalSessions: sessions.length,
    totalMessages,
    storageUsed,
    storageLimit,
    percentUsed: Math.round(percentUsed),
  };
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new session
 */
export function createNewSession(
  aiProvider: "openai" | "anthropic" | "gemini" = "gemini",
  context?: { route: string; pageTitle: string }
): StoredSession {
  const session: StoredSession = {
    id: generateSessionId(),
    title: "New Conversation",
    created_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    message_count: 0,
    ai_provider: aiProvider,
    status: "active",
    messages: [],
    context,
  };
  
  saveSession(session);
  return session;
}

/**
 * Update session title (auto-generate from first message)
 */
export function updateSessionTitle(sessionId: string, title?: string): void {
  const session = getSession(sessionId);
  if (!session) return;
  
  if (title) {
    session.title = title;
  } else if (session.messages.length > 0) {
    // Auto-generate title from first user message
    const firstUserMessage = session.messages.find(m => m.type === "user");
    if (firstUserMessage) {
      // Use first 50 characters
      session.title = firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "");
    }
  }
  
  saveSession(session);
}
