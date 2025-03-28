import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings, generateDemoData, backupDatabase, restoreDatabase, wipeTables, generateOldDemoData, testGenerateEmployees, testGenerateAvailability, testGenerateAbsences, testGenerateCoverage, testGenerateShiftTemplates } from "@/services/api";
import { Settings } from "@/types";
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
import { Loader2, Save, Trash2, Plus, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDebouncedCallback } from 'use-debounce';
import { useTheme } from '@/hooks/use-theme';
import { PageHeader } from '@/components/PageHeader';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { format } from 'date-fns';
import { ScheduleGenerationSettings } from "@/components/Schedule/ScheduleGenerationSettings";
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
import { DemoDataSection } from '@/components/DemoDataSection';
import { DemoDataGenerationProgress } from "@/components/DemoDataGenerationProgress";

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
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [generationTaskId, setGenerationTaskId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string>("all");

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

  const handleSave = (
    category: keyof Omit<Settings, "id" | "store_name" | "store_address" | "store_contact" | "timezone" | "language" | "date_format" | "time_format" | "store_opening" | "store_closing" | "keyholder_before_minutes" | "keyholder_after_minutes" | "opening_days" | "special_hours" | "availability_types">,
    updates: Partial<Settings[typeof category]>
  ) => {
    if (!localSettings) return;

    // Initialize generation_requirements if it doesn't exist
    if (category === 'scheduling' && !localSettings.scheduling.generation_requirements) {
      localSettings.scheduling.generation_requirements = {
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
        enforce_opening_hours: true
      };
    }

    const updatedSettings = {
      ...localSettings,
      [category]: {
        ...localSettings[category],
        ...updates
      }
    };

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

  // Convert time string to Date object for DateTimePicker
  const timeStringToDate = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    return date;
  };

  // Convert Date object back to time string
  const dateToTimeString = (date: Date): string => {
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
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to backup database",
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
        description: "Database restored successfully",
      });
      // Reload the page to reflect the restored data
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to restore database",
        variant: "destructive",
      });
    }
  };

  // Fetch available tables when component mounts
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await api.get('/settings/tables');
        setAvailableTables(response.data.tables);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch database tables",
          variant: "destructive",
        });
      }
    };
    fetchTables();
  }, []);

  const handleWipeTables = async () => {
    if (selectedTables.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one table to wipe",
        variant: "destructive",
      });
      return;
    }

    try {
      await wipeTables(selectedTables);
      toast({
        title: "Success",
        description: "Selected tables have been wiped successfully",
      });
      setSelectedTables([]);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to wipe tables",
        variant: "destructive",
      });
    }
  };

  const renderDemoDataSection = () => {
    const handleGenerateDemoData = async (type: 'new' | 'old') => {
      try {
        setIsGenerating(true);

        // Show generation in progress toast
        toast({
          title: "Generating demo data",
          description: "Please wait while the data is being generated...",
        });

        // Invalidate queries before generating new data
        queryClient.invalidateQueries(['settings']);
        queryClient.invalidateQueries(['employees']);
        queryClient.invalidateQueries(['shifts']);
        queryClient.invalidateQueries(['coverage']);

        // Generate demo data based on type
        if (type === 'new') {
          await generateDemoData();
        } else {
          await generateOldDemoData(selectedComponent);
        }

        // Invalidate queries after successful generation
        queryClient.invalidateQueries(['settings']);
        queryClient.invalidateQueries(['employees']);
        queryClient.invalidateQueries(['shifts']);
        queryClient.invalidateQueries(['coverage']);

        // Show success toast
        toast({
          title: "Success",
          description: "Demo data has been generated successfully.",
        });

      } catch (error) {
        console.error('Demo data generation error:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to generate demo data",
          variant: "destructive",
        });
      } finally {
        setIsGenerating(false);
      }
    };

    const handleTestComponent = async (component: string, testFn: () => Promise<any>) => {
      try {
        toast({
          title: `Testing ${component} generation`,
          description: "Please wait...",
        });

        const result = await testFn();

        toast({
          title: "Success",
          description: `${result.message} (Count: ${result.count})`,
        });
      } catch (error) {
        console.error(`${component} generation error:`, error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : `Failed to generate ${component}`,
          variant: "destructive",
        });
      }
    };

    const demoComponents = [
      { value: "all", label: "All Components" },
      { value: "employees", label: "Employees" },
      { value: "availability", label: "Availability" },
      { value: "absences", label: "Absences" },
      { value: "coverage", label: "Coverage" },
      { value: "shift-templates", label: "Shift Templates" },
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle>Demo-Daten</CardTitle>
          <CardDescription>
            Generieren Sie Demo-Daten für Tests und Entwicklung. Dies löscht alle vorhandenen Daten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center gap-4">
                <Select
                  value={selectedComponent}
                  onValueChange={setSelectedComponent}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select component" />
                  </SelectTrigger>
                  <SelectContent>
                    {demoComponents.map((component) => (
                      <SelectItem key={component.value} value={component.value}>
                        {component.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => handleGenerateDemoData('old')}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Old Demo Data'
                  )}
                </Button>
              </div>
              <Button
                onClick={() => handleGenerateDemoData('new')}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate New Demo Data'
                )}
              </Button>
            </div>

            {settings?.actions_demo_data?.last_execution && (
              <div className="text-sm text-muted-foreground">
                <p>Last execution: {new Date(settings.actions_demo_data.last_execution).toLocaleString()}</p>
                {settings.actions_demo_data.statistics && (
                  <div className="mt-2">
                    <p>Generated:</p>
                    <ul className="list-disc list-inside">
                      <li>{settings.actions_demo_data.statistics.employees} employees</li>
                      <li>{settings.actions_demo_data.statistics.availabilities} availabilities</li>
                      <li>{settings.actions_demo_data.statistics.coverage_slots} coverage slots</li>
                      <li>{settings.actions_demo_data.statistics.shift_templates} shift templates</li>
                      {settings.actions_demo_data.statistics.absences && (
                        <li>{settings.actions_demo_data.statistics.absences} absences</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const defaultSettings: Settings = {
    id: 1,
    store_name: "",
    store_address: null,
    store_contact: null,
    timezone: "Europe/Berlin",
    language: "de",
    date_format: "DD.MM.YYYY",
    time_format: "24h",
    store_opening: "08:00",
    store_closing: "20:00",
    keyholder_before_minutes: 15,
    keyholder_after_minutes: 15,
    opening_days: {
      "0": true,
      "1": true,
      "2": true,
      "3": true,
      "4": true,
      "5": true,
      "6": true
    },
    special_hours: {},
    availability_types: {
      types: []
    },
    shift_types: [],
    general: {
      store_name: "",
      store_address: "",
      store_contact: "",
      timezone: "Europe/Berlin",
      language: "de",
      date_format: "DD.MM.YYYY",
      time_format: "24h",
      store_opening: "08:00",
      store_closing: "20:00",
      keyholder_before_minutes: 15,
      keyholder_after_minutes: 15,
      opening_days: {},
      special_hours: {}
    },
    scheduling: {
      scheduling_resource_type: "shifts",
      default_shift_duration: 8,
      min_break_duration: 30,
      max_daily_hours: 10,
      max_weekly_hours: 40,
      min_rest_between_shifts: 11,
      scheduling_period_weeks: 1,
      auto_schedule_preferences: true,
      generation_requirements: {
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
        enforce_opening_hours: true
      }
    },
    display: {
      theme: "light",
      primary_color: "#000000",
      secondary_color: "#000000",
      accent_color: "#000000",
      background_color: "#ffffff",
      surface_color: "#ffffff",
      text_color: "#000000",
      dark_theme: {
        primary_color: "#ffffff",
        secondary_color: "#ffffff",
        accent_color: "#ffffff",
        background_color: "#000000",
        surface_color: "#000000",
        text_color: "#ffffff"
      },
      show_sunday: false,
      show_weekdays: true,
      start_of_week: 1,
      email_notifications: false,
      schedule_published: false,
      shift_changes: false,
      time_off_requests: false
    },
    pdf_layout: {
      page_size: "A4",
      orientation: "portrait",
      margins: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      },
      table_style: {
        header_bg_color: "#f5f5f5",
        border_color: "#e0e0e0",
        text_color: "#000000",
        header_text_color: "#000000"
      },
      fonts: {
        family: "Arial",
        size: 12,
        header_size: 14
      },
      content: {
        show_employee_id: true,
        show_position: true,
        show_breaks: true,
        show_total_hours: true
      }
    },
    employee_groups: {
      employee_types: [],
      shift_types: [],
      absence_types: []
    },
    actions: {
      demo_data: {
        selected_module: "all",
        last_execution: null
      }
    }
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
                            <DateTimePicker
                              date={timeStringToDate(localSettings?.general.store_opening ?? '09:00')}
                              setDate={(date) => handleSave("general", { store_opening: dateToTimeString(date) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="store-closing">Closing Time</Label>
                            <DateTimePicker
                              date={timeStringToDate(localSettings?.general.store_closing ?? '20:00')}
                              setDate={(date) => handleSave("general", { store_closing: dateToTimeString(date) })}
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
              <div className="space-y-6">
                {renderDemoDataSection()}
                <Card>
                  <CardHeader>
                    <CardTitle>Database Management</CardTitle>
                    <CardDescription>
                      Manage your database backups and perform maintenance operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex gap-4">
                      <Button onClick={handleBackup}>
                        <Download className="w-4 h-4 mr-2" />
                        Backup Database
                      </Button>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleRestore}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button variant="outline">
                          <Upload className="w-4 h-4 mr-2" />
                          Restore Database
                        </Button>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Table Management</h3>
                      <div className="space-y-2">
                        <Label>Select Tables to Wipe</Label>
                        <Select
                          value={selectedTables.join(',')}
                          onValueChange={(value) => setSelectedTables(value ? value.split(',') : [])}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select tables..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTables.map((table) => (
                              <SelectItem key={table} value={table}>
                                {table}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            disabled={selectedTables.length === 0}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Wipe Selected Tables
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will permanently delete all data from the selected tables:
                              <ul className="list-disc list-inside mt-2">
                                {selectedTables.map((table) => (
                                  <li key={table}>{table}</li>
                                ))}
                              </ul>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleWipeTables}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Yes, wipe tables
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="scheduling">
              <div className="grid gap-6">
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

                <ScheduleGenerationSettings
                  settings={localSettings ?? defaultSettings}
                  onUpdate={(updates) => {
                    if (!localSettings?.scheduling) return;

                    const updatedSettings: Settings = {
                      ...localSettings,
                      scheduling: {
                        ...localSettings.scheduling,
                        generation_requirements: {
                          ...localSettings.scheduling.generation_requirements,
                          ...updates
                        }
                      }
                    };

                    setLocalSettings(updatedSettings);
                    debouncedUpdate.cancel();
                    updateMutation.mutate(updatedSettings);
                  }}
                />
              </div>
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;