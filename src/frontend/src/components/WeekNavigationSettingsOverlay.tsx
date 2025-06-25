/**
 * Week Navigation Settings Overlay Component
 * 
 * A quick settings panel that can be toggled on the schedule page
 * to allow users to adjust week navigation preferences without going to the settings page.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { getSettings, updateSettings } from '@/services/api';
import { Settings } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Settings as SettingsIcon, Split } from 'lucide-react';
import { useState } from 'react';

interface WeekNavigationSettingsOverlayProps {
  currentSettings?: {
    weekendStart?: 'MONDAY' | 'SUNDAY';
    monthBoundaryMode?: 'keep_intact' | 'split_by_month';
  };
  onSettingsChanged?: (settings: Settings['week_navigation']) => void;
  triggerClassName?: string;
}

export function WeekNavigationSettingsOverlay({
  onSettingsChanged,
  triggerClassName = "",
}: WeekNavigationSettingsOverlayProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation to update settings
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(['settings'], updatedSettings);
      onSettingsChanged?.(updatedSettings.week_navigation);
      toast({
        title: "Settings Updated",
        description: "Week navigation settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings.",
        variant: "destructive",
      });
    },
  });

  // Get effective settings (normalize the settings structure)
  const weekNavSettings = settings?.week_navigation || {
    week_weekend_start: 'MONDAY' as const,
    week_month_boundary_mode: 'keep_intact' as const,
  };

  const handleSettingChange = (key: string, value: boolean | string) => {
    if (!settings) return;

    const updatedSettings = {
      ...settings,
      week_navigation: {
        ...settings.week_navigation,
        [key]: value,
      },
    };

    updateSettingsMutation.mutate(updatedSettings);
  };

  const formatCurrentSettings = () => {
    const parts = [];
    if (weekNavSettings.week_weekend_start === 'SUNDAY') {
      parts.push('So-Start');
    } else {
      parts.push('Mo-Start');
    }
    
    if (weekNavSettings.week_month_boundary_mode === 'split_by_month') {
      parts.push('Teilen');
    } else {
      parts.push('Beibehalten');
    }
    
    return parts.join(' • ');
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`flex items-center gap-2 ${triggerClassName}`}
        >
          <SettingsIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Wocheneinstellungen</span>
          <Badge variant="secondary" className="text-xs">
            {formatCurrentSettings()}
          </Badge>
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Wochennavigation Einstellungen
          </SheetTitle>
          <SheetDescription>
            Passen Sie die Wochennavigation an Ihre Präferenzen an. 
            Änderungen werden sofort gespeichert.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading && (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">Einstellungen werden geladen...</div>
            </div>
          )}

          {!isLoading && (
            <>
              {/* Weekend Start Preference */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Wochenbeginn
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-base">Wochenbeginn</Label>
                    <div className="text-sm text-muted-foreground mb-2">
                      Wählen Sie, wann die Woche beginnen soll
                    </div>
                    <Select
                      value={weekNavSettings.week_weekend_start}
                      onValueChange={(value) => 
                        handleSettingChange('week_weekend_start', value)
                      }
                      disabled={updateSettingsMutation.isPending}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Wochenbeginn wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONDAY">Montag (ISO Standard)</SelectItem>
                        <SelectItem value="SUNDAY">Sonntag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Month Boundary Mode */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Split className="h-4 w-4" />
                    Monatsgrenze
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-base">Monatsgrenze-Verhalten</Label>
                    <div className="text-sm text-muted-foreground mb-2">
                      Wie sollen Wochen behandelt werden, die mehrere Monate umfassen?
                    </div>
                    <Select
                      value={weekNavSettings.week_month_boundary_mode}
                      onValueChange={(value) => 
                        handleSettingChange('week_month_boundary_mode', value)
                      }
                      disabled={updateSettingsMutation.isPending}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Monatsgrenze-Modus wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keep_intact">Woche beibehalten</SelectItem>
                        <SelectItem value="split_by_month">An Monatsgrenze teilen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-md">
                    <div className="font-medium mb-1">
                      {weekNavSettings.week_month_boundary_mode === 'keep_intact' 
                        ? 'Beibehalten:' 
                        : 'Teilen:'}
                    </div>
                    <div>
                      {weekNavSettings.week_month_boundary_mode === 'keep_intact'
                        ? 'Wochen, die sich über Monate erstrecken, bleiben als komplette Wochen erhalten.'
                        : 'Wochen werden am Monatsende geteilt und beginnen mit dem ersten Tag des neuen Monats.'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Aktuelle Einstellungen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Wochenbeginn:</span>
                      <Badge variant="outline">
                        {weekNavSettings.week_weekend_start === 'SUNDAY' ? 'Sonntag' : 'Montag'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Monatsgrenze:</span>
                      <Badge variant="outline">
                        {weekNavSettings.week_month_boundary_mode === 'keep_intact' 
                          ? 'Beibehalten' 
                          : 'Teilen'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
