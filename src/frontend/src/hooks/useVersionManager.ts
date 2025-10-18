/**
 * Unified version management hook for the Schichtplan application.
 *
 * This hook provides a clean, simplified interface for managing versions,
 * replacing the complex logic in useVersionControl and useWeekBasedVersionControl.
 */

import { useToast } from "@/components/ui/use-toast";
import {
  createNewVersion as apiCreateNewVersion,
  deleteVersion,
  duplicateVersion,
  getAllVersions,
  updateVersionNotes,
  updateVersionStatus,
  type VersionMeta,
  type VersionResponse,
} from "@/services/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import { DateRange } from "react-day-picker";

interface UseVersionManagerProps {
  dateRange?: DateRange;
  onVersionSelected?: (version: number | undefined) => void;
  autoSelectLatest?: boolean;
}

interface VersionManagerState {
  versions: VersionMeta[];
  selectedVersion: number | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

interface VersionActions {
  selectVersion: (version: number | undefined) => void;
  resetVersionSelection: () => void;
  createVersion: (options?: CreateVersionOptions) => void;
  updateVersionStatus: (
    version: number,
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
  ) => void;
  updateVersionNotes: (version: number, notes: string) => void;
  deleteVersion: (version: number) => void;
  duplicateVersion: (
    version: number,
    options?: DuplicateVersionOptions,
  ) => void;
  refetch: () => void;
}

interface CreateVersionOptions {
  startDate?: string;
  endDate?: string;
  baseVersion?: number;
  notes?: string;
}

interface DuplicateVersionOptions {
  startDate?: string;
  endDate?: string;
  weekVersion?: string;
  notes?: string;
}

export interface UseVersionManagerReturn {
  state: VersionManagerState;
  actions: VersionActions;
}

/**
 * Unified version management hook
 */
export function useVersionManager({
  dateRange,
  onVersionSelected,
  autoSelectLatest = true,
}: UseVersionManagerProps = {}): UseVersionManagerReturn {
  const { toast } = useToast();
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>();

  // Track previous date range to detect changes
  const prevDateRangeRef = useRef<string | null>(null);
  const currentDateRangeKey =
    dateRange?.from?.toISOString() + "-" + dateRange?.to?.toISOString();

  // Use ref to store onVersionSelected to avoid dependency issues
  const onVersionSelectedRef = useRef(onVersionSelected);
  onVersionSelectedRef.current = onVersionSelected;

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

  // Consolidated effect: Handle date range changes and version selection
  // This replaces the two separate useEffect hooks that were causing race conditions
  useEffect(() => {
    // Skip if dateRange is undefined (external versions mode)
    if (!dateRange?.from || !dateRange?.to) {
      return;
    }

    const versions = versionsQuery.data?.versions || [];
    const dateRangeChanged =
      prevDateRangeRef.current !== null &&
      prevDateRangeRef.current !== currentDateRangeKey;

    // Update the previous date range reference
    prevDateRangeRef.current = currentDateRangeKey;

    // If date range changed, clear selection immediately
    if (dateRangeChanged) {
      if (process.env.NODE_ENV === "development") {
        console.log("📅 Date range changed, clearing version selection");
      }
      setSelectedVersion(undefined);
      onVersionSelectedRef.current?.(undefined);
      // Don't return here - continue to process new versions if available
    }

    // Only proceed with version selection if query is complete
    if (versionsQuery.isLoading || versionsQuery.isError) {
      return;
    }

    // Handle version selection based on available versions
    if (versions.length === 0) {
      // No versions available - ensure selection is cleared
      if (selectedVersion !== undefined) {
        if (process.env.NODE_ENV === "development") {
          console.log("📅 No versions available, clearing selection");
        }
        setSelectedVersion(undefined);
        onVersionSelectedRef.current?.(undefined);
      }
      return;
    }

    // Check if currently selected version is valid for current date range
    const isSelectedVersionValid =
      selectedVersion !== undefined &&
      versions.some((v) => v.version === selectedVersion);

    if (!isSelectedVersionValid) {
      // Invalid or no selection - auto-select latest if enabled
      if (autoSelectLatest) {
        const latestVersion = Math.max(...versions.map((v) => v.version));
        if (process.env.NODE_ENV === "development") {
          console.log("📅 Auto-selecting latest version:", latestVersion);
        }
        setSelectedVersion(latestVersion);
        onVersionSelectedRef.current?.(latestVersion);
      } else if (selectedVersion !== undefined) {
        // Clear invalid selection when auto-select is disabled
        if (process.env.NODE_ENV === "development") {
          console.log("📅 Clearing invalid version selection");
        }
        setSelectedVersion(undefined);
        onVersionSelectedRef.current?.(undefined);
      }
    }
  }, [
    currentDateRangeKey,
    dateRange?.from,
    dateRange?.to,
    versionsQuery.data,
    versionsQuery.isLoading,
    versionsQuery.isError,
    autoSelectLatest,
    selectedVersion,
  ]);

  // Create version mutation
  const createVersionMutation = useMutation({
    mutationFn: async (options: CreateVersionOptions = {}) => {
      const startDate =
        options.startDate ||
        (dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined);
      const endDate =
        options.endDate ||
        (dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined);

      if (!startDate || !endDate) {
        throw new Error("Date range is required to create a version");
      }

      return apiCreateNewVersion({
        start_date: startDate,
        end_date: endDate,
        base_version: options.baseVersion,
        notes: options.notes,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Version erstellt",
        description: `Version ${data.version} wurde erfolgreich erstellt.`,
      });

      // Auto-select the new version
      setSelectedVersion(data.version);
      onVersionSelectedRef.current?.(data.version);

      // Refresh versions
      versionsQuery.refetch();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen der Version",
        description:
          error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  // Update version status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      version,
      status,
    }: {
      version: number;
      status: string;
    }) => {
      return await updateVersionStatus(version, {
        status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Version aktualisiert",
        description: `Version ${data.version} Status wurde auf ${data.status} geändert.`,
      });
      versionsQuery.refetch();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren der Version",
        description:
          error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  // Update version notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({
      version,
      notes,
    }: {
      version: number;
      notes: string;
    }) => {
      return await updateVersionNotes(version, { notes });
    },
    onSuccess: (data) => {
      toast({
        title: "Notizen aktualisiert",
        description: `Notizen für Version ${data.version} wurden aktualisiert.`,
      });
      versionsQuery.refetch();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren der Notizen",
        description:
          error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  // Delete version mutation
  const deleteVersionMutation = useMutation({
    mutationFn: async (version: number) => {
      return await deleteVersion(version);
    },
    onSuccess: (data, version) => {
      toast({
        title: "Version gelöscht",
        description: `Version wurde erfolgreich gelöscht. ${data.deleted_schedules_count} Schichtpläne wurden entfernt.`,
      });

      // If we deleted the selected version, clear selection
      if (selectedVersion === version) {
        setSelectedVersion(undefined);
        onVersionSelectedRef.current?.(undefined);
      }

      versionsQuery.refetch();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Löschen der Version",
        description:
          error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  // Duplicate version mutation
  const duplicateVersionMutation = useMutation({
    mutationFn: async ({
      sourceVersion,
      options,
    }: {
      sourceVersion: number;
      options: DuplicateVersionOptions;
    }) => {
      const startDate =
        options.startDate ||
        (dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined);
      const endDate =
        options.endDate ||
        (dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined);

      if (!startDate || !endDate) {
        throw new Error("Date range is required to duplicate a version");
      }

      return await duplicateVersion({
        start_date: startDate,
        end_date: endDate,
        source_version: sourceVersion,
        week_version: options.weekVersion,
        notes: options.notes,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Version dupliziert",
        description: `Version ${data.version} wurde erfolgreich erstellt.`,
      });

      // Auto-select the new version
      setSelectedVersion(data.version);
      onVersionSelectedRef.current?.(data.version);

      versionsQuery.refetch();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Duplizieren der Version",
        description:
          error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  // Action handlers
  const selectVersion = useCallback((version: number | undefined) => {
    setSelectedVersion(version);
    onVersionSelectedRef.current?.(version);
  }, []);

  const resetVersionSelection = useCallback(() => {
    setSelectedVersion(undefined);
    onVersionSelectedRef.current?.(undefined);
  }, []);

  const createVersion = useCallback(
    (options: CreateVersionOptions = {}) => {
      createVersionMutation.mutate(options);
    },
    [createVersionMutation],
  );

  const updateVersionStatusAction = useCallback(
    (version: number, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") => {
      updateStatusMutation.mutate({ version, status });
    },
    [updateStatusMutation],
  );

  const updateVersionNotesAction = useCallback(
    (version: number, notes: string) => {
      updateNotesMutation.mutate({ version, notes });
    },
    [updateNotesMutation],
  );

  const deleteVersionAction = useCallback(
    (version: number) => {
      deleteVersionMutation.mutate(version);
    },
    [deleteVersionMutation],
  );

  const duplicateVersionAction = useCallback(
    (version: number, options: DuplicateVersionOptions = {}) => {
      duplicateVersionMutation.mutate({ sourceVersion: version, options });
    },
    [duplicateVersionMutation],
  );

  // Compute loading state
  const isLoading =
    versionsQuery.isLoading ||
    createVersionMutation.isPending ||
    updateStatusMutation.isPending ||
    updateNotesMutation.isPending ||
    deleteVersionMutation.isPending ||
    duplicateVersionMutation.isPending;

  return {
    state: {
      versions: versionsQuery.data?.versions || [],
      selectedVersion,
      isLoading,
      isError: versionsQuery.isError,
      error: versionsQuery.error,
    },
    actions: {
      selectVersion,
      resetVersionSelection,
      createVersion,
      updateVersionStatus: updateVersionStatusAction,
      updateVersionNotes: updateVersionNotesAction,
      deleteVersion: deleteVersionAction,
      duplicateVersion: duplicateVersionAction,
      refetch: versionsQuery.refetch,
    },
  };
}
