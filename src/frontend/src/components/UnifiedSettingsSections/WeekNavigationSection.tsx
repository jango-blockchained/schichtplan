/**
 * Week Navigation Settings Section
 * 
 * Provides configuration options for week-based navigation including:
 * - Enable/disable week navigation
 * - Weekend start preference (Monday/Sunday)
 * - Month boundary handling mode
 * - Default navigation mode
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Split } from 'lucide-react';

export interface WeekNavigationSectionProps {
  settings: Partial<{
    week_weekend_start: 'MONDAY' | 'SUNDAY';
    week_month_boundary_mode: 'keep_intact' | 'split_by_month';
  }>;
  onChange: (key: keyof WeekNavigationSectionProps['settings'], value: boolean | string) => void;
  onImmediateUpdate: () => void;
}
export interface WeekNavigationSectionProps {
  settings: Partial<{
    week_weekend_start: "MONDAY" | "SUNDAY";
    week_month_boundary_mode: "keep_intact" | "split_by_month";
  }>;
  onUpdate: (updates: Partial<{
    week_weekend_start: "MONDAY" | "SUNDAY";
    week_month_boundary_mode: "keep_intact" | "split_by_month";
  }>) => void;
  onImmediateUpdate: () => void;
}

export default function WeekNavigationSection({
  settings,
  onChange,
  onImmediateUpdate
}: WeekNavigationSectionProps) {

  const handleSelectChange = (key: keyof WeekNavigationSectionProps['settings']) => (value: string) => {
    onChange(key, value);
    onImmediateUpdate();
  };

  return (
    <div className="space-y-6">
      {/* Weekend Start Preference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Week Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">Weekend Start</Label>
            <div className="text-sm text-muted-foreground mb-2">
              Choose when the weekend starts for week calculations
            </div>
            <Select
              value={settings.week_weekend_start}
              onValueChange={handleSelectChange('week_weekend_start')}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select weekend start" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONDAY">Monday (ISO Standard)</SelectItem>
                <SelectItem value="SUNDAY">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-base">Month Boundary Mode</Label>
            <div className="text-sm text-muted-foreground mb-2">
              How to handle weeks that span multiple months
            </div>
            <Select
              value={settings.week_month_boundary_mode}
              onValueChange={handleSelectChange('week_month_boundary_mode')}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select boundary mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep_intact">Keep Intact</SelectItem>
                <SelectItem value="split_by_month">Split by Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Split className="h-4 w-4" />
            About Week Navigation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Week-based navigation</strong> allows users to browse schedules by ISO calendar weeks (e.g., "2024-W15")
              instead of manually selecting date ranges.
            </p>
            <p>
              <strong>Keep Intact:</strong> Weeks that span multiple months are treated as single units.
            </p>
            <p>
              <strong>Split by Month:</strong> Weeks are divided at month boundaries for separate scheduling.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
