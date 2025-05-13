# Time-Only Picker Component Implementation

## Task ID: TASK-20240710-Time-Picker-Component
## Status: pending
## Priority: medium
## Dependencies: TASK-20240710-Settings-Refactor

## Description
Create or adapt a time-only picker component to replace the current DateTimePicker in the GeneralStoreSetupSection. This component will be used for selecting opening and closing times without the date portion.

## Requirements

### Component Features
1. Input field for time in HH:MM format
2. Pop-up time selector with:
   - Hour selection (12-hour or 24-hour format based on settings)
   - Minute selection
   - AM/PM toggle (if in 12-hour format)
3. Support for keyboard input
4. Validation for entered times
5. Accessibility compliance

### Integration Points
- Replace the DateTimePicker in GeneralStoreSetupSection
- Must work with the existing state management
- Should convert between time string format (HH:MM) and Date objects if needed

## Implementation Steps

### Step 1: Research Existing Solutions
1. Check if the current UI library (shadcn/ui or similar) has a time-only picker
2. Evaluate existing React time picker libraries
3. Decide whether to adapt an existing component or create a new one

### Step 2: Component Implementation
If adapting the existing DateTimePicker:
```typescript
// ui/time-picker.tsx
import React from 'react';
import { TimePickerProps } from '@/types';
import { DateTimePicker as BaseDateTimePicker } from '@/components/ui/date-time-picker';

export const TimePicker: React.FC<TimePickerProps> = ({
  time,
  setTime,
  format = '24h',
  ...props
}) => {
  // Use a reference date (today) and only change the time portion
  const handleDateChange = (newDate: Date | undefined) => {
    if (!newDate) return;
    // Extract only the time part
    const hours = newDate.getHours();
    const minutes = newDate.getMinutes();
    
    // Format as HH:MM
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    setTime(timeString);
  };

  // Convert time string to Date for the picker
  const getDateFromTime = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 0);
    date.setMinutes(minutes || 0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  };

  return (
    <BaseDateTimePicker
      date={getDateFromTime(time)}
      setDate={handleDateChange}
      {...props}
      showDatePicker={false} // Hide the date portion
      granularity="minute" // Only show hours and minutes
    />
  );
};
```

If creating a new component:
```typescript
// ui/time-picker.tsx
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimePickerProps {
  value: string; // HH:MM format
  onChange: (time: string) => void;
  disabled?: boolean;
  className?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  
  // Parse current value
  const [hours, minutes] = value.split(':').map(Number);
  
  // Generate hours and minutes options
  const hoursOptions = Array.from({ length: 24 }, (_, i) => i);
  const minutesOptions = Array.from({ length: 60 }, (_, i) => i);
  
  // Handle selection
  const handleHourSelect = (hour: number) => {
    const newValue = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    onChange(newValue);
  };
  
  const handleMinuteSelect = (minute: number) => {
    const newValue = `${hours.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onChange(newValue);
  };
  
  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <Clock className="mr-2 h-4 w-4" />
            {value || "Select time..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
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
    </div>
  );
};
```

### Step 3: Integration with GeneralStoreSetupSection
Update the GeneralStoreSetupSection to use the new TimePicker:

```typescript
// In GeneralStoreSetupSection.tsx
import { TimePicker } from '@/components/ui/time-picker';

// Replace DateTimePicker instances with TimePicker
<div className="space-y-2">
  <Label htmlFor="store-opening">Opening Time</Label>
  <TimePicker
    value={generalSettings.store_opening || '09:00'}
    onChange={(time) => onInputChange('store_opening', time)}
  />
</div>
<div className="space-y-2">
  <Label htmlFor="store-closing">Closing Time</Label>
  <TimePicker
    value={generalSettings.store_closing || '20:00'}
    onChange={(time) => onInputChange('store_closing', time)}
  />
</div>
```

### Step 4: Testing and Validation
1. Test the component with various input methods
2. Validate the time format
3. Ensure correct handling of edge cases (midnight, etc.)
4. Verify accessibility compliance

## Technical Considerations

### Time Format
- Use 24-hour format (HH:MM) for internal representation
- Display format can be configurable based on user preferences (12h/24h)

### Validation
- Ensure hours are between 0-23
- Ensure minutes are between 0-59
- Validate manual input format

### Accessibility
- Ensure keyboard navigation works
- Add appropriate ARIA attributes
- Maintain focus management

## Acceptance Criteria
1. TimePicker component correctly displays and allows selection of time values
2. Time values are properly formatted (HH:MM)
3. Component integrates seamlessly with GeneralStoreSetupSection
4. Keyboard input and navigation work as expected
5. Component meets accessibility standards
6. UI design matches the application's style guidelines

## Resources
- Existing DateTimePicker component code
- shadcn/ui documentation
- ARIA best practices for time selection components