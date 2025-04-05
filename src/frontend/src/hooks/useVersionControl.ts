import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { DateRange } from "react-day-picker";
import { format, getWeek } from "date-fns";
import {
  getAllVersions,
  createNewVersion,
  updateVersionStatus,
  duplicateVersion,
  type VersionResponse,
  type VersionMeta,
  deleteVersion,
} from "@/services/api";

interface UseVersionControlProps {
  dateRange: DateRange | undefined;
  onVersionSelected?: (version: number) => void;
}

export function useVersionControl({
  dateRange,
  onVersionSelected,
}: UseVersionControlProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>();

  // Query for versions
  const versionsQuery = useQuery<VersionResponse, Error>({
    queryKey: [
      "versions",
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
    ],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Date range is required");
      }

      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      const toStr = format(dateRange.to, "yyyy-MM-dd");

      return await getAllVersions(fromStr, toStr);
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
  });

  // Set selected version to the latest version for this week when versions change or week changes
  useEffect(() => {
    if (
      versionsQuery.data?.versions &&
      versionsQuery.data.versions.length > 0
    ) {
      // Sort by version number (descending) to get the latest version
      const sortedVersions = [...versionsQuery.data.versions].sort(
        (a, b) => b.version - a.version,
      );
      const latestVersion = sortedVersions[0].version;

      // Only update if not already selected
      if (!selectedVersion || selectedVersion !== latestVersion) {
        console.log(`🔄 Auto-selecting latest version (${latestVersion})`);
        setSelectedVersion(latestVersion);
        if (onVersionSelected) {
          onVersionSelected(latestVersion);
        }
      }
    } else {
      // If no versions are available, make sure we don't have a selected version
      if (selectedVersion !== undefined) {
        console.log("🔄 No versions available, clearing selected version");
        setSelectedVersion(undefined);
        if (onVersionSelected) {
          onVersionSelected(undefined as any);
        }
      }
    }
  }, [versionsQuery.data, onVersionSelected]);

  // Create version mutation
  const createVersionMutation = useMutation({
    mutationFn: async (params?: { startDate?: string; endDate?: string }) => {
      if (params?.startDate && params?.endDate) {
        // Use provided date range from params
        const data = {
          start_date: params.startDate,
          end_date: params.endDate,
          base_version: selectedVersion,
          notes: `New version for ${params.startDate} - ${params.endDate}`,
        };
        return await createNewVersion(data);
      } else if (dateRange?.from && dateRange?.to) {
        // Use the date range from the component state
        const fromStr = format(dateRange.from, "yyyy-MM-dd");
        const toStr = format(dateRange.to, "yyyy-MM-dd");

        const data = {
          start_date: fromStr,
          end_date: toStr,
          base_version: selectedVersion,
          notes: `New version for week ${getWeek(dateRange.from)} (${format(dateRange.from, "dd.MM.yyyy")} - ${format(dateRange.to, "dd.MM.yyyy")})`,
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

      // Invalidate schedule queries
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Erstellen der neuen Version: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
        variant: "destructive",
      });
    },
  });

  // Update version status mutation
  const updateVersionStatusMutation = useMutation({
    mutationFn: (params: {
      version: number;
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    }) => updateVersionStatus(params.version, { status: params.status }),
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Version ${data.version} status updated to ${data.status}`,
      });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["versions"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update version status: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
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
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["versions"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to duplicate version: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  // Delete version mutation
  const deleteVersionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVersion) throw new Error("No version selected");
      return await deleteVersion(selectedVersion);
    },
    onSuccess: (data) => {
      toast({
        title: "Version gelöscht",
        description: `Version ${selectedVersion} wurde erfolgreich gelöscht. ${data.deleted_schedules_count} Schichtpläne wurden entfernt.`,
        variant: "default",
      });
      // Refresh versions list after delete
      queryClient.invalidateQueries({ queryKey: ["versions"] });

      // Get the current versions from the query data
      const currentVersions =
        versionsQuery.data?.versions.map((v) => v.version) || [];

      // If we deleted the currently selected version, select a new one
      if (
        currentVersions.length > 0 &&
        currentVersions[0] !== selectedVersion
      ) {
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
      console.error("Error deleting version:", error);
      toast({
        title: "Fehler beim Löschen der Version",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleVersionChange = (version: number) => {
    console.log(`🔢 Changing selected version to: ${version}`);
    setSelectedVersion(version);
    if (onVersionSelected) {
      console.log(
        `🔄 Triggering onVersionSelected callback with version ${version}`,
      );
      onVersionSelected(version);
    } else {
      console.log(`⚠️ No onVersionSelected callback provided`);
    }
  };

  const handleCreateNewVersion = () => {
    console.log(
      `🆕 Creating new version for date range: ${dateRange?.from?.toISOString()} - ${dateRange?.to?.toISOString()}`,
    );
    createVersionMutation.mutate();
  };

  const handleCreateNewVersionWithOptions = (options: {
    dateRange: DateRange;
    weekAmount: number;
  }) => {
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
    const fromStr = format(options.dateRange.from, "yyyy-MM-dd");
    const toStr = format(options.dateRange.to, "yyyy-MM-dd");

    // Create with the specific date range
    createVersionMutation.mutate({
      startDate: fromStr,
      endDate: toStr,
    });
  };

  const handlePublishVersion = (version: number) => {
    updateVersionStatusMutation.mutate({ version, status: "PUBLISHED" });
  };

  const handleArchiveVersion = (version: number) => {
    updateVersionStatusMutation.mutate({ version, status: "ARCHIVED" });
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
        start_date: format(dateRange.from, "yyyy-MM-dd"),
        end_date: format(dateRange.to, "yyyy-MM-dd"),
      });
    }
  };

  return {
    versions: versionsQuery.data?.versions?.map((v) => v.version) || [],
    versionMetas: versionsQuery.data?.versions || [],
    selectedVersion,
    isLoading:
      versionsQuery.isLoading ||
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
    handleDuplicateVersion,
  };
}

export default useVersionControl;
