import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Loader2,
  Play,
  Plus,
  Settings,
  Trash2,
  Wand2,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface ScheduleActionsProps {
  onAddSchedule: () => void;
  onDeleteSchedule: () => void;
  onGenerateStandardSchedule: () => void;
  onGenerateAiFastSchedule: () => void;
  onGenerateAiDetailedSchedule: () => void;
  onOpenGenerationSettings: () => void;
  onPreviewAiData: () => void;
  onImportAiResponse: () => void;
  onOpenStatistics: () => void;
  onAddFixed: () => void;
  onAddPreferred: () => void;
  onAddAbsence: () => void;
  isLoading: boolean;
  isGenerating: boolean;
  isAiFastGenerating: boolean;
  isAiDetailedGenerating: boolean;
  canAdd: boolean;
  canDelete: boolean;
  canGenerate: boolean;
  isAiEnabled: boolean;
  hasScheduleData: boolean;
}

export function ScheduleActions({
  onAddSchedule,
  onDeleteSchedule,
  onGenerateStandardSchedule,
  onGenerateAiFastSchedule,
  onGenerateAiDetailedSchedule,
  onOpenGenerationSettings,
  onPreviewAiData,
  onImportAiResponse,
  onOpenStatistics,
  onAddFixed,
  onAddPreferred,
  onAddAbsence,
  isGenerating,
  isAiFastGenerating,
  isAiDetailedGenerating,
  isAiEnabled,
}: ScheduleActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle delete with loading state
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteSchedule();
    } finally {
      setIsDeleting(false);
    }
  };

  const isAnyAiGenerating = isAiFastGenerating || isAiDetailedGenerating;

  return (
    <div>
      <div className="flex space-x-2">
        {/* Add Schedule Dropdown - always enabled */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-1"
                // disabled={isLoading || !canAdd}
              >
                <Plus className="h-4 w-4" />
                <span>Hinzufügen</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onAddSchedule}>
                <Plus className="h-4 w-4 mr-2" />
                Schicht hinzufügen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onAddFixed}>
                <Settings className="h-4 w-4 mr-2" />
                Feste Schichtzuweisungen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddPreferred}>
                <Settings className="h-4 w-4 mr-2" />
                Bevorzugte Verfügbarkeit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddAbsence}>
                <Calendar className="h-4 w-4 mr-2" />
                Abwesenheit hinzufügen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Disabled message removed */}
        </div>

        {/* Generate Schedule Dropdown - always enabled */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-1"
                // disabled={isLoading || !canGenerate || isGenerating || isAnyAiGenerating}
              >
                {isGenerating || isAnyAiGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>Generieren</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={onGenerateStandardSchedule}
                // disabled={isGenerating || isAnyAiGenerating}
              >
                <Play className="h-4 w-4 mr-2" />
                Standard-Generierung
              </DropdownMenuItem>
              {isAiEnabled && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onGenerateAiFastSchedule}
                    // disabled={isGenerating || isAnyAiGenerating || isAiFastGenerating}
                  >
                    {isAiFastGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    KI Schnell-Generierung
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onGenerateAiDetailedSchedule}
                    // disabled={isGenerating || isAnyAiGenerating || isAiDetailedGenerating}
                  >
                    {isAiDetailedGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    KI Detail-Generierung
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onOpenGenerationSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Einstellungen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onPreviewAiData}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    KI-Daten Vorschau
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onImportAiResponse}>
                    <Plus className="h-4 w-4 mr-2" />
                    KI-Antwort importieren
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Disabled message removed */}
        </div>

        {/* Delete Button - always enabled */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-1"
                // disabled={isLoading || !canDelete || isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>Löschen</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Schichtplan löschen</AlertDialogTitle>
                <AlertDialogDescription>
                  Möchten Sie wirklich alle Schichtpläne der aktuellen Version
                  löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Disabled message removed */}
        </div>

        {/* Statistics Button - always enabled */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Button
            variant="outline"
            className="flex items-center gap-1"
            // disabled={!hasScheduleData}
            onClick={onOpenStatistics}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Statistiken</span>
          </Button>
          {/* Disabled message removed */}
        </div>
      </div>
    </div>
  );
}
