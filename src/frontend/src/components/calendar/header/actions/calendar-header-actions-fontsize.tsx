import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Type } from 'lucide-react'
import { useCalendarContext } from '../../calendar-context'

export default function CalendarHeaderActionsFontSize() {
    const { fontSizeMultiplier = 1, setFontSizeMultiplier } = useCalendarContext()

    const handleFontSizeChange = (value: number[]) => {
        if (setFontSizeMultiplier) {
            setFontSizeMultiplier(value[0])
        }
    }

    const resetFontSize = () => {
        if (setFontSizeMultiplier) {
            setFontSizeMultiplier(1)
        }
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    title="Adjust event text size"
                    className="gap-2"
                >
                    <Type className="h-4 w-4" />
                    <span className="text-xs">{(fontSizeMultiplier * 100).toFixed(0)}%</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-4">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Event Text Size</label>
                        <p className="text-xs text-muted-foreground mb-2">
                            Adjust the size of event text in calendar entries
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Slider
                            value={[fontSizeMultiplier]}
                            onValueChange={handleFontSizeChange}
                            min={0.25}
                            max={3}
                            step={0.05}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground px-1">
                            <span>25%</span>
                            <span>100%</span>
                            <span>300%</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                            {(fontSizeMultiplier * 100).toFixed(0)}%
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetFontSize}
                            className="text-xs"
                        >
                            Reset
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
