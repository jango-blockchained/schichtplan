import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

/**
 * LoadingSpinner component displays an animated loading indicator
 * 
 * @component
 * @example
 * ```tsx
 * <LoadingSpinner size="md" />
 * ```
 */
export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12'
    };

    return (
        <div
            role="status"
            className={cn(
                "flex items-center justify-center",
                className
            )}
        >
            <Loader2
                className={cn(
                    "animate-spin text-primary",
                    sizeClasses[size]
                )}
            />
            <span className="sr-only">Wird geladen...</span>
        </div>
    );
} 