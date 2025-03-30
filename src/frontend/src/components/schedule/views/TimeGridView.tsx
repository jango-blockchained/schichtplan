import { Schedule, ScheduleUpdate } from '@/types';
import { DateRange } from 'react-day-picker';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { getSettings, getEmployees } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { TimeGridScheduleTable } from '../TimeGridScheduleTable';

interface TimeGridViewProps {
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
}

export const TimeGridView = ({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading,
    employeeAbsences,
    absenceTypes
}: TimeGridViewProps) => {
    // Fetch settings for opening days
    const { data: settings, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings
    });

    if (isLoading || isLoadingSettings) {
        return <Skeleton className="w-full h-[600px]" />;
    }

    if (!dateRange?.from || !dateRange?.to) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Bitte wählen Sie einen Datumsbereich aus</AlertDescription>
            </Alert>
        );
    }

    // Use the TimeGridScheduleTable component for the new layout with time slots on Y-axis
    return (
        <TimeGridScheduleTable 
            schedules={schedules}
            dateRange={dateRange}
            onDrop={onDrop}
            onUpdate={onUpdate}
            isLoading={isLoading}
            employeeAbsences={employeeAbsences}
            absenceTypes={absenceTypes}
        />
    );
}; 