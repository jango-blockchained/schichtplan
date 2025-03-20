import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component catches JavaScript errors anywhere in their child
 * component tree, logs those errors, and displays a fallback UI
 * 
 * @component
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <ComponentThatMightError />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    private handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <Alert variant="destructive">
                    <AlertTitle>Ein Fehler ist aufgetreten</AlertTitle>
                    <AlertDescription className="mt-2">
                        <div className="space-y-2">
                            <p>
                                {this.state.error?.message || 'Ein unerwarteter Fehler ist aufgetreten'}
                            </p>
                            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                                <pre className="mt-2 max-h-40 overflow-auto rounded bg-secondary/10 p-2 text-xs">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={this.handleReset}
                                className="mt-4"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Neu laden
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            );
        }

        return this.props.children;
    }
} 