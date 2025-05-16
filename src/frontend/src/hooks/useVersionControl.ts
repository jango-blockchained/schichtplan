import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { DateRange } from "react-day-picker";
import { format, getWeek, getMonth, getYear } from "date-fns";
import {
  getAllVersions,
  createNewVersion,
  updateVersionStatus,
  duplicateVersion,
  type VersionResponse,
  type VersionMeta,
  deleteVersion,
  updateVersionNotes,
  getVersions as fetchVersions,
  getVersionMetas,
  createNewVersion as apiCreateNewVersion,
  archiveVersion as apiArchiveVersion,
  duplicateVersion as apiDuplicateVersion,
  createVersion as apiCreateVersion,
} from "@/services/api";

interface UseVersionControlProps {
  dateRange: DateRange | undefined;
  onVersionSelected?: (version: number) => void;
  initialVersion?: number;
}

export function useVersionControl({
  dateRange,
  onVersionSelected,
  initialVersion,
}: UseVersionControlProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(
    initialVersion,
  );

  // Track if the user has explicitly made a selection to prevent auto-selection override
  const [userHasManuallySelected, setUserHasManuallySelected] =
    useState<boolean>(!!initialVersion);

  // Track the current date range key to detect when it changes
  const previousDateRangeRef = useRef<string | null>(null);
  const currentDateRangeKey =
    dateRange?.from?.toISOString() + "-" + dateRange?.to?.toISOString();

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

  // Reset manual selection flag when date range changes
  useEffect(() => {
    if (
      previousDateRangeRef.current !== null &&
      previousDateRangeRef.current !== currentDateRangeKey
    ) {
      console.log("📅 Date range changed, resetting manual selection flag");
      setUserHasManuallySelected(false);
    }

    previousDateRangeRef.current = currentDateRangeKey;
  }, [currentDateRangeKey]);

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

      console.log("🔄 Version selection logic:", {
        selectedVersion,
        userHasManuallySelected,
        availableVersions: sortedVersions.map((v) => v.version),
        dateRange: {
          from: dateRange?.from?.toISOString(),
          to: dateRange?.to?.toISOString(),
        },
      });

      // Only auto-select if no version is currently selected AND the user hasn't manually selected a version
      if (selectedVersion === undefined && !userHasManuallySelected) {
        console.log(
          `🔄 Auto-selecting latest version (${latestVersion}) because no version was selected`,
        );
        setSelectedVersion(latestVersion);
        if (onVersionSelected) {
          onVersionSelected(latestVersion);
        }
      } else if (
        !versionsQuery.data.versions.some((v) => v.version === selectedVersion)
      ) {
        // Selected version is no longer available - must switch to another version
        console.log(
          `🔄 Selected version ${selectedVersion} is no longer available, switching to ${latestVersion}`,
        );
        setSelectedVersion(latestVersion);
        if (onVersionSelected) {
          onVersionSelected(latestVersion);
        }
        // Don't track this as a manual selection since it's a fallback
        setUserHasManuallySelected(false);
      }
    } else {
      // If no versions are available, make sure we don't have a selected version
      if (selectedVersion !== undefined) {
        console.log("🔄 No versions available, clearing selected version");
        setSelectedVersion(undefined);
        if (onVersionSelected) {
          onVersionSelected(undefined as any);
        }
        // Reset manual selection flag since there's nothing to select
        setUserHasManuallySelected(false);
      }
    }
  }, [
    versionsQuery.data,
    onVersionSelected,
    selectedVersion,
    dateRange,
    userHasManuallySelected,
  ]);

  // Create version mutation
  const createVersionMutation = useMutation({
    mutationFn: async (
      options: {
        startDate?: string;
        endDate?: string;
        isUserInitiated?: boolean;
      } = {},
    ) => {
      // Default to using the current dateRange if not provided
      const startDate =
        options.startDate ||
        (dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined);
      const endDate =
        options.endDate ||
        (dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined);

      // Ensure we have dates to work with
      if (!startDate || !endDate) {
        throw new Error("Date range is required to create a version");
      }

      return createNewVersion(startDate, endDate);
    },
    onSuccess: (data, variables) => {
      console.log(
        "💡 New version created:",
        data.version,
        "Variables:",
        variables,
      );

      toast({
        title: "Neue Version erstellt",
        description: `Version ${data.version} wurde erfolgreich erstellt.`,
      });

      // Automatically select the new version
      console.log("🔄 Selecting newly created version:", data.version);
      setSelectedVersion(data.version);

      // For version creation, we want automatic selection to work without being overridden
      // Reset the user manual selection flag to allow the selection to take effect
      console.log("🔄 Resetting userHasManuallySelected flag");
      setUserHasManuallySelected(false);

      if (onVersionSelected) {
        console.log(
          "🔄 Calling onVersionSelected callback with version:",
          data.version,
        );
        onVersionSelected(data.version);
      }

      // Refresh the versions list
      versionsQuery.refetch();
    },
    onError: (error) => {
      console.error("❌ Error creating version:", error);
      toast({
        title: "Fehler beim Erstellen der Version",
        description:
          error instanceof Error
            ? error.message
            : "Ein unerwarteter Fehler ist aufgetreten",
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
    mutationFn: async (version: number) => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Date range is required to duplicate a version");
      }

      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      const toStr = format(dateRange.to, "yyyy-MM-dd");
      const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");

      const data = {
        start_date: fromStr,
        end_date: toStr,
        source_version: version,
        notes: `Duplicate of Version ${version} [Created: ${timestamp}]`,
      };

      return await duplicateVersion(data);
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Version ${data.version} created as a duplicate`,
      });
      setSelectedVersion(data.version);
      setUserHasManuallySelected(true); // Mark as manual since user explicitly created this
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

  // --- Start: New mutation for updating version details (like notes) ---
  const updateVersionDetailsMutation = useMutation({
    mutationFn: async (params: {
      versionId: number;
      details: { notes?: string };
    }) => {
      // Call the real API function
      if (params.details.notes === undefined) {
        // Should not happen with current logic
        throw new Error("Notes cannot be undefined when updating.");
      }
      return await updateVersionNotes(params.versionId, {
        notes: params.details.notes,
      });
    },
    onSuccess: (updatedVersionData) => {
      toast({
        title: "Version aktualisiert",
        description: `Notiz für Version ${updatedVersionData.version} erfolgreich gesetzt auf: ${updatedVersionData.notes}`,
      });
      // Refresh versions query to show updated notes
      queryClient.invalidateQueries({ queryKey: ["versions"] });
    },
    onError: (error, variables) => {
      toast({
        title: "Fehler bei Notizaktualisierung",
        description: `Notiz für Version ${variables.versionId} konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
        variant: "destructive",
      });
    },
  });
  // --- End: New mutation for updating version details ---

  const handleVersionChange = (version: number) => {
    console.log(`🔢 Changing selected version to: ${version}`);
    // Mark this as a manual user selection
    setUserHasManuallySelected(true);
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

  const handleCreateNewVersion = (isUserInitiated: boolean = true) => {
    console.log(
      `🆕 Creating new version for date range: ${dateRange?.from?.toISOString()} - ${dateRange?.to?.toISOString()}, user-initiated: ${isUserInitiated}`,
    );
    createVersionMutation.mutate({ isUserInitiated });
  };

  const handleCreateNewVersionWithOptions = (options: {
    dateRange: DateRange;
    weekAmount: number;
    isUserInitiated?: boolean;
  }) => {
    if (!options.dateRange.from || !options.dateRange.to) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen gültigen Zeitraum aus.",
        variant: "destructive",
      });
      return;
    }

    // Get isUserInitiated from options or default to true
    const isUserInitiated = options.isUserInitiated !== false;
    console.log(
      `🆕 Creating new version with custom options:`,
      options,
      `user-initiated: ${isUserInitiated}`,
    );

    // Format dates for API
    const fromStr = format(options.dateRange.from, "yyyy-MM-dd");
    const toStr = format(options.dateRange.to, "yyyy-MM-dd");

    // Create with the specific date range
    createVersionMutation.mutate({
      startDate: fromStr,
      endDate: toStr,
      isUserInitiated,
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
      duplicateVersionMutation.mutate(version);
    }
  };

  const createNewVersion = async (startDate: string, endDate: string) => {
    console.log(`📝 Creating new version for dates ${startDate} to ${endDate}`);

    const data = {
      start_date: startDate,
      end_date: endDate,
      notes: `NEW BLANK VERSION - Empty schedules for ${startDate} - ${endDate} [Created: ${new Date().toISOString().slice(0, 16).replace("T", " ")}]`,
    };

    try {
      const response = await apiCreateNewVersion(data);
      console.log(`📝 Version created successfully:`, response);
      return response;
    } catch (error) {
      console.error("Error creating version:", error);
      throw error;
    }
  };

  return {
    versions: versionsQuery.data?.versions.map((v) => v.version) || [],
    versionMetas: versionsQuery.data?.versions || [],
    selectedVersion,
    isManuallySelected: userHasManuallySelected, // Expose the manual selection state
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
    // Method to explicitly reset the manual selection flag if needed
    resetManualSelection: () => setUserHasManuallySelected(false),
  };
}

export default useVersionControl;
