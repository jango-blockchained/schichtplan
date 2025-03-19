import { useEffect } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';

export type WebSocketEventType =
    | 'schedule_updated'
    | 'availability_updated'
    | 'absence_updated'
    | 'settings_updated'
    | 'coverage_updated'
    | 'shift_template_updated';

export interface WebSocketEventHandler {
    eventType: WebSocketEventType;
    handler: (data: unknown) => void;
}

export const useWebSocketEvents = (handlers: WebSocketEventHandler[]) => {
    const { socket } = useWebSocket();

    useEffect(() => {
        if (!socket) return;

        // Register all event handlers
        handlers.forEach(({ eventType, handler }) => {
            socket.on(eventType, handler);
        });

        // Cleanup: remove all event handlers
        return () => {
            handlers.forEach(({ eventType, handler }) => {
                socket?.off(eventType, handler);
            });
        };
    }, [socket, handlers]);
}; 