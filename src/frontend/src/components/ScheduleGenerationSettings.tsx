import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { GenerationOptions } from "@/hooks/useScheduleGeneration";
import { Settings } from "@/types";
import { Play, RefreshCw, Save } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";

/**
 * Definition of schedule generation requirements with labels and descriptions
 */
const SCHEDULE_REQUIREMENTS = [
  {
    key: "enforce_minimum_coverage",
    label: "Mindestbesetzung",
    description:
      "Stellt sicher, dass für jeden Zeitraum genügend Mitarbeiter eingeplant sind",
  },
  {
    key: "enforce_contracted_hours",
    label: "Vertragsstunden",
    description:
      "Passt die geplanten Stunden an die Mitarbeiterverträge an (VZ/TZ)",
  },
  {
    key: "enforce_keyholder_coverage",
    label: "Schlüsselträger-Abdeckung",
    description:
      "Stellt sicher, dass Schlüsselträger für Öffnungs-/Schließdienste eingeplant sind",
  },
  {
    key: "enforce_rest_periods",
    label: "Ruhezeiten",
    description: "Hält Mindestpausen zwischen Schichten ein",
  },
  {
    key: "enforce_early_late_rules",
    label: "Früh-/Spätschicht-Regeln",
    description: "Wendet Regeln für Früh- und Spätschichtzuweisungen an",
  },
  {
    key: "enforce_employee_group_rules",
    label: "Mitarbeitergruppen-Regeln",
    description:
      "Befolgt spezifische Regeln für verschiedene Mitarbeitergruppen (TZ/GFB)",
  },
  {
    key: "enforce_break_rules",
    label: "Pausenregelungen",
    description: "Plant erforderliche Pausen basierend auf der Schichtdauer",
  },
  {
    key: "enforce_max_hours",
    label: "Maximale Arbeitszeit",
    description: "Respektiert tägliche und wöchentliche Höchstarbeitszeiten",
  },
  {
    key: "enforce_consecutive_days",
    label: "Aufeinanderfolgende Tage",
    description: "Begrenzt die Anzahl aufeinanderfolgender Arbeitstage",
  },
  {
    key: "enforce_weekend_distribution",
    label: "Wochenendverteilung",
    description: "Sorgt für eine faire Verteilung der Wochenendschichten",
  },
  {
    key: "enforce_shift_distribution",
    label: "Schichtverteilung",
    description: "Gleicht verschiedene Schichttypen unter den Mitarbeitern aus",
  },
  {
    key: "enforce_availability",
    label: "Mitarbeiterverfügbarkeit",
    description: "Berücksichtigt Verfügbarkeitspräferenzen der Mitarbeiter",
  },
  {
    key: "enforce_qualifications",
    label: "Qualifikationen",
    description: "Passt Mitarbeiterfähigkeiten an Schichtanforderungen an",
  },
  {
    key: "enforce_opening_hours",
    label: "Öffnungszeiten",
    description: "Richtet Dienstpläne an den Ladenöffnungszeiten aus",
  },
];

// Define the type for requirement keys
type RequirementKey = (typeof SCHEDULE_REQUIREMENTS)[number]["key"];

// Default generation requirements used when settings don't provide them
const DEFAULT_REQUIREMENTS: Record<RequirementKey, boolean> =
  Object.fromEntries(
    SCHEDULE_REQUIREMENTS.map((req) => [req.key, true]),
  ) as Record<RequirementKey, boolean>;

interface ScheduleGenerationSettingsProps {
  /** Current generation requirements settings */
  settings: Partial<Settings["scheduling"]["generation_requirements"]> | null;
  /** Callback for updating generation requirements */
  onUpdate: (updatedRequirements: Record<RequirementKey, boolean>) => void;
  /** Current generation options */
  generationOptions?: GenerationOptions;
  /** Callback for updating generation options */
  onGenerationOptionsUpdate?: (options: GenerationOptions) => void;
  /** Whether to create empty schedules during generation */
  createEmptySchedules?: boolean;
  /** Whether to include empty schedules in the view */
  includeEmpty?: boolean;
  /** Whether to enable diagnostic results */
  enableDiagnostics?: boolean;
  /** Handler for changing createEmptySchedules */
  onCreateEmptyChange?: (checked: boolean) => void;
  /** Handler for changing includeEmpty */
  onIncludeEmptyChange?: (checked: boolean) => void;
  /** Handler for changing enableDiagnostics */
  onEnableDiagnosticsChange?: (checked: boolean) => void;
  /** Handler for generating schedule */
  onGenerateSchedule?: () => void;
  /** Whether schedule generation is in progress */
  isGenerating?: boolean;
}

