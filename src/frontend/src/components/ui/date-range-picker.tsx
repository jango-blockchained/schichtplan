import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getSettings } from "@/services/api";
import { getWeekStartsOn } from "@/utils/weekStart";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  endOfWeek,
  format,
  isBefore,
  startOfToday,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";
import { DateRange } from "react-day-picker";

export interface DateRangePickerProps {
  className?: string;
  dateRange?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  fromDate?: Date;
  onStartDateSelect?: (date: Date) => void;
}

export function DateRangePicker({
  className,
  dateRange,
  onChange,
  fromDate = startOfToday(),
  onStartDateSelect,
}: DateRangePickerProps) {
  const today = startOfToday();
  const [isOpen, setIsOpen] = React.useState(false);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 300_000,
  });
  const weekStartsOn = getWeekStartsOn(settings);

  const defaultPresets = [
    {
      label: "Diese Woche",
      dateRange: {
        from: startOfWeek(today, { weekStartsOn }),
        to: endOfWeek(today, { weekStartsOn }),
      },
    },
    {
      label: "Nächste Woche",
      dateRange: {
        from: startOfWeek(addDays(today, 7), { weekStartsOn }),
        to: endOfWeek(addDays(today, 7), { weekStartsOn }),
      },
    },
    {
      label: "Nächste 2 Wochen",
      dateRange: {
        from: today,
        to: addDays(today, 13),
      },
    },
    {
      label: "Nächste 4 Wochen",
      dateRange: {
        from: today,
        to: addDays(today, 27),
      },
    },
  ];

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "dd.MM.yyyy")} -{" "}
                  {format(dateRange.to, "dd.MM.yyyy")}
                </>
              ) : (
                format(dateRange.from, "dd.MM.yyyy")
              )
            ) : (
              <span>Zeitraum auswählen</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="border-r p-3 space-y-2">
              {defaultPresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  className="w-full justify-start font-normal"
                  onClick={() => {
                    onChange(preset.dateRange);
                    setIsOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from || fromDate}
              selected={dateRange}
              onSelect={(range) => {
                if (range?.from && !range.to && onStartDateSelect) {
                  onStartDateSelect(range.from);
                } else {
                  onChange(range);
                }
              }}
              numberOfMonths={2}
              disabled={(date) => isBefore(date, fromDate)}
              locale={de}
              weekStartsOn={weekStartsOn}
              showOutsideDays={true}
              fixedWeeks={true}
              formatters={{
                formatCaption: (date, options) =>
                  format(date, "MMMM yyyy", { locale: options?.locale }),
              }}
              ISOWeek
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
