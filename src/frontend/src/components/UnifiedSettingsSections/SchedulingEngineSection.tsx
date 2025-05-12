import React from 'react';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Info, Loader2 } from 'lucide-react';
import { ScheduleGenerationSettings } from "@/components/ScheduleGenerationSettings"; // Assuming this component is in this path
import type { Settings } from '@/types/index';

interface SchedulingEngineSectionProps {
  localSettings: Partial<Settings>;
  handleSave: (category: 'scheduling', updates: Partial<Settings['scheduling']>) => void;
  handleDiagnosticsChange: (checked: boolean) => void;
  handleImmediateUpdate: () => void;
  updateMutationIsPending: boolean;
}

export const SchedulingEngineSection: React.FC<SchedulingEngineSectionProps> = ({
  localSettings,
  handleSave,
  handleDiagnosticsChange,
  handleImmediateUpdate,
  updateMutationIsPending,
}) => {
  const schedulingSettings = localSettings.scheduling ?? {};
  const generationRequirements = schedulingSettings.generation_requirements ?? {};

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Scheduling Rules</CardTitle>
          <CardDescription>Configure core scheduling parameters and constraints</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scheduling_resource_type">Resource Type</Label>
                <Select
                  value={schedulingSettings.scheduling_resource_type ?? "shifts"}
                  onValueChange={(value: 'shifts' | 'coverage') => handleSave("scheduling", { scheduling_resource_type: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shifts">Shifts</SelectItem>
                    <SelectItem value="coverage">Coverage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_shift_duration">Default Shift Duration (hours)</Label>
                <Input id="default_shift_duration" type="number" value={schedulingSettings.default_shift_duration ?? 8} onChange={(e) => handleSave("scheduling", { default_shift_duration: parseFloat(e.target.value) })} onBlur={handleImmediateUpdate} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_break_duration">Min Break Duration (minutes)</Label>
                <Input id="min_break_duration" type="number" value={schedulingSettings.min_break_duration ?? 30} onChange={(e) => handleSave("scheduling", { min_break_duration: Number(e.target.value) })} onBlur={handleImmediateUpdate} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_rest_between_shifts">Min Rest Between Shifts (hours)</Label>
                <Input id="min_rest_between_shifts" type="number" value={schedulingSettings.min_rest_between_shifts ?? 11} onChange={(e) => handleSave("scheduling", { min_rest_between_shifts: Number(e.target.value) })} onBlur={handleImmediateUpdate} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max_daily_hours">Max Daily Hours</Label>
                <Input id="max_daily_hours" type="number" value={schedulingSettings.max_daily_hours ?? 10} onChange={(e) => handleSave("scheduling", { max_daily_hours: Number(e.target.value) })} onBlur={handleImmediateUpdate} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_weekly_hours">Max Weekly Hours</Label>
                <Input id="max_weekly_hours" type="number" value={schedulingSettings.max_weekly_hours ?? 40} onChange={(e) => handleSave("scheduling", { max_weekly_hours: Number(e.target.value) })} onBlur={handleImmediateUpdate} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduling_period_weeks">Scheduling Period (weeks)</Label>
                <Input id="scheduling_period_weeks" type="number" value={schedulingSettings.scheduling_period_weeks ?? 1} onChange={(e) => handleSave("scheduling", { scheduling_period_weeks: Number(e.target.value) })} onBlur={handleImmediateUpdate} />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="auto_schedule_preferences" checked={schedulingSettings.auto_schedule_preferences ?? true} onCheckedChange={(checked) => handleSave("scheduling", { auto_schedule_preferences: checked })} />
                <Label htmlFor="auto_schedule_preferences">Auto-schedule by preferences</Label>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="enable_diagnostics" checked={schedulingSettings.enable_diagnostics ?? false} onCheckedChange={handleDiagnosticsChange} />
                <Label htmlFor="enable_diagnostics" className="flex items-center">
                  Enable Scheduling Diagnostics 
                  <HoverCard><HoverCardTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help ml-1.5" /></HoverCardTrigger><HoverCardContent className="w-80 text-sm">Enables detailed logging during schedule generation. Useful for troubleshooting.</HoverCardContent></HoverCard>
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleImmediateUpdate} disabled={updateMutationIsPending}>
            {updateMutationIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Scheduling Rules
          </Button>
        </CardFooter>
      </Card>
      <ScheduleGenerationSettings
        // The settings prop for ScheduleGenerationSettings expects the full Settings object according to SettingsPage.tsx
        // However, we should only pass what's necessary or adapt the component.
        // For now, passing localSettings.scheduling.generation_requirements directly if available.
        settings={{ scheduling: { generation_requirements: generationRequirements } } as any} // Cast as any for now
        onUpdate={(genUpdates) => {
          if (!localSettings?.scheduling) return;
          const updatedGenReqs = { ...generationRequirements, ...genUpdates };
          handleSave("scheduling", { ...schedulingSettings, generation_requirements: updatedGenReqs });
          handleImmediateUpdate(); // This was in the original logic, ensures save on update from this sub-component
        }}
      />
    </div>
  );
}; 