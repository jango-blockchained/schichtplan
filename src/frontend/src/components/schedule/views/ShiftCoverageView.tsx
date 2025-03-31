import React from 'react';
import { ShiftCoverageView as CoreShiftCoverageView } from '@/components/shifts/views';
import { Schedule, Settings } from '@/types';
import { DateRange } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';

interface ShiftCoverageViewProps {
    schedules: Schedule[];
    dateRange: DateRange | undefined;
    onDrop?: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate?: (scheduleId: number, updates: any) => Promise<void>;
    isLoading?: boolean;
    employeeAbsences?: Record<number, any[]>;
    absenceTypes?: Array<{
        id: string;
        name: string;
        color: string;
        type: 'absence';
    }>;
    settings?: Settings;
}

/**
 * ShiftCoverageView component for the schedule module
 * This is a wrapper around the core ShiftCoverageView component with schedule-specific defaults
 */
export const ShiftCoverageView = (props: ShiftCoverageViewProps) => {
    // Fetch settings if not provided
    const { data: fetchedSettings, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
        enabled: !props.settings
    });
    
    const activeSettings = props.settings || fetchedSettings;
    
    // Convert DateRange to the format expected by the core component
    const convertedDateRange = props.dateRange && props.dateRange.from && props.dateRange.to ? {
        from: props.dateRange.from,
        to: props.dateRange.to
    } : undefined;
    
    if (!activeSettings || isLoadingSettings) {
        return <div>Loading settings...</div>;
    }
    
    return (
        <CoreShiftCoverageView
            schedules={props.schedules}
            dateRange={convertedDateRange}
            onDrop={props.onDrop}
            onUpdate={props.onUpdate}
            isLoading={props.isLoading || isLoadingSettings}
            employeeAbsences={props.employeeAbsences}
            absenceTypes={props.absenceTypes}
            settings={activeSettings}
            mode="schedules"
        />
    );
};