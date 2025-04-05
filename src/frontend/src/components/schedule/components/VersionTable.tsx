import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { differenceInDays } from 'date-fns';
import { Check, Archive, Pencil, Calendar, Trash, Copy } from 'lucide-react';
import { VersionMeta } from '@/services/api';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

interface VersionTableProps {
    versions: VersionMeta[];
    selectedVersion?: number;
    onSelectVersion: (version: number) => void;
    onPublishVersion: (version: number) => void;
    onArchiveVersion: (version: number) => void;
    onDeleteVersion: (version: number) => void;
    onDuplicateVersion?: (version: number) => void;
}

export function VersionTable({
    versions,
    selectedVersion,
    onSelectVersion,
    onPublishVersion,
    onArchiveVersion,
    onDeleteVersion,
    onDuplicateVersion
}: VersionTableProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10; // Show 10 versions per page
    
    // Calculate pagination details
    const totalPages = Math.ceil(versions.length / itemsPerPage);
    const paginatedVersions = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return versions.slice(startIndex, endIndex);
    }, [versions, currentPage, itemsPerPage]);

    // Handle page changes
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    // Show previous/next page
    const goToPreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    if (!versions || versions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Versionen</CardTitle>
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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Versions-Tabelle
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Seite {currentPage} von {totalPages}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Version</TableHead>
                            <TableHead>Zeitraum</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Wochen</TableHead>
                            <TableHead>Aktionen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedVersions.map((version) => (
                            <TableRow
                                key={version.version}
                                className={selectedVersion === version.version ? "bg-muted/50" : ""}
                            >
                                <TableCell>
                                    <Button
                                        variant={selectedVersion === version.version ? "default" : "ghost"}
                                        size="sm"
                                        onClick={() => onSelectVersion(version.version)}
                                    >
                                        V{version.version}
                                    </Button>
                                </TableCell>
                                <TableCell>
                                    {format(new Date(version.date_range.start), 'dd.MM.yyyy')} - {format(new Date(version.date_range.end), 'dd.MM.yyyy')}
                                </TableCell>
                                <TableCell>{getStatusBadge(version.status)}</TableCell>
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
                        ))}
                    </TableBody>
                </Table>
                
                {versions.length > itemsPerPage && (
                    <div className="mt-4 flex justify-center">
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious 
                                        onClick={goToPreviousPage} 
                                        className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                                    />
                                </PaginationItem>
                                
                                {Array.from({length: Math.min(totalPages, 5)}, (_, i) => {
                                    // Show pages 1, 2, currentPage-1, currentPage, currentPage+1, last-1, last
                                    let pageToShow = i + 1;
                                    
                                    if (totalPages > 5) {
                                        if (currentPage <= 3) {
                                            // First 3 pages
                                            if (i < 3) {
                                                pageToShow = i + 1;
                                            } else if (i === 3) {
                                                return (
                                                    <PaginationItem key="ellipsis1">
                                                        <PaginationEllipsis />
                                                    </PaginationItem>
                                                );
                                            } else {
                                                pageToShow = totalPages;
                                            }
                                        } else if (currentPage >= totalPages - 2) {
                                            // Last 3 pages
                                            if (i === 0) {
                                                pageToShow = 1;
                                            } else if (i === 1) {
                                                return (
                                                    <PaginationItem key="ellipsis2">
                                                        <PaginationEllipsis />
                                                    </PaginationItem>
                                                );
                                            } else {
                                                pageToShow = totalPages - (4 - i);
                                            }
                                        } else {
                                            // Middle pages
                                            if (i === 0) {
                                                pageToShow = 1;
                                            } else if (i === 1) {
                                                return (
                                                    <PaginationItem key="ellipsis3">
                                                        <PaginationEllipsis />
                                                    </PaginationItem>
                                                );
                                            } else if (i === 3) {
                                                return (
                                                    <PaginationItem key="ellipsis4">
                                                        <PaginationEllipsis />
                                                    </PaginationItem>
                                                );
                                            } else if (i === 4) {
                                                pageToShow = totalPages;
                                            } else {
                                                pageToShow = currentPage;
                                            }
                                        }
                                    }
                                    
                                    return (
                                        <PaginationItem key={pageToShow}>
                                            <PaginationLink 
                                                onClick={() => handlePageChange(pageToShow)} 
                                                isActive={currentPage === pageToShow}
                                            >
                                                {pageToShow}
                                            </PaginationLink>
                                        </PaginationItem>
                                    );
                                })}
                                
                                <PaginationItem>
                                    <PaginationNext 
                                        onClick={goToNextPage}
                                        className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}
            </CardContent>
        </Card>
    );
} 