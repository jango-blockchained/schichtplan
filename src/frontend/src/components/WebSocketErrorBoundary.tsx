import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ReloadIcon } from '@radix-ui/react-icons';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class WebSocketErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('WebSocket Error Boundary caught an error:', error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <Alert variant="destructive" className="my-4">
                    <AlertTitle>Connection Error</AlertTitle>
                    <AlertDescription className="mt-2">
                        <p>There was a problem with the real-time connection. Some features may not update automatically.</p>
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={this.handleRetry}
                        >
                            <ReloadIcon className="mr-2 h-4 w-4" />
                            Retry Connection
                        </Button>
                    </AlertDescription>
                </Alert>
            );
        }

        return this.props.children;
    }
} 