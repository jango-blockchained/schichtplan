import React from "react";
import { Label } from "./label";

export interface ColorPickerProps {
  id?: string;
  color: string;
  onChange: (color: string) => void;
  onBlur?: () => void;
  className?: string;
}

export function ColorPicker({ 
  id, 
  color, 
  onChange, 
  onBlur,
  className 
}: ColorPickerProps) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <input
        type="color"
        id={id}
        value={color}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="h-10 w-10 rounded-md border border-input bg-background"
      />
      <Label htmlFor={id}>{color}</Label>
    </div>
  );
}
