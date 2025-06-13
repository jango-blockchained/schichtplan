/**
 * Week Navigation Settings Section
 * 
 * Provides configuration options for week-based navigation including:
 * - Enable/disable week navigation
 * - Weekend start preference (Monday/Sunday)
 * - Month boundary handling mode
 * - Default navigation mode
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Calendar, Split } from 'lucide-react';

interface WeekNavigationSectionProps {
  settings: {
    enable_week_navigation: boolean;
    week_weekend_start: 'MONDAY' | 'SUNDAY';
    week_month_boundary_mode: 'keep_intact' | 'split_by_month';
    week_navigation_default: boolean;
  };
  onChange: (key: keyof WeekNavigationSectionProps['settings'], value: boolean | string) => void;
  onImmediateUpdate: () => void;
}

export default function WeekNavigationSection({
  settings,
  onChange,
  onImmediateUpdate
}: WeekNavigationSectionProps) {
  
  const handleSwitchChange = (key: keyof WeekNavigationSectionProps['settings']) => (checked: boolean) => {
    onChange(key, checked);
    onImmediateUpdate();
  };

  const handleSelectChange = (key: keyof WeekNavigationSectionProps['settings']) => (value: string) => {
    onChange(key, value);
    onImmediateUpdate();
  };

  return (
    <div className="space-y-6">
      {/* Enable Week Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Week-based Navigation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Week Navigation</Label>
              <div className="text-sm text-muted-foreground">
                Allow users to navigate by ISO calendar weeks instead of date ranges
              </div>
            </div>
            <Switch
              checked={settings.enable_week_navigation}
              onCheckedChange={handleSwitchChange('enable_week_navigation')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Default Navigation Mode</Label>
              <div className="text-sm text-muted-foreground">
                Use week navigation as the default mode for new users
              </div>
            </div>
            <Switch
              checked={settings.week_navigation_default}
              onCheckedChange={handleSwitchChange('week_navigation_default')}
              disabled={!settings.enable_week_navigation}
            />
          </div>
        </CardContent>
      </Card>

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
              disabled={!settings.enable_week_navigation}
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
              disabled={!settings.enable_week_navigation}
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
