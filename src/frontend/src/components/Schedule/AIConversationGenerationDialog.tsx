import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { aiConversationService } from '@/services/aiConversationService';
import {
    AlertCircle,
    BarChart3,
    Calendar,
    CheckCircle2,
    ChevronRight,
    FileText,
    Lightbulb,
    Loader2,
    Settings,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface AIConversationGenerationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    startDate: string;
    endDate: string;
    versionId?: number;
    onComplete: () => void;
}

type ConversationStep = 'initialize' | 'analyze' | 'recommend' | 'generate' | 'review' | 'complete';

const STEP_DETAILS: Record<ConversationStep, { title: string; description: string; icon: React.ElementType }> = {
    initialize: {
        title: 'Initialization',
        description: 'Setting up AI conversation for schedule generation',
        icon: Settings,
    },
    analyze: {
        title: 'Analysis',
        description: 'Analyzing current schedule state and identifying issues',
        icon: BarChart3,
    },
    recommend: {
        title: 'Recommendations',
        description: 'Generating optimization recommendations',
        icon: Lightbulb,
    },
    generate: {
        title: 'Generation',
        description: 'Creating optimized schedule based on recommendations',
        icon: Calendar,
    },
    review: {
        title: 'Review',
        description: 'Review and adjust the generated schedule',
        icon: FileText,
    },
    complete: {
        title: 'Complete',
        description: 'Schedule generation completed',
        icon: CheckCircle2,
    },
};

