import React, { useState } from 'react';
import { ScheduleTable } from './Table/ScheduleTable';
import { TimeGridScheduleTable } from '../TimeGridScheduleTable';
import { Schedule, ScheduleUpdate } from '@/types';
import { DateRange } from 'react-day-picker';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';

interface ScheduleManagerProps {
    schedules: Schedule[];
    dateRange: DateRange | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => void;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
    isLoading?: boolean;
    employeeAbsences: Record<number, any[]>;
    absenceTypes: any[];
    activeView: 'table' | 'table2' | 'table3' | 'grid' | 'schedule-table' | 'table-overview';
}

export function ScheduleManager({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading,
    employeeAbsences,
    absenceTypes,
    activeView
}: ScheduleManagerProps) {
    // Fetch settings for store configuration
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
    });

    // Enhanced drop handler that can handle both table and grid view drops
    const handleDrop = async (
        scheduleId: number,
        newEmployeeId: number,
        newDate: Date,
        newShiftId: number,
        newStartTime?: string,
        newEndTime?: string
    ) => {
        // For the grid view, we might get additional time parameters
        if (activeView === 'grid' && newStartTime && newEndTime) {
            const updates = {
                date: newDate.toISOString().split('T')[0],
                employee_id: newEmployeeId,
                shift_id: newShiftId
            } as any;

            // Add shift times if provided
            updates.shift_start = newStartTime;
            updates.shift_end = newEndTime;

            await onUpdate(scheduleId, updates);
        } else {
            // Standard drop for the table view
            await onDrop(scheduleId, newEmployeeId, newDate, newShiftId);
        }
    };

    return (
        <Card>
            <CardContent className="p-0">
                {activeView === 'table' ? (
                    <ScheduleTable
                        schedules={schedules}
                        dateRange={dateRange}
                        onDrop={onDrop}
                        onUpdate={onUpdate}
                        isLoading={isLoading}
                        employeeAbsences={employeeAbsences}
                        absenceTypes={absenceTypes}
                        settings={settings}
                    />
                ) : (
                    <TimeGridScheduleTable
                        schedules={schedules}
                        dateRange={dateRange}
                        onDrop={onDrop}
                        onUpdate={onUpdate}
                        isLoading={isLoading}
                        employeeAbsences={employeeAbsences}
                        absenceTypes={absenceTypes}
                    />
                )}
            </CardContent>
        </Card>
    );
} 