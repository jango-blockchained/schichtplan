import { useWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { useDebounceInvalidation } from '@/hooks/useDebounceInvalidation';
import { useToast } from '@/components/ui/use-toast';
import { WebSocketErrorBoundary } from '@/components/WebSocketErrorBoundary';
import { ReactNode } from 'react';

interface EmployeeManagementProps {
    children?: ReactNode;
    // ... other props
}

export function EmployeeManagementWithSocket(props: EmployeeManagementProps) {
    const { toast } = useToast();

    const invalidateQueries = useDebounceInvalidation([
        {
            queryKey: ['employees'],
            priority: 'high',
            batchWith: ['availability', 'absences'],
            debounceMs: 500, // Quick updates for employee data
            maxWait: 2000
        },
        {
            queryKey: ['availability'],
            priority: 'medium',
            batchWith: ['employees'],
            debounceMs: 1000,
            maxWait: 3000
        },
        {
            queryKey: ['absences'],
            priority: 'medium',
            batchWith: ['employees'],
            debounceMs: 1000,
            maxWait: 3000
        },
        {
            queryKey: ['settings'],
            priority: 'low',
            debounceMs: 2000,
            maxWait: 5000
        },
        {
            queryKey: ['employee-stats'],
            priority: 'low',
            batchWith: ['employees', 'availability', 'absences'],
            debounceMs: 3000, // Longer delay for stats calculations
            maxWait: 10000
        }
    ]);

    useWebSocketEvents([
        {
            eventType: 'availability_updated',
            handler: (data) => {
                // Force immediate update for critical availability changes
                invalidateQueries([['employees'], ['availability']], { force: true });

                toast({
                    title: "Availability Updated",
                    description: "Employee availability has been updated.",
                });
            }
        },
        {
            eventType: 'absence_updated',
            handler: (data) => {
                // Regular debounced update for absences
                invalidateQueries([
                    ['employees'],
                    ['absences'],
                    ['employee-stats']
                ]);

                toast({
                    title: "Absence Updated",
                    description: "Employee absence information has been modified.",
                });
            }
        },
        {
            eventType: 'settings_updated',
            handler: () => {
                // Low priority update for settings changes
                invalidateQueries([
                    ['settings'],
                    ['employees'],
                    ['employee-stats']
                ]);
            }
        }
    ]);

    return <>{props.children}</>;
}

export function EmployeeManagement(props: EmployeeManagementProps) {
    return (
        <WebSocketErrorBoundary>
            <EmployeeManagementWithSocket {...props} />
        </WebSocketErrorBoundary>
    );
} 