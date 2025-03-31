import React from 'react';
import { ShiftCoverageView as CoreShiftCoverageView } from '@/components/shifts/views';
import { Settings, Shift } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';

interface ShiftCoverageViewProps {
    settings?: Settings;
    shifts: Shift[];
}

/**
 * ShiftCoverageView component for the shifts module
 * This is a wrapper around the core ShiftCoverageView component with shifts-specific defaults
 */
export const ShiftCoverageView = (props: ShiftCoverageViewProps) => {
    // Fetch settings if not provided
    const { data: fetchedSettings, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
        enabled: !props.settings
    });
    
    const activeSettings = props.settings || fetchedSettings;
    
    if (!activeSettings || isLoadingSettings) {
        return <div>Loading settings...</div>;
    }
    
    return (
        <CoreShiftCoverageView
            shifts={props.shifts}
            settings={activeSettings}
            isLoading={isLoadingSettings}
            mode="shifts"
        />
    );
};