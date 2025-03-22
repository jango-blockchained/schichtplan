import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
    isConnected: boolean;
    socket: Socket | null;
}

const WebSocketContext = createContext<WebSocketContextType>({
    isConnected: false,
    socket: null,
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const { token } = useAuth();

    useEffect(() => {
        if (!token) {
            console.log('No token available, skipping socket connection');
            return;
        }

        // Clean up any existing socket connection
        if (socketRef.current) {
            console.log('Cleaning up existing socket connection');
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        // Socket.IO v3+ configuration
        const socketOptions: Partial<ManagerOptions & SocketOptions> = {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            timeout: 20000,
            auth: {
                token: token
            }
        };

        console.log('Initializing new socket connection');
        const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001', socketOptions);
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
            toast.success('Connected to server');
        });

        socket.on('connect_error', (error: Error) => {
            console.error('Socket connection error:', error);
            setIsConnected(false);
            toast.error(`Connection error: ${error.message}`);
        });

        socket.on('disconnect', (reason: string) => {
            console.log('Socket disconnected:', reason);
            setIsConnected(false);
            if (reason === 'io server disconnect') {
                // Server initiated disconnect, don't reconnect automatically
                toast.error('Disconnected by server');
            } else {
                toast.warning('Connection lost, attempting to reconnect...');
            }
        });

        socket.on('connection_established', (data: any) => {
            console.log('Connection established:', data);
            if (data.is_authenticated) {
                toast.success(`Authenticated as ${data.user_id}`);
            }
        });

        socket.on('error', (error: Error) => {
            console.error('Socket error:', error);
            toast.error(`Socket error: ${error.message}`);
        });

        // Connect after setting up all event handlers
        socket.connect();

        // Cleanup function
        return () => {
            console.log('Cleaning up socket connection');
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [token]); // Only recreate socket when token changes

    return (
        <WebSocketContext.Provider value={{ isConnected, socket: socketRef.current }}>
            {children}
        </WebSocketContext.Provider>
    );
}; 