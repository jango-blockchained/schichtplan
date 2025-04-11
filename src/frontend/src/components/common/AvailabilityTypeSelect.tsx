import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/services/api";
import type { Settings } from "@/types/index";
import { cn } from "@/lib/utils";

interface AvailabilityType {
  id: string;
  name: string;
  description: string;
  color: string;
  priority: number;
  is_available: boolean;
}

interface AvailabilityTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  showUnavailable?: boolean;
}

export function AvailabilityTypeSelect({
  value,
  onChange,
  showUnavailable = true,
}: AvailabilityTypeSelectProps) {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Filter out UNAVAILABLE type unless showUnavailable is true
  const availabilityTypes = (settings?.availability_types || [])
    .filter((type: AvailabilityType) => showUnavailable || type.is_available)
    .sort(
      (a: AvailabilityType, b: AvailabilityType) => a.priority - b.priority,
    );

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: availabilityTypes.find(
                  (type) => type.id === value,
                )?.color,
              }}
            />
            <span>
              {availabilityTypes.find((type) => type.id === value)?.name ||
                "Select type"}
            </span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availabilityTypes.map((type: AvailabilityType) => (
          <SelectItem
            key={type.id}
            value={type.id}
            className={cn(
              "flex items-center gap-2",
              type.id === value && "bg-secondary",
            )}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: type.color }}
            />
            <span>{type.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {type.description}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
