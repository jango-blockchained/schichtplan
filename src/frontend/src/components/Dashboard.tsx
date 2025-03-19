import { useWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { useDebounceInvalidation } from '@/hooks/useDebounceInvalidation';
import { WebSocketErrorBoundary } from '@/components/WebSocketErrorBoundary';
import { ReactNode } from 'react';

interface DashboardProps {
    children?: ReactNode;
    // ... other props
}

export function DashboardWithSocket(props: DashboardProps) {
    const invalidateQueries = useDebounceInvalidation([
        { queryKey: ['schedules'] },
        { queryKey: ['coverage'] },
        { queryKey: ['absences'] },
        { queryKey: ['employees'] },
        { queryKey: ['settings'] },
        { queryKey: ['dashboard-metrics'], debounceMs: 2000 } // Longer debounce for metrics
    ]);

    useWebSocketEvents([
        {
            eventType: 'schedule_updated',
            handler: () => {
                invalidateQueries([['schedules'], ['dashboard-metrics']]);
            }
        },
        {
            eventType: 'coverage_updated',
            handler: () => {
                invalidateQueries([['coverage'], ['dashboard-metrics']]);
            }
        },
        {
            eventType: 'absence_updated',
            handler: () => {
                invalidateQueries([
                    ['absences'],
                    ['employees'],
                    ['dashboard-metrics']
                ]);
            }
        },
        {
            eventType: 'settings_updated',
            handler: () => {
                invalidateQueries([['settings'], ['dashboard-metrics']]);
            }
        }
    ]);

    return <>{props.children}</>;
}

export function Dashboard(props: DashboardProps) {
    return (
        <WebSocketErrorBoundary>
            <DashboardWithSocket {...props} />
        </WebSocketErrorBoundary>
    );
} 