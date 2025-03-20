import { useWebSocket } from '@/contexts/WebSocketContext';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, AlertCircle, Loader2, Lock, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WebSocketStatusProps {
    className?: string;
    showReconnectButton?: boolean;
}

export function WebSocketStatus({ className, showReconnectButton = true }: WebSocketStatusProps) {
    const { isConnected, isAuthenticated, userId, lastError, reconnect } = useWebSocket();

    return (
        <div className={cn('flex items-center gap-2', className)}>
            {isConnected ? (
                <div className={cn(
                    "flex items-center",
                    isAuthenticated ? "text-green-500" : "text-amber-500"
                )} title={isAuthenticated ? `Connected (Authenticated as ${userId})` : "Connected (Not authenticated)"}>
                    <Wifi className="h-4 w-4" />
                    <span className="ml-2 text-sm">Connected</span>
                    {isAuthenticated ? (
                        <Lock className="h-3 w-3 ml-1" />
                    ) : (
                        <KeyRound className="h-3 w-3 ml-1" />
                    )}
                </div>
            ) : lastError ? (
                <div className="flex items-center text-destructive" title={lastError.message}>
                    <AlertCircle className="h-4 w-4" />
                    <span className="ml-2 text-sm">Error</span>
                    {showReconnectButton && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => reconnect()}
                            className="ml-2"
                        >
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Reconnect
                        </Button>
                    )}
                </div>
            ) : (
                <div className="flex items-center text-muted-foreground" title="Disconnected">
                    <WifiOff className="h-4 w-4" />
                    <span className="ml-2 text-sm">Disconnected</span>
                    {showReconnectButton && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => reconnect()}
                            className="ml-2"
                        >
                            Reconnect
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
} 