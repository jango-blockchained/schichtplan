import { useWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { useQueryClient } from '@tanstack/react-query';

export function ScheduleView({ /* existing props */ }) {
    const queryClient = useQueryClient();

    // Add WebSocket event handlers
    useWebSocketEvents([
        {
            eventType: 'schedule_updated',
            handler: () => {
                // Invalidate and refetch schedules when updates occur
                queryClient.invalidateQueries({ queryKey: ['schedules'] });
            }
        },
        {
            eventType: 'availability_updated',
            handler: () => {
                // Invalidate availability-related queries
                queryClient.invalidateQueries({ queryKey: ['schedules'] });
                queryClient.invalidateQueries({ queryKey: ['availability'] });
            }
        },
        {
            eventType: 'absence_updated',
            handler: () => {
                // Invalidate absence-related queries
                queryClient.invalidateQueries({ queryKey: ['schedules'] });
                queryClient.invalidateQueries({ queryKey: ['absences'] });
                queryClient.invalidateQueries({ queryKey: ['employees'] });
            }
        }
    ]);

    // ... rest of the component code ...
} 