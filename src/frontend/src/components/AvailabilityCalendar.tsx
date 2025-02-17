import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TimeSlot {
  day: number;
  start: string;
  end: string;
}

interface AvailabilityCalendarProps {
  availability: TimeSlot[];
  onChange: (availability: TimeSlot[]) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = [
  { label: 'Morning', value: 'morning', start: '06:00', end: '14:00' },
  { label: 'Afternoon', value: 'afternoon', start: '14:00', end: '22:00' },
  { label: 'Night', value: 'night', start: '22:00', end: '06:00' },
];

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  availability,
  onChange,
}) => {
  const isSlotSelected = (day: number, start: string, end: string) => {
    return availability.some(
      (slot) => slot.day === day && slot.start === start && slot.end === end
    );
  };

  const handleToggle = (day: number, start: string, end: string) => {
    const isSelected = isSlotSelected(day, start, end);
    let newAvailability: TimeSlot[];

    if (isSelected) {
      newAvailability = availability.filter(
        (slot) => !(slot.day === day && slot.start === start && slot.end === end)
      );
    } else {
      newAvailability = [...availability, { day, start, end }];
    }

    onChange(newAvailability);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Availability</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          {DAYS.map((dayLabel, dayIndex) => (
            <div key={dayLabel} className="space-y-2">
              <Label>{dayLabel}</Label>
              <ToggleGroup type="multiple" className="justify-start">
                {TIME_SLOTS.map((slot) => {
                  const selected = isSlotSelected(dayIndex, slot.start, slot.end);
                  return (
                    <ToggleGroupItem
                      key={slot.value}
                      value={`${dayIndex}-${slot.value}`}
                      aria-label={`${dayLabel} ${slot.label}`}
                      className={cn(
                        "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
                        selected && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => handleToggle(dayIndex, slot.start, slot.end)}
                    >
                      {slot.label}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}; 