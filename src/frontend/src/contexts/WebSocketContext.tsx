import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket as SocketIOClient } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';

interface WebSocketContextType {
    socket: SocketIOClient | null;
    isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
    socket: null,
    isConnected: false,
});

export const useWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
    children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
    const [isConnected, setIsConnected] = React.useState(false);
    const socketRef = useRef<SocketIOClient | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        // Initialize Socket.IO connection
        const socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:5000', {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        // Store socket in ref
        socketRef.current = socket;

        // Connection event handlers
        socket.on('connect', () => {
            setIsConnected(true);
            window.dispatchEvent(new CustomEvent('websocket-connect'));
            toast({
                title: "Connected",
                description: "Real-time connection established",
            });
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            window.dispatchEvent(new CustomEvent('websocket-disconnect'));
            toast({
                title: "Disconnected",
                description: "Real-time connection lost",
                variant: "destructive",
            });
        });

        socket.on('reconnecting', () => {
            window.dispatchEvent(new CustomEvent('websocket-reconnecting'));
            toast({
                title: "Reconnecting",
                description: "Real-time connection is reconnecting",
            });
        });

        socket.on('reconnect_error', () => {
            window.dispatchEvent(new CustomEvent('websocket-reconnect_error'));
            toast({
                title: "Reconnection Error",
                description: "Failed to reconnect to real-time connection",
                variant: "destructive",
            });
        });

        // Schedule update events
        socket.on('schedule_updated', (data) => {
            window.dispatchEvent(new CustomEvent('websocket-schedule_updated', { detail: data }));
        });

        // Availability update events
        socket.on('availability_updated', (data) => {
            window.dispatchEvent(new CustomEvent('websocket-availability_updated', { detail: data }));
        });

        // Settings update events
        socket.on('settings_updated', (data) => {
            window.dispatchEvent(new CustomEvent('websocket-settings_updated', { detail: data }));
        });

        // Listen for manual reconnection requests
        const handleReconnectRequest = () => {
            if (socketRef.current) {
                socketRef.current.connect();
            }
        };

        window.addEventListener('websocket-reconnect-requested', handleReconnectRequest);

        // Cleanup
        return () => {
            window.removeEventListener('websocket-reconnect-requested', handleReconnectRequest);
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [toast]);

    return (
        <WebSocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
            {children}
        </WebSocketContext.Provider>
    );
} 