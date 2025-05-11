import React, { useState, useEffect } from 'react';
import { ScheduleTable } from './ScheduleTable';
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
    currentVersion?: number;
    // Removed activeView as we're always using table view
}

export function ScheduleManager({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading,
    employeeAbsences,
    absenceTypes,
    currentVersion
}: ScheduleManagerProps) {
    // Log detailed debug info about received schedules
    useEffect(() => {
        // Basic count info
        const schedulesWithShiftId = schedules.filter(s => s.shift_id !== null);
        const schedulesWithTimes = schedulesWithShiftId.filter(s => s.shift_start && s.shift_end);
        const employeeIds = [...new Set(schedules.map(s => s.employee_id))];
        
        console.log('🔵 ScheduleManager received:', {
            totalSchedules: schedules.length,
            withShiftId: schedulesWithShiftId.length,
            withTimes: schedulesWithTimes.length, 
            uniqueEmployees: employeeIds.length,
            currentVersion,
            dateRange: dateRange ? {
                from: dateRange.from?.toISOString(),
                to: dateRange.to?.toISOString()
            } : null
        });
        
        // Log the first few schedules with shift IDs for debugging
        if (schedulesWithShiftId.length > 0) {
            console.log('🔵 First 3 schedules with shifts:', schedulesWithShiftId.slice(0, 3));
        } else {
            console.log('🔵 WARNING: No schedules with shift IDs found');
        }
    }, [schedules, dateRange, currentVersion]);

    // Debug log for ScheduleManager render
    console.log('🔍 RENDERING ScheduleManager with:', {
        schedulesCount: schedules.length,
        dateRangeFrom: dateRange?.from ? dateRange.from.toISOString() : 'undefined',
        dateRangeTo: dateRange?.to ? dateRange.to.toISOString() : 'undefined',
        isLoading,
        currentVersion
    });

    // We've removed the enhanced drop handler that handled both table and grid view
    // Now we're always using the table view, so we can directly pass onDrop to the ScheduleTable

    return (
        <Card>
            <CardContent className="p-0">
                <div className="bg-yellow-200 p-4 text-center font-bold">
                    DEBUG: ScheduleManager is rendering (Schedules: {schedules.length})
                </div>
                
                <ScheduleTable
                    schedules={schedules}
                    dateRange={dateRange}
                    onDrop={onDrop}
                    onUpdate={onUpdate}
                    isLoading={isLoading}
                    employeeAbsences={employeeAbsences}
                    absenceTypes={absenceTypes}
                    currentVersion={currentVersion}
                />
            </CardContent>
        </Card>
    );
} 