import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { generateSchedule, fixShiftDurations } from '@/services/api';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import axios from 'axios';

// Types imported from GenerationOverlay
export interface GenerationStep {
    id: string;
    title: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    message?: string;
}

export interface GenerationLog {
    type: 'info' | 'warning' | 'error';
    timestamp: string;
    message: string;
    details?: string;
}

interface UseScheduleGenerationProps {
    dateRange: DateRange | undefined;
    selectedVersion?: number;
    createEmptySchedules: boolean;
    onSuccess?: () => void;
}

export function useScheduleGeneration({
    dateRange,
    selectedVersion,
    createEmptySchedules,
    onSuccess
}: UseScheduleGenerationProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
    const [generationLogs, setGenerationLogs] = useState<GenerationLog[]>([]);
    const [showGenerationOverlay, setShowGenerationOverlay] = useState(false);

    const addGenerationLog = (type: 'info' | 'warning' | 'error', message: string, details?: string) => {
        setGenerationLogs(prev => [...prev, {
            timestamp: new Date().toISOString(),
            type,
            message,
            details
        }]);
    };

    const clearGenerationLogs = () => {
        setGenerationLogs([]);
    };

    const resetGenerationState = () => {
        setGenerationSteps([]);
        setShowGenerationOverlay(false);
    };

    const updateGenerationStep = (stepId: string, status: GenerationStep['status'], message?: string) => {
        setGenerationSteps(steps =>
            steps.map(step =>
                step.id === stepId
                    ? { ...step, status, message }
                    : step
            )
        );
    };

    // Generation mutation with timeout
    const generateMutation = useMutation({
        mutationFn: async () => {
            try {
                if (!dateRange?.from || !dateRange?.to) {
                    throw new Error("Bitte wählen Sie einen Zeitraum aus");
                }

                if (!selectedVersion) {
                    throw new Error("Bitte wählen Sie eine Version aus");
                }

                // Log the generation parameters
                console.log("🚀 Starting generation with:", {
                    dateRange: {
                        from: dateRange.from.toISOString(),
                        to: dateRange.to.toISOString()
                    },
                    selectedVersion,
                    createEmptySchedules
                });

                // Set up steps
                const steps: GenerationStep[] = [
                    { id: "init", title: "Initialisiere Generierung", status: "pending" },
                    { id: "validate", title: "Validiere Eingabedaten", status: "pending" },
                    { id: "process", title: "Verarbeite Schichtplan", status: "pending" },
                    { id: "assign", title: "Weise Schichten zu", status: "pending" },
                    { id: "finalize", title: "Finalisiere Schichtplan", status: "pending" },
                ];
                setGenerationSteps(steps);
                setShowGenerationOverlay(true);

                // Set a timeout to automatically reset if it takes too long
                const timeout = setTimeout(() => {
                    addGenerationLog('error', 'Zeitüberschreitung', 'Die Generierung dauert länger als erwartet. Bitte versuchen Sie es erneut.');
                    updateGenerationStep('init', 'error', 'Zeitüberschreitung');
                    throw new Error('Die Generierung dauert länger als erwartet.');
                }, 30000); // 30 second timeout

                try {
                    // Init
                    updateGenerationStep("init", "in-progress");
                    addGenerationLog("info", "Initialisiere Generierung",
                        `Version: ${selectedVersion}, Zeitraum: ${format(dateRange.from, 'dd.MM.yyyy')} - ${format(dateRange.to, 'dd.MM.yyyy')}`);
                    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
                    updateGenerationStep("init", "completed");

                    // Validate
                    updateGenerationStep("validate", "in-progress");
                    addGenerationLog("info", "Validiere Eingabedaten");
                    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
                    updateGenerationStep("validate", "completed");

                    // Process
                    updateGenerationStep("process", "in-progress");
                    addGenerationLog("info", "Starte Verarbeitung");

                    // Call API to generate schedule
                    const fromStr = format(dateRange.from, 'yyyy-MM-dd');
                    const toStr = format(dateRange.to, 'yyyy-MM-dd');

                    try {
                        // Always use the explicit selectedVersion, no fallback to 1
                        console.log('🚀 Calling generateSchedule API with:', {
                            fromStr,
                            toStr,
                            createEmptySchedules,
                            selectedVersion,
                            'Request will include shift_type values': true
                        });

                        const result = await generateSchedule(
                            fromStr,
                            toStr,
                            createEmptySchedules,
                            selectedVersion  // Use the selected version without fallback
                        );

                        // Log the response to help with debugging
                        console.log('✅ GenerateSchedule API response:', {
                            'Total schedules': result.schedules?.length || 0,
                            'Schedules with shifts': result.schedules?.filter(s => s.shift_id !== null)?.length || 0,
                            'Unique employees': [...new Set(result.schedules?.map(s => s.employee_id) || [])].length,
                            'Has errors': result.errors && result.errors.length > 0,
                            'Error count': result.errors?.length || 0,
                            'First error': result.errors?.[0] || 'No errors',
                            'First schedule': result.schedules?.[0] || 'No schedules',
                            'Log count from backend': result.logs?.length || 0, // Log backend log count
                        });

                        // Process backend logs AFTER successful API call
                        if (result.logs && result.logs.length > 0) {
                           // Convert backend logs to frontend format
                           const formattedLogs: GenerationLog[] = result.logs.map((log: any) => ({
                               timestamp: log.timestamp || new Date().toISOString(),
                               type: (log.level?.toLowerCase() || 'info') as 'info' | 'warning' | 'error',
                               message: log.message || 'Log message missing',
                               details: log.details
                           }));
                           setGenerationLogs(prev => [...prev, ...formattedLogs]); // Append backend logs
                        }

                        updateGenerationStep("process", "completed");

                        // Assign shifts
                        updateGenerationStep("assign", "in-progress");
                        addGenerationLog("info", "Weise Schichten zu");
                        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
                        updateGenerationStep("assign", "completed");

                        // Finalize
                        updateGenerationStep("finalize", "in-progress");
                        addGenerationLog("info", "Finalisiere Schichtplan");
                        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
                        updateGenerationStep("finalize", "completed");

                        // Clear the timeout since we finished successfully
                        clearTimeout(timeout);

                        return result;
                    } catch (apiError) {
                        // Handle API-specific errors
                        console.error("API error during generation:", apiError);

                        // Update the appropriate step to error state
                        updateGenerationStep("process", "error", apiError instanceof Error ? apiError.message : "Unbekannter Fehler");

                        // Add detailed error log
                        if (apiError instanceof Error) {
                            addGenerationLog("error", apiError.message, "Fehler bei der API-Anfrage");

                            // Check for various patterns that indicate duration_hours issues
                            const durationPatterns = [
                                'duration_hours',
                                'schichtdauer',
                                'nonetype',
                                'attribute',
                                'none',
                                'shift',
                                'duration',
                                'has no attribute',
                                'fehlt ein attribut',
                                'missing attribute'
                            ];

                            const hasDurationError = durationPatterns.some(pattern =>
                                apiError.message.toLowerCase().includes(pattern)
                            );

                            if (hasDurationError) {
                                addGenerationLog("error", "Schichtdauer fehlt", "Bitte überprüfen Sie die Schichteinstellungen und stellen Sie sicher, dass alle Schichten eine Dauer haben.");
                            }
                        } else {
                            addGenerationLog("error", "Unbekannter API-Fehler", String(apiError));
                        }

                        // Clear the timeout on error
                        clearTimeout(timeout);
                        throw apiError;
                    }
                } catch (error) {
                    // Clear the timeout on error
                    clearTimeout(timeout);
                    throw error;
                }
            } catch (error) {
                console.error("Generation error:", error);
                if (error instanceof Error) {
                    addGenerationLog("error", "Fehler bei der Generierung", error.message);
                } else {
                    addGenerationLog("error", "Unbekannter Fehler", String(error));
                }

                // Mark any in-progress steps as error
                setGenerationSteps(prev =>
                    prev.map(step => step.status === 'in-progress' ? { ...step, status: 'error' } : step)
                );

                throw error;
            }
        },
        onSuccess: (data) => {
            // Add backend logs received in the response
            if (data.logs && data.logs.length > 0) {
                const formattedLogs: GenerationLog[] = data.logs.map((log: any) => ({
                   timestamp: log.timestamp || new Date().toISOString(),
                   type: (log.level?.toLowerCase() || 'info') as 'info' | 'warning' | 'error',
                   message: log.message || 'Log message missing',
                   details: log.details
               }));
               // Overwrite logs with backend logs for final status
               setGenerationLogs(formattedLogs);
            }

            // Check if we have any errors in the response
            if (data.errors && data.errors.length > 0) {
                // Add errors to logs if not already present from backend logs
                data.errors.forEach(error => {
                    if (!generationLogs.some(log => log.message === error.message)) {
                       addGenerationLog("error", error.message, error.date || error.shift);
                    }
                });

                // Update UI to show errors
                updateGenerationStep("finalize", "error", "Fehler bei der Generierung");

                // Show error toast
                toast({
                    variant: "destructive",
                    title: "Generierung mit Warnungen",
                    description: `Schichtplan wurde generiert, enthält aber ${data.errors.length} Fehler oder Warnungen.`,
                });
            } else {
                // Show success toast with accurate count
                const generatedCount = data.schedules ? data.schedules.filter(s => s.shift_id !== null).length : 0;
                const totalEmployees = data.filtered_schedules || data.schedules?.length || 0;

                toast({
                    title: "Generierung erfolgreich",
                    description: `Schichtplan für ${totalEmployees} Mitarbeiter generiert mit ${generatedCount} zugewiesenen Schichten.`,
                });

                // Add success log
                addGenerationLog("info", "Generierung erfolgreich abgeschlossen",
                    `${generatedCount} Schichten wurden ${totalEmployees} Mitarbeitern zugewiesen.`);

                // Allow time for UI update before hiding overlay
                setTimeout(() => {
                    setShowGenerationOverlay(false);
                }, 1500);
            }

            // Invalidate queries to refresh data
            queryClient.invalidateQueries({ queryKey: ['schedules'] });

            // Call onSuccess callback if provided
            if (onSuccess) {
                onSuccess();
            }
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
            let backendLogs: GenerationLog[] = [];

            // Attempt to extract logs from the error response if available
            if (axios.isAxiosError(error) && error.response?.data?.logs) {
                backendLogs = error.response.data.logs.map((log: any) => ({
                    timestamp: log.timestamp || new Date().toISOString(),
                    type: (log.level?.toLowerCase() || 'error') as 'info' | 'warning' | 'error',
                    message: log.message || 'Log message missing',
                    details: log.details
                }));
            }

            // Add the main error message to the logs
            const errorLog: GenerationLog = {
                timestamp: new Date().toISOString(),
                type: 'error',
                message: `Fehler bei der Generierung: ${errorMessage}`,
            };

            // Combine extracted backend logs with the main error log
            setGenerationLogs(prev => [...prev, ...backendLogs, errorLog]);

            toast({
                variant: "destructive",
                title: "Fehler",
                description: `Fehler bei der Generierung: ${errorMessage}`,
            });

            // Don't auto-hide the overlay on error so user can see what happened
            // Mark any in-progress steps as error
            setGenerationSteps(prev =>
                prev.map(step => step.status === 'in-progress' ? { ...step, status: 'error', message: errorMessage } : step)
            );
        },
    });

    return {
        generationSteps,
        generationLogs,
        showGenerationOverlay,
        isPending: generateMutation.isPending,
        isError: generateMutation.isError,
        generate: generateMutation.mutate,
        resetGenerationState,
        addGenerationLog,
        clearGenerationLogs,
        updateGenerationStep
    };
}

export default useScheduleGeneration; 