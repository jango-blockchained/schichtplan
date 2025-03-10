// Backup of unused code removed from SchedulePage.tsx

// Duplicate version control handlers - these are redundant with the handleVersionXXX functions
const handlePublishVersion = async (version: number) => {
    if (version) {
        try {
            const result = await publishSchedule(version);
            toast({
                title: "Version Published",
                description: `Version ${version} has been published successfully.`,
            });

            // Refetch schedules to update status
            refetchSchedules();
        } catch (error) {
            toast({
                title: "Publish Error",
                description: "Failed to publish version.",
                variant: "destructive",
            });
        }
    }
};

const handleArchiveVersion = async (version: number) => {
    if (version) {
        try {
            const result = await archiveSchedule(version);
            toast({
                title: "Version Archived",
                description: `Version ${version} has been archived successfully.`,
            });

            // Refetch schedules to update status
            refetchSchedules();
        } catch (error) {
            toast({
                title: "Archive Error",
                description: "Failed to archive version.",
                variant: "destructive",
            });
        }
    }
};

const handleDuplicateVersion = async (version: number) => {
    if (version) {
        try {
            // Open duplicate dialog with the selected version pre-filled
            setDuplicateSourceVersion(version);
            setIsDuplicateVersionOpen(true);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to prepare version duplication.",
                variant: "destructive",
            });
        }
    }
};

// Unused comparison functions and state
const handleCompareVersions = async () => {
    if (!selectedVersion || !versionToCompare) {
        toast({
            title: "Error",
            description: "Please select both versions to compare",
            variant: "destructive",
        });
        return;
    }

    setIsComparingVersions(true);
    try {
        const results = await compareVersions(selectedVersion, versionToCompare);
        setComparisonResults(results);
    } catch (error) {
        toast({
            title: "Error",
            description: `Failed to compare versions: ${error}`,
            variant: "destructive",
        });
    } finally {
        setIsComparingVersions(false);
    }
};

// Unused state variables
const [duplicateVersionDialogOpen, setDuplicateVersionDialogOpen] = useState(false);
const [versionToCompare, setVersionToCompare] = useState<number | null>(null);
const [comparisonResults, setComparisonResults] = useState<any>(null);
const [isComparingVersions, setIsComparingVersions] = useState(false);

// Unused/redundant version management functions
const handleVersionCreate = async () => {
    if (!dateRange?.from || !dateRange?.to) {
        toast({
            title: "Fehler",
            description: "Bitte wählen Sie einen Datumsbereich aus",
            variant: "destructive"
        });
        return;
    }

    try {
        const result = await createNewVersion({
            start_date: format(dateRange.from, 'yyyy-MM-dd'),
            end_date: format(dateRange.to, 'yyyy-MM-dd'),
            base_version: selectedVersion
        });

        toast({
            title: "Erfolg",
            description: `Neue Version ${result.version} wurde erstellt`
        });

        setSelectedVersion(result.version);
        await refetch();
    } catch (error) {
        toast({
            title: "Fehler",
            description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
            variant: "destructive"
        });
    }
};

// Duplicate fetch functions
const fetchData = () => {
    void queryClient.invalidateQueries({
        queryKey: ['schedules'],
        exact: false
    });
};

// Redundant generation mutation with timeout
const generateMutation = useMutation({
    mutationFn: async () => {
        try {
            if (!dateRange?.from || !dateRange?.to) {
                throw new Error("Bitte wählen Sie einen Zeitraum aus");
            }

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
                addGenerationLog("info", "Initialisiere Generierung");
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

                const result = await generateSchedule(
                    fromStr,
                    toStr,
                    createEmptySchedules
                );

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
        toast({
            title: "Erfolg",
            description: `Schichtplan für ${scheduleData.length} Mitarbeiter generiert`,
        });

        // Allow time for UI update before hiding overlay
        setTimeout(() => {
            setShowGenerationOverlay(false);
        }, 1500);
    },
    onError: (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";

        toast({
            variant: "destructive",
            title: "Fehler",
            description: `Fehler bei der Generierung: ${errorMessage}`,
        });

        // Don't auto-hide the overlay on error so user can see what happened
    },
});

// Unused loading skeleton 
const ScheduleTableSkeleton = () => (
    <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <div className="grid grid-cols-7 gap-2">
            {Array(7).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-10" />
            ))}
        </div>
        {Array(5).fill(0).map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-2">
                {Array(7).fill(0).map((_, j) => (
                    <Skeleton key={j} className="h-16" />
                ))}
            </div>
        ))}
    </div>
);

