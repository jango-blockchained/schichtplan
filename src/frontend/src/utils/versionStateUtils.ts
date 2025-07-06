/**
 * Unified version state utilities for consistent version management across components.
 * 
 * These utilities ensure that all components handle version state consistently,
 * especially when dealing with loading states, empty states, and navigation between weeks.
 */

import { VersionMeta } from '@/services/api';

export interface VersionState {
    versions: VersionMeta[];
    selectedVersion: number | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
}

export interface VersionDisplayState {
    hasVersions: boolean;
    showVersionAvailable: boolean;
    selectedVersionCleared: boolean;
    shouldShowLoading: boolean;
}

/**
 * Determines the display state for version-related components
 * @param versionState - The current version state from useVersionManager
 * @returns Display state object with flags for UI components
 */
export function getVersionDisplayState(versionState: VersionState): VersionDisplayState {
    const { versions, selectedVersion, isLoading, isError } = versionState;

    // Has versions only if not loading, not error, and actually has versions
    const hasVersions = !isLoading && !isError && versions.length > 0;

    // Show "Version vorhanden" only if we actually have versions and not loading
    const showVersionAvailable = hasVersions;

    // Version selection should be cleared if no versions or loading/error state
    const selectedVersionCleared = !hasVersions && selectedVersion === undefined;

    // Show loading state during queries
    const shouldShowLoading = isLoading;

    return {
        hasVersions,
        showVersionAvailable,
        selectedVersionCleared,
        shouldShowLoading,
    };
}

/**
 * Checks if a version selection is valid for the current state
 * @param selectedVersion - The currently selected version
 * @param availableVersions - Array of available version metadata
 * @param isLoading - Whether versions are currently loading
 * @returns True if the selection is valid, false otherwise
 */
export function isVersionSelectionValid(
    selectedVersion: number | undefined,
    availableVersions: VersionMeta[],
    isLoading: boolean
): boolean {
    // If loading, consider selection invalid to trigger clearing
    if (isLoading) {
        return false;
    }

    // If no version selected, that's valid (cleared state)
    if (selectedVersion === undefined) {
        return true;
    }

    // Check if selected version exists in available versions
    return availableVersions.some(v => v.version === selectedVersion);
}

/**
 * Gets the appropriate version to display/select based on current state
 * @param versionState - Current version state
 * @param autoSelectLatest - Whether to auto-select latest version
 * @returns Version number to select, or undefined if none should be selected
 */
export function getVersionToSelect(
    versionState: VersionState,
    autoSelectLatest: boolean = true
): number | undefined {
    const { versions, isLoading, isError } = versionState;

    // Don't select anything while loading or if there's an error
    if (isLoading || isError) {
        return undefined;
    }

    // No versions available
    if (versions.length === 0) {
        return undefined;
    }

    // Auto-select latest if requested
    if (autoSelectLatest) {
        return Math.max(...versions.map(v => v.version));
    }

    return undefined;
}

/**
 * Clears version selection if it's no longer valid for the current state
 * @param selectedVersion - Currently selected version
 * @param versionState - Current version state
 * @param onVersionSelected - Callback to update version selection
 */
export function clearInvalidVersionSelection(
    selectedVersion: number | undefined,
    versionState: VersionState,
    onVersionSelected: (version: number | undefined) => void
): void {
    if (!isVersionSelectionValid(selectedVersion, versionState.versions, versionState.isLoading)) {
        console.log("🧹 Clearing invalid version selection:", selectedVersion);
        onVersionSelected(undefined);
    }
} 