import React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertCircle,
  Circle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Loader2,
  Info,
  AlertTriangle,
} from "lucide-react";
import { fixShiftDurations } from "@/services/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GenerationStep, GenerationLog } from "@/hooks/useScheduleGeneration";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface GenerationOverlayProps {
  generationSteps: GenerationStep[];
  generationLogs: GenerationLog[];
  showGenerationOverlay: boolean;
  isPending: boolean;
  resetGenerationState: () => void;
  addGenerationLog: (
    type: "info" | "warning" | "error",
    message: string,
    details?: string,
  ) => void;
}

export const GenerationOverlay: React.FC<GenerationOverlayProps> = ({
  generationSteps,
  generationLogs,
  showGenerationOverlay,
  isPending,
  resetGenerationState,
  addGenerationLog,
}) => {
  const { toast } = useToast();

  // Check if there are any errors in the generation steps
  const hasErrors = generationSteps.some((step) => step.status === "error");
  const errorLogs = generationLogs.filter((log) => log.type === "error");
  const hasDurationError = errorLogs.some((log) => {
    const message = (log.message || "").toLowerCase();
    const details = (log.details || "").toLowerCase();

    // Check for various patterns that indicate duration_hours issues
    const durationPatterns = [
      "duration_hours",
      "schichtdauer",
      "nonetype",
      "attribute",
      "none",
      "shift",
      "duration",
      "has no attribute",
      "fehlt ein attribut",
      "missing attribute",
    ];

    return durationPatterns.some(
      (pattern) => message.includes(pattern) || details.includes(pattern),
    );
  });

  // Function to fix shift durations
  const handleFixShiftDurations = async () => {
    try {
      // Show loading state
      toast({
        title: "Schichtdauer wird berechnet",
        description:
          "Bitte warten Sie, während die Schichtdauer berechnet wird...",
      });

      // Add a log to show we're attempting to fix the issue
      addGenerationLog(
        "info",
        "Versuche, Schichtdauer zu berechnen",
        "Die fehlenden Schichtdauern werden automatisch berechnet und aktualisiert.",
      );

      // Call the API to fix shift durations
      const result = await fixShiftDurations();

      // Show success message
      toast({
        title: "Schichtdauer berechnet",
        description: `${result.fixed_count} Schichten wurden aktualisiert. Bitte versuchen Sie erneut, den Dienstplan zu generieren.`,
        variant: "default",
      });

      // Add a success log
      addGenerationLog(
        "info",
        "Schichtdauer erfolgreich berechnet",
        `${result.fixed_count} Schichten wurden aktualisiert. Sie können jetzt den Dienstplan erneut generieren.`,
      );

      // Reset the generation state after a short delay to allow the user to see the success message
      setTimeout(() => {
        resetGenerationState();
      }, 2000);
    } catch (error) {
      console.error("Error fixing shift durations:", error);

      // Add an error log
      addGenerationLog(
        "error",
        "Fehler bei der Berechnung der Schichtdauer",
        error instanceof Error
          ? error.message
          : "Ein unerwarteter Fehler ist aufgetreten",
      );

      toast({
        variant: "destructive",
        title: "Fehler",
        description:
          error instanceof Error
            ? error.message
            : "Ein unerwarteter Fehler ist aufgetreten",
      });
    }
  };

  const getIcon = (status: GenerationStep["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "in-progress":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getLogIcon = (type: GenerationLog["type"]) => {
    switch (type) {
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const isComplete = generationSteps.every(
    (step) => step.status === "completed",
  );
  const hasError = generationSteps.some((step) => step.status === "error");

  if (!showGenerationOverlay) return null;

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => !open && resetGenerationState()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : hasError ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
            {isComplete
              ? "Generierung abgeschlossen"
              : hasError
                ? "Fehler bei der Generierung"
                : "Generiere Dienstplan"}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          {/* Steps Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-md">Fortschritt</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {generationSteps.map((step) => (
                  <li key={step.id} className="flex items-center gap-3">
                    {getIcon(step.status)}
                    <span
                      className={cn(
                        "text-sm",
                        step.status === "error" && "text-red-600 font-medium",
                        step.status === "completed" && "text-green-600",
                      )}
                    >
                      {step.title}
                    </span>
                    {step.message && (
                      <span className="text-xs text-muted-foreground ml-auto truncate">
                        {" "}
                        - {step.message}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Logs Section with ScrollArea */}
          <Card>
            <CardHeader>
              <CardTitle className="text-md">Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] w-full rounded-md border p-3 text-sm">
                {generationLogs.length === 0 ? (
                  <p className="text-muted-foreground italic">
                    Keine Logs verfügbar.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {generationLogs.map((log, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-0.5">{getLogIcon(log.type)}</span>
                        <div className="flex-1">
                          <p className="font-medium leading-tight">
                            {log.message}
                          </p>
                          {log.details && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {log.details}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground/70">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        <DialogFooter className="mt-4">
          <Button onClick={resetGenerationState} variant="outline">
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerationOverlay;
