import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings } from "@/types";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { DEFAULT_SETTINGS } from "@/hooks/useSettings";

interface ShiftFormProps {
  settings?: Settings | null;
  onSave: (data: {
    start_time: string;
    end_time: string;
    requires_break: boolean;
    active_days: { [key: string]: boolean };
  }) => void;
  initialData?: {
    start_time?: string;
    end_time?: string;
    requires_break?: boolean;
    active_days?: { [key: string]: boolean };
  };
}

const ALL_DAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

export const ShiftForm: React.FC<ShiftFormProps> = ({
  settings,
  onSave,
  initialData,
}) => {
  const generalSettings = settings?.general || DEFAULT_SETTINGS.general;

  const [formData, setFormData] = useState({
    start_time: initialData?.start_time || generalSettings.store_opening,
    end_time: initialData?.end_time || generalSettings.store_closing,
    requires_break: initialData?.requires_break ?? true,
    active_days: initialData?.active_days || generalSettings.opening_days,
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  // Convert time string to minutes for calculations
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Calculate shift duration in hours
  const calculateDuration = (): number => {
    const startMinutes = timeToMinutes(formData.start_time);
    const endMinutes = timeToMinutes(formData.end_time);
    let duration = endMinutes - startMinutes;
    if (duration < 0) duration += 24 * 60; // Handle overnight shifts
    return duration / 60;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Öffnungszeiten</Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Beginn</Label>
              <DateTimePicker
                date={timeStringToDate(formData.start_time)}
                setDate={(date) =>
                  setFormData({
                    ...formData,
                    start_time: dateToTimeString(date),
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="end_time">Ende</Label>
              <DateTimePicker
                date={timeStringToDate(formData.end_time)}
                setDate={(date) =>
                  setFormData({ ...formData, end_time: dateToTimeString(date) })
                }
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Aktive Tage</Label>
          <Table>
            <TableHeader>
              <TableRow>
                {ALL_DAYS.map((day) => (
                  <TableHead key={day} className="text-center">
                    {day}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                {ALL_DAYS.map((_, index) => (
                  <TableCell key={index} className="text-center">
                    <Switch
                      checked={formData.active_days[index.toString()]}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          active_days: {
                            ...formData.active_days,
                            [index.toString()]: checked,
                          },
                        })
                      }
                    />
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-2">
          <Label>Schicht Visualisierung</Label>
          <Card className="p-6">
            <div className="relative h-12 bg-muted rounded-md">
              {/* Store hours background */}
              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs text-muted-foreground">
                <span>{generalSettings.store_opening}</span>
                <span>{generalSettings.store_closing}</span>
              </div>

              {/* Shift visualization */}
              <div
                className="absolute h-8 top-2 bg-primary/20 border border-primary rounded"
                style={{
                  left: `${((timeToMinutes(formData.start_time) - timeToMinutes(generalSettings.store_opening)) / (timeToMinutes(generalSettings.store_closing) - timeToMinutes(generalSettings.store_opening))) * 100}%`,
                  width: `${((timeToMinutes(formData.end_time) - timeToMinutes(formData.start_time)) / (timeToMinutes(generalSettings.store_closing) - timeToMinutes(generalSettings.store_opening))) * 100}%`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-xs">
                  {calculateDuration().toFixed(1)}h
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="requires_break"
            checked={formData.requires_break}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, requires_break: checked })
            }
          />
          <Label htmlFor="requires_break">Pause erforderlich</Label>
        </div>
      </div>

      <Button type="submit" className="w-full">
        Speichern
      </Button>
    </form>
  );
};
