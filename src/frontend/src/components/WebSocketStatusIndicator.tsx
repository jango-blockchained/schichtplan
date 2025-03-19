import React from 'react';
import { useWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff } from 'lucide-react';

interface WebSocketStatusIndicatorProps {
    className?: string;
}

export function WebSocketStatusIndicator({ className = '' }: WebSocketStatusIndicatorProps) {
    const [status, setStatus] = React.useState<'connected' | 'disconnected' | 'connecting'>('connecting');
    const [lastConnected, setLastConnected] = React.useState<Date | null>(null);
    const { toast } = useToast();

    // WebSocket event handlers
    useWebSocketEvents([
        {
            eventType: 'connect',
            handler: () => {
                setStatus('connected');
                setLastConnected(new Date());
                toast({
                    title: "Connected",
                    description: "WebSocket connection established",
                });
            }
        },
        {
            eventType: 'disconnect',
            handler: () => {
                setStatus('disconnected');
                toast({
                    title: "Disconnected",
                    description: "WebSocket connection lost. Attempting to reconnect...",
                    variant: "destructive"
                });
            }
        },
        {
            eventType: 'reconnecting',
            handler: () => {
                setStatus('connecting');
                toast({
                    title: "Reconnecting",
                    description: "Attempting to restore WebSocket connection..."
                });
            }
        },
        {
            eventType: 'reconnect_error',
            handler: () => {
                setStatus('disconnected');
                toast({
                    title: "Reconnection Failed",
                    description: "Failed to restore WebSocket connection. Please check your internet connection.",
                    variant: "destructive"
                });
            }
        }
    ]);

    // Function to trigger manual reconnection
    const handleManualReconnect = () => {
        // Emit a custom event to trigger reconnection
        window.dispatchEvent(new CustomEvent('websocket-reconnect-requested'));
        setStatus('connecting');
        toast({
            title: "Reconnecting",
            description: "Manually attempting to restore connection..."
        });
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {status === 'connected' ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                    <Wifi className="h-4 w-4" />
                    <span className="text-sm">Connected</span>
                    {lastConnected && (
                        <span className="text-xs text-gray-500">
                            {`(${lastConnected.toLocaleTimeString()})`}
                        </span>
                    )}
                </div>
            ) : status === 'connecting' ? (
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                    <Wifi className="h-4 w-4 animate-pulse" />
                    <span className="text-sm">Connecting...</span>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
                        <WifiOff className="h-4 w-4" />
                        <span className="text-sm">Disconnected</span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualReconnect}
                        className="ml-2"
                    >
                        Reconnect
                    </Button>
                </div>
            )}
        </div>
    );
} 