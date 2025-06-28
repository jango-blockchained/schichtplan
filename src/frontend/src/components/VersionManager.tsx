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
import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";

import { DuplicateVersionModal } from "@/components/DuplicateVersionModal";
import { VersionDetailsPanel } from "@/components/VersionDetailsPanel";
import { VersionTable } from "@/components/VersionTableRefactored";
import { useVersionManager } from "@/hooks/useVersionManager";
import { cn } from "@/lib/utils";
import { getSettings } from "@/services/api";
import type { Settings } from "@/types";

// Helper function to get status badge (matching Action Dock style)
const getStatusBadge = (status: string | undefined) => {
  if (!status) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        status === "PUBLISHED" && "bg-green-500/20 text-green-300 border-green-500/30",
        status === "DRAFT" && "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
        status === "ARCHIVED" && "bg-gray-500/20 text-gray-300 border-gray-500/30"
      )}
    >
      {status.toLowerCase()}
    </Badge>
  );
};

interface VersionManagerProps {
  dateRange?: DateRange;
  onVersionSelected?: (version: number | undefined) => void;
  autoSelectLatest?: boolean;
  className?: string;
  showCreateButton?: boolean;
  layout?: "horizontal" | "vertical" | "table-only" | "details-only";
  isCollapsible?: boolean;
  initiallyCollapsed?: boolean;
  weekNavigationSettings?: {
    weekendStart?: number; // 0 = Sunday, 1 = Monday
    monthBoundaryMode?: string; // 'keep_intact' or 'split_by_month'
  };
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
  weekNavigationSettings,
}: VersionManagerProps) {
  const { state, actions } = useVersionManager({
    dateRange,
    onVersionSelected,
    autoSelectLatest,
  });

  // Fetch settings if not provided
  const { data: settings } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 5 * 60 * 1000,
    enabled: !weekNavigationSettings, // Only fetch if settings not provided
  });

  // Use provided settings or fall back to fetched settings
  const effectiveSettings = weekNavigationSettings || {
    weekendStart: settings?.week_navigation?.week_weekend_start === 'SUNDAY' ? 0 : 1,
    monthBoundaryMode: settings?.week_navigation?.week_month_boundary_mode ?? 'keep_intact',
  };

  const [selectedVersionStats, setSelectedVersionStats] = useState<VersionStatistics | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [versionToDuplicate, setVersionToDuplicate] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
  const [filterByDate, setFilterByDate] = useState(false);

  // Get selected version metadata
  const selectedVersionMeta = state.selectedVersion
    ? state.versions.find(v => v.version === state.selectedVersion)
    : undefined;

  // Helper function to get week number and date range info
  const getDateRangeInfo = () => {
    if (!dateRange?.from || !dateRange?.to) return null;

    // Use settings-aware week calculation
    const weekStartsOn = effectiveSettings.weekendStart === 0 ? 0 : 1;
    const weekFrom = getWeek(dateRange.from, { locale: de, weekStartsOn });
    const weekTo = getWeek(dateRange.to, { locale: de, weekStartsOn });
    const year = dateRange.from.getFullYear();

    const weekInfo = {
      weekRange: weekFrom === weekTo ? `KW ${weekFrom}` : `KW ${weekFrom}-${weekTo}`,
      dateRange: `${format(dateRange.from, "dd.MM")} - ${format(dateRange.to, "dd.MM.yyyy", { locale: de })}`,
      year,
      weekendStart: effectiveSettings.weekendStart,
      monthBoundaryMode: effectiveSettings.monthBoundaryMode,
    };

    return weekInfo;
  };

  const dateRangeInfo = getDateRangeInfo();

  const renderCollapsibleHeader = () => {
    const totalVersions = state.versions.length;

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <CardTitle>Versionsverwaltung</CardTitle>
          </div>

          {isCollapsed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {/* Date Range Info with Week Version and Settings-aware display */}
              {dateRangeInfo && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {dateRangeInfo.weekRange} • {dateRangeInfo.dateRange}
                  </Badge>
                </div>
              )}

              {/* Version Count */}
              <Badge variant="secondary">
                {totalVersions} Version{totalVersions !== 1 ? 'en' : ''}
              </Badge>

              {/* Selected Version with enhanced info */}
              {selectedVersionMeta && (
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs font-mono">
                    v{selectedVersionMeta.version}
                  </Badge>
                  {getStatusBadge(selectedVersionMeta.status)}
                  {dateRangeInfo && (
                    <Badge variant="outline" className="text-xs">
                      {dateRangeInfo.weekRange}
                    </Badge>
                  )}
                </div>
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

  // Filter versions by selected week date range if enabled
  const filteredVersions = filterByDate && dateRange?.from && dateRange?.to
    ? state.versions.filter(v => {
      const vStart = new Date(v.date_range.start);
      const vEnd = new Date(v.date_range.end);
      return vStart >= dateRange.from && vEnd <= dateRange.to;
    })
    : state.versions;

  // Render the layout content (extracted from the switch statement)
  const renderLayoutContent = () => {
    switch (layout) {
      case "table-only":
        return (
          <div>
            {/* Date Range Filter UI */}
            <div className="flex items-center gap-4 px-2 py-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filterByDate}
                  onChange={e => setFilterByDate(e.target.checked)}
                />
                <span className="text-sm">Nur Versionen im ausgewählten Zeitraum anzeigen</span>
              </label>
            </div>
            <VersionTable
              versions={filteredVersions}
              selectedVersion={state.selectedVersion}
              onSelectVersion={handleVersionSelection}
              onPublishVersion={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
              onArchiveVersion={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
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
              onPublish={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
              onArchive={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
              onDuplicate={handleDuplicateVersion}
              isLoading={state.isLoading}
            />
          </div>
        );

      case "vertical":
        return (
          <div className="space-y-6">
            {/* Date Range Filter UI */}
            <div className="flex items-center gap-4 px-2 py-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filterByDate}
                  onChange={e => setFilterByDate(e.target.checked)}
                />
                <span className="text-sm">Nur Versionen im ausgewählten Zeitraum anzeigen</span>
              </label>
            </div>
            {/* Version Table */}
            <VersionTable
              versions={filteredVersions}
              selectedVersion={state.selectedVersion}
              onSelectVersion={handleVersionSelection}
              onPublishVersion={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
              onArchiveVersion={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
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
              onPublish={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
              onArchive={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
              onDuplicate={handleDuplicateVersion}
              isLoading={state.isLoading}
            />
          </div>
        );

      case "horizontal":
      default:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Date Range Filter UI */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-4 px-2 py-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filterByDate}
                    onChange={e => setFilterByDate(e.target.checked)}
                  />
                  <span className="text-sm">Nur Versionen im ausgewählten Zeitraum anzeigen</span>
                </label>
              </div>
              <VersionTable
                versions={filteredVersions}
                selectedVersion={state.selectedVersion}
                onSelectVersion={handleVersionSelection}
                onPublishVersion={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
                onArchiveVersion={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
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
                onPublish={(version) => actions.updateVersionStatus(version, "PUBLISHED")}
                onArchive={(version) => actions.updateVersionStatus(version, "ARCHIVED")}
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

  // Handle duplicate version modal
  const handleDuplicateVersion = (version: number) => {
    setVersionToDuplicate(version);
    setDuplicateModalOpen(true);
  };

  // Handle duplicate confirmation from modal
  const handleDuplicateConfirm = (options: {
    startDate: string;
    endDate: string;
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
        <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
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
                  <div className="text-lg font-medium mb-2">Kein Zeitraum ausgewählt</div>
                  <div className="text-sm text-muted-foreground">
                    Bitte wählen Sie einen Zeitraum aus, um Versionen anzuzeigen.
                  </div>
                </div>
              ) : state.versions.length === 0 ? (
                /* Empty state */
                <div className="text-center py-8">
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
            <div className="text-lg font-medium mb-2">Kein Zeitraum ausgewählt</div>
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
              onDuplicate={handleDuplicateConfirm}
              isLoading={state.isLoading}
            />
          )}
        </>
      )}
    </div>
  );
}
