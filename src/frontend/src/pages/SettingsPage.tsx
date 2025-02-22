import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings } from "@/services/api";
import { Settings } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import { PDFLayoutEditor } from "@/components/PDFLayoutEditor";
import EmployeeSettingsEditor, { EmployeeType, AbsenceType } from "@/components/EmployeeSettingsEditor";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDebouncedCallback } from 'use-debounce';
import { Trash2 } from "lucide-react";
import { useTheme } from '@/providers/ThemeProvider';

type GroupType = EmployeeType | AbsenceType;

export default function SettingsPage() {
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = React.useState("general");
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);

  const { data: settings, isLoading, error } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
    retry: 3,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({
        title: "Settings updated",
        description: "Your settings have been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const debouncedUpdate = useDebouncedCallback(
    (updatedSettings: Settings) => {
      updateMutation.mutate(updatedSettings);
    },
    1000 // 1 second delay
  );

  const handleSave = <T extends keyof Settings>(category: T, updates: Partial<Settings[T]>) => {
    if (!localSettings) return;

    const updatedSettings = { ...localSettings };
    if (category === 'employee_groups') {
      const employeeGroups = updates as Partial<Settings['employee_groups']>;
      updatedSettings.employee_groups = {
        ...updatedSettings.employee_groups,
        ...employeeGroups
      };
    } else {
      updatedSettings[category] = {
        ...updatedSettings[category],
        ...updates
      } as Settings[T];
    }

    setLocalSettings(updatedSettings);
    debouncedUpdate(updatedSettings);
  };

  const handleImmediateUpdate = () => {
    if (localSettings) {
      updateMutation.mutate(localSettings);
      debouncedUpdate.cancel();
    }
  };

  const handleEmployeeGroupChange = (groups: GroupType[]) => {
    const employeeTypes = groups
      .filter((group): group is EmployeeType => group.type === 'employee')
      .map(({ type, ...rest }) => rest);
    handleSave("employee_groups", { employee_types: employeeTypes });
  };

  const handleAbsenceGroupChange = (groups: GroupType[]) => {
    const absenceTypes = groups
      .filter((group): group is AbsenceType => group.type === 'absence')
      .map(({ type, ...rest }) => rest);
    handleSave("employee_groups", { absence_types: absenceTypes });
  };

  const renderTypeList = (types: Array<{ id: string; name: string }>) => {
    return types.map((type) => (
      <SelectItem key={type.id} value={type.id}>
        {type.name}
      </SelectItem>
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load settings</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
              <TabsTrigger value="display">Display</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="pdf">PDF Layout</TabsTrigger>
              <TabsTrigger value="employee_groups">Groups</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeName">Store Name</Label>
                    <Input
                      id="storeName"
                      value={localSettings?.general.store_name ?? ''}
                      onChange={(e) =>
                        handleSave("general", { store_name: e.target.value })
                      }
                      onBlur={handleImmediateUpdate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeAddress">Store Address</Label>
                    <Input
                      id="storeAddress"
                      value={localSettings?.general.store_address ?? ''}
                      onChange={(e) =>
                        handleSave("general", { store_address: e.target.value })
                      }
                      onBlur={handleImmediateUpdate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeContact">Store Contact</Label>
                    <Input
                      id="storeContact"
                      value={localSettings?.general.store_contact ?? ''}
                      onChange={(e) =>
                        handleSave("general", { store_contact: e.target.value })
                      }
                      onBlur={handleImmediateUpdate}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="storeOpening">Opening Time</Label>
                      <Input
                        id="storeOpening"
                        type="time"
                        value={localSettings?.general.store_opening ?? '09:00'}
                        onChange={(e) =>
                          handleSave("general", { store_opening: e.target.value })
                        }
                        onBlur={handleImmediateUpdate}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storeClosing">Closing Time</Label>
                      <Input
                        id="storeClosing"
                        type="time"
                        value={localSettings?.general.store_closing ?? '20:00'}
                        onChange={(e) =>
                          handleSave("general", { store_closing: e.target.value })
                        }
                        onBlur={handleImmediateUpdate}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="keyholderBefore">Keyholder Time Before Opening (minutes)</Label>
                      <Input
                        id="keyholderBefore"
                        type="number"
                        min="0"
                        max="120"
                        value={localSettings?.general.keyholder_before_minutes ?? 30}
                        onChange={(e) =>
                          handleSave("general", { keyholder_before_minutes: parseInt(e.target.value) })
                        }
                        onBlur={handleImmediateUpdate}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="keyholderAfter">Keyholder Time After Closing (minutes)</Label>
                      <Input
                        id="keyholderAfter"
                        type="number"
                        min="0"
                        max="120"
                        value={localSettings?.general.keyholder_after_minutes ?? 30}
                        onChange={(e) =>
                          handleSave("general", { keyholder_after_minutes: parseInt(e.target.value) })
                        }
                        onBlur={handleImmediateUpdate}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Opening Days</Label>
                    <div className="grid grid-cols-7 gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <div key={day} className="flex flex-col items-center">
                          <Label className="text-xs mb-1">{day}</Label>
                          <Switch
                            checked={localSettings?.general.opening_days?.[index.toString()] ?? false}
                            onCheckedChange={(checked) => {
                              if (!localSettings) return;

                              // Create new settings object with updated opening days
                              const updatedSettings = {
                                ...localSettings,
                                general: {
                                  ...localSettings.general,
                                  opening_days: {
                                    ...localSettings.general.opening_days,
                                    [index.toString()]: checked
                                  }
                                }
                              };

                              // Update local state immediately
                              setLocalSettings(updatedSettings);

                              // Send update to server
                              updateMutation.mutate(updatedSettings);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label>Special Opening Hours</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const date = prompt('Enter date (YYYY-MM-DD):');
                          if (!date) return;

                          const newSpecialHours = {
                            ...localSettings?.general.special_hours,
                            [date]: {
                              is_closed: false,
                              opening: localSettings?.general.store_opening,
                              closing: localSettings?.general.store_closing
                            }
                          };
                          handleSave("general", { special_hours: newSpecialHours });
                          handleImmediateUpdate();
                        }}
                      >
                        Add Special Hours
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(localSettings?.general.special_hours ?? {}).map(([date, hours]) => (
                        <Card key={date} className="p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{date}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newSpecialHours = { ...localSettings?.general.special_hours };
                                delete newSpecialHours[date];
                                handleSave("general", { special_hours: newSpecialHours });
                                handleImmediateUpdate();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={hours.is_closed}
                                onCheckedChange={(checked) => {
                                  const newSpecialHours = {
                                    ...localSettings?.general.special_hours,
                                    [date]: { ...hours, is_closed: checked }
                                  };
                                  handleSave("general", { special_hours: newSpecialHours });
                                  handleImmediateUpdate();
                                }}
                              />
                              <Label>Closed</Label>
                            </div>
                            {!hours.is_closed && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Opening</Label>
                                  <Input
                                    type="time"
                                    value={hours.opening ?? localSettings?.general.store_opening}
                                    onChange={(e) => {
                                      const newSpecialHours = {
                                        ...localSettings?.general.special_hours,
                                        [date]: { ...hours, opening: e.target.value }
                                      };
                                      handleSave("general", { special_hours: newSpecialHours });
                                      handleImmediateUpdate();
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Closing</Label>
                                  <Input
                                    type="time"
                                    value={hours.closing ?? localSettings?.general.store_closing}
                                    onChange={(e) => {
                                      const newSpecialHours = {
                                        ...localSettings?.general.special_hours,
                                        [date]: { ...hours, closing: e.target.value }
                                      };
                                      handleSave("general", { special_hours: newSpecialHours });
                                      handleImmediateUpdate();
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={localSettings?.general.timezone ?? ''}
                      onValueChange={(value) => {
                        handleSave("general", { timezone: value });
                        handleImmediateUpdate();
                      }}
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                        <SelectItem value="Europe/London">Europe/London</SelectItem>
                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={localSettings?.general.language ?? ''}
                      onValueChange={(value) => {
                        handleSave("general", { language: value });
                        handleImmediateUpdate();
                      }}
                    >
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Select
                      value={localSettings?.general.date_format ?? ''}
                      onValueChange={(value) => {
                        handleSave("general", { date_format: value });
                        handleImmediateUpdate();
                      }}
                    >
                      <SelectTrigger id="dateFormat">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD.MM.YYYY">DD.MM.YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeFormat">Time Format</Label>
                    <Select
                      value={localSettings?.general.time_format ?? ''}
                      onValueChange={(value) => {
                        handleSave("general", { time_format: value });
                        handleImmediateUpdate();
                      }}
                    >
                      <SelectTrigger id="timeFormat">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">24h</SelectItem>
                        <SelectItem value="12h">12h</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scheduling" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultShiftDuration">
                      Default Shift Duration (hours)
                    </Label>
                    <Input
                      type="number"
                      id="defaultShiftDuration"
                      value={localSettings?.scheduling.default_shift_duration ?? ''}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          default_shift_duration: parseFloat(e.target.value),
                        })
                      }
                      onBlur={handleImmediateUpdate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minBreakDuration">
                      Minimum Break Duration (minutes)
                    </Label>
                    <Input
                      type="number"
                      id="minBreakDuration"
                      value={localSettings?.scheduling.min_break_duration ?? ''}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          min_break_duration: Number(e.target.value),
                        })
                      }
                      onBlur={handleImmediateUpdate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxDailyHours">
                      Maximum Daily Hours
                    </Label>
                    <Input
                      type="number"
                      id="maxDailyHours"
                      value={localSettings?.scheduling.max_daily_hours ?? ''}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          max_daily_hours: Number(e.target.value),
                        })
                      }
                      onBlur={handleImmediateUpdate}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxWeeklyHours">
                      Maximum Weekly Hours
                    </Label>
                    <Input
                      type="number"
                      id="maxWeeklyHours"
                      value={localSettings?.scheduling.max_weekly_hours ?? ''}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          max_weekly_hours: Number(e.target.value),
                        })
                      }
                      onBlur={handleImmediateUpdate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minRestBetweenShifts">
                      Minimum Rest Between Shifts (hours)
                    </Label>
                    <Input
                      type="number"
                      id="minRestBetweenShifts"
                      value={localSettings?.scheduling.min_rest_between_shifts ?? ''}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          min_rest_between_shifts: Number(e.target.value),
                        })
                      }
                      onBlur={handleImmediateUpdate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schedulingPeriodWeeks">
                      Scheduling Period (weeks)
                    </Label>
                    <Input
                      type="number"
                      id="schedulingPeriodWeeks"
                      value={localSettings?.scheduling.scheduling_period_weeks ?? ''}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          scheduling_period_weeks: Number(e.target.value),
                        })
                      }
                      onBlur={handleImmediateUpdate}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoSchedulePreferences"
                      checked={localSettings?.scheduling.auto_schedule_preferences ?? false}
                      onCheckedChange={(checked) =>
                        handleSave("scheduling", {
                          auto_schedule_preferences: checked,
                        })
                      }
                      onBlur={handleImmediateUpdate}
                    />
                    <Label htmlFor="autoSchedulePreferences">
                      Auto-schedule based on preferences
                    </Label>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="display" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={localSettings?.display.theme ?? ''}
                      onValueChange={(value) => {
                        if (!localSettings) return;
                        const updatedSettings = {
                          ...localSettings,
                          display: {
                            ...localSettings.display,
                            theme: value
                          }
                        };
                        setLocalSettings(updatedSettings);
                        updateMutation.mutate(updatedSettings, {
                          onSuccess: () => {
                            setTheme(value as 'light' | 'dark' | 'system');
                          }
                        });
                        debouncedUpdate.cancel(); // Cancel any pending debounced updates
                      }}
                    >
                      <SelectTrigger id="theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <ColorPicker
                      id="primaryColor"
                      color={localSettings?.display.primary_color ?? '#000000'}
                      onChange={(color) => {
                        handleSave("display", { primary_color: color });
                        handleImmediateUpdate();
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Secondary Color</Label>
                    <ColorPicker
                      id="secondaryColor"
                      color={localSettings?.display.secondary_color ?? '#000000'}
                      onChange={(color) => {
                        handleSave("display", { secondary_color: color });
                        handleImmediateUpdate();
                      }}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showSunday"
                      checked={localSettings?.display.show_sunday ?? false}
                      onCheckedChange={(checked) => {
                        handleSave("display", { show_sunday: checked });
                        handleImmediateUpdate();
                      }}
                    />
                    <Label htmlFor="showSunday">Sonntag anzeigen</Label>
                    <div className="text-xs text-muted-foreground ml-2">
                      (Sonntag wird angezeigt, auch wenn er nicht als Öffnungstag markiert ist)
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showWeekdays"
                      checked={localSettings?.display.show_weekdays ?? false}
                      onCheckedChange={(checked) => {
                        handleSave("display", { show_weekdays: checked });
                        handleImmediateUpdate();
                      }}
                    />
                    <Label htmlFor="showWeekdays">Geschlossene Wochentage anzeigen</Label>
                    <div className="text-xs text-muted-foreground ml-2">
                      (Wochentage werden angezeigt, auch wenn sie nicht als Öffnungstage markiert sind)
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startOfWeek">Wochenbeginn</Label>
                    <Select
                      value={localSettings?.display.start_of_week?.toString() ?? ''}
                      onValueChange={(value) => {
                        handleSave("display", { start_of_week: Number(value) });
                        handleImmediateUpdate();
                      }}
                    >
                      <SelectTrigger id="startOfWeek">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sonntag</SelectItem>
                        <SelectItem value="1">Montag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="emailNotifications"
                    checked={localSettings?.notifications.email_notifications ?? false}
                    onCheckedChange={(checked) =>
                      handleSave("notifications", {
                        email_notifications: checked,
                      })
                    }
                    onBlur={handleImmediateUpdate}
                  />
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="schedulePublished"
                    checked={localSettings?.notifications.schedule_published ?? false}
                    onCheckedChange={(checked) =>
                      handleSave("notifications", {
                        schedule_published: checked,
                      })
                    }
                    onBlur={handleImmediateUpdate}
                  />
                  <Label htmlFor="schedulePublished">
                    Schedule Published Notifications
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="shiftChanges"
                    checked={localSettings?.notifications.shift_changes ?? false}
                    onCheckedChange={(checked) =>
                      handleSave("notifications", {
                        shift_changes: checked,
                      })
                    }
                    onBlur={handleImmediateUpdate}
                  />
                  <Label htmlFor="shiftChanges">Shift Changes Notifications</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="timeOffRequests"
                    checked={localSettings?.notifications.time_off_requests ?? false}
                    onCheckedChange={(checked) =>
                      handleSave("notifications", {
                        time_off_requests: checked,
                      })
                    }
                    onBlur={handleImmediateUpdate}
                  />
                  <Label htmlFor="timeOffRequests">
                    Time Off Request Notifications
                  </Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pdf" className="space-y-6">
              <PDFLayoutEditor
                config={{
                  page_size: localSettings?.pdf_layout.page_size ?? 'A4',
                  orientation: localSettings?.pdf_layout.orientation ?? 'portrait',
                  margins: localSettings?.pdf_layout.margins ?? { top: 20, right: 20, bottom: 20, left: 20 },
                  table_style: localSettings?.pdf_layout.table_style ?? {
                    header_bg_color: '#f5f5f5',
                    border_color: '#e0e0e0',
                    text_color: '#000000',
                    header_text_color: '#000000'
                  },
                  fonts: localSettings?.pdf_layout.fonts ?? {
                    family: 'Arial',
                    size: 12,
                    header_size: 14
                  },
                  content: localSettings?.pdf_layout.content ?? {
                    show_employee_id: true,
                    show_position: true,
                    show_breaks: true,
                    show_total_hours: true
                  }
                }}
                onChange={(config) => {
                  handleSave("pdf_layout", config);
                  handleImmediateUpdate();
                }}
              />
            </TabsContent>

            <TabsContent value="employee_groups" className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Employee Types</Label>
                  <EmployeeSettingsEditor
                    type="employee"
                    groups={localSettings?.employee_groups.employee_types.map(type => ({
                      ...type,
                      type: 'employee'
                    })) ?? []}
                    onChange={handleEmployeeGroupChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Absence Types</Label>
                  <EmployeeSettingsEditor
                    type="absence"
                    groups={localSettings?.employee_groups.absence_types.map(type => ({
                      ...type,
                      type: 'absence'
                    })) ?? []}
                    onChange={handleAbsenceGroupChange}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}