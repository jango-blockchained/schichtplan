/**
 * Refactored Version Table Component
 * 
 * A clean, focused component for displaying version information in a table format.
 * This component is purely presentational and delegates all actions to parent components.
 */

import { differenceInDays, format } from "date-fns";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  Trash,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { VersionMeta } from "@/services/api";

interface VersionTableProps {
  versions: VersionMeta[];
  selectedVersion?: number;
  onSelectVersion: (version: number) => void;
  onPublishVersion: (version: number) => void;
  onArchiveVersion: (version: number) => void;
  onDeleteVersion: (version: number) => void;
  onDuplicateVersion?: (version: number) => void;
  isLoading?: boolean;
  className?: string;
  showPagination?: boolean;
  initialPageSize?: number;
  isCollapsible?: boolean;
  initiallyOpen?: boolean;
}

export function VersionTable({
  versions,
  selectedVersion,
  onSelectVersion,
  onPublishVersion,
  onArchiveVersion,
  onDeleteVersion,
  onDuplicateVersion,
  isLoading = false,
  className = "",
  showPagination = true,
  initialPageSize = 10,
  isCollapsible = false,
  initiallyOpen = true,
}: VersionTableProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialPageSize);
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  // Early return for empty state
  if (!versions || versions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="text-center text-muted-foreground py-8">
            <div className="text-lg font-medium mb-2">Keine Versionen vorhanden</div>
            <div className="text-sm">
              Erstellen Sie eine neue Version, um zu beginnen.
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // Sort versions by version number (descending - newest first)
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  // Pagination calculations
  const totalPages = showPagination ? Math.ceil(sortedVersions.length / itemsPerPage) : 1;
  const indexOfLastItem = showPagination ? currentPage * itemsPerPage : sortedVersions.length;
  const indexOfFirstItem = showPagination ? indexOfLastItem - itemsPerPage : 0;
  const currentItems = sortedVersions.slice(indexOfFirstItem, indexOfLastItem);

  // Utility functions
  const getWeekCount = (startDate: string, endDate: string): number => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dayDiff = differenceInDays(end, start);
      return Math.ceil((dayDiff + 1) / 7);
    } catch {
      return 1;
    }
  };

  // Helper function to get status badge (matching Action Dock style)
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return (
          <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
            draft
          </Badge>
        );
      case "PUBLISHED":
        return (
          <Badge variant="outline" className="text-xs bg-green-500/20 text-green-300 border-green-500/30">
            published
          </Badge>
        );
      case "ARCHIVED":
        return (
          <Badge variant="outline" className="text-xs bg-gray-500/20 text-gray-300 border-gray-500/30">
            archived
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status.toLowerCase()}
          </Badge>
        );
    }
  };

  const isVersionNew = (createdAt: string): boolean => {
    return new Date(createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000);
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  // Render pagination items
  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => handlePageChange(i)}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            onClick={() => handlePageChange(1)}
            isActive={currentPage === 1}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Show ellipsis if needed
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => handlePageChange(i)}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      // Show ellipsis if needed
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show last page
      if (totalPages > 1) {
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink
              onClick={() => handlePageChange(totalPages)}
              isActive={currentPage === totalPages}
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    return items;
  };

  // Render version actions
  const renderVersionActions = (version: VersionMeta) => {
    return (
      <div className="flex items-center gap-1">
        {/* Publish button for draft versions */}
        {version.status === "DRAFT" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPublishVersion(version.version)}
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                  disabled={isLoading}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Version veröffentlichen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Archive button for published versions */}
        {version.status === "PUBLISHED" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onArchiveVersion(version.version)}
                  className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  disabled={isLoading}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Version archivieren</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Duplicate button */}
        {onDuplicateVersion && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDuplicateVersion(version.version)}
                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  disabled={isLoading}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Version duplizieren</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Delete button for draft versions */}
        {version.status === "DRAFT" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteVersion(version.version)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={isLoading}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Version löschen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  // Main table content
  const tableContent = (
    <>
      <div className="border border-border rounded-lg m-4">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border">
              <TableHead className="font-medium">Version</TableHead>
              <TableHead className="font-medium">Zeitraum</TableHead>
              <TableHead className="font-medium">Status</TableHead>
              <TableHead className="font-medium">Notizen</TableHead>
              <TableHead className="font-medium">Wochen</TableHead>
              <TableHead className="font-medium">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.map((version) => {
              const isSelected = selectedVersion === version.version;
              const isNew = version.created_at && isVersionNew(version.created_at);

              return (
                <TableRow
                  key={version.version}
                  className={`${isSelected
                      ? "bg-primary/10 border-primary/20"
                      : "hover:bg-muted/30"
                    } ${isNew ? "bg-green-500/10 border-green-500/20" : ""
                    } border-b border-border`}
                >
                  <TableCell className="font-medium">
                    <Button
                      variant={isSelected ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => onSelectVersion(version.version)}
                      className={
                        isSelected
                          ? "bg-primary/20 hover:bg-primary/30"
                          : ""
                      }
                      disabled={isLoading}
                    >
                      <Badge variant="secondary" className="text-xs font-mono">
                        v{version.version}
                      </Badge>
                      {isNew && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-xs bg-green-100 text-green-800 border-green-300"
                        >
                          Neu
                        </Badge>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    {format(new Date(version.date_range.start), "dd.MM.yyyy")} -{" "}
                    {format(new Date(version.date_range.end), "dd.MM.yyyy")}
                  </TableCell>
                  <TableCell>{getStatusBadge(version.status)}</TableCell>
                  <TableCell className="max-w-[200px]">
                    {version.notes ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center cursor-help">
                              <span className="truncate text-sm">
                                {version.notes}
                              </span>
                              <Info className="h-3 w-3 ml-1 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-[300px] whitespace-normal">
                              {version.notes}
                            </p>
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
                    {getWeekCount(
                      version.date_range.start,
                      version.date_range.end
                    )}
                  </TableCell>
                  <TableCell>{renderVersionActions(version)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Pagination */}
        {showPagination && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Zeige</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={handleItemsPerPageChange}
              >
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue placeholder={itemsPerPage.toString()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">pro Seite</span>
            </div>

            <div className="flex items-center">
              <span className="text-sm text-muted-foreground mr-4">
                Seite {currentPage} von {totalPages} ({sortedVersions.length}{" "}
                Versionen)
              </span>

              <Pagination>
                <PaginationContent>
                  {currentPage > 1 && (
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => handlePageChange(currentPage - 1)}
                        className="hover:bg-muted/50"
                      />
                    </PaginationItem>
                  )}

                  {renderPaginationItems()}

                  {currentPage < totalPages && (
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => handlePageChange(currentPage + 1)}
                        className="hover:bg-muted/50"
                      />
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // Render with or without collapsible wrapper
  if (isCollapsible) {
    return (
      <Card className={className}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 p-0 hover:bg-muted/50"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="text-lg font-semibold">
                  Versionen ({versions.length})
                </span>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-0">{tableContent}</CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-0">{tableContent}</CardContent>
    </Card>
  );
}

// Export for compatibility
