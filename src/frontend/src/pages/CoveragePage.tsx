import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PencilIcon } from "lucide-react";
import { getAllCoverage, updateCoverage, getSettings } from "@/services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NewCoverageGrid } from "@/components/coverage-editor/components/NewCoverageGrid";
import { BlockEditor } from "@/components/coverage-editor/components/BlockEditor";

// Define query keys as constants
const SETTINGS_QUERY_KEY = ['settings'] as const;
const COVERAGE_QUERY_KEY = ['coverage'] as const;

export default function CoveragePage() {
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editingSlot, setEditingSlot] = useState<{ dayIndex: number; slotIndex: number } | null>(null);

    const { data: settings, isLoading: isSettingsLoading } = useQuery({
        queryKey: SETTINGS_QUERY_KEY,
        queryFn: getSettings
    });

    const { data: coverage, isLoading: isCoverageLoading } = useQuery({
        queryKey: COVERAGE_QUERY_KEY,
        queryFn: getAllCoverage
    });

    if (isSettingsLoading || !settings || isCoverageLoading || !coverage) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin">Loading...</div>
            </div>
        );
    }

    // Convert settings to the format expected by NewCoverageGrid
    const storeConfig = {
        store_opening: settings.general.store_opening,
        store_closing: settings.general.store_closing,
        opening_days: settings.general.opening_days,
        min_employees_per_shift: settings.scheduling.min_employees_per_shift,
        max_employees_per_shift: settings.scheduling.max_employees_per_shift,
        employee_types: settings.employee_groups.employee_types.map(type => ({
            id: type.id,
            name: type.name
        })),
        keyholder_before_minutes: settings.general.keyholder_before_minutes,
        keyholder_after_minutes: settings.general.keyholder_after_minutes
    };

    // Initialize default coverage if none exists
    const initialCoverage = coverage || Array.from({ length: 7 }, (_, index) => ({
        dayIndex: index,
        timeSlots: []
    }));

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Coverage Overview</h1>
                    <p className="text-muted-foreground">
                        Manage employee coverage requirements
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={isEditing ? "secondary" : "outline"}
                        size="sm"
                        className="gap-2"
                        onClick={() => setIsEditing(!isEditing)}
                    >
                        <PencilIcon className="h-4 w-4" />
                        {isEditing ? 'Done' : 'Edit'}
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="border-b p-4">
                    <CardTitle>Coverage Requirements</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <NewCoverageGrid
                        coverage={initialCoverage}
                        storeConfig={storeConfig}
                        isEditing={isEditing}
                        onUpdateSlot={(dayIndex, slotIndex, updates) => {
                            const newCoverage = [...initialCoverage];
                            newCoverage[dayIndex].timeSlots[slotIndex] = {
                                ...newCoverage[dayIndex].timeSlots[slotIndex],
                                ...updates
                            };
                            updateCoverage(newCoverage)
                                .then(() => queryClient.invalidateQueries({ queryKey: COVERAGE_QUERY_KEY }))
                                .catch(console.error);
                        }}
                        onDeleteSlot={(dayIndex, slotIndex) => {
                            const newCoverage = [...initialCoverage];
                            newCoverage[dayIndex].timeSlots.splice(slotIndex, 1);
                            updateCoverage(newCoverage)
                                .then(() => queryClient.invalidateQueries({ queryKey: COVERAGE_QUERY_KEY }))
                                .catch(console.error);
                        }}
                        onAddSlot={(dayIndex, startTime) => {
                            const newCoverage = [...initialCoverage];
                            const endHour = parseInt(startTime) + 1;
                            const endTime = `${endHour.toString().padStart(2, '0')}:00`;

                            newCoverage[dayIndex].timeSlots.push({
                                startTime,
                                endTime,
                                minEmployees: storeConfig.min_employees_per_shift,
                                maxEmployees: storeConfig.max_employees_per_shift,
                                employeeTypes: storeConfig.employee_types.map(t => t.id),
                                requiresKeyholder: startTime === storeConfig.store_opening || endTime === storeConfig.store_closing,
                                keyholderBeforeMinutes: startTime === storeConfig.store_opening ? storeConfig.keyholder_before_minutes : 0,
                                keyholderAfterMinutes: endTime === storeConfig.store_closing ? storeConfig.keyholder_after_minutes : 0
                            });

                            updateCoverage(newCoverage)
                                .then(() => queryClient.invalidateQueries({ queryKey: COVERAGE_QUERY_KEY }))
                                .catch(console.error);
                        }}
                        onEditSlot={(dayIndex, slotIndex) => {
                            setEditingSlot({ dayIndex, slotIndex });
                        }}
                    />
                </CardContent>
            </Card>

            {editingSlot && (
                <Dialog open={!!editingSlot} onOpenChange={() => setEditingSlot(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Coverage Block</DialogTitle>
                        </DialogHeader>
                        <BlockEditor
                            slot={initialCoverage[editingSlot.dayIndex].timeSlots[editingSlot.slotIndex]}
                            onSave={(updates) => {
                                const newCoverage = [...initialCoverage];
                                newCoverage[editingSlot.dayIndex].timeSlots[editingSlot.slotIndex] = {
                                    ...newCoverage[editingSlot.dayIndex].timeSlots[editingSlot.slotIndex],
                                    ...updates
                                };
                                updateCoverage(newCoverage)
                                    .then(() => {
                                        queryClient.invalidateQueries({ queryKey: COVERAGE_QUERY_KEY });
                                        setEditingSlot(null);
                                    })
                                    .catch(console.error);
                            }}
                            onCancel={() => setEditingSlot(null)}
                            storeConfig={storeConfig}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
} 