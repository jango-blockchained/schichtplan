import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimePickerProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
}

export const TimePicker = ({
    value,
    onChange,
    disabled = false,
    className
}: TimePickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [hours, setHours] = useState('00');
    const [minutes, setMinutes] = useState('00');
    const hourInputRef = useRef<HTMLInputElement>(null);
    const minuteInputRef = useRef<HTMLInputElement>(null);

    // Initialize from value prop
    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':');
            setHours(h.padStart(2, '0'));
            setMinutes(m.padStart(2, '0'));
        }
    }, [value]);

    // Format hours with leading zero
    const formatHours = (val: string) => {
        let numVal = parseInt(val || '0', 10);
        if (isNaN(numVal)) numVal = 0;
        if (numVal > 23) numVal = 23;
        if (numVal < 0) numVal = 0;
        return numVal.toString().padStart(2, '0');
    };

    // Format minutes with leading zero
    const formatMinutes = (val: string) => {
        let numVal = parseInt(val || '0', 10);
        if (isNaN(numVal)) numVal = 0;
        if (numVal > 59) numVal = 59;
        if (numVal < 0) numVal = 0;
        return numVal.toString().padStart(2, '0');
    };

    // Handle hour input change
    const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '');
        const formatted = formatHours(val);
        setHours(formatted);
        
        // Move to minutes input if 2 digits entered
        if (val.length >= 2 && minuteInputRef.current) {
            minuteInputRef.current.focus();
        }
    };

    // Handle minute input change
    const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '');
        const formatted = formatMinutes(val);
        setMinutes(formatted);
    };

    // Handle time selection
    const handleSelect = () => {
        const formattedTime = `${hours}:${minutes}`;
        onChange(formattedTime);
        setIsOpen(false);
    };

    // Quick time selection buttons
    const timePresets = [
        { label: 'Morgens', times: ['07:00', '08:00', '09:00', '10:00'] },
        { label: 'Mittag', times: ['11:00', '12:00', '13:00', '14:00'] },
        { label: 'Nachmittag', times: ['15:00', '16:00', '17:00', '18:00'] },
        { label: 'Abend', times: ['19:00', '20:00', '21:00', '22:00'] }
    ];

    // Handle preset click
    const handlePresetClick = (time: string) => {
        const [h, m] = time.split(':');
        setHours(h);
        setMinutes(m);
        onChange(time);
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "justify-start text-left font-normal w-full",
                        !value && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                >
                    <Clock className="mr-2 h-4 w-4" />
                    {value || 'Uhrzeit auswählen'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-center">
                            <div className="flex items-center space-x-2">
                                <Input
                                    ref={hourInputRef}
                                    className="w-16 text-center text-2xl"
                                    value={hours}
                                    onChange={handleHourChange}
                                    maxLength={2}
                                />
                                <span className="text-2xl">:</span>
                                <Input
                                    ref={minuteInputRef}
                                    className="w-16 text-center text-2xl"
                                    value={minutes}
                                    onChange={handleMinuteChange}
                                    maxLength={2}
                                />
                            </div>
                        </div>
                        
                        <div className="flex justify-center mt-3">
                            <Button onClick={handleSelect}>Auswählen</Button>
                        </div>
                    </div>
                    
                    <div className="border-t pt-4">
                        <div className="grid gap-3">
                            {timePresets.map((group) => (
                                <div key={group.label} className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">{group.label}</p>
                                    <div className="grid grid-cols-4 gap-1">
                                        {group.times.map((time) => (
                                            <Button
                                                key={time}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePresetClick(time)}
                                                className={cn(
                                                    "text-xs",
                                                    time === value && "bg-primary text-primary-foreground"
                                                )}
                                            >
                                                {time}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}; 