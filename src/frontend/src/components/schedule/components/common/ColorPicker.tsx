import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

// Predefined color palette
const colors = [
  // Blues
  "#e6f2ff",
  "#b3d9ff",
  "#80c1ff",
  "#4da6ff",
  "#1a8cff",
  "#0073e6",
  "#0059b3",
  "#004080",
  "#00264d",
  // Reds
  "#ffebeb",
  "#ffc2c2",
  "#ff9999",
  "#ff7070",
  "#ff4747",
  "#ff1f1f",
  "#e60000",
  "#b30000",
  "#800000",
  // Greens
  "#ebffeb",
  "#c2ffc2",
  "#99ff99",
  "#70ff70",
  "#47ff47",
  "#1fff1f",
  "#00e600",
  "#00b300",
  "#008000",
  // Yellows
  "#ffffeb",
  "#ffffc2",
  "#ffff99",
  "#ffff70",
  "#ffff47",
  "#ffff1f",
  "#e6e600",
  "#b3b300",
  "#808000",
  // Purples
  "#f5ebff",
  "#e6c2ff",
  "#d699ff",
  "#c670ff",
  "#b647ff",
  "#a61fff",
  "#8e00e6",
  "#7000b3",
  "#500080",
  // Teals
  "#ebffff",
  "#c2ffff",
  "#99ffff",
  "#70ffff",
  "#47ffff",
  "#1fffff",
  "#00e6e6",
  "#00b3b3",
  "#008080",
  // Neutrals
  "#ffffff",
  "#e6e6e6",
  "#cccccc",
  "#b3b3b3",
  "#999999",
  "#808080",
  "#666666",
  "#4d4d4d",
  "#333333",
];

export const ColorPicker = ({
  value,
  onChange,
  className,
}: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorSelect = (color: string) => {
    onChange(color);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-10 h-10 p-0 border-2", className)}
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="grid grid-cols-9 gap-1">
          {colors.map((color, index) => (
            <button
              key={index}
              className={cn(
                "w-6 h-6 rounded-md border border-muted",
                value === color && "ring-2 ring-primary ring-offset-2",
              )}
              style={{ backgroundColor: color }}
              onClick={() => handleColorSelect(color)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
