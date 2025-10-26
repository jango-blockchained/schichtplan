import { ColorPicker as BaseColorPicker } from '@/components/ui/color-picker';
import { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';

interface ColorPickerProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
    field: ControllerRenderProps<TFieldValues, TName>;
}

export function ColorPicker<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({ field }: ColorPickerProps<TFieldValues, TName>) {
    const value = (field.value as string) || 'blue';

    return (
        <BaseColorPicker
            color={value}
            onChange={field.onChange}
            onBlur={field.onBlur}
        />
    );
}
