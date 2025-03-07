import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings } from '@/types';

interface ScheduleGenerationSettingsProps {
    settings: Settings;
    onUpdate: (updates: Partial<Settings['scheduling']['generation_requirements']>) => void;
}

export function ScheduleGenerationSettings({ settings, onUpdate }: ScheduleGenerationSettingsProps) {
    const requirements = settings.scheduling.generation_requirements;

    const handleToggle = (key: keyof Settings['scheduling']['generation_requirements']) => {
        onUpdate({ [key]: !requirements[key] });
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Schedule Generation Requirements</CardTitle>
                <CardDescription>
                    Enable or disable specific requirements for schedule generation
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {requirementsList.map(({ key, label, description }) => (
                        <div key={key} className="flex items-center justify-between space-x-4">
                            <div>
                                <Label htmlFor={key} className="font-medium">{label}</Label>
                                <p className="text-sm text-gray-500">{description}</p>
                            </div>
                            <Switch
                                id={key}
                                checked={requirements[key]}
                                onCheckedChange={() => handleToggle(key)}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
} 