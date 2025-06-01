import { useWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { useDebounceInvalidation } from '@/hooks/useDebounceInvalidation';
import { useToast } from '@/components/ui/use-toast';
import { WebSocketErrorBoundary } from '@/components/WebSocketErrorBoundary';
import { ReactNode } from 'react';

interface ShiftTemplateEditorProps {
    children?: ReactNode;
    // ... other props
}

export function ShiftTemplateEditorWithSocket(props: ShiftTemplateEditorProps) {
    const { toast } = useToast();

    const invalidateQueries = useDebounceInvalidation([
        { queryKey: ['shifts'] },
        { queryKey: ['coverage'] },
        { queryKey: ['settings'] }
    ]);

    useWebSocketEvents([
        {
            eventType: 'shift_template_updated',
            handler: (data) => {
                invalidateQueries([['shifts']]);

                toast({
                    title: "Shift Templates Updated",
                    description: "Shift templates have been modified.",
                });
            }
        },
        {
            eventType: 'coverage_updated',
            handler: () => {
                invalidateQueries([['coverage'], ['shifts']]);
            }
        },
        {
            eventType: 'settings_updated',
            handler: () => {
                invalidateQueries([['settings'], ['shifts']]);
            }
        }
    ]);

    return <>{props.children}</>;
}

export function ShiftTemplateEditor(props: ShiftTemplateEditorProps) {
    return (
        <WebSocketErrorBoundary>
            <ShiftTemplateEditorWithSocket {...props} />
        </WebSocketErrorBoundary>
    );
} 