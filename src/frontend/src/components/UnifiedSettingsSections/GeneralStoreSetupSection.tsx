import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/types";
import React from "react";

// Props that will be passed from UnifiedSettingsPage.tsx
interface GeneralStoreSetupSectionProps {
  settings: Settings["general"];
  onInputChange: (key: string, value: string | number | boolean, isNumeric?: boolean) => void;
  onOpeningDaysChange: (dayIndex: number, checked: boolean) => void;
}

export const GeneralStoreSetupSection: React.FC<GeneralStoreSetupSectionProps> = ({
  settings,
  onInputChange,
  onOpeningDaysChange,
}) => {
  // Special days handling moved to Holiday Management subpage.

  return (
    <div className="space-y-6">
      {/* Store Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
          <CardDescription>Basic information about your store</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store Name</Label>
              <Input
                id="storeName"
                placeholder="Enter store name"
                value={settings.store_name || ""}
                onChange={(e) => onInputChange("store_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeAddress">Store Address</Label>
              <Input
                id="storeAddress"
                placeholder="Enter store address"
                value={settings.store_address || ""}
                onChange={(e) => onInputChange("store_address", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storePhone">Store Phone</Label>
              <Input
                id="storePhone"
                type="tel"
                placeholder="e.g., +49 123 456789"
                value={settings.store_phone || ""}
                onChange={(e) => onInputChange("store_phone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeEmail">Store Email</Label>
              <Input
                id="storeEmail"
                type="email"
                placeholder="store@example.com"
                value={settings.store_email || ""}
                onChange={(e) => onInputChange("store_email", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opening Days Card */}
      <Card>
        <CardHeader>
          <CardTitle>Opening Days</CardTitle>
          <CardDescription>Choose which days your store is open</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Opening Days</Label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
                <div key={day} className="flex flex-col items-center space-y-1">
                  <Label
                    htmlFor={`opening-day-${day}`}
                    className="text-sm font-normal"
                  >
                    {day}
                  </Label>
                  <Switch
                    id={`opening-day-${day}`}
                    checked={
                      (settings.opening_days || {})[
                      ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][index]
                      ] || false
                    }
                    onCheckedChange={(checked) => onOpeningDaysChange(index, checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Opening and Closing Times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="storeOpening">Store Opening Time</Label>
              <Input
                id="storeOpening"
                type="time"
                value={settings.store_opening || ""}
                onChange={(e) => onInputChange("store_opening", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeClosing">Store Closing Time</Label>
              <Input
                id="storeClosing"
                type="time"
                value={settings.store_closing || ""}
                onChange={(e) => onInputChange("store_closing", e.target.value)}
              />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Keyholder settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="keyholder-before">Keyholder Before Opening (minutes)</Label>
              <Input
                id="keyholder-before"
                type="number"
                min="0"
                max="120"
                step="5"
                value={settings.keyholder_before_minutes ?? 30}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onInputChange("keyholder_before_minutes", e.target.value, true)
                }
              />
              <p className="text-xs text-muted-foreground">
                How many minutes before opening should keyholders arrive
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyholder-after">Keyholder After Closing (minutes)</Label>
              <Input
                id="keyholder-after"
                type="number"
                min="0"
                max="120"
                step="5"
                value={settings.keyholder_after_minutes ?? 30}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onInputChange("keyholder_after_minutes", e.target.value, true)
                }
              />
              <p className="text-xs text-muted-foreground">
                How many minutes after closing should keyholders stay
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Special Days moved to Holiday Management subpage */}
    </div>
  );
};
