import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BlockEditorProps } from "../types";
import {
  snapToQuarterHour,
  timeToMinutes,
  normalizeTime,
  isValidTimeFormat,
} from "../utils/time";

export const BlockEditor: React.FC<BlockEditorProps> = ({
  slot,
  onSave,
  onCancel,
  storeConfig,
}) => {
  const [startTime, setStartTime] = useState(normalizeTime(slot.startTime));
  const [endTime, setEndTime] = useState(normalizeTime(slot.endTime));
  const [minEmployees, setMinEmployees] = useState(slot.minEmployees);
  const [maxEmployees, setMaxEmployees] = useState(slot.maxEmployees);
  const [employeeTypes, setEmployeeTypes] = useState(slot.employeeTypes);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate keyholder requirements based on store settings
  const isEarlyShift = startTime === storeConfig.store_opening;
  const isLateShift = endTime === storeConfig.store_closing;
  const requiresKeyholder = isEarlyShift || isLateShift;
  const keyholderBeforeMinutes = isEarlyShift
    ? storeConfig.keyholder_before_minutes
    : 0;
  const keyholderAfterMinutes = isLateShift
    ? storeConfig.keyholder_after_minutes
    : 0;

  const validateTime = (time: string): boolean => {
    if (!isValidTimeFormat(time)) {
      return false;
    }
    return true;
  };

  const handleTimeChange = (type: "start" | "end", value: string) => {
    // First validate the time format
    if (!validateTime(value)) {
      setErrors({
        ...errors,
        time: "Invalid time format. Use HH:MM (24-hour format)",
      });
      return;
    }

    const newErrors = { ...errors };
    delete newErrors.time;

    const storeOpeningMinutes = timeToMinutes(storeConfig.store_opening);
    const storeClosingMinutes = timeToMinutes(storeConfig.store_closing);
    const startMinutes = timeToMinutes(type === "start" ? value : startTime);
    const endMinutes = timeToMinutes(type === "end" ? value : endTime);

    // Validate times are within store hours
    if (
      startMinutes < storeOpeningMinutes ||
      endMinutes > storeClosingMinutes
    ) {
      newErrors.time = "Time slot must be within store hours";
    }

    // Validate end time is after start time
    if (endMinutes <= startMinutes) {
      newErrors.time = "End time must be after start time";
    }

    // Validate minimum duration (15 minutes)
    if (endMinutes - startMinutes < 15) {
      newErrors.time = "Time slot must be at least 15 minutes";
    }

    setErrors(newErrors);

    // Snap the time to quarter hours
    const snappedValue = snapToQuarterHour(value);

    if (type === "start") {
      setStartTime(snappedValue);
    } else {
      setEndTime(snappedValue);
    }
  };

  const handleEmployeeCountChange = (type: "min" | "max", value: number) => {
    const newErrors = { ...errors };
    delete newErrors.employees;

    if (type === "min") {
      if (value > maxEmployees) {
        newErrors.employees = "Minimum employees cannot exceed maximum";
      }
      setMinEmployees(value);
    } else {
      if (value < minEmployees) {
        newErrors.employees = "Maximum employees cannot be less than minimum";
      }
      setMaxEmployees(value);
    }

    setErrors(newErrors);
  };

  const handleSave = () => {
    if (Object.keys(errors).length > 0) return;

    onSave({
      startTime: normalizeTime(startTime),
      endTime: normalizeTime(endTime),
      minEmployees,
      maxEmployees,
      employeeTypes,
      requiresKeyholder,
      keyholderBeforeMinutes,
      keyholderAfterMinutes,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">Start Time</Label>
          <Input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => handleTimeChange("start", e.target.value)}
            className={cn(errors.time && "border-red-500")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">End Time</Label>
          <Input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => handleTimeChange("end", e.target.value)}
            className={cn(errors.time && "border-red-500")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minEmployees">Minimum Employees</Label>
          <Input
            id="minEmployees"
            type="number"
            min={1}
            value={minEmployees}
            onChange={(e) =>
              handleEmployeeCountChange("min", parseInt(e.target.value))
            }
            className={cn(errors.employees && "border-red-500")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxEmployees">Maximum Employees</Label>
          <Input
            id="maxEmployees"
            type="number"
            min={1}
            value={maxEmployees}
            onChange={(e) =>
              handleEmployeeCountChange("max", parseInt(e.target.value))
            }
            className={cn(errors.employees && "border-red-500")}
          />
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="text-red-500 text-sm">
          {Object.values(errors).map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={Object.keys(errors).length > 0}>
          Save
        </Button>
      </div>
    </div>
  );
};
