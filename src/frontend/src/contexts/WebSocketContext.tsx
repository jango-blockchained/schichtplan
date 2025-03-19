import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Manager, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface WebSocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    lastError: Error | null;
    reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;
const RETRY_MULTIPLIER = 1.5;

interface WebSocketProviderProps {
    children: ReactNode;
    url: string;
}

export function WebSocketProvider({ children, url }: WebSocketProviderProps) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastError, setLastError] = useState<Error | null>(null);
    const [retryDelay, setRetryDelay] = useState(INITIAL_RETRY_DELAY);
    const { toast } = useToast();

    const connect = useCallback(() => {
        try {
            const manager = new Manager(url, {
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
                    description: "Real-time connection established",
                    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />
                });
            });

            newSocket.on('disconnect', () => {
                setIsConnected(false);
                toast({
                    title: "Disconnected",
                    description: "Real-time connection lost",
                    variant: "destructive",
                    icon: <AlertCircle className="h-4 w-4" />
                });
            });

            newSocket.on('connect_error', (error: Error) => {
                setIsConnected(false);
                setLastError(error);

                // Implement exponential backoff
                const nextDelay = Math.min(retryDelay * RETRY_MULTIPLIER, MAX_RETRY_DELAY);
                setRetryDelay(nextDelay);

                toast({
                    title: "Connection Error",
                    description: `Failed to connect: ${error.message}`,
                    variant: "destructive",
                    icon: <AlertCircle className="h-4 w-4" />
                });

                // Schedule reconnection
                setTimeout(() => {
                    reconnect();
                }, retryDelay);
            });

            setSocket(newSocket);
        } catch (error) {
            setLastError(error as Error);
            console.error('Failed to create WebSocket connection:', error);
        }
    }, [url, retryDelay, toast]);

    const reconnect = useCallback(() => {
        if (socket) {
            socket.close();
            setSocket(null);
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
        <WebSocketContext.Provider value={{ socket, isConnected, lastError, reconnect }}>
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