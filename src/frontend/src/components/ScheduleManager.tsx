import React, { useState, useEffect } from 'react';
import { ScheduleTable } from './ScheduleTable';
import { TimeGridScheduleTable } from './TimeGridScheduleTable';
import { Schedule, ScheduleUpdate } from '@/types';
import { DateRange } from 'react-day-picker';
import { Card, CardContent } from '@/components/ui/card';
import { useWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2 } from 'lucide-react';

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

interface WebSocketScheduleEvent {
    action: 'create' | 'update' | 'delete' | 'batch_update';
    schedule?: Schedule;
    schedules?: Schedule[];
    timestamp: string;
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
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [localSchedules, setLocalSchedules] = useState<Schedule[]>(schedules);

    // Update local schedules when prop changes
    useEffect(() => {
        setLocalSchedules(schedules);
    }, [schedules]);

    // WebSocket event handlers
    useWebSocketEvents([
        {
            eventType: 'schedule_updated',
            handler: (data: unknown) => {
                const eventData = data as WebSocketScheduleEvent;
                const { action, schedule, schedules: batchSchedules, timestamp } = eventData;

                // Handle different types of updates
                switch (action) {
                    case 'create':
                    case 'update':
                        if (schedule) {
                            setLocalSchedules(prev => {
                                const updated = prev.filter(s => s.id !== schedule.id);
                                return [...updated, schedule];
                            });
                            toast({
                                title: "Schedule Updated",
                                description: `Schedule has been ${action}d successfully`
                            });
                        }
                        break;

                    case 'delete':
                        if (schedule) {
                            setLocalSchedules(prev => prev.filter(s => s.id !== schedule.id));
                            toast({
                                title: "Schedule Deleted",
                                description: "Schedule has been removed"
                            });
                        }
                        break;

                    case 'batch_update':
                        if (batchSchedules) {
                            setLocalSchedules(prev => {
                                const updated = prev.filter(s => !batchSchedules.find(bs => bs.id === s.id));
                                return [...updated, ...batchSchedules];
                            });
                            toast({
                                title: "Schedules Updated",
                                description: `${batchSchedules.length} schedules have been updated`
                            });
                        }
                        break;
                }

                // Invalidate queries to ensure data consistency
                queryClient.invalidateQueries({ queryKey: ['schedules'] });
            }
        }
    ]);

    // Enhanced drop handler that can handle both table and grid view drops
    const handleDrop = async (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => {
        try {
            await onDrop(scheduleId, newEmployeeId, newDate, newShiftId);
            // Note: No need to manually update state here as WebSocket event will handle it
        } catch (error) {
            console.error('Error handling schedule drop:', error);
            toast({
                title: "Error",
                description: "Failed to update schedule. Please try again.",
                variant: "destructive"
            });
        }
    };

    // Enhanced update handler
    const handleUpdate = async (scheduleId: number, updates: ScheduleUpdate) => {
        try {
            await onUpdate(scheduleId, updates);
            // Note: No need to manually update state here as WebSocket event will handle it
        } catch (error) {
            console.error('Error updating schedule:', error);
            toast({
                title: "Error",
                description: "Failed to update schedule. Please try again.",
                variant: "destructive"
            });
        }
    };

    return (
        <Card>
            <CardContent className="p-0">
                {activeView === 'table' ? (
                    <ScheduleTable
                        schedules={localSchedules}
                        dateRange={dateRange}
                        onDrop={handleDrop}
                        onUpdate={handleUpdate}
                        isLoading={isLoading}
                        employeeAbsences={employeeAbsences}
                        absenceTypes={absenceTypes}
                    />
                ) : (
                    <TimeGridScheduleTable
                        schedules={localSchedules}
                        dateRange={dateRange}
                        onDrop={handleDrop}
                        onUpdate={handleUpdate}
                        isLoading={isLoading}
                        employeeAbsences={employeeAbsences}
                        absenceTypes={absenceTypes}
                    />
                )}
            </CardContent>
        </Card>
    );
} 