import { ConversationPanel } from "@/components/ai/ConversationPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIConversation } from "@/hooks/useAIConversation";
import {
    AlertTriangle,
    ArrowRight,
    Info,
    Loader2,
    MessageCircle,
    Play,
    Settings,
    Sliders,
    Users,
} from "lucide-react";
import { useState } from "react";

interface DetailedAIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: DetailedAIOptions) => void;
  isGenerating: boolean;
}

export interface DetailedAIOptions {
  prioritySettings: {
    employeeSatisfaction: number;
    fairness: number;
    consistency: number;
    workloadBalance: number;
  };
  constraintOverrides: {
    ignoreNonCriticalAvailability: boolean;
    allowOvertime: boolean;
    strictKeyholder: boolean;
    minimumRestPeriods: boolean;
  };
  employeeOptions: {
    onlyFixedPreferred: boolean;
    respectPreferenceWeights: boolean;
    considerHistoricalPatterns: boolean;
  };
  aiModelParams: {
    temperature: number;
    creativity: number;
  };
}

const DEFAULT_OPTIONS: DetailedAIOptions = {
  prioritySettings: {
    employeeSatisfaction: 50,
    fairness: 50,
    consistency: 50,
    workloadBalance: 50,
  },
  constraintOverrides: {
    ignoreNonCriticalAvailability: false,
    allowOvertime: false,
    strictKeyholder: true,
    minimumRestPeriods: true,
  },
  employeeOptions: {
    onlyFixedPreferred: false,
    respectPreferenceWeights: true,
    considerHistoricalPatterns: true,
  },
  aiModelParams: {
    temperature: 0.7,
    creativity: 0.5,
  },
};

