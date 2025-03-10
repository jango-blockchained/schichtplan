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
import { Separator } from './ui/separator';

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
    onRetry?: () => void;
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
    schedules = [],
    onRetry
}: VersionControlProps) {
    const [selectedTab, setSelectedTab] = useState('selection');

    // Add error handling for missing data
    if (hasError) {
        return (
            <Card className="mb-4">
                <CardHeader className="py-4 border-b">
                    <CardTitle className="text-lg">Versionsverwaltung</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Fehler bei der Versionsverwaltung</AlertTitle>
                        <AlertDescription className="flex flex-col">
                            <div>Es gab ein Problem beim Laden der Versionen. Bitte versuchen Sie es erneut oder überprüfen Sie die Serververbindung.</div>
                            {onRetry && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-4 w-fit"
                                    onClick={onRetry}
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Erneut versuchen
                                </Button>
                            )}
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    // If no versions are available, show a message but not an error
    if (versions.length === 0 && !isLoading) {
        return (
            <Card className="mb-4">
                <CardHeader className="py-4 border-b">
                    <CardTitle className="text-lg">Versionsverwaltung</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Keine Versionen verfügbar</AlertTitle>
                        <AlertDescription className="flex flex-col">
                            <div>Für den ausgewählten Zeitraum sind keine Versionen verfügbar. Bitte erstellen Sie eine neue Version.</div>
                            <Button
                                variant="default"
                                size="sm"
                                className="mt-4 w-fit"
                                onClick={onCreateNewVersion}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Neue Version erstellen
                            </Button>
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    // Add loading state
    if (isLoading) {
        return (
            <Card className="mb-4">
                <CardHeader className="py-4 border-b">
                    <CardTitle className="text-lg">Versionsverwaltung</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex items-center space-x-4">
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <div>Lade Versionen...</div>
                    </div>
                </CardContent>
            </Card>
        );
    }

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
        if (!dateRange?.from || !dateRange?.to) return 'Kein Datumsbereich ausgewählt';
        return `${format(dateRange.from, 'dd.MM.yyyy')} - ${format(dateRange.to, 'dd.MM.yyyy')}`;
    };

    const currentStatus = currentVersion ? versionStatuses[currentVersion] : undefined;

    // Define valid status transitions with proper typing
    const validTransitions: Record<string, readonly string[]> = {
        'DRAFT': ['PUBLISHED', 'ARCHIVED'] as const,
        'PUBLISHED': ['ARCHIVED'] as const,
        'ARCHIVED': [] as const
    } as const;

    // Check if a status transition is valid
    const isValidTransition = (fromStatus: string, toStatus: string): boolean => {
        return (validTransitions[fromStatus] || []).includes(toStatus);
    };

    const canPublish = currentStatus === 'DRAFT';
    const canArchive = currentStatus && isValidTransition(currentStatus, 'ARCHIVED');

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
            <CardHeader className="py-4 border-b">
                <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span>Versionsverwaltung</span>
                        {currentVersion && (
                            <Badge variant="outline" className="ml-2 text-sm">
                                Version {currentVersion} {getStatusBadge(versionStatuses[currentVersion] || 'DRAFT')}
                            </Badge>
                        )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {formatDateRange()}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <div className="text-sm font-medium">Version</div>
                            <Select
                                value={currentVersion?.toString() || ''}
                                onValueChange={(value) => onVersionChange(Number(value))}
                                disabled={isLoading || versions.length === 0}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Version auswählen" />
                                </SelectTrigger>
                                <SelectContent>
                                    {versions.length === 0 ? (
                                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                            Keine Versionen verfügbar
                                        </div>
                                    ) : (
                                        versions.map(v => (
                                            <SelectItem key={v} value={v.toString()} className="flex items-center">
                                                <div className="flex items-center justify-between w-full">
                                                    <span>Version {v}{v === Math.max(...versions) ? " (Neueste)" : ""}</span>
                                                    {versionStatuses[v] && getStatusBadge(versionStatuses[v])}
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {currentVersion && (
                            <div className="space-y-2">
                                <div className="text-sm font-medium">Abdeckung</div>
                                <div className="flex items-center gap-4">
                                    <Progress value={getCoveragePercentage(currentVersion)} className="flex-1 h-2" />
                                    <span className="text-sm font-medium w-12 text-right">
                                        {getCoveragePercentage(currentVersion)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator className="my-6" />

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            variant="default"
                            size="sm"
                            onClick={onCreateNewVersion}
                            disabled={isLoading}
                            className="h-9"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Neue Version
                        </Button>

                        {canPublish && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => currentVersion && onPublishVersion(currentVersion)}
                                disabled={isLoading || !currentVersion}
                                className="h-9"
                            >
                                <Check className="h-4 w-4 mr-2" />
                                Veröffentlichen
                            </Button>
                        )}

                        {canArchive && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => currentVersion && onArchiveVersion(currentVersion)}
                                disabled={isLoading || !currentVersion}
                                className="h-9"
                            >
                                <Archive className="h-4 w-4 mr-2" />
                                Archivieren
                            </Button>
                        )}

                        {onDuplicateVersion && currentVersion && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onDuplicateVersion(currentVersion)}
                                disabled={isLoading || !currentVersion}
                                className="h-9"
                            >
                                <Copy className="h-4 w-4 mr-2" />
                                Duplizieren
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 