import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';

interface WebSocketContextType {
    isConnected: boolean;
    subscribe: (eventType: string) => void;
    unsubscribe: (eventType: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return [context.isConnected, context.subscribe, context.unsubscribe] as const;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Create Socket.IO instance with configuration matching the Python backend
        const socket = io('http://localhost:5001', {
            transports: ['websocket', 'polling'],
            auth: {
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXIifQ.x5-TZSxG6c8k0RD3A1eNjDKqlS3ToZh7OWj0CTo7YdI'
            },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            timeout: 20000
        });

        // Connection event handlers
        socket.on('connect', () => {
            console.log('WebSocket connected');
            setIsConnected(true);
            toast.success('Connected to server');
        });

        socket.on('connection_established', (data) => {
            console.log('Connection established:', data);
            toast.success(`Authenticated as ${data.user_id}`);
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            setIsConnected(false);
            toast.error(`Connection error: ${error.message}`);
        });

        socket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            setIsConnected(false);
            toast.warning(`Disconnected: ${reason}`);
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
            toast.error(`Socket error: ${error}`);
        });

        setSocket(socket);

        // Cleanup on unmount
        return () => {
            if (socket) {
                socket.removeAllListeners();
                socket.close();
            }
        };
    }, []);

    const subscribe = useCallback((eventType: string) => {
        if (socket && isConnected) {
            socket.emit('subscribe', { event_type: eventType }, (response: any) => {
                if (response?.status === 'success') {
                    console.log(`Subscribed to ${eventType}`);
                } else {
                    console.error(`Failed to subscribe to ${eventType}:`, response?.message);
                }
            });
        }
    }, [socket, isConnected]);

    const unsubscribe = useCallback((eventType: string) => {
        if (socket && isConnected) {
            socket.emit('unsubscribe', { event_type: eventType }, (response: any) => {
                if (response?.status === 'success') {
                    console.log(`Unsubscribed from ${eventType}`);
                } else {
                    console.error(`Failed to unsubscribe from ${eventType}:`, response?.message);
                }
            });
        }
    }, [socket, isConnected]);

    return (
        <WebSocketContext.Provider value={{ isConnected, subscribe, unsubscribe }}>
            {children}
        </WebSocketContext.Provider>
    );
}; 