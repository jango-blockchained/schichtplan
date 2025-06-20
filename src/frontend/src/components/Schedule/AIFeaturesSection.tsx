import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Brain,
    Eye,
    Settings,
    Sparkles,
    Upload,
    Zap
} from "lucide-react";
import { DateRange } from "react-day-picker";

export interface AIFeaturesSectionProps {
  // Visibility
  isAiEnabled: boolean;
  
  // AI State
  isAiFastGenerating: boolean;
  isAiDetailedGenerating: boolean;
  isAiDataPreviewOpen: boolean;
  
  // Capabilities
  canGenerate: boolean;
  hasScheduleData: boolean;
  
  // Date range for AI operations
  dateRange: DateRange | undefined;
  selectedVersion: number | undefined;
  
  // AI Actions
  onGenerateAiFastSchedule: () => void;
  onGenerateAiDetailedSchedule: () => void;
  onPreviewAiData: () => void;
  onImportAiResponse: () => void;
  onOpenAiSettings?: () => void;
  
  // Configuration
  showAdvancedFeatures?: boolean;
  aiCapabilities?: {
    fastGeneration: boolean;
    detailedGeneration: boolean;
    dataPreview: boolean;
    responseImport: boolean;
  };
}

export function AIFeaturesSection({
  isAiEnabled,
  isAiFastGenerating,
  isAiDetailedGenerating,
  isAiDataPreviewOpen,
  canGenerate,
  hasScheduleData,
  dateRange,
  selectedVersion,
  onGenerateAiFastSchedule,
  onGenerateAiDetailedSchedule,
  onPreviewAiData,
  onImportAiResponse,
  onOpenAiSettings,
  showAdvancedFeatures = true,
  aiCapabilities = {
    fastGeneration: true,
    detailedGeneration: true,
    dataPreview: true,
    responseImport: true,
  },
}: AIFeaturesSectionProps) {
  
  // Don't render if AI is not enabled
  if (!isAiEnabled) {
    return null;
  }
  
  const isGenerating = isAiFastGenerating || isAiDetailedGenerating;
  const canPerformAiOperations = canGenerate && dateRange?.from && dateRange?.to && selectedVersion;
  
  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Brain className="h-5 w-5" />
          KI-gestützte Schichtplanung
          <Badge variant="secondary" className="ml-auto">
            Beta
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generation Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Fast AI Generation */}
          {aiCapabilities.fastGeneration && (
            <Button
              variant="outline"
              onClick={onGenerateAiFastSchedule}
              disabled={!canPerformAiOperations || isGenerating}
              className="flex items-center gap-2 h-auto p-3 bg-white dark:bg-gray-900"
            >
              <Zap className="h-4 w-4 text-yellow-500" />
              <div className="text-left">
                <div className="font-medium">Schnelle KI</div>
                <div className="text-xs text-muted-foreground">
                  Optimierte Generierung
                </div>
              </div>
              {isAiFastGenerating && (
                <div className="animate-spin ml-auto">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
            </Button>
          )}
          
          {/* Detailed AI Generation */}
          {aiCapabilities.detailedGeneration && (
            <Button
              variant="outline"
              onClick={onGenerateAiDetailedSchedule}
              disabled={!canPerformAiOperations || isGenerating}
              className="flex items-center gap-2 h-auto p-3 bg-white dark:bg-gray-900"
            >
              <Brain className="h-4 w-4 text-blue-500" />
              <div className="text-left">
                <div className="font-medium">Erweiterte KI</div>
                <div className="text-xs text-muted-foreground">
                  Mit Konfiguration
                </div>
              </div>
              {isAiDetailedGenerating && (
                <div className="animate-spin ml-auto">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
            </Button>
          )}
        </div>
        
        {/* Advanced Features */}
        {showAdvancedFeatures && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Erweiterte Funktionen
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* Data Preview */}
                {aiCapabilities.dataPreview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPreviewAiData}
                    disabled={!dateRange?.from || !dateRange?.to}
                    className="flex items-center gap-2 justify-start"
                  >
                    <Eye className="h-4 w-4" />
                    Daten-Vorschau
                  </Button>
                )}
                
                {/* Import Response */}
                {aiCapabilities.responseImport && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onImportAiResponse}
                    disabled={!selectedVersion || !dateRange?.from || !dateRange?.to}
                    className="flex items-center gap-2 justify-start"
                  >
                    <Upload className="h-4 w-4" />
                    KI-Import
                  </Button>
                )}
                
                {/* AI Settings */}
                {onOpenAiSettings && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onOpenAiSettings}
                    className="flex items-center gap-2 justify-start"
                  >
                    <Settings className="h-4 w-4" />
                    Einstellungen
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
        
        {/* Status Information */}
        {!canPerformAiOperations && (
          <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
            💡 Für KI-Generierung benötigt: Zeitraum auswählen und Version erstellen
          </div>
        )}
        
        {isGenerating && (
          <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-2 rounded flex items-center gap-2">
            <div className="animate-spin">
              <Sparkles className="h-3 w-3" />
            </div>
            KI-Generierung läuft...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
