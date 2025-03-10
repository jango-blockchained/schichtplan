import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings } from '@/types';
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { CollapsibleSection } from './CollapsibleSection';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Play, Settings2 } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { getAvailableCalendarWeeks } from '@/utils/dateUtils';

interface ScheduleGenerationSettingsProps {
    settings: Settings;
    onUpdate: (updates: Partial<Settings['scheduling']['generation_requirements']>) => void;
    selectedCalendarWeek?: string;
    weeksAmount?: number;
    createEmptySchedules?: boolean;
    includeEmpty?: boolean;
    onCalendarWeekChange?: (week: string) => void;
    onWeeksAmountChange?: (amount: string) => void;
    onCreateEmptyChange?: (checked: boolean) => void;
    onIncludeEmptyChange?: (checked: boolean) => void;
    onGenerateSchedule?: () => void;
    isGenerating?: boolean;
}

export function ScheduleGenerationSettings({
    settings,
    onUpdate,
    selectedCalendarWeek,
    weeksAmount,
    createEmptySchedules,
    includeEmpty,
    onCalendarWeekChange,
    onWeeksAmountChange,
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
            title: "Settings saved",
            description: "Schedule generation requirements have been updated.",
        });
    };

    const requirementsList = [
        { key: 'enforce_minimum_coverage', label: 'Minimum Coverage Requirements', description: 'Ensure minimum number of employees are scheduled for each time slot' },
        { key: 'enforce_contracted_hours', label: 'Contracted Hours Requirements', description: 'Match scheduled hours with employee contracts (VZ/TZ)' },
        { key: 'enforce_keyholder_coverage', label: 'Keyholder Coverage', description: 'Ensure keyholders are scheduled for opening/closing shifts' },
        { key: 'enforce_rest_periods', label: 'Rest Periods', description: 'Maintain minimum rest time between shifts' },
        { key: 'enforce_early_late_rules', label: 'Early/Late Shift Rules', description: 'Apply rules for early and late shift assignments' },
        { key: 'enforce_employee_group_rules', label: 'Employee Group Rules', description: 'Follow specific rules for different employee groups (TZ/GFB)' },
        { key: 'enforce_break_rules', label: 'Break Requirements', description: 'Schedule required breaks based on shift duration' },
        { key: 'enforce_max_hours', label: 'Maximum Working Hours', description: 'Respect daily and weekly maximum working hours' },
        { key: 'enforce_consecutive_days', label: 'Consecutive Days', description: 'Limit the number of consecutive working days' },
        { key: 'enforce_weekend_distribution', label: 'Weekend Distribution', description: 'Ensure fair distribution of weekend shifts' },
        { key: 'enforce_shift_distribution', label: 'Shift Distribution', description: 'Balance different types of shifts among employees' },
        { key: 'enforce_availability', label: 'Employee Availability', description: 'Consider employee availability preferences' },
        { key: 'enforce_qualifications', label: 'Skills/Qualifications', description: 'Match employee skills with shift requirements' },
        { key: 'enforce_opening_hours', label: 'Store Opening Hours', description: 'Align schedules with store opening hours' }
    ] as const;

    const availableWeeks = getAvailableCalendarWeeks();

    // Determine if we should show the schedule generation controls
    const showGenerationControls = selectedCalendarWeek !== undefined &&
        weeksAmount !== undefined &&
        createEmptySchedules !== undefined &&
        includeEmpty !== undefined &&
        onCalendarWeekChange !== undefined &&
        onWeeksAmountChange !== undefined &&
        onCreateEmptyChange !== undefined &&
        onIncludeEmptyChange !== undefined &&
        onGenerateSchedule !== undefined;

    return (
        <CollapsibleSection
            title={
                <div className="flex items-center">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Dienstplan Generierung
                </div>
            }
            defaultOpen={false}
        >
            <div className="space-y-4 p-4">
                {showGenerationControls && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Kalenderwoche</label>
                                <Select
                                    value={selectedCalendarWeek}
                                    onValueChange={onCalendarWeekChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wähle eine Kalenderwoche" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableWeeks.map((week) => (
                                            <SelectItem key={week.value} value={week.value}>
                                                {week.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Anzahl Wochen</label>
                                <Select
                                    value={weeksAmount?.toString()}
                                    onValueChange={onWeeksAmountChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wähle die Anzahl der Wochen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4].map((amount) => (
                                            <SelectItem key={amount} value={amount.toString()}>
                                                {amount} {amount === 1 ? 'Woche' : 'Wochen'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="createEmpty"
                                    checked={createEmptySchedules}
                                    onCheckedChange={onCreateEmptyChange}
                                />
                                <label
                                    htmlFor="createEmpty"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Leere Dienstpläne für alle Mitarbeiter erstellen
                                </label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="includeEmpty"
                                    checked={includeEmpty}
                                    onCheckedChange={onIncludeEmptyChange}
                                />
                                <label
                                    htmlFor="includeEmpty"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Leere Dienstpläne anzeigen
                                </label>
                            </div>
                        </div>

                        <Button
                            onClick={onGenerateSchedule}
                            disabled={isGenerating}
                            className="w-full"
                        >
                            {isGenerating ? (
                                <>
                                    <Play className="mr-2 h-4 w-4 animate-spin" />
                                    Generiere...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Dienstplan generieren
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </CollapsibleSection>
    );
} 