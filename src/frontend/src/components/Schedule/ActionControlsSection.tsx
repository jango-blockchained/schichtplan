import { ScheduleActions } from "@/components/Schedule/ScheduleActions";
import { ActionDock } from "@/components/dock/ActionDock";
import type { WeekVersionMeta } from "@/types/weekVersion";
import { DateRange } from "react-day-picker";

export interface ActionControlsSectionProps {
  // Schedule state
  isLoading: boolean;
  isGenerating: boolean;
  isAiFastGenerating: boolean;
  isAiDetailedGenerating: boolean;
  
  // Capabilities
  canAdd: boolean;
  canDelete: boolean;
  canGenerate: boolean;
  hasScheduleData: boolean;
  isAiEnabled: boolean;
  
  // Schedule actions
  onAddSchedule: () => void;
  onDeleteSchedule: () => void;
  onGenerateStandardSchedule: () => void;
  onGenerateAiFastSchedule: () => void;
  onGenerateAiDetailedSchedule: () => void;
  onOpenGenerationSettings: () => void;
  onOpenStatistics: () => void;
  
  // AI-specific actions
  onPreviewAiData: () => void;
  onImportAiResponse: () => void;
  
  // Utility actions that correspond to ScheduleActions interface
  onAddFixed: () => void; // Maps to onAddFixedShifts
  onAddUnavailable: () => void;
  onAddPreferred: () => void;
  
  // Action dock props
  showActionDock?: boolean;
  currentVersion?: number;
  selectedDate?: Date;
  dateRange?: DateRange;
  versionMeta?: WeekVersionMeta;
  versionStatus?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  onDockClose?: () => void;
  onDrop?: (employeeId: number, date: Date, shiftId: number) => Promise<void>;
  onAIPrompt?: (prompt: string) => Promise<void>;
}

export function ActionControlsSection({
  // Schedule state
  isLoading,
  isGenerating,
  isAiFastGenerating,
  isAiDetailedGenerating,
  
  // Capabilities
  canAdd,
  canDelete,
  canGenerate,
  hasScheduleData,
  isAiEnabled,
  
  // Schedule actions
  onAddSchedule,
  onDeleteSchedule,
  onGenerateStandardSchedule,
  onGenerateAiFastSchedule,
  onGenerateAiDetailedSchedule,
  onOpenGenerationSettings,
  onOpenStatistics,
  
  // AI-specific actions
  onPreviewAiData,
  onImportAiResponse,
  
  // Utility actions
  onAddFixed,
  onAddUnavailable,
  onAddPreferred,
  
  // Action dock props
  showActionDock = true,
  currentVersion,
  selectedDate,
  dateRange,
  versionMeta,
  versionStatus,
  onDockClose,
  onDrop,
  onAIPrompt,
}: ActionControlsSectionProps) {
  
  return (
    <div className="flex justify-start gap-2 mb-4">
      {/* Main Schedule Actions */}
      <ScheduleActions
        isLoading={isLoading}
        isGenerating={isGenerating}
        isAiFastGenerating={isAiFastGenerating}
        isAiDetailedGenerating={isAiDetailedGenerating}
        canAdd={canAdd}
        canDelete={canDelete}
        canGenerate={canGenerate}
        hasScheduleData={hasScheduleData}
        onAddSchedule={onAddSchedule}
        onDeleteSchedule={onDeleteSchedule}
        onGenerateStandardSchedule={onGenerateStandardSchedule}
        onGenerateAiFastSchedule={onGenerateAiFastSchedule}
        onGenerateAiDetailedSchedule={onGenerateAiDetailedSchedule}
        onOpenGenerationSettings={onOpenGenerationSettings}
        onOpenStatistics={onOpenStatistics}
        isAiEnabled={isAiEnabled}
        onPreviewAiData={onPreviewAiData}
        onImportAiResponse={onImportAiResponse}
        onAddFixedShifts={onAddFixed} // Map to the correct prop name
        onAddUnavailable={onAddUnavailable}
        onAddPreferred={onAddPreferred}
      />
      
      {/* Action Dock */}
      {showActionDock && (
        <ActionDock
          currentVersion={currentVersion}
          selectedDate={selectedDate}
          dateRange={dateRange}
          versionMeta={versionMeta}
          versionStatus={versionStatus}
          onClose={onDockClose}
          onDrop={onDrop}
          onAIPrompt={onAIPrompt}
        />
      )}
    </div>
  );
}