// Redundant version management functions with slightly different implementations
const handleVersionDuplicate = async () => {
    if (!dateRange?.from || !dateRange?.to || !selectedVersion) {
        toast({
            title: "Fehler",
            description: "Bitte wählen Sie einen Datumsbereich und eine Version aus",
            variant: "destructive"
        });
        return;
    }

    try {
        const result = await duplicateVersion({
            source_version: selectedVersion,
            start_date: format(dateRange.from, 'yyyy-MM-dd'),
            end_date: format(dateRange.to, 'yyyy-MM-dd')
        });

        toast({
            title: "Erfolg",
            description: `Version ${result.version} wurde dupliziert`
        });

        setSelectedVersion(result.version);
        await refetch();
    } catch (error) {
        toast({
            title: "Fehler",
            description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
            variant: "destructive"
        });
    }
};

const handleVersionArchive = async () => {
    if (!selectedVersion) {
        toast({
            title: "Fehler",
            description: "Bitte wählen Sie eine Version aus",
            variant: "destructive"
        });
        return;
    }

    try {
        await archiveSchedule(selectedVersion);
        toast({
            title: "Erfolg",
            description: `Version ${selectedVersion} wurde archiviert`
        });
        await refetch();
    } catch (error) {
        toast({
            title: "Fehler",
            description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
            variant: "destructive"
        });
    }
};

const handleVersionPublish = async () => {
    if (!selectedVersion) {
        toast({
            title: "Fehler",
            description: "Bitte wählen Sie eine Version aus",
            variant: "destructive"
        });
        return;
    }

    try {
        await publishSchedule(selectedVersion);
        toast({
            title: "Erfolg",
            description: `Version ${selectedVersion} wurde veröffentlicht`
        });
        await refetch();
    } catch (error) {
        toast({
            title: "Fehler",
            description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
            variant: "destructive"
        });
    }
};

// Unused version comparison function (not used in render)
const handleVersionCompare = async (compareVersion: number) => {
    if (!selectedVersion) {
        toast({
            title: "Fehler",
            description: "Bitte wählen Sie eine Version aus",
            variant: "destructive"
        });
        return;
    }

    try {
        const result = await compareVersions(selectedVersion, compareVersion);
        // Handle comparison result (e.g., show in a modal)
        console.log('Version comparison:', result);
    } catch (error) {
        toast({
            title: "Fehler",
            description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten",
            variant: "destructive"
        });
    }
};

// Unused skeleton component
if (isLoading && !scheduleData) {
    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <Skeleton className="h-10 w-48" />
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
            <Card className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableCell>
                                <Skeleton className="h-6 w-32" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-6 w-20" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-6 w-24" />
                            </TableCell>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <TableCell key={i}>
                                    <Skeleton className="h-6 w-24" />
                                </TableCell>
                            ))}
                            <TableCell>
                                <Skeleton className="h-6 w-24" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-6 w-24" />
                            </TableCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell>
                                    <Skeleton className="h-24 w-32" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-24 w-20" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-24 w-24" />
                                </TableCell>
                                {Array.from({ length: 6 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-24 w-24" />
                                    </TableCell>
                                ))}
                                <TableCell>
                                    <Skeleton className="h-24 w-24" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-24 w-24" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}

// Redundant version note management functions
const confirmDuplicateVersion = () => {
    if (!selectedVersion || !dateRange?.from || !dateRange?.to) return;

    duplicateVersionMutation.mutate({
        source_version: selectedVersion,
        start_date: dateRange.from.toISOString().split('T')[0],
        end_date: dateRange.to.toISOString().split('T')[0],
        notes: versionNotes
    });
};

const handleUpdateNotes = () => {
    if (!selectedVersion) {
        toast({
            title: "Error",
            description: "Please select a version first",
            variant: "destructive",
        });
        return;
    }

    if (data?.version_meta?.notes) {
        setVersionNotes(data.version_meta.notes);
    } else {
        setVersionNotes('');
    }
    setIsEditingNotes(true);
};

const saveVersionNotes = () => {
    if (!selectedVersion) return;

    updateVersionNotesMutation.mutate({
        version: selectedVersion,
        notes: versionNotes
    });
    setIsEditingNotes(false);
}; 