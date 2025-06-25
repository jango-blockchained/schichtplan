/**
 * Unified Version Manager Component
 * 
 * This component brings together all version management functionality
 * in a clean, unified interface using the new refactored components.
 */

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRange } from "react-day-picker";

import { VersionDetailsPanel } from "@/components/VersionDetailsPanel";
import { VersionTable } from "@/components/VersionTableRefactored";
import { useVersionManager } from "@/hooks/useVersionManager";

interface VersionManagerProps {
  dateRange?: DateRange;
  onVersionSelected?: (version: number | undefined) => void;
  autoSelectLatest?: boolean;
  className?: string;
  showCreateButton?: boolean;
  layout?: "horizontal" | "vertical" | "table-only" | "details-only";
}

interface VersionStatistics {
  total_schedules: number;
  filled_schedules: number;
  empty_schedules: number;
  coverage_percentage: number;
  unique_employees: number;
  unique_dates: number;
}

export function VersionManager({
  dateRange,
  onVersionSelected,
  autoSelectLatest = true,
  className = "",
  showCreateButton = true,
  layout = "horizontal",
}: VersionManagerProps) {
  const { state, actions } = useVersionManager({
    dateRange,
    onVersionSelected,
    autoSelectLatest,
  });

  const [selectedVersionStats, setSelectedVersionStats] = useState<VersionStatistics | null>(null);

  // Get selected version metadata
  const selectedVersionMeta = state.selectedVersion
    ? state.versions.find(v => v.version === state.selectedVersion)
    : undefined;

  // Handle version selection
  const handleVersionSelection = (version: number) => {
    actions.selectVersion(version);
    // TODO: Fetch version statistics
    // For now, we'll use mock data
    setSelectedVersionStats({
      total_schedules: 100,
      filled_schedules: 80,
      empty_schedules: 20,
      coverage_percentage: 80,
      unique_employees: 12,
      unique_dates: 7,
    });
  };

  // Handle creating new version
  const handleCreateNewVersion = () => {
    actions.createVersion();
  };

  // Render loading state
  if (state.isLoading && state.versions.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="text-lg font-medium mb-2">Laden...</div>
          <div className="text-sm text-muted-foreground">
            Versionen werden geladen...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (state.isError) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="text-lg font-medium mb-2 text-destructive">
            Fehler beim Laden der Versionen
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            {state.error?.message || "Unbekannter Fehler"}
          </div>
          <Button variant="outline" onClick={actions.refetch}>
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Render empty state when no date range is selected
  if (!dateRange?.from || !dateRange?.to) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="text-lg font-medium mb-2">Kein Zeitraum ausgewählt</div>
          <div className="text-sm text-muted-foreground">
            Bitte wählen Sie einen Zeitraum aus, um Versionen anzuzeigen.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render empty state for no versions
  if (state.versions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Versionsverwaltung</span>
            {showCreateButton && (
              <Button
                variant="outline"
                onClick={handleCreateNewVersion}
                disabled={state.isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Erste Version erstellen
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="text-lg font-medium mb-2">Keine Versionen vorhanden</div>
          <div className="text-sm text-muted-foreground mb-4">
            Erstellen Sie eine Version für den ausgewählten Zeitraum.
          </div>
          {showCreateButton && (
            <Button
              onClick={handleCreateNewVersion}
              disabled={state.isLoading || !dateRange?.from || !dateRange?.to}
            >
              <Plus className="h-4 w-4 mr-2" />
              Erste Version erstellen
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Render different layouts
  switch (layout) {
    case "table-only":
      return (
        <div className={className}>
          {showCreateButton && (
            <div className="mb-4 flex justify-end">
              <Button
                variant="outline"
                onClick={handleCreateNewVersion}
                disabled={state.isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Neue Version
              </Button>
            </div>
          )}
          <VersionTable
            versions={state.versions}
            selectedVersion={state.selectedVersion}
            onSelectVersion={handleVersionSelection}
            onPublishVersion={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
            onArchiveVersion={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
            onDeleteVersion={actions.deleteVersion}
            onDuplicateVersion={actions.duplicateVersion}
            isLoading={state.isLoading}
          />
        </div>
      );

    case "details-only":
      return (
        <div className={className}>
          <VersionDetailsPanel
            version={selectedVersionMeta}
            statistics={selectedVersionStats}
            onUpdateNotes={actions.updateVersionNotes}
            onPublish={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
            onArchive={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
            onDuplicate={actions.duplicateVersion}
            isLoading={state.isLoading}
          />
        </div>
      );

    case "vertical":
      return (
        <div className={`${className} space-y-6`}>
          {/* Header with create button */}
          {showCreateButton && (
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Versionsverwaltung</h2>
              <Button
                variant="outline"
                onClick={handleCreateNewVersion}
                disabled={state.isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Neue Version
              </Button>
            </div>
          )}

          {/* Version Table */}
          <VersionTable
            versions={state.versions}
            selectedVersion={state.selectedVersion}
            onSelectVersion={handleVersionSelection}
            onPublishVersion={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
            onArchiveVersion={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
            onDeleteVersion={actions.deleteVersion}
            onDuplicateVersion={actions.duplicateVersion}
            isLoading={state.isLoading}
            isCollapsible={true}
          />

          {/* Version Details */}
          <VersionDetailsPanel
            version={selectedVersionMeta}
            statistics={selectedVersionStats}
            onUpdateNotes={actions.updateVersionNotes}
            onPublish={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
            onArchive={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
            onDuplicate={actions.duplicateVersion}
            isLoading={state.isLoading}
          />
        </div>
      );

    case "horizontal":
    default:
      return (
        <div className={className}>
          {/* Header with create button */}
          {showCreateButton && (
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Versionsverwaltung</h2>
              <Button
                variant="outline"
                onClick={handleCreateNewVersion}
                disabled={state.isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Neue Version
              </Button>
            </div>
          )}

          {/* Main content in horizontal layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Version Table - takes 2/3 on large screens */}
            <div className="lg:col-span-2">
              <VersionTable
                versions={state.versions}
                selectedVersion={state.selectedVersion}
                onSelectVersion={handleVersionSelection}
                onPublishVersion={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
                onArchiveVersion={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
                onDeleteVersion={actions.deleteVersion}
                onDuplicateVersion={actions.duplicateVersion}
                isLoading={state.isLoading}
                showPagination={true}
                initialPageSize={8}
              />
            </div>

            {/* Version Details - takes 1/3 on large screens */}
            <div className="lg:col-span-1">
              <VersionDetailsPanel
                version={selectedVersionMeta}
                statistics={selectedVersionStats}
                onUpdateNotes={actions.updateVersionNotes}
                onPublish={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
                onArchive={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
                onDuplicate={actions.duplicateVersion}
                isLoading={state.isLoading}
              />
            </div>
          </div>
        </div>
      );
  }
}
