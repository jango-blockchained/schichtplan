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
  CalendarPlus,
  CheckCircle,
  Eye,
  Heart,
  Loader2,
  Play,
  Plus,
  Settings,
  Sliders,
  Trash2,
  XCircle,
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
  onAddUnavailable: () => void;
  onAddPreferred: () => void;
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
  onAddUnavailable,
  onAddPreferred,
  isLoading,
  isGenerating,
  isAiFastGenerating,
  isAiDetailedGenerating,
  canAdd,
  canDelete,
  canGenerate,
  isAiEnabled,
  hasScheduleData,
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
    <div className="flex space-x-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-1"
            disabled={isLoading || !canAdd}
          >
            <Plus className="h-4 w-4" />
            <span>Hinzufügen</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onAddSchedule}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            <span>Neue Schicht</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onAddFixed}>
            <CheckCircle className="h-4 w-4 mr-2" />
            <span>Feste Verfügbarkeiten</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddPreferred}>
            <Heart className="h-4 w-4 mr-2" />
            <span>Bevorzugte Verfügbarkeiten</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddUnavailable}>
            <XCircle className="h-4 w-4 mr-2" />
            <span>Nicht verfügbare Zeiten</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-1"
            disabled={isLoading || !canGenerate || isGenerating || isAnyAiGenerating}
          >
            <Play className="h-4 w-4" />
            <span>Generieren</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={onOpenGenerationSettings}>
            <Settings className="h-4 w-4 mr-2" />
            <span>Einstellungen</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onGenerateStandardSchedule}
            disabled={isGenerating || isLoading || isAnyAiGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            <span>Standard Generierung</span>
          </DropdownMenuItem>
          {isAiEnabled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onGenerateAiFastSchedule}
                disabled={isGenerating || isLoading || isAnyAiGenerating}
              >
                {isAiFastGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                <span>Schnelle KI-Generierung</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onGenerateAiDetailedSchedule}
                disabled={isGenerating || isLoading || isAnyAiGenerating}
              >
                {isAiDetailedGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sliders className="h-4 w-4 mr-2" />
                )}
                <span>Erweiterte KI-Generierung</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onPreviewAiData}
                disabled={isGenerating || isLoading || isAnyAiGenerating}
              >
                <Eye className="h-4 w-4 mr-2" />
                <span>KI Daten Vorschau</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onImportAiResponse}
                disabled={isGenerating || isLoading || isAnyAiGenerating}
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                <span>KI Response Importieren</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-1"
            disabled={isLoading || !canDelete || isDeleting}
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

      {/* Statistics Button */}
      <Button
        variant="outline"
        className="flex items-center gap-1"
        disabled={!hasScheduleData}
        onClick={onOpenStatistics}
      >
        <BarChart3 className="h-4 w-4" />
        <span>Statistiken</span>
      </Button>
    </div>
  );
}
