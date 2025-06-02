/**
 * WeekSettings component for the Schichtplan application.
 * 
 * Provides UI for weekend start preference and month boundary mode configuration.
 */

import React from 'react';
import { Settings, Calendar, Split } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WeekendStart, MonthBoundaryMode } from '@/types/weekVersion';

interface WeekSettingsProps {
  weekendStart: WeekendStart;
  monthBoundaryMode: MonthBoundaryMode;
  onWeekendStartChange: (weekendStart: WeekendStart) => void;
  onMonthBoundaryModeChange: (mode: MonthBoundaryMode) => void;
  className?: string;
}

export function WeekSettings({
  weekendStart,
  monthBoundaryMode,
  onWeekendStartChange,
  onMonthBoundaryModeChange,
  className = ""
}: WeekSettingsProps) {
  
  // Handle weekend start toggle
  const handleWeekendStartToggle = (checked: boolean) => {
    onWeekendStartChange(checked ? WeekendStart.MONDAY : WeekendStart.SUNDAY);
  };

  // Handle month boundary mode change
  const handleMonthBoundaryModeChange = (value: string) => {
    onMonthBoundaryModeChange(value as MonthBoundaryMode);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Wocheneinstellungen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Weekend Start Setting */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="weekend-start" className="text-sm font-medium">
              Wochenbeginn
            </Label>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm">
                {weekendStart === WeekendStart.MONDAY ? 'Montag' : 'Sonntag'}
              </div>
              <div className="text-xs text-muted-foreground">
                {weekendStart === WeekendStart.MONDAY 
                  ? 'Woche beginnt am Montag (ISO-Standard)' 
                  : 'Woche beginnt am Sonntag'}
              </div>
            </div>
            <Switch
              id="weekend-start"
              checked={weekendStart === WeekendStart.MONDAY}
              onCheckedChange={handleWeekendStartToggle}
            />
          </div>
        </div>

        {/* Month Boundary Mode Setting */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Split className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="month-boundary-mode" className="text-sm font-medium">
              Monatsgrenzen-Verhalten
            </Label>
          </div>
          
          <Select
            value={monthBoundaryMode}
            onValueChange={handleMonthBoundaryModeChange}
          >
            <SelectTrigger id="month-boundary-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MonthBoundaryMode.KEEP_INTACT}>
                <div className="space-y-1">
                  <div className="font-medium">Woche beibehalten</div>
                  <div className="text-xs text-muted-foreground">
                    ISO-Wochen bleiben unverändert
                  </div>
                </div>
              </SelectItem>
              <SelectItem value={MonthBoundaryMode.SPLIT_ON_MONTH}>
                <div className="space-y-1">
                  <div className="font-medium">An Monatsgrenze teilen</div>
                  <div className="text-xs text-muted-foreground">
                    Wochen werden an Monatsgrenzen geteilt
                  </div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <div className="text-xs text-muted-foreground">
            {monthBoundaryMode === MonthBoundaryMode.KEEP_INTACT
              ? 'Wochen, die sich über Monate erstrecken, bleiben als komplette Wochen erhalten.'
              : 'Wochen werden am Monatsende geteilt und beginnen mit dem ersten Tag des neuen Monats.'}
          </div>
        </div>

        {/* Information */}
        <div className="p-3 bg-muted/50 rounded-md">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium">Hinweis:</div>
            <div>
              Diese Einstellungen beeinflussen die Berechnung und Anzeige von Kalenderwochen 
              sowie die Behandlung von Wochen, die sich über Monatsgrenzen erstrecken.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 