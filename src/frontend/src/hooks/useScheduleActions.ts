import { useToast } from "@/components/ui/use-toast";
import {
  exportSchedule,
  importAiScheduleResponse,
  previewAiData,
} from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { format as formatDate } from "date-fns";
import { useCallback } from "react";
import { DateRange } from "react-day-picker";

interface UseScheduleActionsProps {
  effectiveDateRange: DateRange | undefined;
  effectiveSelectedVersionNumber: number | undefined;
  addGenerationLog: (level: string, message: string, details?: string) => void;
  setAiPreviewData: (
    data: {
      status: string;
      data_pack: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      optimized_data?: Record<string, unknown>;
      system_prompt?: string;
    } | null,
  ) => void;
  setIsAiDataPreviewOpen: (open: boolean) => void;
}

export function useScheduleActions({
  effectiveDateRange,
  effectiveSelectedVersionNumber,
  addGenerationLog,
  setAiPreviewData,
  setIsAiDataPreviewOpen,
}: UseScheduleActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getErrorMessage = useCallback((error: unknown): string => {
    if (error && typeof error === "object" && "message" in error) {
      return (error as Error).message;
    }
    return "Ein unerwarteter Fehler ist aufgetreten";
  }, []);

  // Handle AI response import
  const handleImportAiResponse = useCallback(() => {
    if (
      !effectiveSelectedVersionNumber ||
      !effectiveDateRange?.from ||
      !effectiveDateRange?.to
    ) {
      toast({
        title: "Import nicht möglich",
        description: "Bitte Zeitraum und Version wählen.",
        variant: "destructive",
      });
      return;
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".csv";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    fileInput.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const file = files[0];

        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "version_id",
          effectiveSelectedVersionNumber?.toString() || "1",
        );
        formData.append(
          "start_date",
          formatDate(effectiveDateRange!.from!, "yyyy-MM-dd"),
        );
        formData.append(
          "end_date",
          formatDate(effectiveDateRange!.to!, "yyyy-MM-dd"),
        );

        try {
          toast({
            title: "Import wird verarbeitet",
            description: "Die KI-Antwort wird importiert...",
            variant: "default",
          });

          const data = await importAiScheduleResponse(formData);

          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["schedules"] });
            queryClient.invalidateQueries({ queryKey: ["versions"] });
          }, 100);

          toast({
            title: "Import erfolgreich",
            description:
              data.message ||
              `Es wurden ${data.imported_count} Zuweisungen importiert.`,
            variant: "default",
          });
        } catch (error) {
          toast({
            title: "Import fehlgeschlagen",
            description: `Fehler: ${getErrorMessage(error)}`,
            variant: "destructive",
          });
        }
      }

      document.body.removeChild(fileInput);
    };

    fileInput.click();
  }, [
    effectiveSelectedVersionNumber,
    effectiveDateRange,
    toast,
    queryClient,
    getErrorMessage,
  ]);

  // Handle retry fetch
  const handleRetryFetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
  }, [queryClient]);

  // Handle AI data preview
  const handlePreviewAiData = useCallback(async () => {
    if (!effectiveDateRange?.from || !effectiveDateRange?.to) {
      toast({
        title: "Vorschau nicht möglich",
        description: "Bitte Zeitraum wählen.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Lade KI-Daten...",
        description: "Die optimierten KI-Daten werden abgerufen.",
      });

      const fromStr = formatDate(effectiveDateRange.from, "yyyy-MM-dd");
      const toStr = formatDate(effectiveDateRange.to, "yyyy-MM-dd");

      const aiDataPreview = await previewAiData(fromStr, toStr);

      setAiPreviewData(aiDataPreview);
      setIsAiDataPreviewOpen(true);

      toast({
        title: "KI-Daten geladen",
        description: "Datenvorschau erfolgreich geladen",
      });
    } catch (error) {
      addGenerationLog(
        "error",
        "AI data preview failed",
        getErrorMessage(error),
      );
      toast({
        title: "Fehler beim Laden",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  }, [
    effectiveDateRange,
    toast,
    addGenerationLog,
    getErrorMessage,
    setAiPreviewData,
    setIsAiDataPreviewOpen,
  ]);

  // Handle export (simplified version)
  const handleExport = useCallback(
    async (exportFormat: "standard" | "mep" | "mep-html", filiale?: string) => {
      if (!effectiveDateRange?.from || !effectiveDateRange?.to) {
        toast({
          title: "Export nicht möglich",
          description: "Bitte Zeitraum wählen.",
          variant: "destructive",
        });
        return;
      }

      if (exportFormat === "mep-html") {
        // TODO: Implement HTML MEP export functionality
        toast({
          title: "Funktion nicht verfügbar",
          description: "HTML MEP Export ist noch nicht implementiert.",
          variant: "destructive",
        });
        return;
      }

      try {
        const exportType = exportFormat === "mep" ? "MEP" : "Standard";
        addGenerationLog("info", `Starting ${exportType} PDF export`);

        const response = await exportSchedule(
          formatDate(effectiveDateRange.from, "yyyy-MM-dd"),
          formatDate(effectiveDateRange.to, "yyyy-MM-dd"),
          undefined, // layoutConfig
          exportFormat,
          filiale,
        );

        addGenerationLog("info", `${exportType} PDF export completed`);
        const blob = new Blob([response], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const prefix = exportFormat === "mep" ? "MEP" : "Schichtplan";
        const dateStr = `${formatDate(effectiveDateRange.from, "yyyy-MM-dd")}_${formatDate(effectiveDateRange.to, "yyyy-MM-dd")}`;
        a.download = `${prefix}_${dateStr}.pdf`;

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Export erfolgreich",
          description: `${exportType} PDF wurde heruntergeladen.`,
        });
      } catch (error) {
        addGenerationLog("error", "PDF export failed", getErrorMessage(error));
        toast({
          title: "Fehler beim Export",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      }
    },
    [effectiveDateRange, toast, addGenerationLog, getErrorMessage],
  );

  return {
    handleImportAiResponse,
    handleRetryFetch,
    handlePreviewAiData,
    handleExport,
    getErrorMessage,
  };
}
