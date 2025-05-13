import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface TimePickerProps {
    value: string; // HH:MM format
    onChange: (time: string) => void;
    disabled?: boolean;
    className?: string;
}

export function TimePicker({ value, onChange, disabled, className }: TimePickerProps) {
    const [open, setOpen] = React.useState(false);
    
    // Parse current value
    const [hours, minutes] = value?.split(':').map(Number) || [0, 0];
    
    // Generate hours and minutes options
    const hoursOptions = Array.from({ length: 24 }, (_, i) => i);
    const minutesOptions = Array.from({ length: 12 }, (_, i) => i * 5); // 5-minute intervals
    
    // Handle time input change
    const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const timeValue = e.target.value;
        if (timeValue) {
            // The input type="time" returns in HH:MM format
            onChange(timeValue);
        }
    };
    
    // Handle selection from the popover
    const handleHourSelect = (hour: number) => {
        const newValue = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        onChange(newValue);
    };
    
    const handleMinuteSelect = (minute: number) => {
        const newValue = `${hours.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        onChange(newValue);
    };
    
    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !value && "text-muted-foreground"
                        )}
                        disabled={disabled}
                    >
                        <Clock className="mr-2 h-4 w-4" />
                        {value || "Select time..."}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <div className="flex p-2">
                        <div className="flex flex-col">
                            <div className="text-center py-1 font-medium">Hour</div>
                            <ScrollArea className="h-[200px] w-[60px]">
                                {hoursOptions.map((hour) => (
                                    <div
                                        key={hour}
                                        className={cn(
                                            "cursor-pointer p-2 text-center hover:bg-accent hover:text-accent-foreground rounded-md mx-1",
                                            hour === hours && "bg-accent text-accent-foreground"
                                        )}
                                        onClick={() => handleHourSelect(hour)}
                                    >
                                        {hour.toString().padStart(2, '0')}
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                        <div className="flex items-center justify-center font-bold py-8">:</div>
                        <div className="flex flex-col">
                            <div className="text-center py-1 font-medium">Minute</div>
                            <ScrollArea className="h-[200px] w-[60px]">
                                {minutesOptions.map((minute) => (
                                    <div
                                        key={minute}
                                        className={cn(
                                            "cursor-pointer p-2 text-center hover:bg-accent hover:text-accent-foreground rounded-md mx-1",
                                            minute === minutes && "bg-accent text-accent-foreground"
                                        )}
                                        onClick={() => handleMinuteSelect(minute)}
                                    >
                                        {minute.toString().padStart(2, '0')}
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
            <Input
                type="time"
                value={value || ""}
                onChange={handleTimeInputChange}
                disabled={disabled}
            />
        </div>
    );
}