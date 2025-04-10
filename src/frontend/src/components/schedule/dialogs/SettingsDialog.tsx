import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings } from "@/types";
import { Button } from "@/components/ui/button";
import { Save, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Settings2, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

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
  /** Current application settings */
  settings: Settings;
  /** Callback for updating generation requirements */
  onUpdate: (
    updates: Partial<Settings["scheduling"]["generation_requirements"]>,
  ) => void;
  /** Whether to create empty schedules during generation */
  createEmptySchedules?: boolean;
  /** Whether to include empty schedules in the view */
  includeEmpty?: boolean;
  /** Handler for changing createEmptySchedules */
  onCreateEmptyChange?: (checked: boolean) => void;
  /** Handler for changing includeEmpty */
  onIncludeEmptyChange?: (checked: boolean) => void;
  /** Handler for generating schedule */
  onGenerateSchedule?: () => void;
  /** Whether schedule generation is in progress */
  isGenerating?: boolean;
  /** Whether to show a compact version with just buttons (no card) */
  compact?: boolean;
}

/**
 * ScheduleGenerationSettings provides a UI for configuring schedule generation options
 * including constraints, empty schedule handling, and triggering generation.
 */
export function ScheduleGenerationSettings({
  settings,
  onUpdate,
  createEmptySchedules,
  includeEmpty,
  onCreateEmptyChange,
  onIncludeEmptyChange,
  onGenerateSchedule,
  isGenerating,
  compact = false,
}: ScheduleGenerationSettingsProps): React.ReactElement {
  const { toast } = useToast();

  // Track settings popup state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Use local state to track changes to requirements
  const [localRequirements, setLocalRequirements] = useState<
    Record<RequirementKey, boolean>
  >(() => {
    // Initialize with settings if available, otherwise use defaults
    if (settings?.scheduling?.generation_requirements) {
      const req = { ...DEFAULT_REQUIREMENTS };
      // Only override values that are explicitly defined in settings
      Object.keys(settings.scheduling.generation_requirements).forEach(
        (key) => {
          if (key in req) {
            req[key as RequirementKey] =
              !!settings.scheduling.generation_requirements[
                key as keyof typeof settings.scheduling.generation_requirements
              ];
          }
        },
      );
      return req;
    }
    return { ...DEFAULT_REQUIREMENTS };
  });

  // Update local state when settings change
  useEffect(() => {
    if (settings?.scheduling?.generation_requirements) {
      const req = { ...DEFAULT_REQUIREMENTS };
      // Only override values that are explicitly defined in settings
      Object.keys(settings.scheduling.generation_requirements).forEach(
        (key) => {
          if (key in req) {
            req[key as RequirementKey] =
              !!settings.scheduling.generation_requirements[
                key as keyof typeof settings.scheduling.generation_requirements
              ];
          }
        },
      );
      setLocalRequirements(req);
    } else {
      setLocalRequirements({ ...DEFAULT_REQUIREMENTS });
    }
  }, [settings]);

  const handleToggle = (key: RequirementKey, checked: boolean) => {
    setLocalRequirements((prev) => ({
      ...prev,
      [key]: checked,
    }));
  };

  const handleSave = async () => {
    try {
      // First call onUpdate to save to backend
      await onUpdate(localRequirements);

      // Then close the popover and show toast only after successful update
      toast({
        title: "Einstellungen gespeichert",
        description:
          "Die Anforderungen für die Dienstplangenerierung wurden aktualisiert.",
      });

      // Close the popover after a short delay to ensure the user sees the toast
      setTimeout(() => {
        setIsSettingsOpen(false);
      }, 300);
    } catch (error) {
      // If there's an error, show it but don't close the popover
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

  // Return compact version if specified
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          onClick={onGenerateSchedule}
          disabled={isGenerating}
          size="sm"
          variant="secondary"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
              Generiere...
            </>
          ) : (
            <>
              <Play className="mr-1 h-4 w-4" />
              Dienstplan generieren
            </>
          )}
        </Button>

        <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-4 space-y-4">
              <h3 className="font-medium">Generierungseinstellungen</h3>
              <p className="text-sm text-muted-foreground">
                Diese Einstellungen beeinflussen, wie der Dienstplan generiert
                wird.
              </p>

              {showGenerationControls && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="createEmpty-compact"
                      checked={createEmptySchedules}
                      onCheckedChange={onCreateEmptyChange}
                    />
                    <Label
                      htmlFor="createEmpty-compact"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Leere Dienstpläne erstellen
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeEmpty-compact"
                      checked={includeEmpty}
                      onCheckedChange={onIncludeEmptyChange}
                    />
                    <Label
                      htmlFor="includeEmpty-compact"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Leere Dienstpläne anzeigen
                    </Label>
                  </div>
                </div>
              )}

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {SCHEDULE_REQUIREMENTS.map(({ key, label, description }) => (
                  <div key={key} className="flex items-start space-x-3">
                    <Switch
                      id={`${key}-compact`}
                      checked={localRequirements[key as RequirementKey]}
                      onCheckedChange={(checked) =>
                        handleToggle(key as RequirementKey, checked)
                      }
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor={`${key}-compact`}
                        className="text-sm font-medium"
                      >
                        {label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={handleSave} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Einstellungen speichern
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader className="py-4">
        <CardTitle className="text-lg flex items-center">
          <Settings2 className="h-4 w-4 mr-2" />
          Dienstplan Generierung
        </CardTitle>
        <CardDescription>
          Einstellungen für die Dienstplangenerierung
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {showGenerationControls && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
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
            </div>

            <Separator className="my-2" />

            <div className="flex gap-2">
              <Button
                onClick={onGenerateSchedule}
                disabled={isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Generiere...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Dienstplan generieren
                  </>
                )}
              </Button>

              <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-4 space-y-4">
                    <h3 className="font-medium">Generierungseinstellungen</h3>
                    <p className="text-sm text-muted-foreground">
                      Diese Einstellungen beeinflussen, wie der Dienstplan
                      generiert wird.
                    </p>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {SCHEDULE_REQUIREMENTS.map(
                        ({ key, label, description }) => (
                          <div key={key} className="flex items-start space-x-3">
                            <Switch
                              id={key}
                              checked={localRequirements[key as RequirementKey]}
                              onCheckedChange={(checked) =>
                                handleToggle(key as RequirementKey, checked)
                              }
                            />
                            <div className="space-y-1">
                              <Label
                                htmlFor={key}
                                className="text-sm font-medium"
                              >
                                {label}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {description}
                              </p>
                            </div>
                          </div>
                        ),
                      )}
                    </div>

                    <Button onClick={handleSave} className="w-full">
                      <Save className="mr-2 h-4 w-4" />
                      Einstellungen speichern
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface GenerationSettings {
  enforceMinCoverage: boolean;
  enforceQualifications: boolean;
  enforceMaxHours: boolean;
  allowOvertime: boolean;
  maxOvertimeHours: number;
  respectAvailability: boolean;
  allowDynamicShiftAdjustment: boolean;
  maxShiftAdjustmentMinutes: number;
  preferOriginalTimes: boolean;
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: GenerationSettings) => void;
  initialSettings?: Partial<GenerationSettings>;
}

export function SettingsDialog({
  isOpen,
  onClose,
  onSave,
  initialSettings = {},
}: SettingsDialogProps) {
  const [settings, setSettings] = React.useState<GenerationSettings>({
    enforceMinCoverage: true,
    enforceQualifications: true,
    enforceMaxHours: true,
    allowOvertime: false,
    maxOvertimeHours: 0,
    respectAvailability: true,
    allowDynamicShiftAdjustment: true,
    maxShiftAdjustmentMinutes: 60,
    preferOriginalTimes: true,
    ...initialSettings,
  });

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Generation Settings</DialogTitle>
          <DialogDescription>
            Configure how the schedule should be generated
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <h3 className="font-medium">Coverage Settings</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="enforceMinCoverage">
                Enforce Minimum Coverage
              </Label>
              <Switch
                id="enforceMinCoverage"
                checked={settings.enforceMinCoverage}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enforceMinCoverage: checked })
                }
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-medium">Dynamic Shift Adjustment</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="allowDynamicShiftAdjustment">
                Allow Dynamic Shift Times
              </Label>
              <Switch
                id="allowDynamicShiftAdjustment"
                checked={settings.allowDynamicShiftAdjustment}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    allowDynamicShiftAdjustment: checked,
                  })
                }
              />
            </div>

            {settings.allowDynamicShiftAdjustment && (
              <>
                <div className="flex items-center justify-between">
                  <Label htmlFor="maxShiftAdjustmentMinutes">
                    Maximum Adjustment (minutes)
                  </Label>
                  <Input
                    id="maxShiftAdjustmentMinutes"
                    type="number"
                    value={settings.maxShiftAdjustmentMinutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxShiftAdjustmentMinutes:
                          parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-24"
                    min={0}
                    max={120}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="preferOriginalTimes">
                    Prefer Original Shift Times
                  </Label>
                  <Switch
                    id="preferOriginalTimes"
                    checked={settings.preferOriginalTimes}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, preferOriginalTimes: checked })
                    }
                  />
                </div>
              </>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-medium">Employee Constraints</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="enforceQualifications">
                Enforce Qualifications
              </Label>
              <Switch
                id="enforceQualifications"
                checked={settings.enforceQualifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enforceQualifications: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enforceMaxHours">Enforce Maximum Hours</Label>
              <Switch
                id="enforceMaxHours"
                checked={settings.enforceMaxHours}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enforceMaxHours: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="respectAvailability">Respect Availability</Label>
              <Switch
                id="respectAvailability"
                checked={settings.respectAvailability}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, respectAvailability: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="allowOvertime">Allow Overtime</Label>
              <Switch
                id="allowOvertime"
                checked={settings.allowOvertime}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allowOvertime: checked })
                }
              />
            </div>

            {settings.allowOvertime && (
              <div className="flex items-center justify-between">
                <Label htmlFor="maxOvertimeHours">Maximum Overtime Hours</Label>
                <Input
                  id="maxOvertimeHours"
                  type="number"
                  value={settings.maxOvertimeHours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxOvertimeHours: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-24"
                  min={0}
                  max={40}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
