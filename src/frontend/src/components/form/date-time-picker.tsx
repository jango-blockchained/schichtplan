import React from 'react';
import { ControllerRenderProps, FieldValues, FieldPath } from 'react-hook-form';
import { format, parse } from 'date-fns';
import { DateTimePicker as BaseDateTimePicker } from '@/components/ui/date-time-picker';

interface DateTimePickerProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  field: ControllerRenderProps<TFieldValues, TName>;
}

export function DateTimePicker<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({ field }: DateTimePickerProps<TFieldValues, TName>) {
  const value = field.value as string | Date | undefined;
  
  // Parse string datetime to Date if needed
  let dateValue: Date;
  if (typeof value === 'string') {
    try {
      dateValue = parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
      if (isNaN(dateValue.getTime())) {
        dateValue = new Date();
      }
    } catch {
      dateValue = new Date();
    }
  } else if (value && typeof value === 'object' && 'getTime' in value) {
    dateValue = value as Date;
  } else {
    dateValue = new Date();
  }

  const handleDateChange = (newDate: Date) => {
    // Format back to string for the form field
    const formattedDate = format(newDate, "yyyy-MM-dd'T'HH:mm");
    field.onChange(formattedDate);
  };

  return (
    <BaseDateTimePicker
      date={dateValue}
      setDate={handleDateChange}
      disabled={field.disabled}
    />
  );
}
