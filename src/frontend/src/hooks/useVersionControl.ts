import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { DateRange } from 'react-day-picker';
import { format, getWeek, getMonth, getYear } from 'date-fns';
import {
    getAllVersions,
    createNewVersion,
    updateVersionStatus,
    duplicateVersion,
    type VersionResponse,
    type VersionMeta,
    deleteVersion,
    updateVersionNotes,
} from '@/services/api';

interface UseVersionControlProps {
    dateRange: DateRange | undefined;
    onVersionSelected?: (version: number) => void;
    initialVersion?: number;
}

export function useVersionControl({ dateRange, onVersionSelected, initialVersion }: UseVersionControlProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedVersion, setSelectedVersion] = useState<number | undefined>(initialVersion);

    // Query for versions
    const versionsQuery = useQuery<VersionResponse, Error>({
        queryKey: ['versions', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
        queryFn: async () => {
            if (!dateRange?.from || !dateRange?.to) {
                throw new Error("Date range is required");
            }

            const fromStr = format(dateRange.from, 'yyyy-MM-dd');
            const toStr = format(dateRange.to, 'yyyy-MM-dd');

            return await getAllVersions(fromStr, toStr);
        },
        enabled: !!dateRange?.from && !!dateRange?.to,
    });

    // Set selected version to the latest version for this week when versions change or week changes
    useEffect(() => {
        if (versionsQuery.data?.versions && versionsQuery.data.versions.length > 0) {
            // Sort by version number (descending) to get the latest version
            const sortedVersions = [...versionsQuery.data.versions].sort((a, b) => b.version - a.version);
            const latestVersion = sortedVersions[0].version;

            // Only auto-select if no version is currently selected
            if (selectedVersion === undefined) {
                console.log(`🔄 Auto-selecting latest version (${latestVersion}) because no version was selected`);
                setSelectedVersion(latestVersion);
                if (onVersionSelected) {
                    onVersionSelected(latestVersion);
                }
            } else if (!versionsQuery.data.versions.some(v => v.version === selectedVersion)) {
                console.log(`🔄 Selected version ${selectedVersion} is no longer available, switching to ${latestVersion}`);
                setSelectedVersion(latestVersion);
                if (onVersionSelected) {
                    onVersionSelected(latestVersion);
                }
            }
        } else {
            // If no versions are available, make sure we don't have a selected version
            if (selectedVersion !== undefined) {
                console.log('🔄 No versions available, clearing selected version');
                setSelectedVersion(undefined);
                if (onVersionSelected) {
                    onVersionSelected(undefined as any);
                }
            }
        }
    }, [versionsQuery.data, onVersionSelected, selectedVersion, dateRange]);

    // Create version mutation
    const createVersionMutation = useMutation({
        mutationFn: async (params?: { startDate?: string; endDate?: string; }) => {
            if (params?.startDate && params?.endDate) {
                // Use provided date range from params
                const data = {
                    start_date: params.startDate,
                    end_date: params.endDate,
                    base_version: selectedVersion,
                    notes: `New version for ${params.startDate} - ${params.endDate}`
                };
                return await createNewVersion(data);
            } else if (dateRange?.from && dateRange?.to) {
                // Use the date range from the component state
                const fromStr = format(dateRange.from, 'yyyy-MM-dd');
                const toStr = format(dateRange.to, 'yyyy-MM-dd');

                const data = {
                    start_date: fromStr,
                    end_date: toStr,
                    base_version: selectedVersion,
                    notes: `New version for week ${getWeek(dateRange.from)} (${format(dateRange.from, 'dd.MM.yyyy')} - ${format(dateRange.to, 'dd.MM.yyyy')})`
                };

                return await createNewVersion(data);
            } else {
                throw new Error("Please select a date range");
            }
        },
        onSuccess: (data) => {
            toast({
                title: "Neue Version erstellt",
                description: `Version ${data.version} wurde erfolgreich erstellt.`,
            });

            // Automatically select the new version
            setSelectedVersion(data.version);
            if (onVersionSelected) {
                onVersionSelected(data.version);
            }

            // Refresh the versions list
            versionsQuery.refetch();

            // --- Start: Generate and set the structured note ---
            if (data.version && data.start_date) {
                try {
                    const startDate = new Date(data.start_date + 'T00:00:00'); // Ensure correct date parsing
                    const calendarWeek = getWeek(startDate, { weekStartsOn: 1 });
                    const month = getMonth(startDate) + 1; // getMonth is 0-indexed
                    const year = getYear(startDate) % 100; // Get last two digits of year

                    const generatedNote = `SCH-${String(calendarWeek).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(year).padStart(2, '0')}-${data.version}`;
                    
                    updateVersionDetailsMutation.mutate({ versionId: data.version, details: { notes: generatedNote } });
                } catch (e) {
                    console.error("Error generating or setting structured note:", e);
                    toast({
                        title: "Hinweis",
                        description: "Version erstellt, aber der automatische Notizname konnte nicht gesetzt werden.",
                        variant: "default" // Or warning
                    });
                }
            }
            // --- End: Generate and set the structured note ---

            // Invalidate schedule queries
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
        },
        onError: (error) => {
            toast({
                title: "Fehler",
                description: `Fehler beim Erstellen der neuen Version: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
                variant: "destructive",
            });
        }
    });

    // Update version status mutation
    const updateVersionStatusMutation = useMutation({
        mutationFn: (params: { version: number, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }) =>
            updateVersionStatus(params.version, { status: params.status }),
        onSuccess: (data) => {
            toast({
                title: "Success",
                description: `Version ${data.version} status updated to ${data.status}`,
            });
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
            queryClient.invalidateQueries({ queryKey: ['versions'] });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to update version status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: "destructive",
            });
        }
    });

    // Duplicate version mutation
    const duplicateVersionMutation = useMutation({
        mutationFn: duplicateVersion,
        onSuccess: (data) => {
            toast({
                title: "Success",
                description: `Version ${data.version} created as a duplicate`,
            });
            setSelectedVersion(data.version);
            if (onVersionSelected) {
                onVersionSelected(data.version);
            }
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
            queryClient.invalidateQueries({ queryKey: ['versions'] });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to duplicate version: ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: "destructive",
            });
        }
    });

    // Delete version mutation
    const deleteVersionMutation = useMutation({
        mutationFn: async () => {
            if (!selectedVersion) throw new Error('No version selected');
            return await deleteVersion(selectedVersion);
        },
        onSuccess: (data) => {
            toast({
                title: 'Version gelöscht',
                description: `Version ${selectedVersion} wurde erfolgreich gelöscht. ${data.deleted_schedules_count} Schichtpläne wurden entfernt.`,
                variant: 'default',
            });
            // Refresh versions list after delete
            queryClient.invalidateQueries({ queryKey: ['versions'] });

            // Get the current versions from the query data
            const currentVersions = versionsQuery.data?.versions.map(v => v.version) || [];

            // If we deleted the currently selected version, select a new one
            if (currentVersions.length > 0 && currentVersions[0] !== selectedVersion) {
                setSelectedVersion(currentVersions[0]);
                if (onVersionSelected) {
                    onVersionSelected(currentVersions[0]);
                }
            } else {
                setSelectedVersion(undefined);
                if (onVersionSelected) {
                    onVersionSelected(undefined as any); // Cast to any to avoid type error
                }
            }
        },
        onError: (error: Error) => {
            console.error('Error deleting version:', error);
            toast({
                title: 'Fehler beim Löschen der Version',
                description: error.message,
                variant: 'destructive',
            });
        }
    });

    // --- Start: New mutation for updating version details (like notes) ---
    const updateVersionDetailsMutation = useMutation({
        mutationFn: async (params: { versionId: number; details: { notes?: string } }) => {
            // Call the real API function
            if (params.details.notes === undefined) { // Should not happen with current logic
                throw new Error("Notes cannot be undefined when updating.");
            }
            return await updateVersionNotes(params.versionId, params.details.notes);
        },
        onSuccess: (updatedVersionData) => {
            toast({
                title: "Version aktualisiert",
                description: `Notiz für Version ${updatedVersionData.version} erfolgreich gesetzt auf: ${updatedVersionData.notes}`,
            });
            // Refresh versions query to show updated notes
            queryClient.invalidateQueries({ queryKey: ['versions'] });
        },
        onError: (error, variables) => {
            toast({
                title: "Fehler bei Notizaktualisierung",
                description: `Notiz für Version ${variables.versionId} konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
                variant: "destructive",
            });
        }
    });
    // --- End: New mutation for updating version details ---

    const handleVersionChange = (version: number) => {
        console.log(`🔢 Changing selected version to: ${version}`);
        setSelectedVersion(version);
        if (onVersionSelected) {
            console.log(`🔄 Triggering onVersionSelected callback with version ${version}`);
            onVersionSelected(version);
        } else {
            console.log(`⚠️ No onVersionSelected callback provided`);
        }
    };

    const handleCreateNewVersion = () => {
        console.log(`🆕 Creating new version for date range: ${dateRange?.from?.toISOString()} - ${dateRange?.to?.toISOString()}`);
        createVersionMutation.mutate();
    };

    const handleCreateNewVersionWithOptions = (options: { dateRange: DateRange; weekAmount: number }) => {
        if (!options.dateRange.from || !options.dateRange.to) {
            toast({
                title: "Fehler",
                description: "Bitte wählen Sie einen gültigen Zeitraum aus.",
                variant: "destructive",
            });
            return;
        }

        console.log(`🆕 Creating new version with custom options:`, options);

        // Format dates for API
        const fromStr = format(options.dateRange.from, 'yyyy-MM-dd');
        const toStr = format(options.dateRange.to, 'yyyy-MM-dd');

        // Create with the specific date range
        createVersionMutation.mutate({
            startDate: fromStr,
            endDate: toStr
        });
    };

    const handlePublishVersion = (version: number) => {
        updateVersionStatusMutation.mutate({ version, status: 'PUBLISHED' });
    };

    const handleArchiveVersion = (version: number) => {
        updateVersionStatusMutation.mutate({ version, status: 'ARCHIVED' });
    };

    const handleDeleteVersion = (version: number) => {
        // Set the version to delete
        setSelectedVersion(version);
        // Then trigger deletion
        deleteVersionMutation.mutate();
    };

    const handleDuplicateVersion = (version: number) => {
        if (dateRange?.from && dateRange?.to) {
            duplicateVersionMutation.mutate({
                source_version: version,
                start_date: format(dateRange.from, 'yyyy-MM-dd'),
                end_date: format(dateRange.to, 'yyyy-MM-dd')
            });
        }
    };

    return {
        versions: versionsQuery.data?.versions.map(v => v.version) || [],
        versionMetas: versionsQuery.data?.versions || [],
        selectedVersion,
        isLoading: versionsQuery.isLoading ||
            createVersionMutation.isPending ||
            updateVersionStatusMutation.isPending ||
            duplicateVersionMutation.isPending ||
            deleteVersionMutation.isPending,
        isError: versionsQuery.isError,
        refetch: versionsQuery.refetch,
        handleVersionChange,
        handleCreateNewVersion,
        handleCreateNewVersionWithOptions,
        handlePublishVersion,
        handleArchiveVersion,
        handleDeleteVersion,
        handleDuplicateVersion
    };
}

export default useVersionControl; 