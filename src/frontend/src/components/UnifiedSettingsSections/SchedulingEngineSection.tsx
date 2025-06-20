import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Info, Loader2 } from "lucide-react";
import { ScheduleGenerationSettings } from "@/components/ScheduleGenerationSettings"; // Assuming this component is in this path
import type { Settings } from "@/types/index";

interface SchedulingEngineSectionProps {
  settings: Settings["scheduling"];
  onInputChange: (key: string, value: any, isNumeric?: boolean) => void;
  onDiagnosticsChange: (checked: boolean) => void;
  onGenerationSettingsUpdate: (updates: Partial<Settings["scheduling"]["generation_requirements"]>) => void;
  onImmediateUpdate: () => void;
}

export const SchedulingEngineSection: React.FC<SchedulingEngineSectionProps> = ({
  settings,
  onInputChange,
  onDiagnosticsChange,
  onGenerationSettingsUpdate,
  onImmediateUpdate,
}) => {
  const generationRequirements = settings.generation_requirements || {};

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
                  value={settings.default_shift_duration ?? 8}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange(
                      "default_shift_duration",
                      e.target.value,
                      true,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_break_duration">
                  Min Break Duration (minutes)
                </Label>
                <Input
                  id="min_break_duration"
                  type="number"
                  value={settings.min_break_duration ?? 30}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange("min_break_duration", e.target.value, true)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_rest_between_shifts">
                  Min Rest Between Shifts (hours)
                </Label>
                <Input
                  id="min_rest_between_shifts"
                  type="number"
                  value={settings.min_rest_between_shifts ?? 11}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange(
                      "min_rest_between_shifts",
                      e.target.value,
                      true,
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max_daily_hours">Max Daily Hours</Label>
                <Input
                  id="max_daily_hours"
                  type="number"
                  value={settings.max_daily_hours ?? 10}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange("max_daily_hours", e.target.value, true)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_weekly_hours">Max Weekly Hours</Label>
                <Input
                  id="max_weekly_hours"
                  type="number"
                  value={settings.max_weekly_hours ?? 40}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange("max_weekly_hours", e.target.value, true)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_weekly_working_hours">Total Weekly Working Hours</Label>
                <Input
                  id="total_weekly_working_hours"
                  type="number"
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
                  value={settings.scheduling_period_weeks ?? 1}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onInputChange(
                      "scheduling_period_weeks",
                      e.target.value,
                      true,
                    )
                  }
                />
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
            onImmediateUpdate={onImmediateUpdate}
          />
        </CardContent>
      </Card>
    </div>
  );
};
