/**
 * Unified Version Manager Component
 *
 * This component brings together all version management functionality
 * in a clean, unified interface using the new refactored components.
 */

import { format, getWeek } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DateRange } from "react-day-picker";

import { DuplicateVersionModal } from "@/components/DuplicateVersionModal";
import { VersionDetailsPanel } from "@/components/VersionDetailsPanel";
import { VersionTable } from "@/components/VersionTableRefactored";
import { useVersionManager } from "@/hooks/useVersionManager";
import { getSchedules, getVersionDetails } from "@/services/api";

interface VersionManagerProps {
  dateRange?: DateRange;
  onVersionSelected?: (version: number | undefined) => void;
  autoSelectLatest?: boolean;
  className?: string;
  showCreateButton?: boolean;
  layout?: "horizontal" | "vertical" | "table-only" | "details-only";
  isCollapsible?: boolean;
  initiallyCollapsed?: boolean;
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
  isCollapsible = true,
  initiallyCollapsed = true,
}: VersionManagerProps) {
  const { state, actions } = useVersionManager({
    dateRange,
    onVersionSelected,
    autoSelectLatest,
  });

  const [selectedVersionStats, setSelectedVersionStats] =
    useState<VersionStatistics | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [versionToDuplicate, setVersionToDuplicate] = useState<number | null>(
    null,
  );
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);

  // Get selected version metadata
  const selectedVersionMeta = state.selectedVersion
    ? state.versions.find((v) => v.version === state.selectedVersion)
    : undefined;

  // Helper function to get week number and date range info
  const getDateRangeInfo = () => {
    if (!dateRange?.from || !dateRange?.to) return null;

    const weekFrom = getWeek(dateRange.from, { locale: de });
    const weekTo = getWeek(dateRange.to, { locale: de });
    const year = dateRange.from.getFullYear();

    return {
      weekRange:
        weekFrom === weekTo ? `KW ${weekFrom}` : `KW ${weekFrom}-${weekTo}`,
      dateRange: `${format(dateRange.from, "dd.MM")} - ${format(dateRange.to, "dd.MM.yyyy", { locale: de })}`,
      year,
    };
  };

  const dateRangeInfo = getDateRangeInfo();

  // Create the collapsible header with summary info
  const renderCollapsibleHeader = () => {
    const totalVersions = state.versions.length;
    const selectedVersionInfo = selectedVersionMeta
      ? `v${selectedVersionMeta.version} (${selectedVersionMeta.status})`
      : "Keine Version ausgewählt";

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
            <CardTitle>Versionsverwaltung</CardTitle>
          </div>

          {isCollapsed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {/* Date Range Info */}
              {dateRangeInfo && (
                <Badge variant="outline">
                  {dateRangeInfo.weekRange} • {dateRangeInfo.dateRange}
                </Badge>
              )}

              {/* Version Count */}
              <Badge variant="secondary">
                {totalVersions} Version{totalVersions !== 1 ? "en" : ""}
              </Badge>

              {/* Selected Version */}
              {selectedVersionMeta && (
                <Badge variant="default">{selectedVersionInfo}</Badge>
              )}
            </div>
          )}
        </div>

        {/* Create Button */}
        {showCreateButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateNewVersion}
            disabled={state.isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Neue Version
          </Button>
        )}
      </div>
    );
  };

  // Render the layout content (extracted from the switch statement)
  const renderLayoutContent = () => {
    switch (layout) {
      case "table-only":
        return (
          <div>
            <VersionTable
              versions={state.versions}
              selectedVersion={state.selectedVersion}
              onSelectVersion={handleVersionSelection}
              onPublishVersion={(version) =>
                actions.updateVersionStatus(version, "PUBLISHED")
              }
              onArchiveVersion={(version) =>
                actions.updateVersionStatus(version, "ARCHIVED")
              }
              onDeleteVersion={actions.deleteVersion}
              onDuplicateVersion={handleDuplicateVersion}
              isLoading={state.isLoading}
            />
          </div>
        );

      case "details-only":
        return (
          <div>
            <VersionDetailsPanel
              version={selectedVersionMeta}
              statistics={selectedVersionStats}
              onUpdateNotes={actions.updateVersionNotes}
              onPublish={(version) =>
                actions.updateVersionStatus(version, "PUBLISHED")
              }
              onArchive={(version) =>
                actions.updateVersionStatus(version, "ARCHIVED")
              }
              onDuplicate={handleDuplicateVersion}
              isLoading={state.isLoading}
            />
          </div>
        );

      case "vertical":
        return (
          <div className="space-y-6">
            {/* Version Table */}
            <VersionTable
              versions={state.versions}
              selectedVersion={state.selectedVersion}
              onSelectVersion={handleVersionSelection}
              onPublishVersion={(version) =>
                actions.updateVersionStatus(version, "PUBLISHED")
              }
              onArchiveVersion={(version) =>
                actions.updateVersionStatus(version, "ARCHIVED")
              }
              onDeleteVersion={actions.deleteVersion}
              onDuplicateVersion={handleDuplicateVersion}
              isLoading={state.isLoading}
              isCollapsible={true}
            />

            {/* Version Details */}
            <VersionDetailsPanel
              version={selectedVersionMeta}
              statistics={selectedVersionStats}
              onUpdateNotes={actions.updateVersionNotes}
              onPublish={(version) =>
                actions.updateVersionStatus(version, "PUBLISHED")
              }
              onArchive={(version) =>
                actions.updateVersionStatus(version, "ARCHIVED")
              }
              onDuplicate={handleDuplicateVersion}
              isLoading={state.isLoading}
            />
          </div>
        );

      case "horizontal":
      default:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Version Table - takes 2/3 on large screens */}
            <div className="lg:col-span-2">
              <VersionTable
                versions={state.versions}
                selectedVersion={state.selectedVersion}
                onSelectVersion={handleVersionSelection}
                onPublishVersion={(version) =>
                  actions.updateVersionStatus(version, "PUBLISHED")
                }
                onArchiveVersion={(version) =>
                  actions.updateVersionStatus(version, "ARCHIVED")
                }
                onDeleteVersion={actions.deleteVersion}
                onDuplicateVersion={handleDuplicateVersion}
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
                onPublish={(version) =>
                  actions.updateVersionStatus(version, "PUBLISHED")
                }
                onArchive={(version) =>
                  actions.updateVersionStatus(version, "ARCHIVED")
                }
                onDuplicate={handleDuplicateVersion}
                isLoading={state.isLoading}
              />
            </div>
          </div>
        );
    }
  };

  // Handle version selection
  const handleVersionSelection = (version: number) => {
    actions.selectVersion(version);
    // Load real statistics for the selected version
    setSelectedVersionStats(null);
    const meta = state.versions.find((v) => v.version === version);
    const start = meta?.date_range.start;
    const end = meta?.date_range.end;
    (async () => {
      try {
        const details = await getVersionDetails(version);
        let total = 0;
        let filled = 0;
        if (start && end) {
          const resp = await getSchedules(start, end, version, true);
          if (
            typeof resp.total_schedules === "number" &&
            typeof resp.filled_shifts_count === "number"
          ) {
            total = resp.total_schedules;
            filled = resp.filled_shifts_count;
          } else {
            const schedules = resp.schedules || [];
            total = schedules.length;
            filled = schedules.filter(
              (s) => s.shift_id != null && s.is_empty !== true,
            ).length;
          }
        }
        const empty = Math.max(0, total - filled);
        const coverage = total > 0 ? (filled / total) * 100 : 0;
        setSelectedVersionStats({
          total_schedules: total || details.schedule_count,
          filled_schedules: filled,
          empty_schedules: empty,
          coverage_percentage: coverage,
          unique_employees: details.employees_count,
          unique_dates: details.days_count,
        });
      } catch (e) {
        console.error("Failed to load version statistics", e);
        try {
          const details = await getVersionDetails(version);
          setSelectedVersionStats({
            total_schedules: details.schedule_count,
            filled_schedules: 0,
            empty_schedules: details.schedule_count,
            coverage_percentage: 0,
            unique_employees: details.employees_count,
            unique_dates: details.days_count,
          });
        } catch {
          setSelectedVersionStats(null);
        }
      }
    })();
  };

  // Handle creating new version
  const handleCreateNewVersion = () => {
    actions.createVersion();
  };

  // Handle duplicate version modal
  const handleDuplicateVersion = (version: number) => {
    setVersionToDuplicate(version);
    setDuplicateModalOpen(true);
  };

  // Handle duplicate confirmation from modal
  const handleDuplicateConfirm = (options: {
    startDate: string;
    endDate: string;
    weekVersion?: string;
    notes?: string;
  }) => {
    if (versionToDuplicate) {
      actions.duplicateVersion(versionToDuplicate, options);
      setDuplicateModalOpen(false);
      setVersionToDuplicate(null);
    }
  };

  // Main render logic with collapsible support
  if (isCollapsible) {
    return (
      <Card className={className}>
        <Collapsible
          open={!isCollapsed}
          onOpenChange={(open) => setIsCollapsed(!open)}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              {renderCollapsibleHeader()}
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent>
              {/* Loading state */}
              {state.isLoading && state.versions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-lg font-medium mb-2">Laden...</div>
                  <div className="text-sm text-muted-foreground">
                    Versionen werden geladen...
                  </div>
                </div>
              ) : state.isError ? (
                /* Error state */
                <div className="text-center py-8">
                  <div className="text-lg font-medium mb-2 text-destructive">
                    Fehler beim Laden der Versionen
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    {state.error?.message || "Unbekannter Fehler"}
                  </div>
                  <Button variant="outline" onClick={actions.refetch}>
                    Erneut versuchen
                  </Button>
                </div>
              ) : !dateRange?.from || !dateRange?.to ? (
                /* No date range state */
                <div className="text-center py-8">
                  <div className="text-lg font-medium mb-2">
                    Kein Zeitraum ausgewählt
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Bitte wählen Sie einen Zeitraum aus, um Versionen
                    anzuzeigen.
                  </div>
                </div>
              ) : state.versions.length === 0 ? (
                /* Empty state */
                <div className="text-center py-8">
                  <div className="text-lg font-medium mb-2">
                    Keine Versionen vorhanden
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    Erstellen Sie eine Version für den ausgewählten Zeitraum.
                  </div>
                  {showCreateButton && (
                    <Button
                      onClick={handleCreateNewVersion}
                      disabled={
                        state.isLoading || !dateRange?.from || !dateRange?.to
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Erste Version erstellen
                    </Button>
                  )}
                </div>
              ) : (
                /* Render layout content */
                renderLayoutContent()
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>

        {/* Duplicate Version Modal */}
        {versionToDuplicate && (
          <DuplicateVersionModal
            open={duplicateModalOpen}
            onOpenChange={setDuplicateModalOpen}
            sourceVersion={versionToDuplicate}
            sourceVersionMeta={state.versions.find(
              (v) => v.version === versionToDuplicate,
            )}
            onDuplicate={handleDuplicateConfirm}
            isLoading={state.isLoading}
          />
        )}
      </Card>
    );
  }

  // Fallback for non-collapsible mode (legacy behavior)
  return (
    <div className={className}>
      {/* Loading state */}
      {state.isLoading && state.versions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-lg font-medium mb-2">Laden...</div>
            <div className="text-sm text-muted-foreground">
              Versionen werden geladen...
            </div>
          </CardContent>
        </Card>
      ) : state.isError ? (
        /* Error state */
        <Card>
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
      ) : !dateRange?.from || !dateRange?.to ? (
        /* No date range state */
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-lg font-medium mb-2">
              Kein Zeitraum ausgewählt
            </div>
            <div className="text-sm text-muted-foreground">
              Bitte wählen Sie einen Zeitraum aus, um Versionen anzuzeigen.
            </div>
          </CardContent>
        </Card>
      ) : state.versions.length === 0 ? (
        /* Empty state */
        <Card>
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
            <div className="text-lg font-medium mb-2">
              Keine Versionen vorhanden
            </div>
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
      ) : (
        /* Render layout content */
        <>
          {renderLayoutContent()}
          {/* Duplicate Version Modal */}
          {versionToDuplicate && (
            <DuplicateVersionModal
              open={duplicateModalOpen}
              onOpenChange={setDuplicateModalOpen}
              sourceVersion={versionToDuplicate}
              sourceVersionMeta={state.versions.find(
                (v) => v.version === versionToDuplicate,
              )}
              onDuplicate={handleDuplicateConfirm}
              isLoading={state.isLoading}
            />
          )}
        </>
      )}
    </div>
  );
}
