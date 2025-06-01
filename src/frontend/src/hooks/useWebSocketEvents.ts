import { useEffect } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';

export type WebSocketEventType =
    | 'schedule_updated'
    | 'availability_updated'
    | 'connect'
    | 'disconnect'
    | 'reconnecting'
    | 'reconnect_error'
    | 'settings_updated';

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

    useEffect(() => {
        // Register event handlers
        const eventListeners = handlers.map(({ eventType, handler }) => {
            const listener = ((event: CustomEvent) => {
                handler(event.detail);
            }) as EventListener;

            window.addEventListener(`websocket-${eventType}`, listener);
            return { eventType, listener };
        });

        // Handle manual reconnection requests
        const handleReconnectRequest = () => {
            // Emit reconnecting event
            window.dispatchEvent(new CustomEvent('websocket-reconnecting'));

            // Attempt to reconnect (you might want to customize this based on your WebSocket setup)
            try {
                // Your reconnection logic here
                // For example:
                // socket.connect();

                // For demo purposes, simulate a successful reconnection after 2 seconds
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('websocket-connect'));
                }, 2000);
            } catch (error) {
                window.dispatchEvent(new CustomEvent('websocket-reconnect_error'));
            }
        };

        window.addEventListener('websocket-reconnect-requested', handleReconnectRequest);

        // Cleanup
        return () => {
            eventListeners.forEach(({ eventType, listener }) => {
                window.removeEventListener(`websocket-${eventType}`, listener);
            });
            window.removeEventListener('websocket-reconnect-requested', handleReconnectRequest);
        };
    }, [handlers]);
}; 