/**
 * ScheduleGenerationSettings provides a UI for configuring schedule generation options
 * including constraints, empty schedule handling, and triggering generation.
 */
export function ScheduleGenerationSettings({
  settings,
  onUpdate,
  generationOptions = {
    keepExistingAssignments: false,
    usePhase1FixedAssignments: true,
    usePhase2PreferredAvailability: true,
    usePhase3StandardGeneration: true,
  },
  onGenerationOptionsUpdate,
  createEmptySchedules,
  includeEmpty,
  enableDiagnostics,
  onCreateEmptyChange,
  onIncludeEmptyChange,
  onEnableDiagnosticsChange,
  onGenerateSchedule,
  isGenerating,
}: ScheduleGenerationSettingsProps): React.ReactElement {
  const { toast } = useToast();

  // Use local state to track changes to requirements
  const [localRequirements, setLocalRequirements] = useState<
    Record<RequirementKey, boolean>
  >(() => {
    // Initialize with settings if available, otherwise use defaults
    if (settings) {
      const req = { ...DEFAULT_REQUIREMENTS };
      Object.keys(settings).forEach(
        (key) => {
          if (key in req && settings[key as RequirementKey] !== undefined) {
            req[key as RequirementKey] =
              !!settings[key as RequirementKey];
          }
        },
      );
      return req;
    }
    return { ...DEFAULT_REQUIREMENTS };
  });

  // Update local state when settings change
  useEffect(() => {
    if (settings) {
      const req = { ...DEFAULT_REQUIREMENTS };
      Object.keys(settings).forEach(
        (key) => {
          if (key in req && settings[key as RequirementKey] !== undefined) {
            req[key as RequirementKey] =
              !!settings[key as RequirementKey];
          }
        },
      );
      setLocalRequirements(req);
    } else {
      setLocalRequirements({ ...DEFAULT_REQUIREMENTS });
    }
  }, [settings]);

  // Local state for generation options
  const [localGenerationOptions, setLocalGenerationOptions] = useState<GenerationOptions>(generationOptions);

  // Update local generation options when props change
  useEffect(() => {
    setLocalGenerationOptions(generationOptions);
  }, [generationOptions]);

  const handleToggle = (key: RequirementKey, checked: boolean) => {
    const updatedRequirements = {
      ...localRequirements,
      [key]: checked,
    };
    setLocalRequirements(updatedRequirements);
    onUpdate(updatedRequirements);

    // Show a small toast to confirm the change
    const requirement = SCHEDULE_REQUIREMENTS.find((r) => r.key === key);
    if (requirement) {
      toast({
        title: checked ? "Constraint Enabled" : "Constraint Disabled",
        description: `${requirement.label} is now ${checked ? "enabled" : "disabled"}.`,
        duration: 3000,
      });
    }
  };

  const handleGenerationOptionToggle = (key: keyof GenerationOptions, checked: boolean) => {
    const updatedOptions = {
      ...localGenerationOptions,
      [key]: checked,
    };
    setLocalGenerationOptions(updatedOptions);
    onGenerationOptionsUpdate?.(updatedOptions);
  };

  const handleSave = () => {
    try {
      onUpdate(localRequirements);

      // Only show success message when explicitly saving
      toast({
        title: "Einstellungen gespeichert",
        description:
          "Die Anforderungen für die Dienstplangenerierung wurden aktualisiert.",
      });
    } catch (error) {
      toast({
        title: "Fehler beim Speichern",
        description:
          error instanceof Error
            ? error.message
            : "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive",
      });
    }
  };

  // Determine if we should show the schedule generation controls
  const showGenerationControls =
    createEmptySchedules !== undefined &&
    includeEmpty !== undefined &&
    onCreateEmptyChange !== undefined &&
    onIncludeEmptyChange !== undefined &&
    onGenerateSchedule !== undefined;

  return (
    <div className="space-y-6">
      {/* Generation Strategy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Generierungsstrategie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Keep/Delete existing assignments */}
            <div className="flex items-center justify-between space-x-3 p-3 border rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  Vorhandene Zuweisungen beibehalten
                </Label>
                <p className="text-xs text-muted-foreground">
                  Wenn aktiviert, werden bestehende Schichtzuweisungen nicht überschrieben.
                  Wenn deaktiviert, werden alle Zuweisungen gelöscht und neu generiert.
                </p>
              </div>
              <Switch
                checked={localGenerationOptions.keepExistingAssignments}
                onCheckedChange={(checked) =>
                  handleGenerationOptionToggle("keepExistingAssignments", checked)
                }
              />
            </div>

            <Separator />

            {/* Phase Controls */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Generierungsphasen</Label>
              <p className="text-xs text-muted-foreground">
                Wählen Sie, welche Phasen der Generierung ausgeführt werden sollen.
              </p>

              <div className="space-y-3">
                {/* Phase 1: Fixed Assignments */}
                <div className="flex items-center justify-between space-x-3 p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">
                      Phase 1: Feste Schichtzuweisungen
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Verarbeitet feste Verfügbarkeiten und erstellt direkte Schichtzuweisungen
                    </p>
                  </div>
                  <Switch
                    checked={localGenerationOptions.usePhase1FixedAssignments}
                    onCheckedChange={(checked) =>
                      handleGenerationOptionToggle("usePhase1FixedAssignments", checked)
                    }
                  />
                </div>

                {/* Phase 2: Preferred Availability */}
                <div className="flex items-center justify-between space-x-3 p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">
                      Phase 2: Bevorzugte Verfügbarkeiten
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Berücksichtigt bevorzugte Arbeitszeiten bei der Schichtverteilung
                    </p>
                  </div>
                  <Switch
                    checked={localGenerationOptions.usePhase2PreferredAvailability}
                    onCheckedChange={(checked) =>
                      handleGenerationOptionToggle("usePhase2PreferredAvailability", checked)
                    }
                  />
                </div>

                {/* Phase 3: Standard Generation */}
                <div className="flex items-center justify-between space-x-3 p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">
                      Phase 3: Standard-Generierung
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Füllt verbleibende Schichten mit der Standard-Generierungslogik
                    </p>
                  </div>
                  <Switch
                    checked={localGenerationOptions.usePhase3StandardGeneration}
                    onCheckedChange={(checked) =>
                      handleGenerationOptionToggle("usePhase3StandardGeneration", checked)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty Schedules Settings */}
      {showGenerationControls && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Allgemeine Einstellungen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createEmpty"
                  checked={createEmptySchedules}
                  onCheckedChange={onCreateEmptyChange}
                />
                <Label
                  htmlFor="createEmpty"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Leere Dienstpläne erstellen
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeEmpty"
                  checked={includeEmpty}
                  onCheckedChange={onIncludeEmptyChange}
                />
                <Label
                  htmlFor="includeEmpty"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Leere Dienstpläne anzeigen
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enableDiagnostics"
                  checked={enableDiagnostics}
                  onCheckedChange={onEnableDiagnosticsChange}
                />
                <Label
                  htmlFor="enableDiagnostics"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Diagnose-Ergebnisse anzeigen
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Generierungseinstellungen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto border rounded-md p-4">
            {SCHEDULE_REQUIREMENTS.map(({ key, label, description }) => (
              <div
                key={key}
                className="flex items-start space-x-3 p-2 hover:bg-muted/30 rounded-md"
              >
                <Switch
                  id={key}
                  checked={localRequirements[key as RequirementKey]}
                  onCheckedChange={(checked) =>
                    handleToggle(key as RequirementKey, checked)
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor={key} className="text-sm font-medium">
                    {label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Einstellungen speichern
        </Button>

        {showGenerationControls && (
          <Button
            onClick={onGenerateSchedule}
            disabled={isGenerating}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Mehrstufige Generierung starten
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
