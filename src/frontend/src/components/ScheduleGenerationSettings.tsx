import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings } from '@/types';
import { Button } from "@/components/ui/button";
import { Save, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { CollapsibleSection } from './CollapsibleSection';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Play, Settings2, Calendar, RefreshCw } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { getAvailableCalendarWeeks } from '@/utils/dateUtils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Separator } from './ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface ScheduleGenerationSettingsProps {
    settings: Settings;
    onUpdate: (updates: Partial<Settings['scheduling']['generation_requirements']>) => void;
    createEmptySchedules?: boolean;
    includeEmpty?: boolean;
    onCreateEmptyChange?: (checked: boolean) => void;
    onIncludeEmptyChange?: (checked: boolean) => void;
    onGenerateSchedule?: () => void;
    isGenerating?: boolean;
}

export function ScheduleGenerationSettings({
    settings,
    onUpdate,
    createEmptySchedules,
    includeEmpty,
    onCreateEmptyChange,
    onIncludeEmptyChange,
    onGenerateSchedule,
    isGenerating
}: ScheduleGenerationSettingsProps): React.ReactElement {
    const { toast } = useToast();
    const defaultRequirements = {
        enforce_minimum_coverage: true,
        enforce_contracted_hours: true,
        enforce_keyholder_coverage: true,
        enforce_rest_periods: true,
        enforce_early_late_rules: true,
        enforce_employee_group_rules: true,
        enforce_break_rules: true,
        enforce_max_hours: true,
        enforce_consecutive_days: true,
        enforce_weekend_distribution: true,
        enforce_shift_distribution: true,
        enforce_availability: true,
        enforce_qualifications: true,
        enforce_opening_hours: true
    };

    // Use local state to track changes
    const [localRequirements, setLocalRequirements] = useState(settings?.scheduling?.generation_requirements ?? defaultRequirements);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Update local state when settings change
    useEffect(() => {
        setLocalRequirements(settings?.scheduling?.generation_requirements ?? defaultRequirements);
    }, [settings]);

    const handleToggle = (key: keyof typeof defaultRequirements, checked: boolean) => {
        setLocalRequirements(prev => ({
            ...prev,
            [key]: checked
        }));
    };

    const handleSave = () => {
        onUpdate(localRequirements);
        toast({
            title: "Einstellungen gespeichert",
            description: "Die Anforderungen für die Dienstplangenerierung wurden aktualisiert.",
        });
        setIsSettingsOpen(false);
    };

    const requirementsList = [
        { key: 'enforce_minimum_coverage', label: 'Mindestbesetzung', description: 'Stellt sicher, dass für jeden Zeitraum genügend Mitarbeiter eingeplant sind' },
        { key: 'enforce_contracted_hours', label: 'Vertragsstunden', description: 'Passt die geplanten Stunden an die Mitarbeiterverträge an (VZ/TZ)' },
        { key: 'enforce_keyholder_coverage', label: 'Schlüsselträger-Abdeckung', description: 'Stellt sicher, dass Schlüsselträger für Öffnungs-/Schließdienste eingeplant sind' },
        { key: 'enforce_rest_periods', label: 'Ruhezeiten', description: 'Hält Mindestpausen zwischen Schichten ein' },
        { key: 'enforce_early_late_rules', label: 'Früh-/Spätschicht-Regeln', description: 'Wendet Regeln für Früh- und Spätschichtzuweisungen an' },
        { key: 'enforce_employee_group_rules', label: 'Mitarbeitergruppen-Regeln', description: 'Befolgt spezifische Regeln für verschiedene Mitarbeitergruppen (TZ/GFB)' },
        { key: 'enforce_break_rules', label: 'Pausenregelungen', description: 'Plant erforderliche Pausen basierend auf der Schichtdauer' },
        { key: 'enforce_max_hours', label: 'Maximale Arbeitszeit', description: 'Respektiert tägliche und wöchentliche Höchstarbeitszeiten' },
        { key: 'enforce_consecutive_days', label: 'Aufeinanderfolgende Tage', description: 'Begrenzt die Anzahl aufeinanderfolgender Arbeitstage' },
        { key: 'enforce_weekend_distribution', label: 'Wochenendverteilung', description: 'Sorgt für eine faire Verteilung der Wochenendschichten' },
        { key: 'enforce_shift_distribution', label: 'Schichtverteilung', description: 'Gleicht verschiedene Schichttypen unter den Mitarbeitern aus' },
        { key: 'enforce_availability', label: 'Mitarbeiterverfügbarkeit', description: 'Berücksichtigt Verfügbarkeitspräferenzen der Mitarbeiter' },
        { key: 'enforce_qualifications', label: 'Qualifikationen', description: 'Passt Mitarbeiterfähigkeiten an Schichtanforderungen an' },
        { key: 'enforce_opening_hours', label: 'Öffnungszeiten', description: 'Richtet Dienstpläne an den Ladenöffnungszeiten aus' }
    ] as const;

    const availableWeeks = getAvailableCalendarWeeks();

    // Determine if we should show the schedule generation controls
    const showGenerationControls = createEmptySchedules !== undefined &&
        includeEmpty !== undefined &&
        onCreateEmptyChange !== undefined &&
        onIncludeEmptyChange !== undefined &&
        onGenerateSchedule !== undefined;

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

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <Settings2 className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0" align="end">
                                    <div className="p-4 space-y-4">
                                        <h3 className="font-medium">Generierungseinstellungen</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Diese Einstellungen beeinflussen, wie der Dienstplan generiert wird.
                                        </p>

                                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                            {requirementsList.map(({ key, label, description }) => (
                                                <div key={key} className="flex items-start space-x-3">
                                                    <Switch
                                                        id={key}
                                                        checked={localRequirements[key as keyof typeof defaultRequirements]}
                                                        onCheckedChange={(checked) => handleToggle(key as keyof typeof defaultRequirements, checked)}
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
                    </div>
                )}
            </CardContent>
        </Card>
    );
} 