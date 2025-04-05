import React from "react";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScheduleOptimizationControlsProps {
  onGenerateSchedule: () => void;
  isGenerating: boolean;
  onResetGeneration: () => void;
  generationProgress: {
    progress: number;
    message: string;
    isComplete: boolean;
  };
}

export function ScheduleOptimizationControls({
  onGenerateSchedule,
  isGenerating,
  onResetGeneration,
  generationProgress,
}: ScheduleOptimizationControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onGenerateSchedule}
              disabled={isGenerating}
              variant="outline"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generiere...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Optimieren
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Optimierter Dienstplan generieren</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {(isGenerating || generationProgress.isComplete) && (
        <div className="flex items-center gap-2">
          {isGenerating && (
            <div className="flex flex-col gap-1 w-36">
              <Progress value={generationProgress.progress} className="h-2" />
              <p className="text-xs text-muted-foreground truncate">
                {generationProgress.message ||
                  "Generiere optimierten Dienstplan..."}
              </p>
            </div>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onResetGeneration}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Generierungsstatus zurücksetzen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
