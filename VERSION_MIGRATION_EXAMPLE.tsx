/**
 * Example: Migrating from old version control to new refactored system
 * 
 * This file shows how to replace the existing VersionControl component
 * usage with the new refactored VersionManager component.
 */

import { VersionManager } from "@/components/VersionManager";
import { useState } from "react";
import { DateRange } from "react-day-picker";

// BEFORE: Old complex usage with multiple hooks and components
/*
import { useVersionControl } from "@/hooks/useVersionControl";
import { VersionControl } from "@/components/VersionControl";
import { ScheduleVersions } from "@/components/Schedule/ScheduleVersions";

function OldSchedulePage() {
  const [dateRange, setDateRange] = useState<DateRange>();
  const [selectedVersion, setSelectedVersion] = useState<number>();

  // Complex hook with auto-selection logic
  const versionControl = useVersionControl({
    dateRange,
    onVersionSelected: setSelectedVersion,
    initialVersion: selectedVersion,
  });

  return (
    <div>
      <VersionControl
        versions={versionControl.versions}
        versionStatuses={versionControl.versionStatuses}
        currentVersion={versionControl.selectedVersion}
        versionMeta={versionControl.versionMetas[0]}
        dateRange={dateRange}
        onVersionChange={versionControl.handleVersionChange}
        onCreateNewVersion={versionControl.handleCreateNewVersion}
        onPublishVersion={versionControl.handlePublishVersion}
        onArchiveVersion={versionControl.handleArchiveVersion}
        onDeleteVersion={versionControl.handleDeleteVersion}
        onDuplicateVersion={versionControl.handleDuplicateVersion}
        isLoading={versionControl.isLoading}
        hasError={versionControl.isError}
        schedules={schedules}
        onRetry={versionControl.refetch}
      />
      
      <ScheduleVersions
        schedules={schedules}
        onPublish={versionControl.handlePublishVersion}
        onArchive={versionControl.handleArchiveVersion}
      />
    </div>
  );
}
*/

// AFTER: New simplified usage with unified component
function NewSchedulePage() {
  const [dateRange, setDateRange] = useState<DateRange>();
  const [selectedVersion, setSelectedVersion] = useState<number>();

  return (
    <div className="space-y-6">
      {/* Single component handles everything */}
      <VersionManager
        dateRange={dateRange}
        onVersionSelected={setSelectedVersion}
        layout="horizontal"
        showCreateButton={true}
        autoSelectLatest={true}
      />
    </div>
  );
}

// ALTERNATIVE: Custom layout with separate components
function CustomLayoutPage() {
  const [dateRange, setDateRange] = useState<DateRange>();
  const [selectedVersion, setSelectedVersion] = useState<number>();

  return (
    <div className="space-y-6">
      {/* Use table-only layout for a more compact view */}
      <VersionManager
        dateRange={dateRange}
        onVersionSelected={setSelectedVersion}
        layout="table-only"
        showCreateButton={true}
      />
      
      {/* Show details in a separate section */}
      <VersionManager
        dateRange={dateRange}
        onVersionSelected={setSelectedVersion}
        layout="details-only"
        showCreateButton={false}
      />
    </div>
  );
}

// ADVANCED: Using the hook directly for custom implementation
import { VersionDetailsPanel } from "@/components/VersionDetailsPanel";
import { VersionTable } from "@/components/VersionTableRefactored";
import { useVersionManager } from "@/hooks/useVersionManager";

function AdvancedCustomPage() {
  const [dateRange, setDateRange] = useState<DateRange>();
  const [selectedVersion, setSelectedVersion] = useState<number>();

  // Direct hook usage for maximum control
  const { state, actions } = useVersionManager({
    dateRange,
    onVersionSelected: setSelectedVersion,
    autoSelectLatest: true,
  });

  // Get selected version metadata
  const selectedVersionMeta = state.selectedVersion
    ? state.versions.find(v => v.version === state.selectedVersion)
    : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Custom table with specific configuration */}
      <div className="lg:col-span-2">
        <VersionTable
          versions={state.versions}
          selectedVersion={state.selectedVersion}
          onSelectVersion={actions.selectVersion}
          onPublishVersion={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
          onArchiveVersion={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
          onDeleteVersion={actions.deleteVersion}
          onDuplicateVersion={actions.duplicateVersion}
          isLoading={state.isLoading}
          showPagination={true}
          initialPageSize={5}
          isCollapsible={false}
        />
      </div>

      {/* Custom details panel */}
      <div className="lg:col-span-1">
        <VersionDetailsPanel
          version={selectedVersionMeta}
          onUpdateNotes={actions.updateVersionNotes}
          onPublish={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
          onArchive={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
          onDuplicate={actions.duplicateVersion}
          isLoading={state.isLoading}
        />
      </div>
    </div>
  );
}

export { AdvancedCustomPage, CustomLayoutPage, NewSchedulePage };

