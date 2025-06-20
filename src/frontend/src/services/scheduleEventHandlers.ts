import { QueryClient } from '@tanstack/react-query';
import { addDays, differenceInDays, format, startOfWeek } from 'date-fns';
import type { DateRange } from 'react-day-picker';

// Types
interface ToastFunction {
  (options: {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }): void;
}

interface ScheduleEventHandlersConfig {
  queryClient: QueryClient;
  toast: ToastFunction;
  addGenerationLog: (level: 'info' | 'error', message: string, details?: string) => void;
}

interface CreateNewVersionOptions {
  dateRange: DateRange;
  weekAmount?: number;
  isUserInitiated?: boolean;
}

interface ExportOptions {
  format: 'standard' | 'mep' | 'mep-html';
  filiale?: string;
}

/**
 * Service class for handling complex schedule-related event logic
 * This centralizes business logic that was previously scattered across components
 */
export class ScheduleEventHandlers {
  private queryClient: QueryClient;
  private toast: ToastFunction;
  private addGenerationLog: (level: 'info' | 'error', message: string, details?: string) => void;

  constructor(config: ScheduleEventHandlersConfig) {
    this.queryClient = config.queryClient;
    this.toast = config.toast;
    this.addGenerationLog = config.addGenerationLog;
  }

  /**
   * Handles creating a new version with comprehensive validation and error handling
   */
  async handleCreateNewVersion(
    options: CreateNewVersionOptions,
    createVersionFn: (options: CreateNewVersionOptions) => Promise<void>
  ): Promise<void> {
    try {
      if (!options.dateRange.from || !options.dateRange.to) {
        this.toast({
          title: "Ungültiger Zeitraum",
          description: "Bitte wählen Sie einen gültigen Zeitraum für die neue Version.",
          variant: "destructive",
        });
        return;
      }

      // Calculate week amount if not provided
      if (!options.weekAmount) {
        const daysDiff = differenceInDays(options.dateRange.to, options.dateRange.from);
        options.weekAmount = Math.ceil((daysDiff + 1) / 7);
      }

      this.addGenerationLog(
        "info",
        "Creating new version",
        `Date range: ${format(options.dateRange.from, "yyyy-MM-dd")} - ${format(options.dateRange.to, "yyyy-MM-dd")}, Weeks: ${options.weekAmount}`
      );

      await createVersionFn(options);

      this.toast({
        title: "Version erstellt",
        description: `Neue Version für ${options.weekAmount} Woche(n) erfolgreich erstellt.`,
      });

      // Invalidate relevant queries
      this.queryClient.invalidateQueries({ queryKey: ["versions"] });
      this.queryClient.invalidateQueries({ queryKey: ["schedules"] });

    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.addGenerationLog("error", "Failed to create new version", errorMessage);
      this.toast({
        title: "Fehler beim Erstellen der Version",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  /**
   * Handles schedule deletion with proper confirmation and cleanup
   */
  async handleDeleteSchedule(
    scheduleData: any[],
    selectedVersion: number | undefined,
    deleteScheduleFn: (scheduleId: number, updateData: any) => Promise<void>
  ): Promise<void> {
    if (!selectedVersion) {
      this.toast({
        title: "Keine Version ausgewählt",
        description: "Bitte wählen Sie eine Version aus.",
        variant: "destructive",
      });
      return;
    }

    if (!scheduleData || scheduleData.length === 0) {
      this.toast({
        title: "Keine Schichtpläne",
        description: "Keine Schichtpläne zum Löschen vorhanden.",
        variant: "destructive",
      });
      return;
    }

    try {
      const schedulesToDelete = scheduleData.filter(s => s.shift_id !== null);
      
      if (schedulesToDelete.length === 0) {
        this.toast({
          title: "Keine Schichten zum Löschen",
          variant: "destructive",
        });
        return;
      }

      this.addGenerationLog(
        "info",
        "Starting schedule deletion",
        `Deleting ${schedulesToDelete.length} schedules for version ${selectedVersion}`
      );

      // Process deletions in batches to avoid overwhelming the server
      const batchSize = 10;
      let processedCount = 0;

      for (let i = 0; i < schedulesToDelete.length; i += batchSize) {
        const batch = schedulesToDelete.slice(i, i + batchSize);
        const deletePromises = batch.map(s =>
          deleteScheduleFn(s.id, {
            shift_id: null,
            version: selectedVersion,
          })
        );

        try {
          await Promise.all(deletePromises);
          processedCount += batch.length;
        } catch (batchError) {
          console.error("Batch delete error:", batchError);
          // Continue with next batch
        }
      }

      this.queryClient.invalidateQueries({ queryKey: ["schedules"] });
      
      this.toast({
        title: "Schichtpläne gelöscht",
        description: `${processedCount} Schichten erfolgreich entfernt.`,
      });

      this.addGenerationLog("info", "Schedule deletion completed", `${processedCount} schedules deleted`);

    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.addGenerationLog("error", "Schedule deletion failed", errorMessage);
      this.toast({
        title: "Fehler beim Löschen",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  /**
   * Handles schedule export with format-specific logic
   */
  async handleExportSchedule(
    options: ExportOptions,
    dateRange: DateRange | undefined,
    exportFn: (startDate: string, endDate: string, config: any, format: string, filiale?: string) => Promise<Blob>
  ): Promise<void> {
    if (!dateRange?.from || !dateRange?.to) {
      this.toast({
        title: "Export nicht möglich",
        description: "Bitte wählen Sie einen Zeitraum aus.",
        variant: "destructive",
      });
      return;
    }

    try {
      const exportType = options.format === 'mep' ? 'MEP' : 'Standard';
      this.addGenerationLog("info", `Starting ${exportType} export`);

      const startDate = format(dateRange.from, "yyyy-MM-dd");
      const endDate = format(dateRange.to, "yyyy-MM-dd");

      const blob = await exportFn(
        startDate,
        endDate,
        undefined, // layoutConfig
        options.format,
        options.filiale
      );

      // Generate appropriate filename
      const prefix = options.format === 'mep' ? 'MEP' : 'Schichtplan';
      const dateStr = `${startDate}_${endDate}`;
      const filename = `${prefix}_${dateStr}.pdf`;

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      this.addGenerationLog("info", `${exportType} export completed`);
      this.toast({
        title: "Export erfolgreich",
        description: `${exportType} wurde als ${filename} heruntergeladen.`,
      });

    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.addGenerationLog("error", "Export failed", errorMessage);
      this.toast({
        title: "Fehler beim Export",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  /**
   * Handles week-based navigation with proper date calculations
   */
  handleWeekNavigation(
    direction: 'previous' | 'next',
    currentDateRange: DateRange | undefined,
    weekAmount: number,
    updateDateRange: (range: DateRange) => void
  ): void {
    try {
      if (!currentDateRange?.from) {
        // Initialize with current week if no date range is set
        const today = new Date();
        const from = startOfWeek(today, { weekStartsOn: 1 });
        from.setHours(0, 0, 0, 0);
        const to = addDays(from, (weekAmount * 7) - 1);
        to.setHours(23, 59, 59, 999);
        updateDateRange({ from, to });
        return;
      }

      const weeksToMove = direction === 'next' ? weekAmount : -weekAmount;
      const daysToMove = weeksToMove * 7;

      const newFrom = addDays(currentDateRange.from, daysToMove);
      newFrom.setHours(0, 0, 0, 0);
      
      const newTo = addDays(currentDateRange.to || newFrom, daysToMove);
      newTo.setHours(23, 59, 59, 999);

      updateDateRange({ from: newFrom, to: newTo });

      this.addGenerationLog(
        "info",
        `Navigated ${direction}`,
        `New date range: ${format(newFrom, "yyyy-MM-dd")} - ${format(newTo, "yyyy-MM-dd")}`
      );

    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.addGenerationLog("error", "Week navigation failed", errorMessage);
      this.toast({
        title: "Navigationsfehler",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  /**
   * Validates date range for schedule operations
   */
  validateDateRange(dateRange: DateRange | undefined): boolean {
    if (!dateRange?.from || !dateRange?.to) {
      this.toast({
        title: "Ungültiger Zeitraum",
        description: "Bitte wählen Sie einen gültigen Zeitraum aus.",
        variant: "destructive",
      });
      return false;
    }

    if (dateRange.from > dateRange.to) {
      this.toast({
        title: "Ungültiger Zeitraum",
        description: "Das Startdatum muss vor dem Enddatum liegen.",
        variant: "destructive",
      });
      return false;
    }

    // Check for reasonable date range (not too far in the past or future)
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const oneYearFromNow = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

    if (dateRange.from < oneYearAgo || dateRange.to > oneYearFromNow) {
      this.toast({
        title: "Ungewöhnlicher Zeitraum",
        description: "Der gewählte Zeitraum liegt außerhalb des empfohlenen Bereichs (1 Jahr vor/nach heute).",
        variant: "destructive",
      });
      return false;
    }

    return true;
  }

  /**
   * Utility method to extract error messages from various error types
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return 'Ein unbekannter Fehler ist aufgetreten';
  }

  /**
   * Invalidates all schedule-related queries
   */
  invalidateScheduleQueries(): void {
    this.queryClient.invalidateQueries({ queryKey: ["schedules"] });
    this.queryClient.invalidateQueries({ queryKey: ["versions"] });
    this.queryClient.invalidateQueries({ queryKey: ["employees"] });
    this.queryClient.invalidateQueries({ queryKey: ["settings"] });
  }
}
