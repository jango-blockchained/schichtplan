import React, { useState } from 'react';
import { generateDemoData } from '@/services/api';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';

interface DemoDataGenerationProgressProps {
    onComplete?: () => void;
    onError?: (error: string) => void;
}

export function DemoDataGenerationProgress({ onComplete, onError }: DemoDataGenerationProgressProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        try {
            setError(null);
            setIsGenerating(true);
            const response = await generateDemoData();
            setIsGenerating(false);
            onComplete?.();
        } catch (error) {
            setIsGenerating(false);
            const errorMessage = error instanceof Error ? error.message : 'Failed to generate demo data';
            setError(errorMessage);
            onError?.(errorMessage);
        }
    };

    const handleRetry = () => {
        handleGenerate();
    };

    if (error) {
        return (
            <div className="space-y-4">
                <div className="text-destructive">
                    {error}
                </div>
                <Button
                    variant="outline"
                    onClick={handleRetry}
                    className="w-full"
                >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Retry Generation
                </Button>
            </div>
        );
    }

    if (!isGenerating) {
        return (
            <Button
                variant="outline"
                onClick={handleGenerate}
                className="w-full"
            >
                Generate Demo Data
            </Button>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                    Generating demo data...
                </span>
            </div>
            <Progress value={undefined} className="w-full" />
        </div>
    );
} 