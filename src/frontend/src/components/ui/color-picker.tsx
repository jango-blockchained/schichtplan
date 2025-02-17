import * as React from "react"
import { HexColorPicker } from "react-colorful"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface ColorPickerProps {
    color: string
    onChange: (color: string) => void
    className?: string
}

export function ColorPicker({ color, onChange, className }: ColorPickerProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn("w-[65px] p-0 h-8", className)}
                >
                    <div
                        className="w-full h-full rounded-md"
                        style={{ backgroundColor: color }}
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3">
                <HexColorPicker color={color} onChange={onChange} />
            </PopoverContent>
        </Popover>
    )
} 