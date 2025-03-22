import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
    isConnected: boolean;
    socket: WebSocket | null;
    subscribe: (event: string) => void;
    unsubscribe: (event: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
    isConnected: false,
    socket: null,
    subscribe: () => { },
    unsubscribe: () => { },
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const { token } = useAuth();

    useEffect(() => {
        if (!token) {
            console.log('No token available, skipping socket connection');
            return;
        }

        // Clean up any existing socket connection
        if (socketRef.current) {
            console.log('Cleaning up existing socket connection');
            socketRef.current.close();
            socketRef.current = null;
        }

        // Create WebSocket connection with auth token
        const wsUrl = new URL(process.env.REACT_APP_WS_URL || 'ws://localhost:5001');
        wsUrl.searchParams.set('token', token);

        console.log('Initializing new socket connection');
        const socket = new WebSocket(wsUrl.toString(), ['schichtplan-v1']);
        socketRef.current = socket;

        socket.addEventListener('open', () => {
            console.log('Socket connected');
            setIsConnected(true);
            toast.success('Connected to server');
        });

        socket.addEventListener('message', (event) => {
            try {
                const message = JSON.parse(event.data);

                switch (message.type) {
                    case 'connection_established':
                        console.log('Connection established:', message.data);
                        if (message.data.is_authenticated) {
                            toast.success(`Authenticated as ${message.data.user_id}`);
                        }
                        break;

                    case 'error':
                        console.error('Socket error:', message.message);
                        toast.error(`Socket error: ${message.message}`);
                        break;

                    case 'subscribe_response':
                    case 'unsubscribe_response':
                        if (message.status === 'success') {
                            console.log(message.message);
                        } else {
                            console.error(message.message);
                            toast.error(message.message);
                        }
                        break;

                    default:
                        // Handle other message types (e.g., schedule_updated, etc.)
                        if (message.type && message.data) {
                            // Emit an event that components can listen to
                            const event = new CustomEvent(message.type, { detail: message.data });
                            window.dispatchEvent(event);
                        }
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        socket.addEventListener('close', (event) => {
            console.log('Socket disconnected:', event.reason);
            setIsConnected(false);
            if (event.code === 1000) {
                // Normal closure
                toast.info('Disconnected from server');
            } else {
                toast.error('Connection lost');
            }
        });

        socket.addEventListener('error', (error) => {
            console.error('Socket error:', error);
            setIsConnected(false);
            toast.error('Connection error');
        });

        // Set up ping interval
        const pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000); // Send ping every 30 seconds

        // Cleanup function
        return () => {
            console.log('Cleaning up socket connection');
            clearInterval(pingInterval);
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [token]); // Only recreate socket when token changes

    const subscribe = (event: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'subscribe',
                event,
            }));
        }
    };

    const unsubscribe = (event: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'unsubscribe',
                event,
            }));
        }
    };

    return (
        <WebSocketContext.Provider value={{
            isConnected,
            socket: socketRef.current,
            subscribe,
            unsubscribe,
        }}>
            {children}
        </WebSocketContext.Provider>
    );
}; 