import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings, generateDemoData } from "@/services/api";
import type { Settings } from "@/types/index";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import { PDFLayoutEditor } from "@/components/PDFLayoutEditor";
import EmployeeSettingsEditor, { EmployeeType, AbsenceType } from "@/components/EmployeeSettingsEditor";
import { Loader2, Save, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDebouncedCallback } from 'use-debounce';
import { useTheme } from '@/hooks/use-theme';
import { PageHeader } from '@/components/PageHeader';

export interface BaseGroup {
  id: string;
  name: string;
}

export interface BaseEmployeeType extends BaseGroup {
  min_hours: number;
  max_hours: number;
  type: 'employee';
}

export interface BaseAbsenceType extends BaseGroup {
  color: string;
  type: 'absence';
}

type GroupType = BaseEmployeeType | BaseAbsenceType;

export function SettingsPage() {
  const { toast } = useToast();
  const { setTheme, theme } = useTheme();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = React.useState("general");
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [selectedDemoModule, setSelectedDemoModule] = useState<string>("");

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    retry: 3,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  } as const);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setSelectedDemoModule(settings.actions.demo_data.selected_module || "");
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => updateSettings(data),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(["settings"], updatedSettings);
      setLocalSettings(updatedSettings);
      toast({
        title: "Settings updated",
        description: "Your settings have been successfully updated.",
      });
    },
    onError: (error) => {
      const cachedSettings = queryClient.getQueryData<Settings>(["settings"]);
      if (cachedSettings) {
        setLocalSettings(cachedSettings);
      }
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
      debouncedUpdate.cancel();

      updateMutation.mutate(localSettings);
    }
  };

  const handleEmployeeGroupChange = (groups: GroupType[]) => {
    const employeeTypes = groups
      .filter((group): group is BaseEmployeeType => group.type === 'employee')
      .map(({ type, ...rest }) => rest);
    handleSave("employee_groups", {
      employee_types: employeeTypes.map(type => ({
        ...type,
        type: 'employee' as const
      }))
    });
  };

  const handleAbsenceGroupChange = (groups: GroupType[]) => {
    const absenceTypes = groups
      .filter((group): group is BaseAbsenceType => group.type === 'absence')
      .map(({ type, ...rest }) => rest);
    handleSave("employee_groups", {
      absence_types: absenceTypes.map(type => ({
        ...type,
        type: 'absence' as const
      }))
    });
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
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your store settings and preferences"
      />

      <Card>
        <CardContent className="p-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 gap-4">
              <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                General
              </TabsTrigger>
              <TabsTrigger value="scheduling" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Scheduling
              </TabsTrigger>
              <TabsTrigger value="display" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Display
              </TabsTrigger>
              <TabsTrigger value="pdf" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                PDF Layout
              </TabsTrigger>
              <TabsTrigger value="actions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>
                    Configure your store's basic information and operating hours
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          className="w-full"
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
                          className="w-full"
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
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Store Hours</h3>
                      <div className="rounded-lg border p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="store-opening">Opening Time</Label>
                            <input
                              id="store-opening"
                              type="time"
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              value={localSettings?.general.store_opening ?? '09:00'}
                              onChange={(e) => handleSave("general", { store_opening: e.target.value })}
                              title="Store opening time"
                              aria-label="Store opening time"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="store-closing">Closing Time</Label>
                            <input
                              id="store-closing"
                              type="time"
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              value={localSettings?.general.store_closing ?? '20:00'}
                              onChange={(e) => handleSave("general", { store_closing: e.target.value })}
                              title="Store closing time"
                              aria-label="Store closing time"
                            />
                          </div>
                        </div>

                        <Separator className="my-2" />

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="keyholder-before">Keyholder Time Before Opening</Label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="keyholder-before"
                                type="number"
                                min="0"
                                max="120"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={localSettings?.general.keyholder_before_minutes ?? 30}
                                onChange={(e) => handleSave("general", { keyholder_before_minutes: parseInt(e.target.value) })}
                                title="Minutes before opening for keyholders"
                                aria-label="Minutes before opening for keyholders"
                              />
                              <span className="text-sm text-muted-foreground">min</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="keyholder-after">Keyholder Time After Closing</Label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="keyholder-after"
                                type="number"
                                min="0"
                                max="120"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={localSettings?.general.keyholder_after_minutes ?? 30}
                                onChange={(e) => handleSave("general", { keyholder_after_minutes: parseInt(e.target.value) })}
                                title="Minutes after closing for keyholders"
                                aria-label="Minutes after closing for keyholders"
                              />
                              <span className="text-sm text-muted-foreground">min</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Opening Days</Label>
                      <div className="grid grid-cols-7 gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <div key={day} className="flex flex-col items-center space-y-2">
                            <Label className="text-sm">{day}</Label>
                            <Switch
                              checked={localSettings?.general.opening_days?.[index.toString()] ?? false}
                              onCheckedChange={(checked) => {
                                if (!localSettings) return;
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
                                setLocalSettings(updatedSettings);
                                updateMutation.mutate(updatedSettings);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (localSettings) {
                        debouncedUpdate.cancel();
                        updateMutation.mutate(localSettings);
                      }
                    }}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="actions">
              <Card>
                <CardHeader>
                  <CardTitle>Demo Data Generation</CardTitle>
                  <CardDescription>
                    Generate sample data for testing and development purposes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="demo-data-module">Select Module</Label>
                      <Select
                        value={selectedDemoModule}
                        onValueChange={setSelectedDemoModule}
                      >
                        <SelectTrigger id="demo-data-module" className="w-[200px]">
                          <SelectValue placeholder="Choose a module" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="settings">Settings</SelectItem>
                          <SelectItem value="employees">Employees</SelectItem>
                          <SelectItem value="shifts">Shifts</SelectItem>
                          <SelectItem value="coverage">Coverage</SelectItem>
                          <SelectItem value="availability">Availability</SelectItem>
                          <SelectItem value="all">All Modules</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <Label>Last Execution</Label>
                      <span className="text-sm text-muted-foreground">
                        {localSettings?.actions.demo_data.last_execution
                          ? new Date(localSettings.actions.demo_data.last_execution).toLocaleString()
                          : "Never"}
                      </span>
                    </div>

                    <Separator className="my-4" />

                    <Button
                      onClick={async () => {
                        if (!selectedDemoModule) return;
                        try {
                          await generateDemoData(selectedDemoModule);
                          if (selectedDemoModule === 'settings' || selectedDemoModule === 'all') {
                            await queryClient.invalidateQueries({ queryKey: ["settings"] });
                          }
                          toast({
                            title: "Success",
                            description: `Demo data generated for ${selectedDemoModule} module`,
                          });
                          queryClient.invalidateQueries({ queryKey: ["settings"] });
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: error instanceof Error ? error.message : "Failed to generate demo data",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={!selectedDemoModule}
                      className="w-full"
                    >
                      Generate Demo Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scheduling">
              <Card>
                <CardHeader>
                  <CardTitle>Scheduling Settings</CardTitle>
                  <CardDescription>Configure scheduling rules and preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="resourceType">Resource Type</Label>
                        <Select
                          value={localSettings?.scheduling.scheduling_resource_type}
                          onValueChange={(value: 'shifts' | 'coverage') =>
                            handleSave("scheduling", { scheduling_resource_type: value })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select resource type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="shifts">Shifts</SelectItem>
                            <SelectItem value="coverage">Coverage</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="defaultShiftDuration">Default Shift Duration (hours)</Label>
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
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="minBreakDuration">Minimum Break Duration (minutes)</Label>
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
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="maxDailyHours">Maximum Daily Hours</Label>
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
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxWeeklyHours">Maximum Weekly Hours</Label>
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
                          className="w-full"
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-2">
                        <Switch
                          id="autoSchedulePreferences"
                          checked={localSettings?.scheduling.auto_schedule_preferences ?? false}
                          onCheckedChange={(checked) =>
                            handleSave("scheduling", {
                              auto_schedule_preferences: checked,
                            })
                          }
                        />
                        <Label htmlFor="autoSchedulePreferences">
                          Auto-schedule based on preferences
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleImmediateUpdate}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="display">
              <Card>
                <CardHeader>
                  <CardTitle>Display Settings</CardTitle>
                  <CardDescription>Customize the appearance and notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="theme">Theme</Label>
                        <Select
                          value={localSettings?.display.theme ?? ''}
                          onValueChange={(value) => {
                            if (!localSettings) return;
                            const theme = value as 'light' | 'dark' | 'system';
                            const updatedSettings = Object.assign({}, localSettings, {
                              display: Object.assign({}, localSettings.display, { theme })
                            }) as Settings;
                            setLocalSettings(updatedSettings);
                            updateMutation.mutate(updatedSettings);
                            setTheme(theme);
                            debouncedUpdate.cancel();
                          }}
                        >
                          <SelectTrigger id="theme" className="w-full">
                            <SelectValue placeholder="Select theme" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="primary-color">Primary Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="primary-color"
                            type="color"
                            value={localSettings?.display.primary_color ?? '#000000'}
                            onChange={(e) => {
                              handleSave("display", { primary_color: e.target.value });
                              handleImmediateUpdate();
                            }}
                            className="w-[100px]"
                          />
                          <Input
                            value={localSettings?.display.primary_color ?? '#000000'}
                            onChange={(e) => {
                              handleSave("display", { primary_color: e.target.value });
                              handleImmediateUpdate();
                            }}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="secondary-color">Secondary Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="secondary-color"
                            type="color"
                            value={localSettings?.display.secondary_color ?? '#000000'}
                            onChange={(e) => {
                              handleSave("display", { secondary_color: e.target.value });
                              handleImmediateUpdate();
                            }}
                            className="w-[100px]"
                          />
                          <Input
                            value={localSettings?.display.secondary_color ?? '#000000'}
                            onChange={(e) => {
                              handleSave("display", { secondary_color: e.target.value });
                              handleImmediateUpdate();
                            }}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Calendar Display</Label>
                        <div className="rounded-lg border p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="show-sunday">Show Sunday</Label>
                            <Switch
                              id="show-sunday"
                              checked={localSettings?.display.show_sunday ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("display", { show_sunday: checked });
                                handleImmediateUpdate();
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="show-weekdays">Show Weekdays</Label>
                            <Switch
                              id="show-weekdays"
                              checked={localSettings?.display.show_weekdays ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("display", { show_weekdays: checked });
                                handleImmediateUpdate();
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="start-of-week">Start of Week</Label>
                            <Select
                              value={localSettings?.display.start_of_week?.toString() ?? ''}
                              onValueChange={(value) => {
                                handleSave("display", { start_of_week: Number(value) });
                                handleImmediateUpdate();
                              }}
                            >
                              <SelectTrigger id="start-of-week" className="w-[140px]">
                                <SelectValue placeholder="Select day" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">Sunday</SelectItem>
                                <SelectItem value="1">Monday</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Notifications</Label>
                        <div className="rounded-lg border p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="email-notifications">Email Notifications</Label>
                            <Switch
                              id="email-notifications"
                              checked={localSettings?.display.email_notifications ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("display", { email_notifications: checked });
                                handleImmediateUpdate();
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="schedule-published">Schedule Published</Label>
                            <Switch
                              id="schedule-published"
                              checked={localSettings?.display.schedule_published ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("display", { schedule_published: checked });
                                handleImmediateUpdate();
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="shift-changes">Shift Changes</Label>
                            <Switch
                              id="shift-changes"
                              checked={localSettings?.display.shift_changes ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("display", { shift_changes: checked });
                                handleImmediateUpdate();
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="time-off-requests">Time Off Requests</Label>
                            <Switch
                              id="time-off-requests"
                              checked={localSettings?.display.time_off_requests ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("display", { time_off_requests: checked });
                                handleImmediateUpdate();
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleImmediateUpdate}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="pdf">
              <Card>
                <CardHeader>
                  <CardTitle>PDF Layout Settings</CardTitle>
                  <CardDescription>Customize the appearance of exported PDF schedules</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Page Settings</Label>
                          <div className="rounded-lg border p-4 space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="page-size">Page Size</Label>
                              <Select
                                value={localSettings?.pdf_layout.page_size ?? 'A4'}
                                onValueChange={(value) => {
                                  handleSave("pdf_layout", { page_size: value });
                                  handleImmediateUpdate();
                                }}
                              >
                                <SelectTrigger id="page-size" className="w-full">
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="A4">A4</SelectItem>
                                  <SelectItem value="A3">A3</SelectItem>
                                  <SelectItem value="Letter">Letter</SelectItem>
                                  <SelectItem value="Legal">Legal</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="orientation">Orientation</Label>
                              <Select
                                value={localSettings?.pdf_layout.orientation ?? 'portrait'}
                                onValueChange={(value) => {
                                  handleSave("pdf_layout", { orientation: value });
                                  handleImmediateUpdate();
                                }}
                              >
                                <SelectTrigger id="orientation" className="w-full">
                                  <SelectValue placeholder="Select orientation" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="portrait">Portrait</SelectItem>
                                  <SelectItem value="landscape">Landscape</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Margins (mm)</Label>
                          <div className="rounded-lg border p-4 grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="margin-top">Top</Label>
                              <Input
                                id="margin-top"
                                type="number"
                                value={localSettings?.pdf_layout.margins?.top ?? 20}
                                onChange={(e) => {
                                  handleSave("pdf_layout", {
                                    margins: {
                                      top: Number(e.target.value),
                                      right: localSettings?.pdf_layout.margins?.right ?? 20,
                                      bottom: localSettings?.pdf_layout.margins?.bottom ?? 20,
                                      left: localSettings?.pdf_layout.margins?.left ?? 20
                                    }
                                  });
                                  handleImmediateUpdate();
                                }}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="margin-right">Right</Label>
                              <Input
                                id="margin-right"
                                type="number"
                                value={localSettings?.pdf_layout.margins?.right ?? 20}
                                onChange={(e) => {
                                  handleSave("pdf_layout", {
                                    margins: {
                                      top: localSettings?.pdf_layout.margins?.top ?? 20,
                                      right: Number(e.target.value),
                                      bottom: localSettings?.pdf_layout.margins?.bottom ?? 20,
                                      left: localSettings?.pdf_layout.margins?.left ?? 20
                                    }
                                  });
                                  handleImmediateUpdate();
                                }}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="margin-bottom">Bottom</Label>
                              <Input
                                id="margin-bottom"
                                type="number"
                                value={localSettings?.pdf_layout.margins?.bottom ?? 20}
                                onChange={(e) => {
                                  handleSave("pdf_layout", {
                                    margins: {
                                      top: localSettings?.pdf_layout.margins?.top ?? 20,
                                      right: localSettings?.pdf_layout.margins?.right ?? 20,
                                      bottom: Number(e.target.value),
                                      left: localSettings?.pdf_layout.margins?.left ?? 20
                                    }
                                  });
                                  handleImmediateUpdate();
                                }}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="margin-left">Left</Label>
                              <Input
                                id="margin-left"
                                type="number"
                                value={localSettings?.pdf_layout.margins?.left ?? 20}
                                onChange={(e) => {
                                  handleSave("pdf_layout", {
                                    margins: {
                                      top: localSettings?.pdf_layout.margins?.top ?? 20,
                                      right: localSettings?.pdf_layout.margins?.right ?? 20,
                                      bottom: localSettings?.pdf_layout.margins?.bottom ?? 20,
                                      left: Number(e.target.value)
                                    }
                                  });
                                  handleImmediateUpdate();
                                }}
                                className="w-full"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Content Settings</Label>
                          <div className="rounded-lg border p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="show-employee-id">Show Employee ID</Label>
                              <Switch
                                id="show-employee-id"
                                checked={localSettings?.pdf_layout.content?.show_employee_id ?? true}
                                onCheckedChange={(checked) => {
                                  handleSave("pdf_layout", {
                                    content: {
                                      show_employee_id: checked,
                                      show_position: localSettings?.pdf_layout.content?.show_position ?? true,
                                      show_breaks: localSettings?.pdf_layout.content?.show_breaks ?? true,
                                      show_total_hours: localSettings?.pdf_layout.content?.show_total_hours ?? true
                                    }
                                  });
                                  handleImmediateUpdate();
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label htmlFor="show-position">Show Position</Label>
                              <Switch
                                id="show-position"
                                checked={localSettings?.pdf_layout.content?.show_position ?? true}
                                onCheckedChange={(checked) => {
                                  handleSave("pdf_layout", {
                                    content: {
                                      show_employee_id: localSettings?.pdf_layout.content?.show_employee_id ?? true,
                                      show_position: checked,
                                      show_breaks: localSettings?.pdf_layout.content?.show_breaks ?? true,
                                      show_total_hours: localSettings?.pdf_layout.content?.show_total_hours ?? true
                                    }
                                  });
                                  handleImmediateUpdate();
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label htmlFor="show-breaks">Show Breaks</Label>
                              <Switch
                                id="show-breaks"
                                checked={localSettings?.pdf_layout.content?.show_breaks ?? true}
                                onCheckedChange={(checked) => {
                                  handleSave("pdf_layout", {
                                    content: {
                                      show_employee_id: localSettings?.pdf_layout.content?.show_employee_id ?? true,
                                      show_position: localSettings?.pdf_layout.content?.show_position ?? true,
                                      show_breaks: checked,
                                      show_total_hours: localSettings?.pdf_layout.content?.show_total_hours ?? true
                                    }
                                  });
                                  handleImmediateUpdate();
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label htmlFor="show-total-hours">Show Total Hours</Label>
                              <Switch
                                id="show-total-hours"
                                checked={localSettings?.pdf_layout.content?.show_total_hours ?? true}
                                onCheckedChange={(checked) => {
                                  handleSave("pdf_layout", {
                                    content: {
                                      show_employee_id: localSettings?.pdf_layout.content?.show_employee_id ?? true,
                                      show_position: localSettings?.pdf_layout.content?.show_position ?? true,
                                      show_breaks: localSettings?.pdf_layout.content?.show_breaks ?? true,
                                      show_total_hours: checked
                                    }
                                  });
                                  handleImmediateUpdate();
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Font Settings</Label>
                          <div className="rounded-lg border p-4 space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="font-family">Font Family</Label>
                              <Select
                                value={localSettings?.pdf_layout.fonts?.family ?? 'Arial'}
                                onValueChange={(value) => {
                                  handleSave("pdf_layout", {
                                    fonts: {
                                      family: value,
                                      size: localSettings?.pdf_layout.fonts?.size ?? 12,
                                      header_size: localSettings?.pdf_layout.fonts?.header_size ?? 14
                                    }
                                  });
                                  handleImmediateUpdate();
                                }}
                              >
                                <SelectTrigger id="font-family" className="w-full">
                                  <SelectValue placeholder="Select font" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Arial">Arial</SelectItem>
                                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="font-size">Base Size</Label>
                                <Input
                                  id="font-size"
                                  type="number"
                                  value={localSettings?.pdf_layout.fonts?.size ?? 12}
                                  onChange={(e) => {
                                    handleSave("pdf_layout", {
                                      fonts: {
                                        family: localSettings?.pdf_layout.fonts?.family ?? 'Arial',
                                        size: Number(e.target.value),
                                        header_size: localSettings?.pdf_layout.fonts?.header_size ?? 14
                                      }
                                    });
                                    handleImmediateUpdate();
                                  }}
                                  className="w-full"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="header-size">Header Size</Label>
                                <Input
                                  id="header-size"
                                  type="number"
                                  value={localSettings?.pdf_layout.fonts?.header_size ?? 14}
                                  onChange={(e) => {
                                    handleSave("pdf_layout", {
                                      fonts: {
                                        family: localSettings?.pdf_layout.fonts?.family ?? 'Arial',
                                        size: localSettings?.pdf_layout.fonts?.size ?? 12,
                                        header_size: Number(e.target.value)
                                      }
                                    });
                                    handleImmediateUpdate();
                                  }}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <div className="mt-6 border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Layout Preview</h3>
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
                </div>

                <CardFooter className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleImmediateUpdate}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* End of tabs */}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;