export function DetailedAIGenerationModal({
  isOpen,
  onClose,
  onConfirm,
  isGenerating,
}: DetailedAIGenerationModalProps) {
  const [options, setOptions] = useState<DetailedAIOptions>(DEFAULT_OPTIONS);
  const [activeTab, setActiveTab] = useState("priorities");

  // Conversation mode hook
  const conversation = useAIConversation(async (prompt: string) => {
    // Convert conversation prompt to structured options and trigger generation
    conversation.addSystemMessage(`Anweisung verarbeitet: "${prompt}"`);
    // For now, just trigger generation with current options
    // TODO: Parse prompt and adjust options accordingly
    onConfirm(options);
    return { message: "Anweisung wurde in die Generierung integriert." };
  });

  const handlePriorityChange = (
    key: keyof DetailedAIOptions["prioritySettings"],
    value: number[]
  ) => {
    setOptions((prev) => ({
      ...prev,
      prioritySettings: {
        ...prev.prioritySettings,
        [key]: value[0],
      },
    }));
  };

  const handleConstraintToggle = (
    key: keyof DetailedAIOptions["constraintOverrides"],
    checked: boolean
  ) => {
    setOptions((prev) => ({
      ...prev,
      constraintOverrides: {
        ...prev.constraintOverrides,
        [key]: checked,
      },
    }));
  };

  const handleEmployeeOptionToggle = (
    key: keyof DetailedAIOptions["employeeOptions"],
    checked: boolean
  ) => {
    setOptions((prev) => ({
      ...prev,
      employeeOptions: {
        ...prev.employeeOptions,
        [key]: checked,
      },
    }));
  };

  const handleAIParamChange = (
    key: keyof DetailedAIOptions["aiModelParams"],
    value: number[]
  ) => {
    setOptions((prev) => ({
      ...prev,
      aiModelParams: {
        ...prev.aiModelParams,
        [key]: value[0],
      },
    }));
  };

  const handleConfirm = () => {
    onConfirm(options);
  };

  const handleExportConversationToOptions = () => {
    // TODO: Implement conversation -> options conversion
    setActiveTab("priorities");
    conversation.addSystemMessage("Unterhaltung wurde in strukturierte Optionen übertragen.");
  };

  const getImpactLevel = () => {
    const { onlyFixedPreferred } = options.employeeOptions;
    const { ignoreNonCriticalAvailability, allowOvertime } = options.constraintOverrides;
    
    if (onlyFixedPreferred || ignoreNonCriticalAvailability) {
      return "high";
    }
    if (allowOvertime) {
      return "medium";
    }
    return "low";
  };

  const impactLevel = getImpactLevel();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5" />
            Erweiterte KI-Generierung
          </DialogTitle>
          <DialogDescription>
            Konfigurieren Sie die detaillierten Optionen für die KI-gestützte Schichtplanerstellung.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="priorities" className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              Prioritäten
            </TabsTrigger>
            <TabsTrigger value="constraints" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Einschränkungen
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Mitarbeiter
            </TabsTrigger>
            <TabsTrigger value="ai-params" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              KI-Parameter
            </TabsTrigger>
            <TabsTrigger value="conversation" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Unterhaltung
            </TabsTrigger>
          </TabsList>

          <TabsContent value="priorities" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Optimierungsprioritäten</CardTitle>
                <CardDescription>
                  Bestimmen Sie, welche Aspekte bei der Schichtplanung bevorzugt werden sollen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Mitarbeiterzufriedenheit vs. Abdeckungsoptimierung
                  </Label>
                  <div className="px-2">
                    <Slider
                      value={[options.prioritySettings.employeeSatisfaction]}
                      onValueChange={(value) => handlePriorityChange("employeeSatisfaction", value)}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Abdeckung</span>
                      <span>{options.prioritySettings.employeeSatisfaction}%</span>
                      <span>Zufriedenheit</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Gerechtigkeit vs. Effizienz
                  </Label>
                  <div className="px-2">
                    <Slider
                      value={[options.prioritySettings.fairness]}
                      onValueChange={(value) => handlePriorityChange("fairness", value)}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Effizienz</span>
                      <span>{options.prioritySettings.fairness}%</span>
                      <span>Gerechtigkeit</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Konsistenz vs. Innovation
                  </Label>
                  <div className="px-2">
                    <Slider
                      value={[options.prioritySettings.consistency]}
                      onValueChange={(value) => handlePriorityChange("consistency", value)}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Innovation</span>
                      <span>{options.prioritySettings.consistency}%</span>
                      <span>Konsistenz</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Arbeitsbelastungsausgleich
                  </Label>
                  <div className="px-2">
                    <Slider
                      value={[options.prioritySettings.workloadBalance]}
                      onValueChange={(value) => handlePriorityChange("workloadBalance", value)}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Niedrig</span>
                      <span>{options.prioritySettings.workloadBalance}%</span>
                      <span>Hoch</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="constraints" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Einschränkungsübersteuerungen</CardTitle>
                <CardDescription>
                  Aktivieren Sie Optionen, um bestimmte Einschränkungen zu lockern oder zu verstärken.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">
                      Nicht-kritische Verfügbarkeitseinschränkungen ignorieren
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Erlaubt der KI, "bevorzugte" Verfügbarkeiten zu ignorieren, wenn nötig.
                    </p>
                  </div>
                  <Switch
                    checked={options.constraintOverrides.ignoreNonCriticalAvailability}
                    onCheckedChange={(checked) =>
                      handleConstraintToggle("ignoreNonCriticalAvailability", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">
                      Überstunden in Notfällen erlauben
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Ermöglicht die Zuweisung von Überstunden bei kritischem Personalmangel.
                    </p>
                  </div>
                  <Switch
                    checked={options.constraintOverrides.allowOvertime}
                    onCheckedChange={(checked) =>
                      handleConstraintToggle("allowOvertime", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">
                      Strenge Schlüsselinhaber-Anforderungen
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Stellt sicher, dass immer ein Schlüsselinhaber anwesend ist.
                    </p>
                  </div>
                  <Switch
                    checked={options.constraintOverrides.strictKeyholder}
                    onCheckedChange={(checked) =>
                      handleConstraintToggle("strictKeyholder", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">
                      Mindestpausen zwischen Schichten
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Respektiert die minimal erforderlichen Ruhezeiten zwischen Schichten.
                    </p>
                  </div>
                  <Switch
                    checked={options.constraintOverrides.minimumRestPeriods}
                    onCheckedChange={(checked) =>
                      handleConstraintToggle("minimumRestPeriods", checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mitarbeiterspezifische Optionen</CardTitle>
                <CardDescription>
                  Konfigurieren Sie, wie Mitarbeiterpräferenzen und -verfügbarkeiten behandelt werden.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">
                      Nur feste/bevorzugte Verfügbarkeiten zuweisen
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Weist nur Schichten zu, wenn der Mitarbeiter als "fest" oder "bevorzugt" verfügbar ist.
                    </p>
                  </div>
                  <Switch
                    checked={options.employeeOptions.onlyFixedPreferred}
                    onCheckedChange={(checked) =>
                      handleEmployeeOptionToggle("onlyFixedPreferred", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">
                      Individuelle Präferenzgewichtungen respektieren
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Berücksichtigt individuelle Präferenzstärken bei der Zuweisung.
                    </p>
                  </div>
                  <Switch
                    checked={options.employeeOptions.respectPreferenceWeights}
                    onCheckedChange={(checked) =>
                      handleEmployeeOptionToggle("respectPreferenceWeights", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">
                      Historische Zuweisungsmuster berücksichtigen
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Verwendet vergangene Schichtzuweisungen zur Optimierung der Fairness.
                    </p>
                  </div>
                  <Switch
                    checked={options.employeeOptions.considerHistoricalPatterns}
                    onCheckedChange={(checked) =>
                      handleEmployeeOptionToggle("considerHistoricalPatterns", checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {options.employeeOptions.onlyFixedPreferred && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warnung:</strong> Diese Option kann die Planungsoptionen erheblich einschränken. 
                  Stellen Sie sicher, dass genügend Mitarbeiter mit festen/bevorzugten Verfügbarkeiten vorhanden sind.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="ai-params" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">KI-Modell Parameter</CardTitle>
                <CardDescription>
                  Stellen Sie das Verhalten des KI-Modells für die Schichtplanung ein.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Temperatur (Zufälligkeit)
                  </Label>
                  <div className="px-2">
                    <Slider
                      value={[options.aiModelParams.temperature * 100]}
                      onValueChange={(value) => handleAIParamChange("temperature", [value[0] / 100])}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Deterministisch</span>
                      <span>{Math.round(options.aiModelParams.temperature * 100)}%</span>
                      <span>Kreativ</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Höhere Werte führen zu kreativeren, aber weniger vorhersagbaren Lösungen.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Kreativitätsniveau
                  </Label>
                  <div className="px-2">
                    <Slider
                      value={[options.aiModelParams.creativity * 100]}
                      onValueChange={(value) => handleAIParamChange("creativity", [value[0] / 100])}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Konservativ</span>
                      <span>{Math.round(options.aiModelParams.creativity * 100)}%</span>
                      <span>Innovativ</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Beeinflusst, wie sehr die KI von bewährten Mustern abweicht.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversation" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">KI-Unterhaltung</CardTitle>
                    <CardDescription>
                      Sprechen Sie direkt mit der KI über Ihre Schichtplanungsanforderungen.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportConversationToOptions}
                    className="flex items-center gap-2"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Zu Optionen
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-96">
                  <ConversationPanel
                    messages={conversation.messages}
                    currentInput={conversation.currentInput}
                    onInputChange={conversation.setCurrentInput}
                    onSendMessage={conversation.sendMessage}
                    onClearConversation={conversation.clearConversation}
                    isLoading={conversation.isLoading}
                    className="h-full"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Impact Summary */}
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4" />
              Auswirkungszusammenfassung
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">Erwartete Auswirkung auf die Planung:</span>
              <Badge variant={impactLevel === "high" ? "destructive" : impactLevel === "medium" ? "outline" : "secondary"}>
                {impactLevel === "high" ? "Hoch" : impactLevel === "medium" ? "Mittel" : "Niedrig"}
              </Badge>
            </div>
            {impactLevel === "high" && (
              <p className="text-xs text-muted-foreground mt-1">
                Die gewählten Optionen können die verfügbaren Planungsoptionen erheblich einschränken.
              </p>
            )}
          </CardContent>
        </Card>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Erweiterte Generierung starten
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}