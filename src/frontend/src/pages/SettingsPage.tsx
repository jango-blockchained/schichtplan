import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings, generateDemoData, generateOptimizedDemoData, backupDatabase, restoreDatabase, wipeTables } from "@/services/api";
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
import { Loader2, Save, Trash2, Plus, Download, Upload, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDebouncedCallback } from 'use-debounce';
import { useTheme } from '@/hooks/use-theme';
import { PageHeader } from '@/components/PageHeader';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { format } from 'date-fns';
import { ScheduleGenerationSettings } from "@/components/ScheduleGenerationSettings";
import { ApolloExample } from "@/components/ApolloExample";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/axios";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DEFAULT_SETTINGS } from "@/hooks/useSettings";

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
  const { setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = React.useState("general");
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [aiScheduleGenerationEnabled, setAiScheduleGenerationEnabled] = useState(false);
  const [aiScheduleGenerationApiKey, setAiScheduleGenerationApiKey] = useState("");
  const [selectedDemoModule, setSelectedDemoModule] = useState<string>("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>([]);

  const { data: settings, isLoading, error, refetch } = useQuery({
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
      setSelectedDemoModule(settings.actions?.demo_data?.selected_module || "");
      if (settings.ai_scheduling) {
        setAiScheduleGenerationEnabled(settings.ai_scheduling.enabled || false);
        setAiScheduleGenerationApiKey(settings.ai_scheduling.api_key || "");
      } else {
        setAiScheduleGenerationEnabled(DEFAULT_SETTINGS.ai_scheduling?.enabled || false);
        setAiScheduleGenerationApiKey(DEFAULT_SETTINGS.ai_scheduling?.api_key || "");
      }
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => updateSettings(data),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(["settings"], updatedSettings);
      setLocalSettings(updatedSettings);
    },
    onError: () => {
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
    2000
  );

  const handleSave = (
    category: keyof Omit<Settings, "id" | "store_name" | "store_address" | "store_contact" | "timezone" | "language" | "date_format" | "time_format" | "store_opening" | "store_closing" | "keyholder_before_minutes" | "keyholder_after_minutes" | "opening_days" | "special_hours" | "availability_types"> | "ai_scheduling",
    updates: Partial<Settings[typeof category] | Settings['ai_scheduling']>
  ) => {
    if (!localSettings) return;

    const currentCategoryState = localSettings[category];
    const currentAiScheduling = localSettings.ai_scheduling || { enabled: false, api_key: "" };
    const categoryObject = localSettings[category] || {}; // Ensure categoryObject is an object

    const updatedSettings: Settings = {
      ...localSettings,
      [category]: category === 'ai_scheduling'
        ? { ...currentAiScheduling, ...(updates || {}) }
        : { ...categoryObject, ...(updates || {}) }, // Use categoryObject here
    };

    if (category === 'ai_scheduling' && updates) {
      const aiSpecificUpdates = updates as Partial<Settings['ai_scheduling']>;
      if (aiSpecificUpdates && typeof aiSpecificUpdates.enabled === 'boolean') {
        setAiScheduleGenerationEnabled(aiSpecificUpdates.enabled);
      }
      if (aiSpecificUpdates && typeof aiSpecificUpdates.api_key === 'string') {
        setAiScheduleGenerationApiKey(aiSpecificUpdates.api_key);
      }
    }

    setLocalSettings(updatedSettings);
    debouncedUpdate(updatedSettings);
  };

  const handleImmediateUpdate = () => {
    if (localSettings) {
      debouncedUpdate.cancel();
      updateMutation.mutate(localSettings, {
        onSuccess: (updatedData) => {
          queryClient.setQueryData(["settings"], updatedData);
          setLocalSettings(updatedData);
          toast({
            title: "Settings updated",
            description: "Your settings have been successfully updated.",
          });
        }
      });
    }
  };

  const handleEmployeeGroupChange = (groups: GroupType[]) => {
    const employeeTypes = groups
      .filter((group): group is BaseEmployeeType => group.type === 'employee')
      .map(({ type, ...rest }) => ({ ...rest, type: 'employee' as const }));
    
    const currentEmployeeGroups = localSettings?.employee_groups || { employee_types: [], shift_types: [], absence_types: [] };

    handleSave("employee_groups", {
        ...currentEmployeeGroups,
        employee_types: employeeTypes 
    });
  };

  const handleAbsenceGroupChange = (groups: GroupType[]) => {
    const absenceTypes = groups
      .filter((group): group is BaseAbsenceType => group.type === 'absence')
      .map(({ type, ...rest }) => ({ ...rest, type: 'absence' as const }));

    const currentEmployeeGroups = localSettings?.employee_groups || { employee_types: [], shift_types: [], absence_types: [] };
    
    handleSave("employee_groups", {
        ...currentEmployeeGroups,
        absence_types: absenceTypes
    });
  };

  const timeStringToDate = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  };

  const dateToTimeString = (date: Date | null | undefined): string => {
    if (!date) return "00:00";
    return format(date, 'HH:mm');
  };

  const handleBackup = async () => {
    try {
      const blob = await backupDatabase();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Database backup downloaded successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to backup database",
        variant: "destructive",
      });
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await restoreDatabase(file);
      toast({
        title: "Success",
        description: "Database restored successfully. Page will reload.",
      });
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to restore database",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const fetchTablesAsync = async () => {
      try {
        const response = await api.get<{ tables: string[] }>('/settings/tables');
        setAvailableTables(response.data.tables);
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to fetch database tables",
          variant: "destructive",
        });
      }
    };
    fetchTablesAsync();
  }, [toast]);

  const handleWipeTables = async () => {
    if (selectedTables.length === 0) {
      toast({
        title: "No tables selected",
        description: "Please select at least one table to wipe.",
        variant: "destructive",
      });
      return;
    }

    try {
      await wipeTables(selectedTables);
      toast({
        title: "Success",
        description: "Selected tables have been wiped successfully.",
      });
      setSelectedTables([]);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to wipe tables.",
        variant: "destructive",
      });
    }
  };

  const handleDiagnosticsChange = (checked: boolean) => {
    if (!localSettings) return;
    const updatedSchedSettings = {
      ...localSettings.scheduling,
      enable_diagnostics: checked
    };
    handleSave("scheduling", updatedSchedSettings);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error || !localSettings) {
    return <Alert variant="destructive"><AlertDescription>Error loading settings. Please try again later.</AlertDescription></Alert>;
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
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
              <TabsTrigger value="display">Display</TabsTrigger>
              <TabsTrigger value="pdf">PDF Layout</TabsTrigger>
              <TabsTrigger value="ai_tools">AI Tools</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>
                    Configure your store\'s basic information and operating hours
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="storeName">Store Name</Label>
                        <Input
                          id="storeName"
                          value={localSettings.general?.store_name ?? ""}
                          onChange={(e) => handleSave("general", { store_name: e.target.value })}
                          onBlur={handleImmediateUpdate}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="storeAddress">Store Address</Label>
                        <Input
                          id="storeAddress"
                          value={localSettings.general?.store_address ?? ""}
                          onChange={(e) => handleSave("general", { store_address: e.target.value })}
                          onBlur={handleImmediateUpdate}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="storeContact">Store Contact</Label>
                        <Input
                          id="storeContact"
                          value={localSettings.general?.store_contact ?? ""}
                          onChange={(e) => handleSave("general", { store_contact: e.target.value })}
                          onBlur={handleImmediateUpdate}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Store Hours</h3>
                      <div className="rounded-lg border p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="store-opening">Opening Time</Label>
                            <DateTimePicker
                              date={timeStringToDate(localSettings.general?.store_opening ?? "09:00")}
                              setDate={(date) => handleSave("general", { store_opening: dateToTimeString(date) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="store-closing">Closing Time</Label>
                            <DateTimePicker
                              date={timeStringToDate(localSettings.general?.store_closing ?? "20:00")}
                              setDate={(date) => handleSave("general", { store_closing: dateToTimeString(date) })}
                            />
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="keyholder-before">Keyholder Before (min)</Label>
                            <Input
                              id="keyholder-before"
                              type="number" min="0" max="120"
                              value={localSettings.general?.keyholder_before_minutes ?? 30}
                              onChange={(e) => handleSave("general", { keyholder_before_minutes: parseInt(e.target.value) })}
                              onBlur={handleImmediateUpdate}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="keyholder-after">Keyholder After (min)</Label>
                            <Input
                              id="keyholder-after"
                              type="number" min="0" max="120"
                              value={localSettings.general?.keyholder_after_minutes ?? 30}
                              onChange={(e) => handleSave("general", { keyholder_after_minutes: parseInt(e.target.value) })}
                              onBlur={handleImmediateUpdate}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 md:col-span-2">
                      <Label>Opening Days</Label>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                          <div key={day} className="flex flex-col items-center space-y-1">
                            <Label htmlFor={`opening-day-${day}`} className="text-sm font-normal">{day}</Label>
                            <Switch
                              id={`opening-day-${day}`}
                              checked={localSettings.general?.opening_days?.[index.toString()] ?? false}
                              onCheckedChange={(checked) => {
                                const updatedOpeningDays = { ...localSettings.general?.opening_days, [index.toString()]: checked };
                                handleSave("general", { opening_days: updatedOpeningDays });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4 md:col-span-2">
                        <Label>Employee & Absence Types</Label>
                        <EmployeeSettingsEditor
                            type="employee"
                            groups={(localSettings.employee_groups?.employee_types ?? DEFAULT_SETTINGS.employee_groups.employee_types).map(et => ({...et, type: 'employee' as const}))}
                            onChange={handleEmployeeGroupChange}
                        />
                        <Label>Absence Types</Label>
                        <EmployeeSettingsEditor
                            type="absence"
                            groups={(localSettings.employee_groups?.absence_types ?? DEFAULT_SETTINGS.employee_groups.absence_types).map(at => ({...at, type: 'absence' as const}))}
                            onChange={handleAbsenceGroupChange}
                        />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button onClick={handleImmediateUpdate} disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save General Settings
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="scheduling">
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
                            value={localSettings.scheduling?.scheduling_resource_type ?? "shifts"}
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
                          <Input id="default_shift_duration" type="number" value={localSettings.scheduling?.default_shift_duration ?? 8} onChange={(e) => handleSave("scheduling", { default_shift_duration: parseFloat(e.target.value) })} onBlur={handleImmediateUpdate} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="min_break_duration">Min Break Duration (minutes)</Label>
                          <Input id="min_break_duration" type="number" value={localSettings.scheduling?.min_break_duration ?? 30} onChange={(e) => handleSave("scheduling", { min_break_duration: Number(e.target.value) })} onBlur={handleImmediateUpdate} />
                        </div>
                         <div className="space-y-2">
                          <Label htmlFor="min_rest_between_shifts">Min Rest Between Shifts (hours)</Label>
                          <Input id="min_rest_between_shifts" type="number" value={localSettings.scheduling?.min_rest_between_shifts ?? 11} onChange={(e) => handleSave("scheduling", { min_rest_between_shifts: Number(e.target.value) })} onBlur={handleImmediateUpdate} />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="max_daily_hours">Max Daily Hours</Label>
                          <Input id="max_daily_hours" type="number" value={localSettings.scheduling?.max_daily_hours ?? 10} onChange={(e) => handleSave("scheduling", { max_daily_hours: Number(e.target.value) })} onBlur={handleImmediateUpdate} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="max_weekly_hours">Max Weekly Hours</Label>
                          <Input id="max_weekly_hours" type="number" value={localSettings.scheduling?.max_weekly_hours ?? 40} onChange={(e) => handleSave("scheduling", { max_weekly_hours: Number(e.target.value) })} onBlur={handleImmediateUpdate} />
                        </div>
                         <div className="space-y-2">
                          <Label htmlFor="scheduling_period_weeks">Scheduling Period (weeks)</Label>
                          <Input id="scheduling_period_weeks" type="number" value={localSettings.scheduling?.scheduling_period_weeks ?? 1} onChange={(e) => handleSave("scheduling", { scheduling_period_weeks: Number(e.target.value) })} onBlur={handleImmediateUpdate} />
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                          <Switch id="auto_schedule_preferences" checked={localSettings.scheduling?.auto_schedule_preferences ?? true} onCheckedChange={(checked) => handleSave("scheduling", { auto_schedule_preferences: checked })} />
                          <Label htmlFor="auto_schedule_preferences">Auto-schedule by preferences</Label>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                          <Switch id="enable_diagnostics" checked={localSettings.scheduling?.enable_diagnostics ?? false} onCheckedChange={handleDiagnosticsChange} />
                          <Label htmlFor="enable_diagnostics" className="flex items-center">Enable Scheduling Diagnostics <HoverCard><HoverCardTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help ml-1.5" /></HoverCardTrigger><HoverCardContent className="w-80 text-sm">Enables detailed logging during schedule generation. Useful for troubleshooting.</HoverCardContent></HoverCard></Label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                   <CardFooter className="flex justify-end">
                    <Button onClick={handleImmediateUpdate} disabled={updateMutation.isPending}>
                      {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Scheduling Rules
                    </Button>
                  </CardFooter>
                </Card>
                <ScheduleGenerationSettings
                  settings={localSettings}
                  onUpdate={(genUpdates) => {
                    if (!localSettings?.scheduling) return;
                    const updatedGenReqs = { ...localSettings.scheduling.generation_requirements, ...genUpdates };
                    handleSave("scheduling", { ...localSettings.scheduling, generation_requirements: updatedGenReqs });
                    handleImmediateUpdate();
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="display">
              <Card>
                <CardHeader>
                  <CardTitle>Display & Theme</CardTitle>
                  <CardDescription>Customize application appearance and notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="theme">Theme</Label>
                        <Select value={localSettings.display?.theme ?? "system"} onValueChange={(value: 'light' | 'dark' | 'system') => { setTheme(value); handleSave("display", { theme: value }); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="primary_color">Primary Color</Label>
                        <div className="flex items-center gap-2">
                          <ColorPicker id="primary_color_picker" color={localSettings.display?.primary_color ?? "#000000"} onChange={(color) => handleSave("display", { primary_color: color })} />
                          <Input value={localSettings.display?.primary_color ?? "#000000"} onChange={(e) => handleSave("display", { primary_color: e.target.value })} onBlur={handleImmediateUpdate} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondary_color">Secondary Color</Label>
                        <div className="flex items-center gap-2">
                          <ColorPicker id="secondary_color_picker" color={localSettings.display?.secondary_color ?? "#000000"} onChange={(color) => handleSave("display", { secondary_color: color })} />
                          <Input value={localSettings.display?.secondary_color ?? "#000000"} onChange={(e) => handleSave("display", { secondary_color: e.target.value })} onBlur={handleImmediateUpdate} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label>Calendar Display</Label>
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="show_sunday" className="font-normal">Show Sunday</Label>
                          <Switch id="show_sunday" checked={localSettings.display?.show_sunday ?? false} onCheckedChange={(checked) => handleSave("display", { show_sunday: checked })} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="show_weekdays" className="font-normal">Show Weekdays</Label>
                          <Switch id="show_weekdays" checked={localSettings.display?.show_weekdays ?? true} onCheckedChange={(checked) => handleSave("display", { show_weekdays: checked })} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="start_of_week" className="font-normal">Start of Week</Label>
                          <Select value={localSettings.display?.start_of_week?.toString() ?? "1"} onValueChange={(value) => handleSave("display", { start_of_week: parseInt(value) })}>
                            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Sunday</SelectItem>
                              <SelectItem value="1">Monday</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Label>Notifications</Label>
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="email_notifications" className="font-normal">Email Notifications</Label>
                          <Switch id="email_notifications" checked={localSettings.display?.email_notifications ?? false} onCheckedChange={(checked) => handleSave("display", { email_notifications: checked })} />
                        </div>
                         {/* Add other notification toggles if they were there: schedule_published, shift_changes, time_off_requests */}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button onClick={handleImmediateUpdate} disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Display Settings
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
                  <PDFLayoutEditor
                    config={localSettings.pdf_layout ?? DEFAULT_SETTINGS.pdf_layout}
                    onChange={(newConfig) => { 
                        handleSave("pdf_layout", newConfig);
                        handleImmediateUpdate();
                    }}
                  />
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button onClick={handleImmediateUpdate} disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save PDF Settings
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="ai_tools">
              <Card>
                <CardHeader>
                  <CardTitle>AI Schedule Generation</CardTitle>
                  <CardDescription>
                    Configure settings for the AI-powered schedule generation feature.
                    API keys are sensitive; ensure they are handled securely.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between space-x-2 p-4 border rounded-md">
                    <Label htmlFor="ai-schedule-generation-enabled" className="flex flex-col space-y-1">
                      <span>Enable AI Generation</span>
                      <span className="font-normal leading-snug text-muted-foreground">
                        Allow the system to use AI for generating schedules.
                      </span>
                    </Label>
                    <Switch
                      id="ai-schedule-generation-enabled"
                      checked={aiScheduleGenerationEnabled}
                      onCheckedChange={(checked) => {
                        handleSave("ai_scheduling", { enabled: checked });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-api-key">Gemini API Key</Label>
                    <Input
                      id="ai-api-key"
                      type="password"
                      placeholder="Enter your Gemini API Key"
                      value={aiScheduleGenerationApiKey}
                      onChange={(e) => {
                        handleSave("ai_scheduling", { api_key: e.target.value });
                      }}
                      onBlur={handleImmediateUpdate}
                    />
                    <p className="text-sm text-muted-foreground">
                      Your API key for accessing Gemini models.
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button onClick={handleImmediateUpdate} disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save AI Settings
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="actions">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Demo Data Generation</CardTitle>
                    <CardDescription>Generate sample data for testing and development</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="demo-data-module">Select Module</Label>
                      <Select value={selectedDemoModule} onValueChange={setSelectedDemoModule}>
                        <SelectTrigger id="demo-data-module" className="w-[180px]"><SelectValue placeholder="Choose module" /></SelectTrigger>
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
                    <Button
                      className="w-full"
                      disabled={!selectedDemoModule || updateMutation.isPending}
                      onClick={async () => {
                        if (!selectedDemoModule) return;
                        try {
                          await generateDemoData(selectedDemoModule);
                          toast({ title: "Success", description: `Demo data for ${selectedDemoModule} generated.` });
                          await refetch();
                        } catch (err) {
                          toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate demo data.", variant: "destructive" });
                        }
                      }}
                    >
                      {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Generate Demo Data
                    </Button>
                    <Separator />
                     <Label>Optimized Demo Data</Label>
                     <Button
                      className="w-full"
                      variant="outline"
                      disabled={updateMutation.isPending}
                      onClick={async () => {
                        try {
                          await generateOptimizedDemoData();
                          toast({ title: "Success", description: "Optimized demo data generated." });
                           await refetch();
                        } catch (err) {
                          toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate optimized data.", variant: "destructive" });
                        }
                      }}
                    >
                      {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Generate Optimized Data
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Database Management</CardTitle>
                    <CardDescription>Backup, restore, or wipe database tables</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button onClick={handleBackup} disabled={updateMutation.isPending}><Download className="mr-2 h-4 w-4" />Backup DB</Button>
                      <Button variant="outline" asChild disabled={updateMutation.isPending}>
                        <Label htmlFor="restore-db-input" className="cursor-pointer flex items-center">
                          <Upload className="mr-2 h-4 w-4" />Restore DB
                          <Input type="file" id="restore-db-input" accept=".json" onChange={handleRestore} className="hidden" />
                        </Label>
                      </Button>
                    </div>
                    <Separator />
                    <Label>Wipe Tables</Label>
                    <div className="flex items-center gap-2">
                        <Select onValueChange={(value) => setSelectedTables(value ? value.split(",") : [])} value={selectedTables.join(",")}>
                        <SelectTrigger className="flex-grow"><SelectValue placeholder="Select tables to wipe..." /></SelectTrigger>
                        <SelectContent>
                          {availableTables.map(table => <SelectItem key={table} value={table}>{table}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={selectedTables.length === 0 || updateMutation.isPending}><Trash2 className="mr-2 h-4 w-4" />Wipe</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete data from: {selectedTables.join(", ")}.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleWipeTables}>Yes, wipe</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Apollo DevTools Example</CardTitle></CardHeader>
                  <CardContent><ApolloExample /></CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;