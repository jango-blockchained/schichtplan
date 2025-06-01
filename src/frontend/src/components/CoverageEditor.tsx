import { useWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { useQueryClient } from '@tanstack/react-query';

export function CoverageEditor({ /* existing props */ }) {
    const queryClient = useQueryClient();

    // Add WebSocket event handlers
    useWebSocketEvents([
        {
            eventType: 'coverage_updated',
            handler: () => {
                // Invalidate and refetch coverage data when updates occur
                queryClient.invalidateQueries({ queryKey: ['coverage'] });
            }
        },
        {
            eventType: 'settings_updated',
            handler: () => {
                // Invalidate settings and coverage when store settings change
                queryClient.invalidateQueries({ queryKey: ['settings'] });
                queryClient.invalidateQueries({ queryKey: ['coverage'] });
            }
        }
    ]);

    // ... rest of the component code ...
} 