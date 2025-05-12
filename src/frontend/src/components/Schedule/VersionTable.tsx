import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { differenceInDays } from 'date-fns';
import { Check, Archive, Pencil, Calendar, Trash, Copy, Plus, Info } from 'lucide-react';
import { VersionMeta } from '@/services/api';
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger, 
} from '@/components/ui/tooltip';

interface VersionTableProps {
    versions: VersionMeta[];
    selectedVersion?: number;
    onSelectVersion: (version: number) => void;
    onPublishVersion: (version: number) => void;
    onArchiveVersion: (version: number) => void;
    onDeleteVersion: (version: number) => void;
    onDuplicateVersion?: (version: number) => void;
    onCreateNewVersion?: () => void;
}

export function VersionTable({
    versions,
    selectedVersion,
    onSelectVersion,
    onPublishVersion,
    onArchiveVersion,
    onDeleteVersion,
    onDuplicateVersion,
    onCreateNewVersion
}: VersionTableProps) {
    if (!versions || versions.length === 0) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Versionen</CardTitle>
                    {onCreateNewVersion && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onCreateNewVersion}
                            className="ml-auto"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Neue Version
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-4">
                        Keine Versionen vorhanden
                    </div>
                </CardContent>
            </Card>
        );
    }

    const getWeekCount = (startDate: string, endDate: string) => {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const dayDiff = differenceInDays(end, start);
            return Math.ceil((dayDiff + 1) / 7);
        } catch (error) {
            return 1;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT':
                return <Badge variant="outline" className="bg-blue-50"><Pencil className="w-3 h-3 mr-1" /> Entwurf</Badge>;
            case 'PUBLISHED':
                return <Badge variant="outline" className="bg-green-50"><Check className="w-3 h-3 mr-1" /> Veröffentlicht</Badge>;
            case 'ARCHIVED':
                return <Badge variant="outline" className="bg-gray-50"><Archive className="w-3 h-3 mr-1" /> Archiviert</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };
    
    // Sort versions by version number descending
    const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

    // Check if a version was created recently (within the last 5 minutes)
    const isNewlyCreated = (createdAt: string | null) => {
        if (!createdAt) return false;
        const created = new Date(createdAt);
        const now = new Date();
        const diffInMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
        return diffInMinutes < 5;
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Versions-Tabelle
                </CardTitle>
                {onCreateNewVersion && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onCreateNewVersion}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Neue Version
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Version</TableHead>
                            <TableHead>Zeitraum</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Notizen</TableHead>
                            <TableHead>Wochen</TableHead>
                            <TableHead>Aktionen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedVersions.map((version) => {
                            const isSelected = selectedVersion === version.version;
                            const isNew = isNewlyCreated(version.created_at);
                            
                            return (
                                <TableRow
                                    key={version.version}
                                    className={`${isSelected ? "bg-muted/50" : ""} ${isNew ? "bg-blue-50/30" : ""}`}
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant={isSelected ? "default" : "ghost"}
                                                size="sm"
                                                onClick={() => onSelectVersion(version.version)}
                                            >
                                                V{version.version}
                                            </Button>
                                            {isNew && (
                                                <Badge variant="default" className="bg-blue-500">Neu</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {format(new Date(version.date_range.start), 'dd.MM.yyyy')} - {format(new Date(version.date_range.end), 'dd.MM.yyyy')}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(version.status)}</TableCell>
                                    <TableCell className="max-w-[200px]">
                                        {version.notes ? (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center cursor-help">
                                                            <span className="truncate text-sm">{version.notes}</span>
                                                            <Info className="h-3 w-3 ml-1 text-muted-foreground" />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="max-w-[300px] whitespace-normal">{version.notes}</p>
                                                        {version.base_version && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                Basiert auf Version {version.base_version}
                                                            </p>
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : version.base_version ? (
                                            <span className="text-sm text-muted-foreground">
                                                Basiert auf V{version.base_version}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {getWeekCount(version.date_range.start, version.date_range.end)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {version.status === 'DRAFT' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onPublishVersion(version.version)}
                                                    title="Veröffentlichen"
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {version.status !== 'ARCHIVED' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onArchiveVersion(version.version)}
                                                    title="Archivieren"
                                                >
                                                    <Archive className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {onDuplicateVersion && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onDuplicateVersion(version.version)}
                                                    title="Duplizieren"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onDeleteVersion(version.version)}
                                                title="Löschen"
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
} 