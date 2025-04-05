import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DateTimePickerProps {
  date: Date;
  setDate: (date: Date) => void;
  className?: string;
  disabled?: boolean;
}

export function DateTimePicker({
  date,
  setDate,
  className,
  disabled,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    date,
  );

  // Update the date when time changes
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = e.target.value;
    const [hours, minutes] = timeValue.split(":").map(Number);

    if (!isNaN(hours) && !isNaN(minutes) && selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(hours);
      newDate.setMinutes(minutes);
      setDate(newDate);
      setSelectedDate(newDate);
    }
  };

  // Update both the selected date and the parent's date state
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const hours = selectedDate ? selectedDate.getHours() : 0;
      const minutes = selectedDate ? selectedDate.getMinutes() : 0;
      date.setHours(hours);
      date.setMinutes(minutes);
      setDate(date);
      setSelectedDate(date);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-2">
        <Input
          type="time"
          value={format(selectedDate || date, "HH:mm")}
          onChange={handleTimeChange}
          className="w-full"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
