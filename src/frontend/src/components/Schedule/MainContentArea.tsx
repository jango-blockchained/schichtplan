import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';
import React from 'react';

interface MainContentAreaProps {
  // Loading and error states
  isLoading?: boolean;
  error?: Error | null;
  
  // Main content
  children: React.ReactNode;
  
  // Error fallback
  onRetry?: () => void;
  
  // Layout options
  className?: string;
}

export function MainContentArea({
  isLoading = false,
  error = null,
  children,
  onRetry,
  className = "space-y-4",
}: MainContentAreaProps) {
  // Error state
  if (error) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Fehler beim Laden der Daten</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{error.message}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="underline hover:no-underline text-sm font-medium"
              >
                Erneut versuchen
              </button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Normal content
  return (
    <div className={className}>
      {children}
    </div>
  );
}
