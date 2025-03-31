import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Schedule } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Lock, Pencil, Archive } from 'lucide-react';
import { VersionTable } from '@/components/schedule/components/VersionTable';

interface VersionsViewProps {
    schedules: Schedule[];
    onPublish: (version: number) => Promise<void>;
    onArchive: (version: number) => Promise<void>;
}

interface VersionGroup {
    version: number;
    startDate: Date;
    endDate: Date;
    status: string;
    coverage: number;
    totalShifts: number;
    filledShifts: number;
}

export function VersionsView({ schedules, onPublish, onArchive }: VersionsViewProps) {
    const versionGroups = useMemo(() => {
        const groups = new Map<number, VersionGroup>();

        schedules.forEach(schedule => {
            if (!groups.has(schedule.version)) {
                groups.set(schedule.version, {
                    version: schedule.version,
                    startDate: new Date(schedule.date),
                    endDate: new Date(schedule.date),
                    status: schedule.status,
                    coverage: 0,
                    totalShifts: 0,
                    filledShifts: 0,
                });
            }

            const group = groups.get(schedule.version)!;
            const scheduleDate = new Date(schedule.date);

            // Update date range
            if (scheduleDate < group.startDate) group.startDate = scheduleDate;
            if (scheduleDate > group.endDate) group.endDate = scheduleDate;

            // Update coverage statistics
            group.totalShifts++;
            if (!schedule.is_empty) group.filledShifts++;
            group.coverage = (group.filledShifts / group.totalShifts) * 100;
        });

        return Array.from(groups.values()).sort((a, b) => b.version - a.version);
    }, [schedules]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return <Badge variant="outline" className="bg-blue-50"><Pencil className="w-3 h-3 mr-1" /> Draft</Badge>;
            case 'published':
                return <Badge variant="outline" className="bg-green-50"><Lock className="w-3 h-3 mr-1" /> Published</Badge>;
            case 'archived':
                return <Badge variant="outline" className="bg-gray-50"><Archive className="w-3 h-3 mr-1" /> Archived</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Schedule Versions</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Version</TableHead>
                            <TableHead>Date Range</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Coverage</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {versionGroups.map((group) => (
                            <TableRow key={group.version}>
                                <TableCell>V{group.version}</TableCell>
                                <TableCell>
                                    {format(group.startDate, 'dd.MM.yyyy')} - {format(group.endDate, 'dd.MM.yyyy')}
                                </TableCell>
                                <TableCell>{getStatusBadge(group.status)}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 transition-all"
                                                style={{ width: `${group.coverage}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            {group.coverage.toFixed(1)}%
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {group.status === 'DRAFT' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onPublish(group.version)}
                                        >
                                            Publish
                                        </Button>
                                    )}
                                    {group.status === 'published' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onArchive(group.version)}
                                        >
                                            Archive
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
} 