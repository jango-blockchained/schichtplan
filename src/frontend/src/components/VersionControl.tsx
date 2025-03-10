import React, { useState } from 'react';
import { format } from 'date-fns';
import { VersionMeta } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Check, Archive, Plus, ChevronDown, ChevronUp, Clock, Calendar, Copy, Pencil, RefreshCw, FileText, Lock } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { DateRange } from 'react-day-picker';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Schedule } from '@/types';

interface VersionControlProps {
    versions: number[];
    versionStatuses: Record<number, string>;
    currentVersion?: number;
    versionMeta?: VersionMeta;
    dateRange?: DateRange;
    onVersionChange: (version: number) => void;
    onCreateNewVersion: () => void;
    onPublishVersion: (version: number) => void;
    onArchiveVersion: (version: number) => void;
    onDuplicateVersion?: (version: number) => void;
    isLoading?: boolean;
    hasError?: boolean;
    schedules?: Schedule[];
}

export function VersionControl({
    versions,
    versionStatuses,
    currentVersion,
    versionMeta,
    dateRange,
    onVersionChange,
    onCreateNewVersion,
    onPublishVersion,
    onArchiveVersion,
    onDuplicateVersion,
    isLoading = false,
    hasError = false,
    schedules = []
}: VersionControlProps) {
    const [isVersionsOpen, setIsVersionsOpen] = useState(true);
    const [selectedTab, setSelectedTab] = useState('selection');

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            'DRAFT': 'default',
            'PUBLISHED': 'success',
            'ARCHIVED': 'secondary'
        };

        const icons: Record<string, React.ReactNode> = {
            'DRAFT': <AlertCircle className="h-3 w-3 mr-1" />,
            'PUBLISHED': <Check className="h-3 w-3 mr-1" />,
            'ARCHIVED': <Archive className="h-3 w-3 mr-1" />
        };

        return (
            <Badge variant={variants[status] as any} className="ml-2 flex items-center">
                {icons[status]}
                {status}
            </Badge>
        );
    };

    const formatDateRange = () => {
        if (!dateRange?.from || !dateRange?.to) return 'No date range selected';
        return `${format(dateRange.from, 'dd.MM.yyyy')} - ${format(dateRange.to, 'dd.MM.yyyy')}`;
    };

    const currentStatus = currentVersion ? versionStatuses[currentVersion] : undefined;

    const canPublish = currentStatus === 'DRAFT';
    const canArchive = currentStatus === 'DRAFT' || currentStatus === 'PUBLISHED';

    // Group schedules by version
    const schedulesByVersion = schedules.reduce((acc, schedule) => {
        if (!acc[schedule.version]) {
            acc[schedule.version] = [];
        }
        acc[schedule.version].push(schedule);
        return acc;
    }, {} as Record<number, Schedule[]>);

    // Calculate coverage percentage for each version
    const getCoveragePercentage = (version: number) => {
        const versionSchedules = schedulesByVersion[version] || [];
        const totalShifts = versionSchedules.length;
        const filledShifts = versionSchedules.filter(s => !s.is_empty).length;
        return totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0;
    };

    return (
        <Card className="mb-4">
            <CardHeader className="py-4">
                <CardTitle className="text-lg flex items-center justify-between">
                    <span>Schedule Version Control</span>
                    {currentVersion && (
                        <Badge variant="outline" className="ml-2">
                            Current: Version {currentVersion} {getStatusBadge(versionStatuses[currentVersion] || 'DRAFT')}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                    <TabsList className="grid grid-cols-3 mb-4">
                        <TabsTrigger value="selection">Selection</TabsTrigger>
                        <TabsTrigger value="versions">Versions</TabsTrigger>
                        <TabsTrigger value="actions">Actions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="selection" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Version</div>
                                <div className="flex items-center">
                                    <Select
                                        value={currentVersion?.toString() || ''}
                                        onValueChange={(value) => onVersionChange(Number(value))}
                                        disabled={isLoading || versions.length === 0}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select version" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {versions.map(v => (
                                                <SelectItem key={v} value={v.toString()} className="flex items-center">
                                                    <div className="flex items-center justify-between w-full">
                                                        <span>Version {v}{v === Math.max(...versions) ? " (Latest)" : ""}</span>
                                                        {versionStatuses[v] && getStatusBadge(versionStatuses[v])}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Date Range</div>
                                <div className="text-sm p-2 border rounded-md bg-muted/50">
                                    <Calendar className="h-4 w-4 inline-block mr-1" />
                                    {formatDateRange()}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Coverage</div>
                                {currentVersion && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>{getCoveragePercentage(currentVersion)}%</span>
                                        </div>
                                        <Progress value={getCoveragePercentage(currentVersion)} className="h-2" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex space-x-2 mt-4">
                            <Button
                                variant="default"
                                size="sm"
                                onClick={onCreateNewVersion}
                                disabled={isLoading}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                New Version
                            </Button>

                            {canPublish && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => currentVersion && onPublishVersion(currentVersion)}
                                    disabled={isLoading || !currentVersion}
                                >
                                    <Check className="h-4 w-4 mr-1" />
                                    Publish
                                </Button>
                            )}

                            {canArchive && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => currentVersion && onArchiveVersion(currentVersion)}
                                    disabled={isLoading || !currentVersion}
                                >
                                    <Archive className="h-4 w-4 mr-1" />
                                    Archive
                                </Button>
                            )}

                            {onDuplicateVersion && currentVersion && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDuplicateVersion(currentVersion)}
                                    disabled={isLoading || !currentVersion}
                                >
                                    <Copy className="h-4 w-4 mr-1" />
                                    Duplicate
                                </Button>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="versions">
                        <div className="space-y-4">
                            {versions.map((version) => {
                                const coverage = getCoveragePercentage(version);
                                const status = versionStatuses[version] || 'DRAFT';

                                return (
                                    <div
                                        key={version}
                                        className={`flex items-center justify-between p-4 border rounded-lg ${currentVersion === version ? 'border-primary' : ''}`}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-medium">Version {version}</h3>
                                                {getStatusBadge(status)}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Coverage: {coverage}%
                                                <Progress value={coverage} className="h-2 mt-1" />
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onVersionChange(version)}
                                            >
                                                {currentVersion === version ? 'Current' : 'Select'}
                                            </Button>

                                            {status === 'DRAFT' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onPublishVersion(version)}
                                                >
                                                    <Check className="w-4 h-4 mr-1" />
                                                    Publish
                                                </Button>
                                            )}

                                            {status === 'PUBLISHED' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onArchiveVersion(version)}
                                                >
                                                    <Lock className="w-4 h-4 mr-1" />
                                                    Archive
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </TabsContent>

                    <TabsContent value="actions">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-md">Version Management</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <Button
                                        className="w-full justify-start"
                                        variant="outline"
                                        size="sm"
                                        onClick={onCreateNewVersion}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create New Version
                                    </Button>

                                    {onDuplicateVersion && currentVersion && (
                                        <Button
                                            className="w-full justify-start"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onDuplicateVersion(currentVersion)}
                                            disabled={!currentVersion}
                                        >
                                            <Copy className="h-4 w-4 mr-2" />
                                            Duplicate Current Version
                                        </Button>
                                    )}

                                    {currentVersion && (
                                        <Button
                                            className="w-full justify-start"
                                            variant="outline"
                                            size="sm"
                                            disabled={!canPublish}
                                        >
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Regenerate Schedule
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-md">Version Status</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {currentVersion && canPublish && (
                                        <Button
                                            className="w-full justify-start"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onPublishVersion(currentVersion)}
                                        >
                                            <Check className="h-4 w-4 mr-2" />
                                            Publish Version
                                        </Button>
                                    )}

                                    {currentVersion && canArchive && (
                                        <Button
                                            className="w-full justify-start"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onArchiveVersion(currentVersion)}
                                        >
                                            <Archive className="h-4 w-4 mr-2" />
                                            Archive Version
                                        </Button>
                                    )}

                                    {currentVersion && (
                                        <Button
                                            className="w-full justify-start"
                                            variant="outline"
                                            size="sm"
                                        >
                                            <FileText className="h-4 w-4 mr-2" />
                                            Edit Version Notes
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                {hasError && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                            There was an error loading or updating the schedule. Please try again.
                            <div className="mt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.location.reload()}
                                >
                                    Refresh Page
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
} 