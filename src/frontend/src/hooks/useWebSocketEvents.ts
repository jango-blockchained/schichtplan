import { io } from 'socket.io-client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketEvent {
    type: string;
    handler: (data: unknown) => void;
    onError?: (error: Error) => void;
    onReconnecting?: (attempt: number) => void;
}

// Memoize the WebSocket URL to prevent unnecessary recalculations
const getWebSocketUrl = (() => {
    let cachedUrl: string | null = null;
    return () => {
        if (cachedUrl) return cachedUrl;
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const host = window.location.hostname;
        const port = '5000';
        cachedUrl = `${protocol}//${host}:${port}`;
        console.log('New Socket.IO URL:', cachedUrl);
        return cachedUrl;
    };
})();

export function useWebSocketEvents(events?: WebSocketEvent[]) {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<ReturnType<typeof io> | null>(null);
    const eventsRef = useRef(events);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);

    // Update events ref when events change
    useEffect(() => {
        eventsRef.current = events;
    }, [events]);

    // Memoize connection handlers
    const handleConnect = useCallback(() => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnectAttempt(0);
    }, []);

    const handleDisconnect = useCallback(() => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
    }, []);

    const handleReconnectAttempt = useCallback((attempt: number) => {
        console.log(`WebSocket reconnection attempt ${attempt}`);
        setReconnectAttempt(attempt);
        eventsRef.current?.forEach(event => {
            if (event.onReconnecting) {
                event.onReconnecting(attempt);
            }
        });
    }, []);

    const handleError = useCallback((error: Error) => {
        console.error('WebSocket error:', error);
        eventsRef.current?.forEach(event => {
            if (event.onError) {
                event.onError(error);
            }
        });
    }, []);

    useEffect(() => {
        // Only create a new socket if one doesn't exist
        if (!socketRef.current) {
            const socket = io(getWebSocketUrl(), {
                transports: ['polling', 'websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 20000,
                autoConnect: true,
                forceNew: false, // Prevent creating multiple connections
                path: '/socket.io',
                withCredentials: true,
                extraHeaders: {
                    'Access-Control-Allow-Credentials': 'true'
                }
            });

            socketRef.current = socket;

            // Set up core event handlers
            socket.on('connect', handleConnect);
            socket.on('disconnect', handleDisconnect);
            socket.on('reconnect_attempt', handleReconnectAttempt);
            socket.on('error', handleError);

            // Register custom event handlers
            if (eventsRef.current) {
                eventsRef.current.forEach(event => {
                    socket.on(event.type, event.handler);
                });
            }
        }

        // Cleanup function
        return () => {
            const socket = socketRef.current;
            if (socket) {
                // Remove all event listeners
                socket.off('connect', handleConnect);
                socket.off('disconnect', handleDisconnect);
                socket.off('reconnect_attempt', handleReconnectAttempt);
                socket.off('error', handleError);

                if (eventsRef.current) {
                    eventsRef.current.forEach(event => {
                        socket.off(event.type, event.handler);
                    });
                }

                // Only disconnect if component is unmounting
                socket.disconnect();
                socketRef.current = null;
            }
        };
    }, []); // Empty dependency array since we use refs

    return { isConnected, reconnectAttempt };
}