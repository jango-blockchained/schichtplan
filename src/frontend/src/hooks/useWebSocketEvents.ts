import { io } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';

interface WebSocketEvent {
    type: string;
    handler: (data: unknown) => void;
    onError?: (error: Error) => void;
    onReconnecting?: (attempt: number) => void;
}

function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.hostname;
    const port = '5000';
    const url = `${protocol}//${host}:${port}`;
    console.log('New Socket.IO URL:', url);
    return url;
}

export function useWebSocketEvents(events?: WebSocketEvent[]) {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<ReturnType<typeof io> | null>(null);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);

    useEffect(() => {
        const socket = io(getWebSocketUrl(), {
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000,
            autoConnect: true,
            forceNew: true,
            path: '/socket.io',
            withCredentials: true,
            extraHeaders: {
                'Access-Control-Allow-Credentials': 'true'
            }
        });

        socketRef.current = socket;

        // Register event handlers if provided
        if (events) {
            events.forEach(event => {
                socket.on(event.type, event.handler);

                if (event.onError) {
                    socket.on('error', event.onError);
                }

                if (event.onReconnecting) {
                    socket.on('reconnect_attempt', event.onReconnecting);
                }
            });
        }

        socket.on('connect', () => {
            console.log('Socket.IO connected');
            setIsConnected(true);
            setReconnectAttempt(0);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket.IO disconnected:', reason);
            setIsConnected(false);
        });

        socket.on('connect_error', (error: Error) => {
            console.error('Socket.IO connection error:', error);
            setIsConnected(false);
            setReconnectAttempt(prev => prev + 1);
            if (socket.io.engine) {
                // Try to upgrade to WebSocket if on polling
                if (socket.io.engine.transport.name === 'polling') {
                    console.log('Attempting to upgrade to WebSocket...');
                }
            }
        });

        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`Attempting to reconnect (${attemptNumber}/5)...`);
            setReconnectAttempt(attemptNumber);
        });

        socket.on('reconnect_failed', () => {
            console.log('Reconnection failed after 5 attempts');
        });

        socket.on('error', (error: Error) => {
            console.error('Socket.IO error:', error);
        });

        socket.on('connection_established', (data: any) => {
            console.log('Connection established:', data);
        });

        return () => {
            if (socket) {
                // Unregister event handlers if provided
                if (events) {
                    events.forEach(event => {
                        socket.off(event.type);
                        if (event.onError) {
                            socket.off('error');
                        }
                        if (event.onReconnecting) {
                            socket.off('reconnect_attempt');
                        }
                    });
                }
                socket.disconnect();
                socket.removeAllListeners();
            }
        };
    }, [events]);

    const subscribe = (event: string, callback: (data: any) => void) => {
        if (socketRef.current) {
            socketRef.current.on(event, callback);
        }
    };

    const unsubscribe = (event: string) => {
        if (socketRef.current) {
            socketRef.current.off(event);
        }
    };

    const emit = (event: string, data: any) => {
        if (socketRef.current) {
            socketRef.current.emit(event, data);
        }
    };

    return {
        isConnected,
        subscribe,
        unsubscribe,
        emit,
    };
}