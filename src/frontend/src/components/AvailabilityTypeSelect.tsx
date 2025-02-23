import React from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';
import type { Settings } from '@/types/index';

interface AvailabilityType {
    id: string;
    name: string;
    description: string;
    color: string;
    priority: number;
    is_available: boolean;
}

interface AvailabilityTypeSelectProps {
    value: string;
    onChange: (value: string) => void;
}

export function AvailabilityTypeSelect({ value, onChange }: AvailabilityTypeSelectProps) {
    const { data: settings } = useQuery<Settings>({
        queryKey: ['settings'],
        queryFn: getSettings,
    });

    const availabilityTypes = settings?.availability_types?.types || [];

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[200px]">
                <SelectValue>
                    {availabilityTypes.find((type: AvailabilityType) => type.id === value)?.name || 'Select type'}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {availabilityTypes.map((type: AvailabilityType) => (
                    <SelectItem
                        key={type.id}
                        value={type.id}
                        className="flex items-center gap-2"
                    >
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: type.color }}
                        />
                        <span>{type.name}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
} 