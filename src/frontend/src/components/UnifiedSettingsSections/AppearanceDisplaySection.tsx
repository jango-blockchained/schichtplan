import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker"; // Assuming ColorPicker is in ui
import type { Settings } from "@/types"; // Assuming Settings type is in @/types
import { useTheme } from "@/hooks/use-theme";

interface AppearanceDisplaySectionProps {
  settings: Settings["display"] | undefined;
  onDisplaySettingChange: (key: keyof Settings["display"], value: any) => void;
}

const AppearanceDisplaySection: React.FC<AppearanceDisplaySectionProps> = ({
  settings,
  onDisplaySettingChange,
}) => {
  const { setTheme } = useTheme();

  const handleThemeChange = (value: "light" | "dark" | "system") => {
    setTheme(value);
    onDisplaySettingChange("theme", value);
  };

  const handleColorChange = (
    key: "accent_color" | "primary_color",
    color: string,
  ) => {
    onDisplaySettingChange(key, color);
  };

  const handleCalendarSettingChange = (
    key: "calendar_start_day" | "calendar_default_view",
    value: string,
  ) => {
    onDisplaySettingChange(key, value);
  };

  if (!settings) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading display settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Theme & Colors</CardTitle>
          <CardDescription>Customize the application's appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="theme-select">Theme</Label>
              <Select
                value={settings.theme ?? "system"}
                onValueChange={handleThemeChange}
              >
                <SelectTrigger id="theme-select">
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
              <Label htmlFor="accent-color-picker">Accent Color</Label>
              <ColorPicker
                id="accent-color-picker"
                color={settings.accent_color ?? "#000000"}
                onChange={(newColor) =>
                  handleColorChange("accent_color", newColor)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="primary-color-picker">Primary Color</Label>
              <ColorPicker
                id="primary-color-picker"
                color={settings.primary_color ?? "#FFFFFF"}
                onChange={(newColor) =>
                  handleColorChange("primary_color", newColor)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendar Display</CardTitle>
          <CardDescription>Configure how the calendar is displayed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="calendar-start-day">Start Day of Week</Label>
              <Select
                value={settings.calendar_start_day ?? "monday"}
                onValueChange={(value) =>
                  handleCalendarSettingChange("calendar_start_day", value)
                }
              >
                <SelectTrigger id="calendar-start-day">
                  <SelectValue placeholder="Select start day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sunday">Sunday</SelectItem>
                  <SelectItem value="monday">Monday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-default-view">Default Calendar View</Label>
              <Select
                value={settings.calendar_default_view ?? "month"}
                onValueChange={(value) =>
                  handleCalendarSettingChange("calendar_default_view", value)
                }
              >
                <SelectTrigger id="calendar-default-view">
                  <SelectValue placeholder="Select default view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppearanceDisplaySection;
