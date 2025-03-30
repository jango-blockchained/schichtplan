import React, { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';

interface DateRangePickerProps {
    value: DateRange | undefined;
    onChange: (range: DateRange | undefined) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
}

export const DateRangePicker = ({
    value,
    onChange,
    className,
    placeholder = "Datumsbereich auswählen",
    disabled = false
}: DateRangePickerProps) => {
    const [isOpen, setIsOpen] = useState(false);

    // Format date range for display
    const formattedDateRange = React.useMemo(() => {
        if (!value?.from) return placeholder;
        if (!value.to) return `Ab ${format(value.from, 'PPP', { locale: de })}`;
        return `${format(value.from, 'dd.MM.yyyy', { locale: de })} - ${format(value.to, 'dd.MM.yyyy', { locale: de })}`;
    }, [value, placeholder]);

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={isOpen && !disabled} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            "justify-start text-left font-normal",
                            !value && "text-muted-foreground"
                        )}
                        disabled={disabled}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formattedDateRange}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={value?.from}
                        selected={value}
                        onSelect={onChange}
                        numberOfMonths={2}
                        locale={de}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}; 