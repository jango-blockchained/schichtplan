import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSettings,
  updateSettings,
  generateDemoData,
  generateOptimizedDemoData,
  resetOptimizedDemoDataStatus,
  backupDatabase,
  restoreDatabase,
  wipeTables,
} from "@/services/api";
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
import { PDFLayoutEditor } from "@/components/pdf-editor";
import {
  EmployeeSettingsEditor,
  EmployeeType,
  AbsenceType,
} from "@/components/employees";
import { ShiftTypesEditor } from "@/components/shift-templates";
import { Loader2, Save, Trash2, Plus, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDebouncedCallback } from "use-debounce";
import { useTheme } from "@/hooks/use-theme";
import { PageHeader } from "@/components/layout/PageHeader";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { format } from "date-fns";
import { ScheduleGenerationSettings } from "@/components/schedule";
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

export interface BaseGroup {
  id: string;
  name: string;
}

export interface BaseEmployeeType extends BaseGroup {
  min_hours: number;
  max_hours: number;
  type: "employee";
}

export interface BaseAbsenceType extends BaseGroup {
  color: string;
  type: "absence";
}

type GroupType = BaseEmployeeType | BaseAbsenceType;

// Define SettingKey locally for now
type SettingKey = keyof Settings;

export function SettingsPage() {
  const { toast } = useToast();
  const { setTheme, theme } = useTheme();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = React.useState("general");
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [selectedDemoModule, setSelectedDemoModule] = useState<string>("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>([]);

  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
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
      setSelectedDemoModule(settings.actions_demo_data?.selected_module || "");

      // Reset stale "started" status on component mount
      if (
        settings.actions_demo_data?.status === "started" &&
        settings.actions_demo_data?.start_time
      ) {
        const startTime = new Date(settings.actions_demo_data.start_time);
        const now = new Date();
        const timeDiffMinutes =
          (now.getTime() - startTime.getTime()) / (1000 * 60);

        // If process has been "started" for more than 5 minutes, reset it
        if (timeDiffMinutes > 5) {
          resetOptimizedDemoDataStatus().catch(console.error);
        }
      }
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
    (updatedSettings: Partial<Settings>) => {
      updateMutation.mutate(updatedSettings);
    },
    1000, // 1 second delay
  );

  const handleSave = <K extends SettingKey>(
    key: K,
    value: Settings[K],
  ) => {
    if (!localSettings) return;
    const updatePayload: Partial<Settings> = { [key]: value };
    setLocalSettings(prevSettings => prevSettings ? { ...prevSettings, ...updatePayload } : null);
    debouncedUpdate(updatePayload);
  };

  const handleImmediateUpdate = () => {
    if (localSettings) {
      debouncedUpdate.cancel();
      updateMutation.mutate(localSettings);
    }
  };

  const handleEmployeeGroupChange = (groups: GroupType[]) => {
    const employeeTypes = groups
      .filter((group): group is BaseEmployeeType => group.type === "employee")
      .map(({ type, ...rest }) => rest);
    handleSave("employee_types", employeeTypes.map((type) => ({ ...type, type: "employee" as const })) );
  };

  const handleAbsenceGroupChange = (groups: GroupType[]) => {
    const absenceTypes = groups
      .filter((group): group is BaseAbsenceType => group.type === "absence")
      .map(({ type, ...rest }) => rest);
    handleSave("absence_types", absenceTypes.map((type) => ({ ...type, type: "absence" as const })));
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
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    return date;
  };

  // Convert Date object back to time string
  const dateToTimeString = (date: Date): string => {
    return format(date, "HH:mm");
  };

  const handleBackup = async () => {
    try {
      const blob = await backupDatabase();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().split("T")[0]}.json`;
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
        description:
          error instanceof Error ? error.message : "Failed to backup database",
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
        description:
          error instanceof Error ? error.message : "Failed to restore database",
        variant: "destructive",
      });
    }
  };

  // Fetch available tables when component mounts
  useEffect(() => {
    // Uncommenting: Backend endpoint /api/settings/tables should now exist
    const fetchTables = async () => {
      try {
        const response = await api.get("/settings/tables"); // Ensure api object uses correct base URL
        // Check if response.data exists and has a tables property which is an array
        if (response.data && Array.isArray(response.data.tables)) {
          setAvailableTables(response.data.tables);
        } else {
          console.error("Invalid response structure from /api/settings/tables:", response.data);
          setAvailableTables([]); // Set to empty array on invalid structure
          toast({
            title: "Error",
            description: "Received invalid data for database tables.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching tables:", error);
        toast({
          title: "Error",
          description: `Failed to fetch database tables: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive",
        });
      }
    };
    fetchTables();
    
  }, [toast]); // Add toast to dependency array as it's used inside the effect

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
        description:
          error instanceof Error ? error.message : "Failed to wipe tables",
        variant: "destructive",
      });
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
          <Tabs
            value={currentTab}
            onValueChange={setCurrentTab}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 gap-4">
              <TabsTrigger
                value="general"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                General
              </TabsTrigger>
              <TabsTrigger
                value="scheduling"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Scheduling
              </TabsTrigger>
              <TabsTrigger
                value="display"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Display
              </TabsTrigger>
              <TabsTrigger
                value="pdf"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                PDF Layout
              </TabsTrigger>
              <TabsTrigger
                value="actions"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Store Information</CardTitle>
                  <CardDescription>Basic store details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="store_name">Store Name</Label>
                        <Input
                          id="store_name"
                          value={localSettings?.store_name ?? ""}
                          onChange={(e) =>
                            handleSave("store_name", e.target.value)
                          }
                          onBlur={handleImmediateUpdate}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="storeAddress">Store Address</Label>
                        <Input
                          id="storeAddress"
                          value={localSettings?.store_address ?? ""}
                          onChange={(e) =>
                            handleSave("store_address", e.target.value)
                          }
                          onBlur={handleImmediateUpdate}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="storeContact">Store Contact</Label>
                        <Input
                          id="storeContact"
                          value={localSettings?.store_contact ?? ""}
                          onChange={(e) =>
                            handleSave("store_contact", e.target.value)
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
                            <Input
                              type="time"
                              id="store-opening"
                              value={localSettings?.store_opening ?? "09:00"}
                              onChange={(e) =>
                                handleSave("store_opening", e.target.value)
                              }
                              onBlur={handleImmediateUpdate}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="store-closing">Closing Time</Label>
                            <Input
                              type="time"
                              id="store-closing"
                              value={localSettings?.store_closing ?? "20:00"}
                              onChange={(e) =>
                                handleSave("store_closing", e.target.value)
                              }
                              onBlur={handleImmediateUpdate}
                            />
                          </div>
                        </div>

                        <Separator className="my-2" />

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="keyholder-before">
                              Keyholder Time Before Opening
                            </Label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="keyholder-before"
                                type="number"
                                min="0"
                                max="120"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={localSettings?.keyholder_before_minutes ?? 30}
                                onChange={(e) =>
                                  handleSave(
                                    "keyholder_before_minutes",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                title="Minutes before opening for keyholders"
                                aria-label="Minutes before opening for keyholders"
                              />
                              <span className="text-sm text-muted-foreground">
                                min
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="keyholder-after">
                              Keyholder Time After Closing
                            </Label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="keyholder-after"
                                type="number"
                                min="0"
                                max="120"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={localSettings?.keyholder_after_minutes ?? 30}
                                onChange={(e) =>
                                  handleSave(
                                    "keyholder_after_minutes",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                title="Minutes after closing for keyholders"
                                aria-label="Minutes after closing for keyholders"
                              />
                              <span className="text-sm text-muted-foreground">
                                min
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Opening Days</Label>
                      <div className="grid grid-cols-7 gap-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                          (day, index) => (
                            <div
                              key={day}
                              className="flex flex-col items-center space-y-2"
                            >
                              <Label className="text-sm">{day}</Label>
                              <Switch
                                checked={localSettings?.opening_days?.[index.toString()] ?? false}
                                onCheckedChange={(checked) => {
                                  if (!localSettings) return;
                                  const updatedOpeningDays = {
                                    ...(localSettings.opening_days || {}),
                                    [index.toString()]: checked,
                                  };
                                  handleSave("opening_days", updatedOpeningDays);
                                }}
                              />
                            </div>
                          ),
                        )}
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

            <TabsContent value="actions">
              <div className="space-y-6">
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
                          <SelectTrigger
                            id="demo-data-module"
                            className="w-[200px]"
                          >
                            <SelectValue placeholder="Choose a module" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="settings">Settings</SelectItem>
                            <SelectItem value="employees">Employees</SelectItem>
                            <SelectItem value="shifts">Shifts</SelectItem>
                            <SelectItem value="coverage">Coverage</SelectItem>
                            <SelectItem value="availability">
                              Availability
                            </SelectItem>
                            <SelectItem value="all">All Modules</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <Label>Last Execution</Label>
                        <span className="text-sm text-muted-foreground">
                          {localSettings?.actions_demo_data?.last_execution
                            ? new Date(
                                localSettings.actions_demo_data.last_execution,
                              ).toLocaleString()
                            : "Never"}
                        </span>
                      </div>

                      <Button
                        onClick={async () => {
                          if (!selectedDemoModule) return;
                          try {
                            await generateDemoData(selectedDemoModule);
                            if (
                              selectedDemoModule === "settings" ||
                              selectedDemoModule === "all"
                            ) {
                              await queryClient.invalidateQueries({
                                queryKey: ["settings"],
                              });
                            }
                            toast({
                              title: "Success",
                              description: `Demo data generated for ${selectedDemoModule} module`,
                            });
                            queryClient.invalidateQueries({
                              queryKey: ["settings"],
                            });
                          } catch (error) {
                            toast({
                              title: "Error",
                              description:
                                error instanceof Error
                                  ? error.message
                                  : "Failed to generate demo data",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={!selectedDemoModule}
                        className="w-full"
                      >
                        Generate Demo Data
                      </Button>

                      <Separator className="my-4" />

                      <div className="flex flex-col space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold">
                            Optimized Schedule Generation
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Generate optimized demo data with more diverse shift
                            patterns and granular coverage requirements
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={async () => {
                              try {
                                await generateOptimizedDemoData();
                                await queryClient.invalidateQueries({
                                  queryKey: ["settings"],
                                });
                                toast({
                                  title: "Success",
                                  description:
                                    "Optimized demo data generated with diverse shift patterns",
                                });
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description:
                                    error instanceof Error
                                      ? error.message
                                      : "Failed to generate optimized demo data",
                                  variant: "destructive",
                                });
                              }
                            }}
                            variant="outline"
                            className="flex-1"
                          >
                            Generate Optimized Schedule Data
                          </Button>

                          {localSettings?.actions_demo_data?.status && (
                            <Button
                              onClick={async () => {
                                try {
                                  await resetOptimizedDemoDataStatus();
                                  await queryClient.invalidateQueries({
                                    queryKey: ["settings"],
                                  });
                                  toast({
                                    title: "Success",
                                    description:
                                      "Demo data status reset successfully",
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description:
                                      error instanceof Error
                                        ? error.message
                                        : "Failed to reset demo data status",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              variant="ghost"
                              size="icon"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                              </svg>
                            </Button>
                          )}
                        </div>

                        {localSettings?.actions_demo_data?.status &&
                          localSettings.actions_demo_data.status !==
                            "completed" &&
                          localSettings.actions_demo_data.status !== "failed" &&
                          localSettings.actions_demo_data.progress != null &&
                          localSettings.actions_demo_data.progress > 0 &&
                          localSettings.actions_demo_data.start_time && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  Status:{" "}
                                  {localSettings.actions_demo_data.status}
                                </span>
                                <span className="text-sm">
                                  {localSettings.actions_demo_data.progress ?? 0}
                                  %
                                </span>
                              </div>
                              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{
                                    width: `${localSettings.actions_demo_data.progress ?? 0}%`,
                                  }}
                                ></div>
                              </div>
                              {localSettings.actions_demo_data.error && (
                                <div className="text-sm text-destructive">
                                  Error: {localSettings.actions_demo_data.error}
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Database Management</CardTitle>
                    <CardDescription>
                      Manage your database backups and perform maintenance
                      operations
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
                          value={selectedTables.join(",")}
                          onValueChange={(value) =>
                            setSelectedTables(value ? value.split(",") : [])
                          }
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
                            <AlertDialogTitle>
                              Are you absolutely sure?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will permanently delete all data from
                              the selected tables:
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
                    <CardDescription>
                      Configure scheduling rules and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="resourceType">Resource Type</Label>
                          <Select
                            value={localSettings?.scheduling_resource_type ?? "shifts"}
                            onValueChange={(value: "shifts" | "coverage") =>
                              handleSave("scheduling_resource_type", value)
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
                          <Label htmlFor="defaultShiftDuration">
                            Default Shift Duration (hours)
                          </Label>
                          <Input
                            type="number"
                            id="defaultShiftDuration"
                            value={localSettings?.default_shift_duration ?? ""}
                            onChange={(e) =>
                              handleSave(
                                "default_shift_duration", 
                                parseFloat(e.target.value) || 0
                              )
                            }
                            onBlur={handleImmediateUpdate}
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="minBreakDuration">
                            Minimum Break Duration (minutes)
                          </Label>
                          <Input
                            type="number"
                            id="minBreakDuration"
                            value={localSettings?.min_break_duration ?? ""}
                            onChange={(e) =>
                              handleSave(
                                "min_break_duration", 
                                Number(e.target.value) || 0
                              )
                            }
                            onBlur={handleImmediateUpdate}
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxDailyHours">
                            Maximum Daily Hours
                          </Label>
                          <Input
                            type="number"
                            id="maxDailyHours"
                            value={localSettings?.max_daily_hours ?? ""}
                            onChange={(e) =>
                              handleSave(
                                "max_daily_hours", 
                                Number(e.target.value) || 0
                              )
                            }
                            onBlur={handleImmediateUpdate}
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="maxWeeklyHours">
                            Maximum Weekly Hours
                          </Label>
                          <Input
                            type="number"
                            id="maxWeeklyHours"
                            value={localSettings?.max_weekly_hours ?? ""}
                            onChange={(e) =>
                              handleSave(
                                "max_weekly_hours", 
                                Number(e.target.value) || 0
                              )
                            }
                            onBlur={handleImmediateUpdate}
                            className="w-full"
                          />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                          <Switch
                            id="autoSchedulePreferences"
                            checked={localSettings?.auto_schedule_preferences ?? false}
                            onCheckedChange={(checked) =>
                              handleSave("auto_schedule_preferences", checked)
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
                    <Button variant="outline" onClick={handleImmediateUpdate}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </CardFooter>
                </Card>

                <ScheduleGenerationSettings
                  settings={localSettings ?? {
                    id: 0,
                    store_name: "",
                    store_address: null,
                    store_contact: null,
                    timezone: "Europe/Berlin",
                    language: "de",
                    date_format: "DD.MM.YYYY",
                    time_format: "24h",
                    store_opening: "09:00",
                    store_closing: "20:00",
                    keyholder_before_minutes: 30,
                    keyholder_after_minutes: 30,
                    opening_days: {},
                    special_hours: {},
                    availability_types: [],
                    scheduling_resource_type: "shifts",
                    default_shift_duration: 8,
                    min_break_duration: 30,
                    max_daily_hours: 10,
                    max_weekly_hours: 40,
                    min_rest_between_shifts: 11,
                    scheduling_period_weeks: 1,
                    auto_schedule_preferences: true,
                    theme: "light",
                    primary_color: "#000000",
                    secondary_color: "#000000",
                    accent_color: "#000000",
                    background_color: "#ffffff",
                    surface_color: "#ffffff",
                    text_color: "#000000",
                    dark_theme_primary_color: "#ffffff",
                    dark_theme_secondary_color: "#ffffff",
                    dark_theme_accent_color: "#ffffff",
                    dark_theme_background_color: "#000000",
                    dark_theme_surface_color: "#000000",
                    dark_theme_text_color: "#ffffff",
                    show_sunday: false,
                    show_weekdays: true,
                    start_of_week: 1,
                    email_notifications: false,
                    schedule_published_notify: false,
                    shift_changes_notify: false,
                    time_off_requests_notify: false,
                    page_size: "A4",
                    orientation: "portrait",
                    margin_top: 20,
                    margin_right: 20,
                    margin_bottom: 20,
                    margin_left: 20,
                    table_header_bg_color: "#f5f5f5",
                    table_border_color: "#e0e0e0",
                    table_text_color: "#000000",
                    table_header_text_color: "#000000",
                    font_family: "Arial",
                    font_size: 12,
                    header_font_size: 14,
                    show_employee_id: true,
                    show_position: true,
                    show_breaks: true,
                    show_total_hours: true,
                    pdf_layout_presets: null,
                    employee_types: [],
                    absence_types: [],
                    actions_demo_data: null,
                    require_keyholder: true,
                    scheduling_advanced: {},
                  }}
                  onUpdate={(updates) => {
                    if (!localSettings) return;
                    handleSave("generation_requirements", updates);
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="display">
              <Card>
                <CardHeader>
                  <CardTitle>Display Settings</CardTitle>
                  <CardDescription>
                    Customize the appearance and notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="theme">Theme</Label>
                        <Select
                          value={localSettings?.theme ?? "system"}
                          onValueChange={(value) => {
                            const theme = value as "light" | "dark" | "system";
                            handleSave("theme", theme);
                            setTheme(theme);
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
                            value={localSettings?.primary_color ?? "#000000"}
                            onChange={(e) => {
                              handleSave("primary_color", e.target.value);
                            }}
                            className="w-[100px]"
                          />
                          <Input
                            value={localSettings?.primary_color ?? "#000000"}
                            onChange={(e) => {
                              handleSave("primary_color", e.target.value);
                            }}
                            onBlur={handleImmediateUpdate}
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
                            value={localSettings?.secondary_color ?? "#000000"}
                            onChange={(e) => {
                              handleSave("secondary_color", e.target.value);
                            }}
                            className="w-[100px]"
                          />
                          <Input
                            value={localSettings?.secondary_color ?? "#000000"}
                            onChange={(e) => {
                              handleSave("secondary_color", e.target.value);
                            }}
                            onBlur={handleImmediateUpdate}
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
                              checked={localSettings?.show_sunday ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("show_sunday", checked);
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="show-weekdays">Show Weekdays</Label>
                            <Switch
                              id="show-weekdays"
                              checked={localSettings?.show_weekdays ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("show_weekdays", checked);
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="start-of-week">Start of Week</Label>
                            <Select
                              value={localSettings?.start_of_week?.toString() ?? "1"}
                              onValueChange={(value) => {
                                handleSave("start_of_week", Number(value));
                              }}
                            >
                              <SelectTrigger
                                id="start-of-week"
                                className="w-[140px]"
                              >
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
                            <Label htmlFor="email-notifications">
                              Email Notifications
                            </Label>
                            <Switch
                              id="email-notifications"
                              checked={localSettings?.email_notifications ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("email_notifications", checked);
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="schedule-published">
                              Schedule Published
                            </Label>
                            <Switch
                              id="schedule-published"
                              checked={localSettings?.schedule_published_notify ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("schedule_published_notify", checked);
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="shift-changes">Shift Changes</Label>
                            <Switch
                              id="shift-changes"
                              checked={localSettings?.shift_changes_notify ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("shift_changes_notify", checked);
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="time-off-requests">
                              Time Off Requests
                            </Label>
                            <Switch
                              id="time-off-requests"
                              checked={localSettings?.time_off_requests_notify ?? false}
                              onCheckedChange={(checked) => {
                                handleSave("time_off_requests_notify", checked);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={handleImmediateUpdate}>
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
                  <CardDescription>
                    Customize the appearance of exported PDF schedules
                  </CardDescription>
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
                                value={localSettings?.page_size ?? "A4"}
                                onValueChange={(value) => { handleSave("page_size", value); }}
                              >
                                <SelectTrigger id="page-size" className="w-full"><SelectValue placeholder="Select size" /></SelectTrigger>
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
                                value={localSettings?.orientation ?? "portrait"}
                                onValueChange={(value) => { handleSave("orientation", value as "portrait" | "landscape"); }}
                              >
                                <SelectTrigger id="orientation" className="w-full"><SelectValue placeholder="Select orientation" /></SelectTrigger>
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
                              <Input id="margin-top" type="number" value={localSettings?.margin_top ?? 20} onChange={(e) => handleSave("margin_top", Number(e.target.value) || 0)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="margin-right">Right</Label>
                              <Input id="margin-right" type="number" value={localSettings?.margin_right ?? 20} onChange={(e) => handleSave("margin_right", Number(e.target.value) || 0)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="margin-bottom">Bottom</Label>
                              <Input id="margin-bottom" type="number" value={localSettings?.margin_bottom ?? 20} onChange={(e) => handleSave("margin_bottom", Number(e.target.value) || 0)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="margin-left">Left</Label>
                              <Input id="margin-left" type="number" value={localSettings?.margin_left ?? 20} onChange={(e) => handleSave("margin_left", Number(e.target.value) || 0)} />
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
                              <Switch id="show-employee-id" checked={localSettings?.show_employee_id ?? true} onCheckedChange={(checked) => handleSave("show_employee_id", checked)} />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="show-position">Show Position</Label>
                              <Switch id="show-position" checked={localSettings?.show_position ?? true} onCheckedChange={(checked) => handleSave("show_position", checked)} />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="show-breaks">Show Breaks</Label>
                              <Switch id="show-breaks" checked={localSettings?.show_breaks ?? true} onCheckedChange={(checked) => handleSave("show_breaks", checked)} />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="show-total-hours">Show Total Hours</Label>
                              <Switch id="show-total-hours" checked={localSettings?.show_total_hours ?? true} onCheckedChange={(checked) => handleSave("show_total_hours", checked)} />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Font Settings</Label>
                          <div className="rounded-lg border p-4 space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="font-family">Font Family</Label>
                              <Select value={localSettings?.font_family ?? "Arial"} onValueChange={(value) => handleSave("font_family", value)} >
                                <SelectTrigger id="font-family" className="w-full"><SelectValue placeholder="Select font" /></SelectTrigger>
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
                                <Input id="font-size" type="number" value={localSettings?.font_size ?? 12} onChange={(e) => handleSave("font_size", Number(e.target.value) || 0)} />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="header-size">Header Size</Label>
                                <Input id="header-size" type="number" value={localSettings?.header_font_size ?? 14} onChange={(e) => handleSave("header_font_size", Number(e.target.value) || 0)} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Table Style</Label>
                          <div className="rounded-lg border p-4 space-y-4">
                            <div className="space-y-2">
                               <Label htmlFor="table_header_bg_color">Header Background Color</Label>
                               <Input id="table_header_bg_color" type="color" value={localSettings?.table_header_bg_color ?? "#f5f5f5"} onChange={(e) => handleSave("table_header_bg_color", e.target.value)} />
                             </div>
                             <div className="space-y-2">
                               <Label htmlFor="table_border_color">Border Color</Label>
                               <Input id="table_border_color" type="color" value={localSettings?.table_border_color ?? "#e0e0e0"} onChange={(e) => handleSave("table_border_color", e.target.value)} />
                             </div>
                             <div className="space-y-2">
                               <Label htmlFor="table_text_color">Text Color</Label>
                               <Input id="table_text_color" type="color" value={localSettings?.table_text_color ?? "#000000"} onChange={(e) => handleSave("table_text_color", e.target.value)} />
                             </div>
                             <div className="space-y-2">
                               <Label htmlFor="table_header_text_color">Header Text Color</Label>
                               <Input id="table_header_text_color" type="color" value={localSettings?.table_header_text_color ?? "#000000"} onChange={(e) => handleSave("table_header_text_color", e.target.value)} />
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
                      page_size: localSettings?.page_size ?? "A4",
                      orientation: localSettings?.orientation ?? "portrait",
                      margins: {
                        top: localSettings?.margin_top ?? 20,
                        right: localSettings?.margin_right ?? 20,
                        bottom: localSettings?.margin_bottom ?? 20,
                        left: localSettings?.margin_left ?? 20,
                      },
                      table_style: {
                        header_bg_color: localSettings?.table_header_bg_color ?? "#f5f5f5",
                        border_color: localSettings?.table_border_color ?? "#e0e0e0",
                        text_color: localSettings?.table_text_color ?? "#000000",
                        header_text_color: localSettings?.table_header_text_color ?? "#000000",
                      },
                      fonts: {
                        family: localSettings?.font_family ?? "Arial",
                        size: localSettings?.font_size ?? 12,
                        header_size: localSettings?.header_font_size ?? 14,
                      },
                      content: {
                        show_employee_id: localSettings?.show_employee_id ?? true,
                        show_position: localSettings?.show_position ?? true,
                        show_breaks: localSettings?.show_breaks ?? true,
                        show_total_hours: localSettings?.show_total_hours ?? true,
                      },
                    }}
                    onChange={(config) => {
                      if (!config) return;
                      handleSave("page_size", config.page_size);
                      handleSave("orientation", config.orientation as "portrait" | "landscape");
                      if (config.margins) {
                        handleSave("margin_top", config.margins.top);
                        handleSave("margin_right", config.margins.right);
                        handleSave("margin_bottom", config.margins.bottom);
                        handleSave("margin_left", config.margins.left);
                      }
                      if (config.table_style) {
                        handleSave("table_header_bg_color", config.table_style.header_bg_color);
                        handleSave("table_border_color", config.table_style.border_color);
                        handleSave("table_text_color", config.table_style.text_color);
                        handleSave("table_header_text_color", config.table_style.header_text_color);
                      }
                      if (config.fonts) {
                        handleSave("font_family", config.fonts.family);
                        handleSave("font_size", config.fonts.size);
                        handleSave("header_font_size", config.fonts.header_size);
                      }
                      if (config.content) {
                        handleSave("show_employee_id", config.content.show_employee_id);
                        handleSave("show_position", config.content.show_position);
                        handleSave("show_breaks", config.content.show_breaks);
                        handleSave("show_total_hours", config.content.show_total_hours);
                      }
                    }}
                  />
                </div>

                <CardFooter className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={handleImmediateUpdate}>
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
