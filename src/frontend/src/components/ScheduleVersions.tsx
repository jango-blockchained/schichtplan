import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Schedule, ScheduleResponse } from '@/types';
import { format } from 'date-fns';
import { Check, Lock, Pencil } from 'lucide-react';

interface ScheduleVersionsProps {
    scheduleResponse: ScheduleResponse;
    onPublish: (version: number) => void;
    onArchive: (version: number) => void;
}

export function ScheduleVersions({ scheduleResponse, onPublish, onArchive }: ScheduleVersionsProps) {
    const { versions = [], schedules = [] } = scheduleResponse;

    // Group schedules by version
    const schedulesByVersion = schedules.reduce((acc, schedule) => {
        if (!acc[schedule.version]) {
            acc[schedule.version] = [];
        }
        acc[schedule.version].push(schedule);
        return acc;
    }, {} as Record<number, Schedule[]>);

    // Calculate coverage percentage for each version
    const getCoveragePercentage = (schedules: Schedule[]) => {
        const totalShifts = schedules.length;
        const filledShifts = schedules.filter(s => !s.is_empty).length;
        return totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0;
    };

    // Get the status badge color
    const getStatusBadge = (status: Schedule['status']) => {
        switch (status) {
            case 'draft':
                return <Badge variant="secondary">Draft</Badge>;
            case 'published':
                return <Badge variant="default">Published</Badge>;
            case 'archived':
                return <Badge variant="outline">Archived</Badge>;
            default:
                return null;
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Schedule Versions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {versions.map((version) => {
                        const versionSchedules = schedulesByVersion[version] || [];
                        const coverage = getCoveragePercentage(versionSchedules);
                        const status = versionSchedules[0]?.status || 'DRAFT';
                        const dateRange = versionSchedules.reduce(
                            (acc, schedule) => {
                                const date = new Date(schedule.date);
                                if (!acc.start || date < acc.start) acc.start = date;
                                if (!acc.end || date > acc.end) acc.end = date;
                                return acc;
                            },
                            { start: null as Date | null, end: null as Date | null }
                        );

                        return (
                            <div
                                key={version}
                                className="flex items-center justify-between p-4 border rounded-lg"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-medium">Version {version}</h3>
                                        {getStatusBadge(status)}
                                    </div>
                                    {dateRange.start && dateRange.end && (
                                        <p className="text-sm text-muted-foreground">
                                            {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
                                        </p>
                                    )}
                                    <p className="text-sm">Coverage: {coverage}%</p>
                                </div>
                                <div className="flex gap-2">
                                    {status === 'DRAFT' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onPublish(version)}
                                        >
                                            <Check className="w-4 h-4 mr-1" />
                                            Publish
                                        </Button>
                                    )}
                                    {status === 'published' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onArchive(version)}
                                        >
                                            <Lock className="w-4 h-4 mr-1" />
                                            Archive
                                        </Button>
                                    )}
                                    {status === 'DRAFT' && (
                                        <Button variant="ghost" size="sm">
                                            <Pencil className="w-4 h-4 mr-1" />
                                            Edit
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
} 