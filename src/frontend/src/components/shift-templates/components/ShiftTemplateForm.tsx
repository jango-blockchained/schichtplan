import React, { useState, useEffect, useMemo } from "react";
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
import { Shift } from "@/services/api";
import { Trash, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftTemplateFormProps } from "../types";

interface ShiftFormProps {
  settings?: Settings;
  shift?: Shift;
  onSave: (data: {
    start_time: string;
    end_time: string;
    requires_break: boolean;
    active_days: { [key: string]: boolean };
    shift_type_id?: string;
    duration_hours: number;
  }) => void;
  onDelete?: () => void;
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

// Helper function to convert active_days from array to object if needed
const normalizeActiveDays = (activeDays: any): { [key: string]: boolean } => {
  if (Array.isArray(activeDays)) {
    // Convert from number[] to {[key: string]: boolean}
    const result: { [key: string]: boolean } = {};
    for (let i = 0; i < 7; i++) {
      result[i.toString()] = activeDays.includes(i);
    }
    return result;
  }
  return activeDays || {};
};

/**
 * Form component for editing shift templates
 */
export const ShiftTemplateForm = ({
  shift,
  settings,
  onSave,
  onDelete,
}: ShiftTemplateFormProps & { onDelete?: () => void }) => {
  // Default shift types to use when none are provided in settings
  const DEFAULT_SHIFT_TYPES = [
    { id: "EARLY", name: "Frühschicht", color: "#4CAF50", type: "shift" },
    { id: "MIDDLE", name: "Mittelschicht", color: "#2196F3", type: "shift" },
    { id: "LATE", name: "Spätschicht", color: "#9C27B0", type: "shift" },
  ];
  
  const defaultSettings = settings || {
    store_opening: "08:00",
    store_closing: "20:00",
    opening_days: {
      "1": true,
      "2": true,
      "3": true,
      "4": true,
      "5": true,
      "0": false,
      "6": false,
    },
    shift_types: DEFAULT_SHIFT_TYPES,
    start_of_week: 1, // Default to Monday
  };

  const [formData, setFormData] = useState({
    start_time: shift?.start_time || defaultSettings.store_opening,
    end_time: shift?.end_time || defaultSettings.store_closing,
    requires_break: shift?.requires_break ?? true,
    active_days:
      normalizeActiveDays(shift?.active_days) ||
      normalizeActiveDays(defaultSettings.opening_days),
    shift_type_id: shift?.shift_type_id || (defaultSettings.shift_types?.[0]?.id || "EARLY"),
  });

  // Time validation states
  const [validationErrors, setValidationErrors] = useState({
    start_time: "",
    end_time: "",
  });

  useEffect(() => {
    if (shift) {
      setFormData({
        start_time: shift.start_time,
        end_time: shift.end_time,
        requires_break: shift.requires_break,
        active_days: normalizeActiveDays(shift.active_days),
        shift_type_id: shift.shift_type_id || (defaultSettings.shift_types?.[0]?.id || "EARLY"),
      });
    }
  }, [shift, defaultSettings.shift_types]);

  // Check if employee inputs should be disabled based on settings
  const isEmployeeInputsDisabled =
    settings?.scheduling_resource_type === "coverage";

  // Convert time string to minutes for calculations
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Validate time is within store hours
  const validateTime = (field: 'start_time' | 'end_time', value: string) => {
    const timeInMinutes = timeToMinutes(value);
    const storeOpeningMinutes = timeToMinutes(defaultSettings.store_opening);
    const storeClosingMinutes = timeToMinutes(defaultSettings.store_closing);
    
    // Handle overnight store hours (e.g., 22:00 - 06:00)
    const isOvernightStore = storeOpeningMinutes >= storeClosingMinutes;
    
    let isValid = false;
    if (isOvernightStore) {
      isValid = timeInMinutes >= storeOpeningMinutes || timeInMinutes <= storeClosingMinutes;
    } else {
      isValid = timeInMinutes >= storeOpeningMinutes && timeInMinutes <= storeClosingMinutes;
    }
    
    setValidationErrors(prev => ({
      ...prev,
      [field]: isValid ? "" : `Zeit muss zwischen ${defaultSettings.store_opening} und ${defaultSettings.store_closing} liegen`
    }));
    
    return isValid;
  };

  // Validate times when they change
  useEffect(() => {
    validateTime('start_time', formData.start_time);
    validateTime('end_time', formData.end_time);
  }, [formData.start_time, formData.end_time, defaultSettings.store_opening, defaultSettings.store_closing]);

  // Calculate shift duration in hours
  const calculateDuration = (): number => {
    const startMinutes = timeToMinutes(formData.start_time);
    const endMinutes = timeToMinutes(formData.end_time);
    let duration = endMinutes - startMinutes;
    if (duration < 0) duration += 24 * 60; // Handle overnight shifts
    return duration / 60;
  };

  // Determine if break is required and break duration based on shift length
  const shiftDuration = calculateDuration();
  const isBreakRequired = shiftDuration > 6;
  const breakDuration = shiftDuration > 8 ? 60 : (shiftDuration > 6 ? 30 : 0);

  // Update requires_break when shift duration changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      requires_break: isBreakRequired
    }));
  }, [isBreakRequired]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate times before submission
    const startTimeValid = validateTime('start_time', formData.start_time);
    const endTimeValid = validateTime('end_time', formData.end_time);
    
    // Only proceed if validation passes
    if (startTimeValid && endTimeValid) {
      // Format times to ensure they're in HH:MM format without seconds
      const formatTimeString = (time: string): string => {
        if (!time) return "";
        // If it contains seconds (HH:MM:SS), strip them
        if (time.split(':').length > 2) {
          const parts = time.split(':');
          return `${parts[0]}:${parts[1]}`;
        }
        return time;
      };
      
      // Ensure shift_type_id is uppercase
      const normalizedShiftTypeId = formData.shift_type_id.toUpperCase();
      
      // Find the shift type name from settings
      const shiftTypeObj = settings?.shift_types?.find(type => type.id === normalizedShiftTypeId);
      
      // Create the data to save - don't include shift_type field
      const saveData = {
        ...shift, // Keep existing properties like id
        start_time: formatTimeString(formData.start_time),
        end_time: formatTimeString(formData.end_time),
        requires_break: isBreakRequired, // Always use calculated value
        active_days: formData.active_days,
        shift_type_id: normalizedShiftTypeId,
        type: normalizedShiftTypeId.toLowerCase(), // Add type field as lowercase shift_type_id
        name: shiftTypeObj?.name || `Shift ${shift?.id || "Template"}`, // Add name from shift type
        duration_hours: shiftDuration, // Include calculated duration
        break_duration: isBreakRequired ? (shiftDuration > 8 ? 60 : 30) : undefined // Add break duration
      };
      
      // Log what we're saving to help with debugging
      console.log("Saving shift template with data:", saveData);
      
      onSave(saveData);
    }
  };

  // Get shift types from settings
  const shiftTypes = settings?.shift_types || defaultSettings.shift_types || [];

  // Order days based on start_of_week setting
  const orderedDays = useMemo(() => {
    const startOfWeek = settings?.start_of_week ?? defaultSettings.start_of_week ?? 1; // Default to Monday
    const days = [...ALL_DAYS];
    return [...days.slice(startOfWeek), ...days.slice(0, startOfWeek)];
  }, [settings?.start_of_week, defaultSettings.start_of_week]);

  // Create an array of day indices in the correct order
  const orderedDayIndices = useMemo(() => {
    const startOfWeek = settings?.start_of_week ?? defaultSettings.start_of_week ?? 1; // Default to Monday
    const indices = [0, 1, 2, 3, 4, 5, 6];
    return [...indices.slice(startOfWeek), ...indices.slice(0, startOfWeek)];
  }, [settings?.start_of_week, defaultSettings.start_of_week]);

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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="start_time">Beginn</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setFormData({ ...formData, start_time: newValue });
                    validateTime('start_time', newValue);
                  }}
                  required
                  className={validationErrors.start_time ? "border-red-500" : ""}
                />
                {validationErrors.start_time && (
                  <div className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.start_time}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="end_time">Ende</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setFormData({ ...formData, end_time: newValue });
                    validateTime('end_time', newValue);
                  }}
                  required
                  className={validationErrors.end_time ? "border-red-500" : ""}
                />
                {validationErrors.end_time && (
                  <div className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.end_time}
                  </div>
                )}
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
                {shiftTypes.map((type) => (
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
                  {orderedDays.map((day) => (
                    <TableHead key={day} className="text-center">
                      {day}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {orderedDayIndices.map((dayIndex) => (
                    <TableCell key={dayIndex} className="text-center">
                      <Switch
                        checked={!!formData.active_days[dayIndex.toString()]}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            active_days: {
                              ...formData.active_days,
                              [dayIndex.toString()]: checked,
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
                  <span>{defaultSettings.store_opening}</span>
                  <span>{defaultSettings.store_closing}</span>
                </div>

                {/* Shift visualization */}
                <div
                  className="absolute h-8 top-2 bg-primary/20 border border-primary rounded"
                  style={{
                    left: `${((timeToMinutes(formData.start_time) - timeToMinutes(defaultSettings.store_opening)) / (timeToMinutes(defaultSettings.store_closing) - timeToMinutes(defaultSettings.store_opening))) * 100}%`,
                    width: `${((timeToMinutes(formData.end_time) - timeToMinutes(formData.start_time)) / (timeToMinutes(defaultSettings.store_closing) - timeToMinutes(defaultSettings.store_opening))) * 100}%`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-xs">
                    {shiftDuration.toFixed(1)}h
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="requires_break"
                checked={isBreakRequired}
                onCheckedChange={() => {}} // No change handler - break is auto-calculated
                disabled={true} // Always disabled - automatic based on duration
              />
              <Label htmlFor="requires_break" className={isBreakRequired ? "" : "text-muted-foreground"}>
                Pause erforderlich
              </Label>
            </div>
            {isBreakRequired && (
              <div className="text-sm text-muted-foreground ml-7">
                Automatisch berechnet: {breakDuration} Minuten Pause 
                {breakDuration === 30 ? " (>6h)" : " (>8h)"}
              </div>
            )}
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full"
          disabled={!!validationErrors.start_time || !!validationErrors.end_time}
        >
          Speichern
        </Button>
      </form>
    </Card>
  );
};