export function AIConversationGenerationDialog({
    isOpen,
    onClose,
    startDate,
    endDate,
    versionId,
    onComplete,
}: AIConversationGenerationDialogProps) {
    const [currentStep, setCurrentStep] = useState<ConversationStep>('initialize');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);

    // Step results
    const [analysis, setAnalysis] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<any>(null);
    const [generationResult, setGenerationResult] = useState<any>(null);

    // Progress tracking
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isOpen) {
            startConversation();
        } else {
            // Reset state when dialog closes
            resetState();
        }
    }, [isOpen]);

    const resetState = () => {
        setCurrentStep('initialize');
        setIsLoading(false);
        setError(null);
        setConversationId(null);
        setAnalysis(null);
        setRecommendations(null);
        setGenerationResult(null);
        setProgress(0);
        aiConversationService.reset();
    };

    const startConversation = async () => {
        setIsLoading(true);
        setError(null);
        setProgress(10);

        try {
            const response = await aiConversationService.startConversation({
                start_date: startDate,
                end_date: endDate,
                generation_type: 'interactive',
                version_id: versionId,
            });

            if (response.status === 'success' && response.conversation_id) {
                setConversationId(response.conversation_id);
                setCurrentStep('analyze');
                setProgress(20);

                // Automatically proceed to analysis
                setTimeout(() => analyzeCurrentState(), 1000);
            } else {
                throw new Error(response.message || 'Failed to start conversation');
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to start conversation');
            setIsLoading(false);
        }
    };

    const analyzeCurrentState = async () => {
        setIsLoading(true);
        setError(null);
        setProgress(30);

        try {
            const response = await aiConversationService.analyzeCurrentState();

            if (response.status === 'success' && response.analysis) {
                setAnalysis(response.analysis);
                setCurrentStep('recommend');
                setProgress(40);

                // Automatically proceed to recommendations
                setTimeout(() => getRecommendations(), 1000);
            } else {
                throw new Error(response.message || 'Failed to analyze current state');
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to analyze current state');
            setIsLoading(false);
        }
    };

    const getRecommendations = async () => {
        setIsLoading(true);
        setError(null);
        setProgress(50);

        try {
            const response = await aiConversationService.getRecommendations();

            if (response.status === 'success' && response.recommendations) {
                setRecommendations(response.recommendations);
                setCurrentStep('generate');
                setProgress(60);

                // Automatically proceed to generation
                setTimeout(() => generateSchedule(), 1000);
            } else {
                throw new Error(response.message || 'Failed to get recommendations');
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to get recommendations');
            setIsLoading(false);
        }
    };

    const generateSchedule = async () => {
        setIsLoading(true);
        setError(null);
        setProgress(70);

        try {
            const response = await aiConversationService.generateSchedule();

            if (response.status === 'success' && response.generation_result) {
                setGenerationResult(response.generation_result);
                setCurrentStep('review');
                setProgress(90);
                setIsLoading(false);
            } else {
                // If the API returns a structured error code, handle it here
                if (response.error_code === 'MISSING_GEMINI_API_KEY') {
                    toast.error('AI generation requires a Gemini API key. Please configure it in your environment settings.');
                }
                throw new Error(response.message || 'Failed to generate schedule');
            }
        } catch (error: any) {
            setError(error?.message || 'Failed to generate schedule');
            setIsLoading(false);

            // Optionally, fallback to string matching if error_code is not available
            if (error?.error_code === 'MISSING_GEMINI_API_KEY' || (error?.message && error.message.includes('Gemini API key'))) {
                toast.error('AI generation requires a Gemini API key. Please configure it in your environment settings.');
            }
        }
    };

    const finalizeSchedule = async () => {
        setIsLoading(true);
        setError(null);
        setProgress(95);

        try {
            const response = await aiConversationService.finalizeSchedule();

            if (response.status === 'success') {
                setCurrentStep('complete');
                setProgress(100);
                setIsLoading(false);

                toast.success('Schedule generated successfully!');

                // Call onComplete after a short delay
                setTimeout(() => {
                    onComplete();
                    onClose();
                }, 2000);
            } else {
                throw new Error(response.message || 'Failed to finalize schedule');
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to finalize schedule');
            setIsLoading(false);
        }
    };

    const cancelConversation = async () => {
        if (conversationId) {
            try {
                await aiConversationService.cancelConversation();
            } catch (error) {
                console.error('Failed to cancel conversation:', error);
            }
        }
        onClose();
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 'initialize':
                return (
                    <div className="text-center py-8">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                        <p className="text-muted-foreground">Initializing AI conversation...</p>
                    </div>
                );

            case 'analyze':
                return (
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-8">
                                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                                <p className="text-muted-foreground">Analyzing current schedule...</p>
                            </div>
                        ) : analysis ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Conflicts</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{analysis.conflicts?.length || 0}</div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Coverage Gaps</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{analysis.coverage_gaps?.length || 0}</div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Workload Issues</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">
                                                {analysis.workload_distribution?.overloaded || 0}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {analysis.summary && (
                                    <Alert>
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            <strong>Analysis Summary:</strong> {analysis.summary.recommendation}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        ) : null}
                    </div>
                );

            case 'recommend':
                return (
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-8">
                                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                                <p className="text-muted-foreground">Generating recommendations...</p>
                            </div>
                        ) : recommendations ? (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium mb-2">Generation Strategy</h4>
                                    <Badge variant="secondary">{recommendations.generation_strategy}</Badge>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">Focus Areas</h4>
                                    <div className="space-y-2">
                                        {recommendations.focus_areas?.map((area: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <span className="text-sm">{area.area.replace(/_/g, ' ')}</span>
                                                <Badge variant={area.priority === 'high' ? 'destructive' : 'secondary'}>
                                                    {area.priority}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">Optimization Parameters</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {Object.entries(recommendations.optimization_parameters?.priority_settings || {}).map(
                                            ([key, value]) => (
                                                <div key={key} className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">{key}:</span>
                                                    <span className="font-medium">{value}%</span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>

                                <Button onClick={generateSchedule} className="w-full" disabled={isLoading}>
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Generate Schedule with These Recommendations
                                </Button>
                            </div>
                        ) : null}
                    </div>
                );

            case 'generate':
                return (
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-8">
                                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                                <p className="text-muted-foreground">Generating optimized schedule...</p>
                                <p className="text-sm text-muted-foreground mt-2">This may take a few moments...</p>
                            </div>
                        ) : generationResult ? (
                            <div className="space-y-4">
                                <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <AlertDescription>
                                        Schedule generation in progress...
                                    </AlertDescription>
                                </Alert>
                                <p className="text-sm text-muted-foreground">
                                    The system is creating your optimized schedule. Please wait...
                                </p>
                            </div>
                        ) : null}
                    </div>
                );

            case 'review':
                return (
                    <div className="space-y-4">
                        {generationResult ? (
                            <div className="space-y-4">
                                <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <AlertDescription>
                                        Successfully generated {generationResult.generated_assignments_count || 0} assignments
                                    </AlertDescription>
                                </Alert>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Version:</span>
                                        <span className="font-medium">{generationResult.version || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Session ID:</span>
                                        <span className="font-mono text-xs">{generationResult.session_id || 'N/A'}</span>
                                    </div>
                                    {generationResult.diagnostic_log && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Diagnostic Log:</span>
                                            <Button variant="link" size="sm" className="h-auto p-0">
                                                View Log
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                <div className="flex gap-2">
                                    <Button onClick={finalizeSchedule} className="flex-1" disabled={isLoading}>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Finalize Schedule
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                );

            case 'complete':
                return (
                    <div className="text-center py-8">
                        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Schedule Generation Complete!</h3>
                        <p className="text-muted-foreground">The optimized schedule has been saved.</p>
                    </div>
                );

            default:
                return null;
        }
    };

    const stepIndex = ['initialize', 'analyze', 'recommend', 'generate', 'review', 'complete'].indexOf(currentStep);

    return (
        <Dialog open={isOpen} onOpenChange={cancelConversation}>
            <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>AI Schedule Generation - Multi-Step Process</DialogTitle>
                    <DialogDescription>
                        Generate an optimized schedule for {startDate} to {endDate}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Step {stepIndex + 1} of 6</span>
                            <span>{STEP_DETAILS[currentStep].title}</span>
                        </div>
                    </div>

                    {/* Step Indicators */}
                    <div className="flex items-center justify-between">
                        {(Object.keys(STEP_DETAILS) as ConversationStep[]).map((step, index) => {
                            const StepIcon = STEP_DETAILS[step].icon;
                            const isActive = step === currentStep;
                            const isCompleted = stepIndex > index;

                            return (
                                <React.Fragment key={step}>
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={`
                        rounded-full p-2 transition-colors
                        ${isActive ? 'bg-primary text-primary-foreground' : ''}
                        ${isCompleted ? 'bg-green-600 text-white' : ''}
                        ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                      `}
                                        >
                                            <StepIcon className="h-4 w-4" />
                                        </div>
                                        <span className="text-xs mt-1">{STEP_DETAILS[step].title}</span>
                                    </div>
                                    {index < Object.keys(STEP_DETAILS).length - 1 && (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Step Content */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">{STEP_DETAILS[currentStep].title}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {STEP_DETAILS[currentStep].description}
                            </p>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[300px] pr-4">
                                {renderStepContent()}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
} 