import React from 'react';
import { Label } from './label';

export interface ColorPickerProps {
    id?: string;
    color: string;
    onChange: (color: string) => void;
}

export function ColorPicker({ id, color, onChange }: ColorPickerProps) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="color"
                id={id}
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-10 rounded-md border border-input bg-background"
            />
            <Label htmlFor={id}>{color}</Label>
        </div>
    );
} 