import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
    dateRange: DateRange | undefined;
    setDateRange: (dateRange: DateRange | undefined) => void;
    className?: string;
    presets?: {
        label: string;
        dateRange: DateRange;
    }[];
}

export function DateRangePicker({
    dateRange,
    setDateRange,
    className,
    presets,
}: DateRangePickerProps) {
    const defaultPresets = [
        {
            label: "Today",
            dateRange: {
                from: new Date(),
                to: new Date(),
            },
        },
        {
            label: "Next 7 days",
            dateRange: {
                from: new Date(),
                to: addDays(new Date(), 6),
            },
        },
        {
            label: "Next 30 days",
            dateRange: {
                from: new Date(),
                to: addDays(new Date(), 29),
            },
        },
    ];

    const allPresets = presets || defaultPresets;

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                    {format(dateRange.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(dateRange.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date range</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <div className="flex">
                        <div className="border-r p-3 space-y-2">
                            {allPresets.map((preset) => (
                                <Button
                                    key={preset.label}
                                    variant="ghost"
                                    className="w-full justify-start font-normal"
                                    onClick={() => setDateRange(preset.dateRange)}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </div>
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                        />
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
} 