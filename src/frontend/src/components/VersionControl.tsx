import React from 'react';
import { format } from 'date-fns';
import { VersionMeta } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Check, Archive, Plus, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { DateRange } from 'react-day-picker';

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
    isLoading?: boolean;
    hasError?: boolean;
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
    isLoading = false,
    hasError = false
}: VersionControlProps) {
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

    return (
        <Card className="mb-4">
            <CardHeader className="py-4">
                <CardTitle className="text-lg flex items-center">
                    Schedule Version Control
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="flex flex-col space-y-4">
                    {/* Version info and status */}
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
                                                    <span>Version {v}</span>
                                                    {versionStatuses[v] && getStatusBadge(versionStatuses[v])}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <div className="text-sm text-muted-foreground mb-1">Status</div>
                            <div className="h-10 px-3 py-2 rounded-md border border-input flex items-center">
                                {currentStatus ? (
                                    <div className="flex items-center">
                                        <span>Current status: </span>
                                        {getStatusBadge(currentStatus)}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">No version selected</span>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="text-sm text-muted-foreground mb-1">Date Range</div>
                            <div className="h-10 px-3 py-2 rounded-md border border-input flex items-center">
                                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                                <span>{formatDateRange()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Version details */}
                    {versionMeta && (
                        <div className="bg-muted/50 p-3 rounded text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div>
                                    <span className="text-muted-foreground">Created:</span> {new Date(versionMeta.created_at).toLocaleString()}
                                </div>
                                {versionMeta.updated_at && (
                                    <div>
                                        <span className="text-muted-foreground">Updated:</span> {new Date(versionMeta.updated_at).toLocaleString()}
                                    </div>
                                )}
                                {versionMeta.base_version && (
                                    <div>
                                        <span className="text-muted-foreground">Based on:</span> Version {versionMeta.base_version}
                                    </div>
                                )}
                                {versionMeta.notes && (
                                    <div className="col-span-full">
                                        <span className="text-muted-foreground">Notes:</span> {versionMeta.notes}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Version status alert/info */}
                    {currentStatus && (
                        <Alert variant={
                            currentStatus === 'DRAFT' ? 'default' :
                                currentStatus === 'PUBLISHED' ? 'default' :
                                    'default'
                        }>
                            <AlertTitle className="flex items-center">
                                {currentStatus === 'DRAFT' && <AlertCircle className="h-4 w-4 mr-2" />}
                                {currentStatus === 'PUBLISHED' && <Check className="h-4 w-4 mr-2" />}
                                {currentStatus === 'ARCHIVED' && <Archive className="h-4 w-4 mr-2" />}
                                {currentStatus === 'DRAFT' && 'Draft Mode'}
                                {currentStatus === 'PUBLISHED' && 'Published Version'}
                                {currentStatus === 'ARCHIVED' && 'Archived Version'}
                            </AlertTitle>
                            <AlertDescription>
                                {currentStatus === 'DRAFT' && 'This version is in draft mode and can be modified. Publish when ready.'}
                                {currentStatus === 'PUBLISHED' && 'This version is published and cannot be modified. Create a new version to make changes.'}
                                {currentStatus === 'ARCHIVED' && 'This version is archived for historical reference and cannot be modified.'}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Error message when version metadata is unavailable */}
                    {hasError && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            <AlertTitle>Version Management Error</AlertTitle>
                            <AlertDescription>
                                There was an error accessing the version metadata.
                                Please run the database migration script to create necessary tables.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={onCreateNewVersion}
                            disabled={isLoading}
                            className="flex items-center"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Version
                        </Button>

                        {currentVersion && (
                            <>
                                <Button
                                    onClick={() => onPublishVersion(currentVersion)}
                                    disabled={isLoading || !canPublish}
                                    variant={canPublish ? "default" : "outline"}
                                    className="flex items-center"
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    Publish
                                </Button>

                                <Button
                                    onClick={() => onArchiveVersion(currentVersion)}
                                    disabled={isLoading || !canArchive}
                                    variant={canArchive ? "secondary" : "outline"}
                                    className="flex items-center"
                                >
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 