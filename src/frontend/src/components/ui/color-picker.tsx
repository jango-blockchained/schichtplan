import React from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="w-[65px] h-[35px] p-0"
                    style={{ backgroundColor: color }}
                >
                    <span className="sr-only">Pick a color</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3">
                <HexColorPicker color={color} onChange={onChange} />
            </PopoverContent>
        </Popover>
    );
} 