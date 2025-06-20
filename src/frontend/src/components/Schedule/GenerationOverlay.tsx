import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { fixShiftDurations } from "@/services/api";
import {
  AlertCircle,
  CheckCircle,
  Circle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import React from "react";

// Define types for the component props
export interface GenerationStep {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed" | "error";
  message?: string;
}

export interface GenerationLog {
  type: "info" | "warning" | "error";
  timestamp: string;
  message: string;
  details?: string;
}

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
  const hasErrors = (generationSteps || []).some((step) => step.status === "error");
  const errorLogs = (generationLogs || []).filter((log) => log.type === "error");
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

  if (!showGenerationOverlay) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="relative bg-card text-card-foreground rounded-lg p-6 max-w-md w-full mx-4 
                        before:content-[''] before:absolute before:-inset-1 before:rounded-lg before:bg-gradient-to-tr before:from-purple-600 before:via-pink-500 before:to-indigo-600 before:opacity-40 before:blur-xl before:animate-pulse before:-z-10 
                        after:content-[''] after:absolute after:-inset-1.5 after:rounded-lg after:bg-gradient-to-bl after:from-violet-500 after:via-fuchsia-500 after:to-blue-600 after:opacity-30 after:blur-2xl after:animate-pulse after:[animation-delay:'-0.5s'] after:-z-20"
      >
        <div className="relative z-10">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold">
              {hasErrors ? (
                <span className="text-red-500 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Fehler bei der Generierung
                </span>
              ) : (
                "Generiere Schichtplan"
              )}
            </h2>
          </div>

          <div className="py-4">
            {!hasErrors ? (
              <div className="text-center mb-4">
                Bitte warten Sie, während der Schichtplan generiert wird...
              </div>
            ) : (
              <div className="text-center mb-4 text-red-500">
                Bei der Generierung des Schichtplans ist ein Fehler aufgetreten.
              </div>
            )}

            <div className="space-y-4 mt-4">
              {(generationSteps || []).map((step) => (
                <div key={step.id} className="flex items-center">
                  <div className="mr-4 flex-shrink-0">
                    {step.status === "completed" ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : step.status === "in-progress" ? (
                      <Circle className="h-6 w-6 text-primary animate-pulse" />
                    ) : step.status === "error" ? (
                      <XCircle className="h-6 w-6 text-red-500" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-grow">
                    <div className="font-medium">{step.title}</div>
                    {step.message && (
                      <div
                        className={`text-sm ${step.status === "error" ? "text-red-500" : "text-muted-foreground"}`}
                      >
                        {step.message}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Show all generation logs */}
            {generationLogs && generationLogs.length > 0 && (
              <div className="mt-6 p-3 border rounded-md">
                <h4 className="font-medium mb-2">
                  Generierungs-Protokoll:
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {generationLogs.map((log, index) => (
                    <div key={index} className={`text-sm p-2 rounded border-l-4 ${
                      log.type === "error" ? "border-red-500 bg-red-50 text-red-700" :
                      log.type === "warning" ? "border-yellow-500 bg-yellow-50 text-yellow-700" :
                      "border-blue-500 bg-blue-50 text-blue-700"
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="font-medium">{log.message}</div>
                        <div className="text-xs opacity-75">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      {log.details && (
                        <div className="text-xs mt-1 opacity-90">{log.details}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show error details if there are any */}
            {hasErrors && errorLogs.length > 0 && (
              <div className="mt-6 p-3 border rounded-md">
                <h4 className="font-medium text-destructive mb-2">
                  Fehlerdetails:
                </h4>
                <ul className="space-y-2 text-sm text-destructive-foreground">
                  {errorLogs.map((log, index) => (
                    <li key={index}>
                      <div className="font-medium">{log.message}</div>
                      {log.details && (
                        <div className="text-xs mt-1">{log.details}</div>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Show specific help for known errors */}
                {hasDurationError && (
                  <div className="mt-3 p-2 border rounded-md text-sm">
                    <strong>Tipp:</strong> Es scheint ein Problem mit der
                    Schichtdauer zu geben. Dies kann auftreten, wenn Schichten
                    keine gültige Dauer haben.
                    <p className="mt-1">
                      Klicken Sie auf die Schaltfläche unten, um die
                      Schichtdauer automatisch zu berechnen. Dies wird die Dauer
                      für alle Schichten basierend auf deren Start- und
                      Endzeiten berechnen.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 flex items-center justify-center"
                      onClick={handleFixShiftDurations}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Schichtdauer automatisch berechnen
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Progress
              value={
                ((generationSteps || []).filter((step) => step.status === "completed")
                  .length /
                  Math.max((generationSteps || []).length, 1)) *
                100
              }
              className="mt-6"
            />

            {/* Force cancel button - only show if we've been processing for a while or there's an error */}
            {(hasErrors || !isPending) && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant={hasErrors ? "destructive" : "outline"}
                  onClick={resetGenerationState}
                  className="w-full"
                >
                  {hasErrors ? "Schließen" : "Fertig"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerationOverlay;
