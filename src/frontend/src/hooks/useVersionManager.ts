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
  updateVersionStatus: (version: number, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") => void;
  updateVersionNotes: (version: number, notes: string) => void;
  deleteVersion: (version: number) => void;
  duplicateVersion: (version: number, options?: DuplicateVersionOptions) => void;
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
  const currentDateRangeKey = dateRange?.from?.toISOString() + "-" + dateRange?.to?.toISOString();
  
  // Track processed query to prevent duplicate processing
  const processedQueryRef = useRef<string | null>(null);

  // Clear selected version immediately when date range changes
  useEffect(() => {
    if (prevDateRangeRef.current !== null && prevDateRangeRef.current !== currentDateRangeKey) {
      console.log("📅 Date range changed, clearing version selection immediately");
      console.log("📅 Previous date range:", prevDateRangeRef.current);
      console.log("📅 Current date range:", currentDateRangeKey);
      setSelectedVersion(undefined);
      onVersionSelected?.(undefined);
      // Clear processed query ref to allow processing of new date range
      processedQueryRef.current = null;
    }
    prevDateRangeRef.current = currentDateRangeKey;
  }, [currentDateRangeKey, onVersionSelected]);

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

    // Auto-select latest version when versions are available and query is complete
  useEffect(() => {
    const versions = versionsQuery.data?.versions || [];

    // Only proceed if query is complete (not loading) and we have a valid result
    if (versionsQuery.isLoading || versionsQuery.isError) {
      return;
    }

    // Create a unique key for this query result to prevent duplicate processing
    const queryKey = currentDateRangeKey + "-" + JSON.stringify(versions.map(v => v.version).sort());
    
    // Skip if we've already processed this exact query result
    if (processedQueryRef.current === queryKey) {
      return;
    }
    
    console.log("📅 Processing version query for date range:", currentDateRangeKey);
    console.log("📅 Available versions:", versions.map(v => v.version));
    console.log("📅 Current selected version:", selectedVersion);

    if (versions.length === 0) {
      // No versions available for this date range - ensure selection is cleared
      if (selectedVersion !== undefined) {
        console.log("📅 No versions available for current date range, clearing selection");
        setSelectedVersion(undefined);
        onVersionSelected?.(undefined);
      }
      processedQueryRef.current = queryKey;
      return;
    }

    // Check if currently selected version is valid for current date range
    const isSelectedVersionValid = selectedVersion !== undefined && 
      versions.some(v => v.version === selectedVersion);

    if (!isSelectedVersionValid) {
      // Clear invalid selection or auto-select latest if enabled
      if (autoSelectLatest) {
        const latestVersion = Math.max(...versions.map(v => v.version));
        console.log("📅 Auto-selecting latest version for current date range:", latestVersion);
        setSelectedVersion(latestVersion);
        onVersionSelected?.(latestVersion);
      } else {
        console.log("📅 Clearing invalid version selection");
        setSelectedVersion(undefined);
        onVersionSelected?.(undefined);
      }
    } else {
      console.log("📅 Current version selection is valid, keeping it");
    }
    
    // Mark this query as processed
    processedQueryRef.current = queryKey;
  }, [versionsQuery.data, versionsQuery.isLoading, versionsQuery.isError, onVersionSelected, autoSelectLatest, currentDateRangeKey]);

  // Create version mutation
  const createVersionMutation = useMutation({
    mutationFn: async (options: CreateVersionOptions = {}) => {
      const startDate = options.startDate ||
        (dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined);
      const endDate = options.endDate ||
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
      onVersionSelected?.(data.version);

      // Refresh versions
      versionsQuery.refetch();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen der Version",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  // Update version status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ version, status }: { version: number; status: string }) => {
      return await updateVersionStatus(version, { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" });
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
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  // Update version notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ version, notes }: { version: number; notes: string }) => {
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
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
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
        onVersionSelected?.(undefined);
      }

      versionsQuery.refetch();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Löschen der Version",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  // Duplicate version mutation
  const duplicateVersionMutation = useMutation({
    mutationFn: async ({
      sourceVersion,
      options
    }: {
      sourceVersion: number;
      options: DuplicateVersionOptions
    }) => {
      const startDate = options.startDate ||
        (dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined);
      const endDate = options.endDate ||
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
      onVersionSelected?.(data.version);

      versionsQuery.refetch();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Duplizieren der Version",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  // Action handlers
  const selectVersion = useCallback((version: number | undefined) => {
    setSelectedVersion(version);
    onVersionSelected?.(version);
  }, [onVersionSelected]);

  const resetVersionSelection = useCallback(() => {
    setSelectedVersion(undefined);
    onVersionSelected?.(undefined);
  }, [onVersionSelected]);

  const createVersion = useCallback((options: CreateVersionOptions = {}) => {
    createVersionMutation.mutate(options);
  }, [createVersionMutation]);

  const updateVersionStatusAction = useCallback((version: number, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") => {
    updateStatusMutation.mutate({ version, status });
  }, [updateStatusMutation]);

  const updateVersionNotesAction = useCallback((version: number, notes: string) => {
    updateNotesMutation.mutate({ version, notes });
  }, [updateNotesMutation]);

  const deleteVersionAction = useCallback((version: number) => {
    deleteVersionMutation.mutate(version);
  }, [deleteVersionMutation]);

  const duplicateVersionAction = useCallback((version: number, options: DuplicateVersionOptions = {}) => {
    duplicateVersionMutation.mutate({ sourceVersion: version, options });
  }, [duplicateVersionMutation]);

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
