import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shift } from "@/services/api";
import { Settings } from "@/types";
import { Trash } from "lucide-react";
import React, { useEffect, useState } from "react";

interface ShiftFormProps {
  settings?: Settings;
  shift?: Shift;
  onSave: (data: {
    start_time: string;
    end_time: string;
    requires_break: boolean;
    active_days: { [key: string]: boolean };
    shift_type_id?: string;
  }) => void;
  onDelete?: () => void;
}

// IMPORTANT: This application uses the Python convention for days of the week:
// - Monday = 0
// - Tuesday = 1
// - ...
// - Sunday = 6
// This is different from JavaScript's Date where Sunday = 0
// The backend model (ShiftTemplate) also uses this convention
const ALL_DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
]; // Mon=0, Sun=6

// Helper function to convert active_days from various formats to object {[key: string]: boolean} with Mon=0 index
const normalizeActiveDays = (activeDays: unknown): { [key: string]: boolean } => {
  const result: { [key: string]: boolean } = {};
  // Initialize all days to false (Mon=0 to Sun=6)
  for (let i = 0; i < 7; i++) {
    result[i.toString()] = false;
  }

  if (Array.isArray(activeDays)) {
    // Assume array contains numbers representing days (Mon=0 convention)
    activeDays.forEach((dayNum) => {
      if (typeof dayNum === "number" && dayNum >= 0 && dayNum < 7) {
        result[dayNum.toString()] = true;
      }
    });
  } else if (typeof activeDays === "object" && activeDays !== null) {
    // We always use the Python/Backend convention (Mon=0) internally
    for (const key in activeDays) {
      const dayIndex = parseInt(key, 10);
      if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex < 7) {
        result[dayIndex.toString()] = !!activeDays[key];
      }
    }
  }
  return result;
};

export const ShiftForm: React.FC<ShiftFormProps> = ({
  settings,
  shift,
  onSave,
  onDelete,
}) => {
  // Default opening days using Mon=0 convention
  const defaultOpeningDaysMonZero = {
    "0": true,
    "1": true,
    "2": true,
    "3": true,
    "4": true,
    "5": true,
    "6": false, // Mon-Sat open, Sun closed
  };

  const defaultSettings = settings || {
    general: {
      store_opening: "08:00",
      store_closing: "20:00",
      // Use normalized Mon=0 opening days from settings if available, otherwise use default
      opening_days:
        normalizeActiveDays(settings?.general.opening_days) ||
        defaultOpeningDaysMonZero,
    },
    shift_types: [
      { id: "EARLY", name: "Frühschicht", color: "#4CAF50", type: "shift" },
      { id: "MIDDLE", name: "Mittelschicht", color: "#2196F3", type: "shift" },
      { id: "LATE", name: "Spätschicht", color: "#9C27B0", type: "shift" },
    ],
  };

  const [formData, setFormData] = useState({
    start_time: shift?.start_time || defaultSettings.general.store_opening,
    end_time: shift?.end_time || defaultSettings.general.store_closing,
    requires_break: shift?.requires_break ?? true,
    // Initialize active_days: Use normalized shift.active_days, or normalized settings.opening_days, or default Mon=0
    active_days:
      normalizeActiveDays(shift?.active_days) ||
      defaultSettings.general.opening_days, // opening_days is already normalized in defaultSettings
    shift_type_id: shift?.shift_type_id || "EARLY",
  });

  useEffect(() => {
    if (shift) {
      setFormData({
        start_time: shift.start_time,
        end_time: shift.end_time,
        requires_break: shift.requires_break,
        active_days: normalizeActiveDays(shift.active_days),
        shift_type_id: shift.shift_type_id || "EARLY",
      });
    }
  }, [shift]);

  // Check if employee inputs should be disabled based on settings
  const isEmployeeInputsDisabled =
    settings?.scheduling.scheduling_resource_type === "coverage";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      start_time: formData.start_time,
      end_time: formData.end_time,
      requires_break: formData.requires_break,
      active_days: formData.active_days,
      shift_type_id: formData.shift_type_id,
    });
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

  // Get shift types from settings
  const shiftTypes = (settings as any)?.shift_types ||
    (defaultSettings as any).shift_types || [
      { id: "EARLY", name: "Frühschicht", color: "#4CAF50", type: "shift" },
      { id: "MIDDLE", name: "Mittelschicht", color: "#2196F3", type: "shift" },
      { id: "LATE", name: "Spätschicht", color: "#9C27B0", type: "shift" },
    ];

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {shift ? `Schicht ${shift.id}` : "Neue Schicht"}
          </h3>
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              type="button"
              onClick={onDelete}
            >
              <Trash className="h-4 w-4 mr-1" /> Löschen
            </Button>
          )}
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Öffnungszeiten</Label>
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <Label htmlFor="start_time">Beginn</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  required
                  className="h-10"
                />
              </div>
              <div>
                <Label htmlFor="end_time">Ende</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                  required
                  className="h-10"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shift_type_id">Schichttyp</Label>
            <Select
              value={formData.shift_type_id}
              onValueChange={(value) =>
                setFormData({ ...formData, shift_type_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Schichttyp auswählen" />
              </SelectTrigger>
              <SelectContent>
                {shiftTypes
                  .filter((type) => !type.autoAssignOnly) // Filter out autoAssignOnly shift types
                  .map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center">
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: type.color }}
                        ></div>
                        {type.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Aktive Tage</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  {ALL_DAYS.map((day) => (
                    <TableHead key={day} className="text-center">
                      {day.substring(0, 2)}
                    </TableHead> // Use Mon=0 ALL_DAYS
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {ALL_DAYS.map(
                    (
                      _,
                      index, // index is Mon=0
                    ) => (
                      <TableCell key={index} className="text-center p-1">
                        <Switch
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-muted-foreground"
                          checked={!!formData.active_days[index.toString()]} // Access using Mon=0 index
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              active_days: {
                                ...formData.active_days,
                                [index.toString()]: checked, // Set using Mon=0 index
                              },
                            })
                          }
                        />
                      </TableCell>
                    ),
                  )}
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-2">
            <Label>Schicht Visualisierung</Label>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-2 flex justify-between">
                <span>{defaultSettings.general.store_opening}</span>
                <span>{defaultSettings.general.store_closing}</span>
              </div>
              <div className="relative h-10 bg-muted rounded-md">
                <div className="absolute inset-1 rounded-md bg-muted/60" />
                <div
                  className="absolute h-8 top-1 left-1 flex items-center justify-center text-xs rounded-md bg-gradient-to-r from-primary/30 to-primary/10 border border-primary/30 px-2"
                  style={{
                    transform: `translateX(${((timeToMinutes(formData.start_time) - timeToMinutes(defaultSettings.general.store_opening)) / (timeToMinutes(defaultSettings.general.store_closing) - timeToMinutes(defaultSettings.general.store_opening))) * 100}%)`,
                    width: `${((timeToMinutes(formData.end_time) - timeToMinutes(formData.start_time)) / (timeToMinutes(defaultSettings.general.store_closing) - timeToMinutes(defaultSettings.general.store_opening))) * 100}%`,
                  }}
                >
                  <span className="text-xs font-medium">
                    {calculateDuration().toFixed(1)} h
                  </span>
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
    </Card>
  );
};
