import React, { useState, useEffect } from 'react';
import { useWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Availability } from '@/types';

interface AvailabilityManagerProps {
    availabilities: Availability[];
    onUpdate: (availabilityId: number, updates: Partial<Availability>) => Promise<void>;
    onDelete: (availabilityId: number) => Promise<void>;
    isLoading: boolean;
}

interface WebSocketAvailabilityEvent {
    action: 'create' | 'update' | 'delete' | 'batch_update';
    availability?: Availability;
    availabilities?: Availability[];
    timestamp: string;
}

export function AvailabilityManager({
    availabilities,
    onUpdate,
    onDelete,
    isLoading
}: AvailabilityManagerProps) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [localAvailabilities, setLocalAvailabilities] = useState<Availability[]>(availabilities);

    // Update local availabilities when prop changes
    useEffect(() => {
        setLocalAvailabilities(availabilities);
    }, [availabilities]);

    // WebSocket event handlers
    useWebSocketEvents([
        {
            eventType: 'availability_updated',
            handler: (data: unknown) => {
                const eventData = data as WebSocketAvailabilityEvent;
                const { action, availability, availabilities: batchAvailabilities, timestamp } = eventData;

                // Handle different types of updates
                switch (action) {
                    case 'create':
                    case 'update':
                        if (availability) {
                            setLocalAvailabilities(prev => {
                                const updated = prev.filter(a => a.id !== availability.id);
                                return [...updated, availability];
                            });
                            toast({
                                title: "Availability Updated",
                                description: `Availability has been ${action}d successfully`
                            });
                        }
                        break;

                    case 'delete':
                        if (availability) {
                            setLocalAvailabilities(prev => prev.filter(a => a.id !== availability.id));
                            toast({
                                title: "Availability Deleted",
                                description: "Availability has been removed"
                            });
                        }
                        break;

                    case 'batch_update':
                        if (batchAvailabilities) {
                            setLocalAvailabilities(prev => {
                                const updated = prev.filter(a => !batchAvailabilities.find(ba => ba.id === a.id));
                                return [...updated, ...batchAvailabilities];
                            });
                            toast({
                                title: "Availabilities Updated",
                                description: `${batchAvailabilities.length} availabilities have been updated`
                            });
                        }
                        break;
                }

                // Invalidate queries to ensure data consistency
                queryClient.invalidateQueries({ queryKey: ['availabilities'] });
            }
        }
    ]);

    // Enhanced update handler
    const handleUpdate = async (availabilityId: number, updates: Partial<Availability>) => {
        try {
            await onUpdate(availabilityId, updates);
            // Note: No need to manually update state here as WebSocket event will handle it
        } catch (error) {
            console.error('Error updating availability:', error);
            toast({
                title: "Error",
                description: "Failed to update availability. Please try again.",
                variant: "destructive"
            });
        }
    };

    // Enhanced delete handler
    const handleDelete = async (availabilityId: number) => {
        try {
            await onDelete(availabilityId);
            // Note: No need to manually update state here as WebSocket event will handle it
        } catch (error) {
            console.error('Error deleting availability:', error);
            toast({
                title: "Error",
                description: "Failed to delete availability. Please try again.",
                variant: "destructive"
            });
        }
    };

    return (
        <Card>
            <CardContent className="p-4">
                {/* Add your availability display/edit UI components here */}
                {/* This is a placeholder for the actual availability management UI */}
                <div className="space-y-4">
                    {localAvailabilities.map(availability => (
                        <div
                            key={availability.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                        >
                            <div>
                                <p className="font-medium">
                                    Employee ID: {availability.employee_id}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {availability.day_of_week} - {availability.start_time} to {availability.end_time}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {/* Add your edit/delete buttons here */}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
} 