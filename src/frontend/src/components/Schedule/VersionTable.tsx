import React, { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";
import {
  Check,
  Archive,
  Pencil,
  Calendar,
  Trash,
  Copy,
  Plus,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { VersionMeta } from "@/services/api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  onCreateNewVersion,
}: VersionTableProps) {
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [isOpen, setIsOpen] = useState(true);

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
      case "DRAFT":
        return (
          <Badge variant="outline" className="bg-blue-50">
            <Pencil className="w-3 h-3 mr-1" /> Entwurf
          </Badge>
        );
      case "PUBLISHED":
        return (
          <Badge variant="outline" className="bg-green-50">
            <Check className="w-3 h-3 mr-1" /> Veröffentlicht
          </Badge>
        );
      case "ARCHIVED":
        return (
          <Badge variant="outline" className="bg-gray-50">
            <Archive className="w-3 h-3 mr-1" /> Archiviert
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Sort versions by version number descending
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  // Pagination calculations
  const totalPages = Math.ceil(sortedVersions.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedVersions.slice(indexOfFirstItem, indexOfLastItem);

  // Pagination change handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Generate pagination items
  const getPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => handlePageChange(i)}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>,
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
        </PaginationItem>,
      );

      // Show ellipsis if needed
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>,
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
          </PaginationItem>,
        );
      }

      // Show ellipsis if needed
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>,
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
          </PaginationItem>,
        );
      }
    }

    return items;
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 p-0 hover:bg-muted/50">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <CardTitle className="text-lg font-semibold">Versionen ({versions.length})</CardTitle>
            </Button>
          </CollapsibleTrigger>
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
        <CollapsibleContent>
          <CardContent className="p-0">
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
                    const isNew =
                      version.created_at &&
                      new Date(version.created_at) >
                        new Date(Date.now() - 24 * 60 * 60 * 1000);

                    return (
                      <TableRow
                        key={version.version}
                        className={`${isSelected ? "bg-primary/10 border-primary/20" : "hover:bg-muted/30"} ${isNew ? "bg-green-500/10 border-green-500/20" : ""} border-b border-border`}
                      >
                        <TableCell className="font-medium">
                          <Button
                            variant={isSelected ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => {
                              console.log(
                                `🎯 VersionTable: User clicked to select version ${version.version}`,
                              );
                              onSelectVersion(version.version);
                            }}
                            className={isSelected ? "bg-primary/20 hover:bg-primary/30" : ""}
                          >
                            {version.version}
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
                            version.date_range.end,
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {version.status === "DRAFT" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onPublishVersion(version.version)}
                                      className="h-8 w-8 p-0"
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

                            {version.status === "PUBLISHED" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onArchiveVersion(version.version)}
                                      className="h-8 w-8 p-0"
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

                            {onDuplicateVersion && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onDuplicateVersion(version.version)}
                                      className="h-8 w-8 p-0"
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

                            {version.status === "DRAFT" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onDeleteVersion(version.version)}
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

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

                      {getPaginationItems()}

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
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
