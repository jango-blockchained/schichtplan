import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Manager, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface WebSocketContextType {
    socket: typeof Socket | null;
    isConnected: boolean;
    isAuthenticated: boolean;
    userId: string | null;
    lastError: Error | null;
    reconnect: (authToken?: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;
const RETRY_MULTIPLIER = 1.5;

interface WebSocketProviderProps {
    children: ReactNode;
    url: string;
    authToken?: string;
}

export function WebSocketProvider({ children, url, authToken }: WebSocketProviderProps) {
    const [socket, setSocket] = useState<typeof Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [lastError, setLastError] = useState<Error | null>(null);
    const [retryDelay, setRetryDelay] = useState(INITIAL_RETRY_DELAY);
    const { toast } = useToast();

    const connect = useCallback(() => {
        try {
            // Add auth token to URL if provided
            const connectionUrl = authToken
                ? `${url}?token=${encodeURIComponent(authToken)}`
                : url;

            const manager = new Manager(connectionUrl, {
                reconnection: false, // We'll handle reconnection ourselves
                timeout: 10000,
                transports: ['websocket']
            });

            const newSocket = manager.socket('/');

            newSocket.on('connect', () => {
                setIsConnected(true);
                setLastError(null);
                setRetryDelay(INITIAL_RETRY_DELAY);
                toast({
                    title: "Connected",
                    description: "Real-time connection established"
                });
            });

            newSocket.on('connection_established', (data: {
                client_id: string;
                is_authenticated: boolean;
                user_id: string | null;
            }) => {
                // Set authentication state based on server response
                setIsAuthenticated(data.is_authenticated);
                setUserId(data.user_id);

                if (data.is_authenticated) {
                    toast({
                        title: "Authenticated",
                        description: `Authenticated as user ${data.user_id}`
                    });
                }
            });

            newSocket.on('disconnect', () => {
                setIsConnected(false);
                setIsAuthenticated(false);
                setUserId(null);
                toast({
                    title: "Disconnected",
                    description: "Real-time connection lost",
                    variant: "destructive"
                });
            });

            newSocket.on('connect_error', (error: Error) => {
                setIsConnected(false);
                setIsAuthenticated(false);
                setUserId(null);
                setLastError(error);

                // Implement exponential backoff
                const nextDelay = Math.min(retryDelay * RETRY_MULTIPLIER, MAX_RETRY_DELAY);
                setRetryDelay(nextDelay);

                toast({
                    title: "Connection Error",
                    description: `Failed to connect: ${error.message}`,
                    variant: "destructive"
                });

                // Schedule reconnection
                setTimeout(() => {
                    reconnect(authToken);
                }, retryDelay);
            });

            setSocket(newSocket);
        } catch (error) {
            setLastError(error as Error);
            console.error('Failed to create WebSocket connection:', error);
        }
    }, [url, retryDelay, toast, authToken]);

    const reconnect = useCallback((newAuthToken?: string) => {
        if (socket) {
            socket.close();
            setSocket(null);
        }

        // Update auth token if a new one is provided
        if (newAuthToken !== undefined) {
            authToken = newAuthToken;
        }

        connect();
    }, [socket, connect]);

    useEffect(() => {
        connect();
        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, [connect]);

    return (
        <WebSocketContext.Provider value={{
            socket,
            isConnected,
            isAuthenticated,
            userId,
            lastError,
            reconnect
        }}>
            {children}
        </WebSocketContext.Provider>
    );
}

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
}; 