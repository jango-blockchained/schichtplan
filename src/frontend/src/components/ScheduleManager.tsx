import React, { useState } from 'react';
import { ScheduleTable } from './ScheduleTable';
import { TimeGridScheduleTable } from './TimeGridScheduleTable';
import { Schedule, ScheduleUpdate } from '@/types';
import { DateRange } from 'react-day-picker';
import { Card, CardContent } from '@/components/ui/card';

interface ScheduleManagerProps {
    schedules: Schedule[];
    dateRange: DateRange | undefined;
    onDrop: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate: (scheduleId: number, updates: ScheduleUpdate) => Promise<void>;
    isLoading: boolean;
    employeeAbsences?: Record<number, any[]>;
    absenceTypes?: Array<{
        id: string;
        name: string;
        color: string;
        type: 'absence';
    }>;
    activeView: 'table' | 'grid';
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