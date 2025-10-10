import { ScheduleGenerationSettings } from "@/components/ScheduleGenerationSettings"; // Assuming this component is in this path
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/types/index";
import { Info } from "lucide-react";
import React from "react";

interface SchedulingEngineSectionProps {
  settings: Partial<Settings["scheduling"]>;
  onInputChange: (key: string, value: string | number | boolean, isNumeric?: boolean) => void;
  onDiagnosticsChange: (checked: boolean) => void;
  onGenerationSettingsUpdate: (updates: Partial<NonNullable<Settings["scheduling"]>["generation_requirements"]>) => void;
}

export const SchedulingEngineSection: React.FC<SchedulingEngineSectionProps> = ({
  settings,
  onInputChange,
  onDiagnosticsChange,
  onGenerationSettingsUpdate,
}) => {
  const generationRequirements: NonNullable<Settings["scheduling"]>["generation_requirements"] =
    settings.generation_requirements || {
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
      enforce_opening_hours: true,
    };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scheduling Rules</CardTitle>
          <CardDescription>
            Configure core scheduling parameters and constraints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scheduling_resource_type">Resource Type</Label>
                <Select
                  value={settings.scheduling_resource_type || "shifts"}
                  onValueChange={(value: "shifts" | "coverage") =>
                    onInputChange("scheduling_resource_type", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shifts">Shifts</SelectItem>
                    <SelectItem value="coverage">Coverage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_shift_duration">
                  Default Shift Duration (hours)
                </Label>
                <Input
                  id="default_shift_duration"
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={settings.default_shift_duration ?? 8}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange(
                      "default_shift_duration",
                      e.target.value,
                      true,
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Standard duration for shifts (typically 8 hours)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_break_duration">
                  Min Break Duration (minutes)
                </Label>
                <Input
                  id="min_break_duration"
                  type="number"
                  min="0"
                  max="120"
                  step="5"
                  value={settings.min_break_duration ?? 30}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange("min_break_duration", e.target.value, true)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Minimum break time required between shifts
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_rest_between_shifts">
                  Min Rest Between Shifts (hours)
                </Label>
                <Input
                  id="min_rest_between_shifts"
                  type="number"
                  min="8"
                  max="24"
                  step="1"
                  value={settings.min_rest_between_shifts ?? 11}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange(
                      "min_rest_between_shifts",
                      e.target.value,
                      true,
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Legal requirement (often 11 hours)
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max_daily_hours">Max Daily Hours</Label>
                <Input
                  id="max_daily_hours"
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={settings.max_daily_hours ?? 10}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange("max_daily_hours", e.target.value, true)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum working hours per day
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_weekly_hours">Max Weekly Hours</Label>
                <Input
                  id="max_weekly_hours"
                  type="number"
                  min="1"
                  max="80"
                  step="1"
                  value={settings.max_weekly_hours ?? 40}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange("max_weekly_hours", e.target.value, true)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum working hours per week per employee
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_weekly_working_hours">Total Weekly Working Hours</Label>
                <Input
                  id="total_weekly_working_hours"
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={settings.total_weekly_working_hours ?? 165}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange("total_weekly_working_hours", e.target.value, true)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Total weekly working hours constraint for all employees combined
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduling_period_weeks">
                  Scheduling Period (weeks)
                </Label>
                <Input
                  id="scheduling_period_weeks"
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  value={settings.scheduling_period_weeks ?? 1}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange(
                      "scheduling_period_weeks",
                      e.target.value,
                      true,
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Number of weeks to generate schedules for at once
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduling_algorithm">Scheduling Algorithm</Label>
                <Select
                  value={settings.scheduling_algorithm || "standard"}
                  onValueChange={(value: "standard" | "optimized") =>
                    onInputChange("scheduling_algorithm", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="optimized">Optimized</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="auto_schedule_preferences"
                  checked={settings.auto_schedule_preferences !== false}
                  onCheckedChange={(checked) =>
                    onInputChange("auto_schedule_preferences", checked)
                  }
                />
                <Label htmlFor="auto_schedule_preferences">
                  Auto-schedule by preferences
                </Label>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="enable_diagnostics"
                  checked={!!settings.enable_diagnostics}
                  onCheckedChange={onDiagnosticsChange}
                />
                <div className="flex items-center">
                  <Label htmlFor="enable_diagnostics" className="mr-2">
                    Enable Schedule Diagnostics
                  </Label>
                  <HoverCard>
                    <HoverCardTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <p>
                        Schedule diagnostics help identify potential issues and
                        optimization opportunities in your generated schedules.
                      </p>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Generation Rules Card */}
      <Card>
        <CardHeader>
          <CardTitle>Generation Requirements</CardTitle>
          <CardDescription>
            Configure detailed requirements for schedule generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleGenerationSettings
            settings={generationRequirements}
            onUpdate={onGenerationSettingsUpdate}
          />
        </CardContent>
      </Card>
    </div>
  );
};
