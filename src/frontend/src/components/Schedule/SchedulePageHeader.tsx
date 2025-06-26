import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import ScheduleControls from "@/components/Schedule/ScheduleControls";
import { DateRange } from "react-day-picker";
import { WeekVersionMeta } from "@/types/weekVersion";

interface WeekBasedVersionControl {
  navigationState: {
    currentWeek: string;
  };
  setSelectedVersion: (version: number) => void;
  createVersionForWeek: (week: string) => void;
  navigateToWeek: (week: string) => void;
  navigateToPreviousWeek: () => void;
  navigateToNextWeek: () => void;
  navigateToCurrentWeek: () => void;
}

interface SchedulePageHeaderProps {
  effectiveDateRange: DateRange | undefined;
  currentWeekVersions: WeekVersionMeta[];
  effectiveSelectedVersionNumber: number | undefined;
  weekBasedVersionControl: WeekBasedVersionControl;
  includeEmpty: boolean;
  setIncludeEmpty: (value: boolean) => void;
  createEmptySchedules: boolean;
  setCreateEmptySchedules: (value: boolean) => void;
  onOpenGenerationSettings: () => void;
  onOpenStatistics: () => void;
  onPreviewAiData: () => void;
  onImportAiResponse: () => void;
  onExport: (format: 'standard' | 'mep', filiale?: string) => void;
  isAnyGenerationActive: boolean;
}

export function SchedulePageHeader({
  effectiveDateRange,
  currentWeekVersions,
  effectiveSelectedVersionNumber,
  weekBasedVersionControl,
  includeEmpty,
  setIncludeEmpty,
  createEmptySchedules,
  setCreateEmptySchedules,
  onOpenGenerationSettings,
  onOpenStatistics,
  onPreviewAiData,
  onImportAiResponse,
  onExport,
  isAnyGenerationActive,
}: SchedulePageHeaderProps) {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Schichtplanung" 
        description="Verwalte und plane Mitarbeiterschichten"
      />
      
      <Card>
        <CardContent className="p-6">
          <ScheduleControls
            dateRange={effectiveDateRange}
            onDateRangeChange={(range) => {
              // Handle date range change through week-based version control
              if (range?.from && range?.to) {
                // This would need to be implemented in the weekBasedVersionControl hook
                // weekBasedVersionControl.setDateRange(range);
              }
            }}
            selectedVersion={effectiveSelectedVersionNumber}
            onVersionChange={weekBasedVersionControl.setSelectedVersion}
            versions={currentWeekVersions}
            onCreateNewVersion={() => {
              weekBasedVersionControl.createVersionForWeek(
                weekBasedVersionControl.navigationState.currentWeek
              );
            }}
            includeEmpty={includeEmpty}
            onIncludeEmptyChange={setIncludeEmpty}
            createEmptySchedules={createEmptySchedules}
            onCreateEmptySchedulesChange={setCreateEmptySchedules}
            onOpenGenerationSettings={onOpenGenerationSettings}
            onOpenStatistics={onOpenStatistics}
            onPreviewAiData={onPreviewAiData}
            onImportAiResponse={onImportAiResponse}
            onExport={onExport}
            isGenerating={isAnyGenerationActive}
            weekNavigation={{
              currentWeek: weekBasedVersionControl.navigationState.currentWeek,
              onWeekChange: weekBasedVersionControl.navigateToWeek,
              onPreviousWeek: weekBasedVersionControl.navigateToPreviousWeek,
              onNextWeek: weekBasedVersionControl.navigateToNextWeek,
              onCurrentWeek: weekBasedVersionControl.navigateToCurrentWeek,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
