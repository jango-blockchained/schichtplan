import { useMemo } from 'react';
import { Schedule } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

interface VersionCompareProps {
    currentVersion: Schedule[];
    previousVersion: Schedule[];
}

interface ScheduleChange {
    type: 'added' | 'removed' | 'modified';
    schedule: Schedule;
    changes?: {
        field: string;
        old: any;
        new: any;
    }[];
}

export function VersionCompare({ currentVersion, previousVersion }: VersionCompareProps) {
    const changes = useMemo(() => {
        const changes: ScheduleChange[] = [];

        // Track processed schedules to identify removals
        const processedPrevIds = new Set<number>();

        // Check for additions and modifications
        currentVersion.forEach(current => {
            const previous = previousVersion.find(p =>
                p.date === current.date &&
                p.shift_id === current.shift_id
            );

            if (!previous) {
                // New schedule
                changes.push({
                    type: 'added',
                    schedule: current
                });
            } else {
                processedPrevIds.add(previous.id);

                // Check for modifications
                const fieldChanges = [];

                if (previous.employee_id !== current.employee_id) {
                    fieldChanges.push({
                        field: 'employee',
                        old: previous.employee_name,
                        new: current.employee_name
                    });
                }

                if (previous.break_start !== current.break_start ||
                    previous.break_end !== current.break_end) {
                    fieldChanges.push({
                        field: 'break',
                        old: previous.break_start && previous.break_end ?
                            `${previous.break_start}-${previous.break_end}` : 'None',
                        new: current.break_start && current.break_end ?
                            `${current.break_start}-${current.break_end}` : 'None'
                    });
                }

                if (previous.notes !== current.notes) {
                    fieldChanges.push({
                        field: 'notes',
                        old: previous.notes || 'None',
                        new: current.notes || 'None'
                    });
                }

                if (fieldChanges.length > 0) {
                    changes.push({
                        type: 'modified',
                        schedule: current,
                        changes: fieldChanges
                    });
                }
            }
        });

        // Check for removals
        previousVersion.forEach(prev => {
            if (!processedPrevIds.has(prev.id)) {
                changes.push({
                    type: 'removed',
                    schedule: prev
                });
            }
        });

        return changes;
    }, [currentVersion, previousVersion]);

    if (changes.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-4">
                Keine Änderungen zwischen den Versionen
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Änderungen im Vergleich zur vorherigen Version</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {changes.map((change, index) => (
                        <div
                            key={index}
                            className={`p-4 rounded-lg border ${change.type === 'added' ? 'border-green-500 bg-green-50' :
                                    change.type === 'removed' ? 'border-red-500 bg-red-50' :
                                        'border-yellow-500 bg-yellow-50'
                                }`}
                        >
                            <div className="font-medium">
                                {change.type === 'added' ? 'Neue Schicht' :
                                    change.type === 'removed' ? 'Entfernte Schicht' :
                                        'Geänderte Schicht'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {format(new Date(change.schedule.date), 'dd.MM.yyyy')} |{' '}
                                {change.schedule.shift_start}-{change.schedule.shift_end}
                            </div>
                            {change.type === 'modified' && change.changes && (
                                <div className="mt-2 space-y-1">
                                    {change.changes.map((fieldChange, i) => (
                                        <div key={i} className="text-sm">
                                            <span className="font-medium">{fieldChange.field}:</span>{' '}
                                            <span className="line-through text-red-500">{fieldChange.old}</span>{' '}
                                            <span className="text-green-500">{fieldChange.new}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
} 