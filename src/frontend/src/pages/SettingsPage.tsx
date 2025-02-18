import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings } from "@/services/api";
import { Settings } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import { PDFLayoutEditor } from "@/components/PDFLayoutEditor";
import { EmployeeSettingsEditor } from "@/components/EmployeeSettingsEditor";

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = React.useState("general");

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

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

  const handleSave = (category: string, updates: Partial<Settings>) => {
    updateMutation.mutate({ ...settings, ...updates });
  };

  if (isLoading || !settings) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
              <TabsTrigger value="display">Display</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="pdf">PDF Layout</TabsTrigger>
              <TabsTrigger value="groups">Employee Groups</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeName">Store Name</Label>
                    <Input
                      id="storeName"
                      value={settings.store_name}
                      onChange={(e) =>
                        handleSave("general", { store_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeAddress">Store Address</Label>
                    <Input
                      id="storeAddress"
                      value={settings.store_address}
                      onChange={(e) =>
                        handleSave("general", { store_address: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeContact">Store Contact</Label>
                    <Input
                      id="storeContact"
                      value={settings.store_contact}
                      onChange={(e) =>
                        handleSave("general", { store_contact: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={settings.timezone}
                      onValueChange={(value) =>
                        handleSave("general", { timezone: value })
                      }
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                        <SelectItem value="Europe/London">Europe/London</SelectItem>
                        <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={settings.language}
                      onValueChange={(value) =>
                        handleSave("general", { language: value })
                      }
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
                      value={settings.date_format}
                      onValueChange={(value) =>
                        handleSave("general", { date_format: value })
                      }
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
                      value={settings.time_format}
                      onValueChange={(value) =>
                        handleSave("general", { time_format: value })
                      }
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
                      value={settings.default_shift_duration}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          default_shift_duration: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minBreakDuration">
                      Minimum Break Duration (minutes)
                    </Label>
                    <Input
                      type="number"
                      id="minBreakDuration"
                      value={settings.min_break_duration}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          min_break_duration: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxDailyHours">
                      Maximum Daily Hours
                    </Label>
                    <Input
                      type="number"
                      id="maxDailyHours"
                      value={settings.max_daily_hours}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          max_daily_hours: Number(e.target.value),
                        })
                      }
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
                      value={settings.max_weekly_hours}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          max_weekly_hours: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minRestBetweenShifts">
                      Minimum Rest Between Shifts (hours)
                    </Label>
                    <Input
                      type="number"
                      id="minRestBetweenShifts"
                      value={settings.min_rest_between_shifts}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          min_rest_between_shifts: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schedulingPeriodWeeks">
                      Scheduling Period (weeks)
                    </Label>
                    <Input
                      type="number"
                      id="schedulingPeriodWeeks"
                      value={settings.scheduling_period_weeks}
                      onChange={(e) =>
                        handleSave("scheduling", {
                          scheduling_period_weeks: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoSchedulePreferences"
                      checked={settings.auto_schedule_preferences}
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
            </TabsContent>

            <TabsContent value="display" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={settings.theme}
                      onValueChange={(value) =>
                        handleSave("display", { theme: value })
                      }
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
                      color={settings.primary_color}
                      onChange={(color) =>
                        handleSave("display", { primary_color: color })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Secondary Color</Label>
                    <ColorPicker
                      id="secondaryColor"
                      color={settings.secondary_color}
                      onChange={(color) =>
                        handleSave("display", { secondary_color: color })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showWeekends"
                      checked={settings.show_weekends}
                      onCheckedChange={(checked) =>
                        handleSave("display", { show_weekends: checked })
                      }
                    />
                    <Label htmlFor="showWeekends">Show Weekends</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startOfWeek">Start of Week</Label>
                    <Select
                      value={settings.start_of_week.toString()}
                      onValueChange={(value) =>
                        handleSave("display", {
                          start_of_week: Number(value),
                        })
                      }
                    >
                      <SelectTrigger id="startOfWeek">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="0">Sunday</SelectItem>
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
                    checked={settings.email_notifications}
                    onCheckedChange={(checked) =>
                      handleSave("notifications", {
                        email_notifications: checked,
                      })
                    }
                  />
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="schedulePublished"
                    checked={settings.schedule_published_notify}
                    onCheckedChange={(checked) =>
                      handleSave("notifications", {
                        schedule_published_notify: checked,
                      })
                    }
                  />
                  <Label htmlFor="schedulePublished">
                    Schedule Published Notifications
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="shiftChanges"
                    checked={settings.shift_changes_notify}
                    onCheckedChange={(checked) =>
                      handleSave("notifications", {
                        shift_changes_notify: checked,
                      })
                    }
                  />
                  <Label htmlFor="shiftChanges">Shift Changes Notifications</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="timeOffRequests"
                    checked={settings.time_off_requests_notify}
                    onCheckedChange={(checked) =>
                      handleSave("notifications", {
                        time_off_requests_notify: checked,
                      })
                    }
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
                  page_size: settings.page_size,
                  orientation: settings.orientation,
                  margins: {
                    top: settings.margin_top,
                    right: settings.margin_right,
                    bottom: settings.margin_bottom,
                    left: settings.margin_left,
                  },
                  table_style: {
                    header_bg_color: settings.table_header_bg_color,
                    border_color: settings.table_border_color,
                    text_color: settings.table_text_color,
                    header_text_color: settings.table_header_text_color,
                  },
                  fonts: {
                    family: settings.font_family,
                    size: settings.font_size,
                    header_size: settings.header_font_size,
                  },
                  content: {
                    show_employee_id: settings.show_employee_id,
                    show_position: settings.show_position,
                    show_breaks: settings.show_breaks,
                    show_total_hours: settings.show_total_hours,
                  },
                }}
                onChange={(config) => handleSave("pdf_layout", config)}
              />
            </TabsContent>

            <TabsContent value="groups" className="space-y-6">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Shift Types</h3>
                  <EmployeeSettingsEditor
                    groups={settings.shift_types}
                    onChange={(types) =>
                      handleSave("employee_groups", { shift_types: types })
                    }
                  />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Employee Types</h3>
                  <EmployeeSettingsEditor
                    groups={settings.employee_types}
                    onChange={(types) =>
                      handleSave("employee_groups", { employee_types: types })
                    }
                  />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Absence Types</h3>
                  <EmployeeSettingsEditor
                    groups={settings.absence_types}
                    onChange={(types) =>
                      handleSave("employee_groups", { absence_types: types })
                    }
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