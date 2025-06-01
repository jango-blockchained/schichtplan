import { useWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

export function SettingsView({ /* existing props */ }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Add WebSocket event handlers
    useWebSocketEvents([
        {
            eventType: 'settings_updated',
            handler: (data) => {
                // Invalidate settings-related queries
                queryClient.invalidateQueries({ queryKey: ['settings'] });
                queryClient.invalidateQueries({ queryKey: ['store-config'] });

                // Show notification
                toast({
                    title: "Settings Updated",
                    description: "Settings have been updated by another user.",
                });
            }
        },
        {
            eventType: 'shift_template_updated',
            handler: () => {
                // Invalidate shift templates when they are updated
                queryClient.invalidateQueries({ queryKey: ['shifts'] });
            }
        }
    ]);

    // ... rest of the component code ...
} 