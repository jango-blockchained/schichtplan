import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CoverageEditor } from '@/components/CoverageEditor';
import { useToast } from '@/components/ui/use-toast';
import { getAllCoverage, updateCoverage, getSettings } from '@/services/api';
import { DailyCoverage, Settings } from '@/types';

export default function CoveragePage() {
    const { toast } = useToast();

    const { data: settings, isLoading: isSettingsLoading } = useQuery<Settings>({
        queryKey: ['settings'],
        queryFn: getSettings
    });

    const { data: coverage, isLoading: isCoverageLoading } = useQuery(
        ['coverage'],
        getAllCoverage
    );

    const updateMutation = useMutation(updateCoverage, {
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Coverage settings saved successfully",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to save coverage settings",
                variant: "destructive",
            });
        }
    });

    if (isSettingsLoading || !settings || isCoverageLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" role="status" aria-label="loading">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span className="ml-2 text-lg">Loading...</span>
            </div>
        );
    }

    // Convert settings to the format expected by CoverageEditor
    const storeConfig = {
        store_opening: settings.general.store_opening,
        store_closing: settings.general.store_closing,
        opening_days: settings.general.opening_days,
        min_employees_per_shift: settings.scheduling.min_employees_per_shift,
        max_employees_per_shift: settings.scheduling.max_employees_per_shift,
        employee_types: settings.employee_groups.employee_types.map(type => ({
            id: type.id,
            name: type.name
        }))
    };

    return (
        <div className="container mx-auto py-6">
            <CoverageEditor
                storeConfig={storeConfig}
                initialCoverage={coverage}
                onChange={updateMutation.mutate}
            />
        </div>
    );
} 