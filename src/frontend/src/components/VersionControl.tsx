import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { VersionMeta } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Check,
  Archive,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  Copy,
  Pencil,
  RefreshCw,
  FileText,
  Lock,
  Trash,
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { DateRange } from "react-day-picker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Schedule } from "@/types";
import { Separator } from "@/components/ui/separator";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  onDeleteVersion: (version: number) => void;
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
  onDeleteVersion,
  onDuplicateVersion,
  isLoading = false,
  hasError = false,
  schedules = [],
  onRetry,
}: VersionControlProps) {
  const [selectedTab, setSelectedTab] = useState("selection");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Show 5 versions per page

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
              <div>
                Es gab ein Problem beim Laden der Versionen. Bitte versuchen Sie
                es erneut oder überprüfen Sie die Serververbindung.
              </div>
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

  // If no versions are available, show an improved create version view
  if (versions.length === 0 && !isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-lg">Versionsverwaltung</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center p-6 space-y-6">
            <div className="bg-muted/30 p-4 rounded-full">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-medium">Keine Versionen vorhanden</h3>
              <p className="text-muted-foreground">
                Für den ausgewählten Zeitraum{" "}
                {dateRange?.from && dateRange?.to
                  ? `(${format(dateRange.from, "dd.MM.yyyy")} - ${format(dateRange.to, "dd.MM.yyyy")})`
                  : ""}{" "}
                sind noch keine Versionen verfügbar.
              </p>
            </div>
            <Button
              variant="default"
              className="mt-6"
              onClick={onCreateNewVersion}
              disabled={!dateRange?.from || !dateRange?.to}
              title={
                !dateRange?.from || !dateRange?.to
                  ? "Bitte wählen Sie einen Datumsbereich"
                  : undefined
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Erste Version erstellen
            </Button>
            {(!dateRange?.from || !dateRange?.to) && (
              <p className="text-sm text-muted-foreground">
                Bitte wählen Sie einen Datumsbereich aus, um eine Version zu
                erstellen.
              </p>
            )}
          </div>
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
      DRAFT: "default",
      PUBLISHED: "success",
      ARCHIVED: "secondary",
    };

    const icons: Record<string, React.ReactNode> = {
      DRAFT: <AlertCircle className="h-3 w-3 mr-1" />,
      PUBLISHED: <Check className="h-3 w-3 mr-1" />,
      ARCHIVED: <Archive className="h-3 w-3 mr-1" />,
    };

    return (
      <Badge
        variant={variants[status] as any}
        className="ml-2 flex items-center"
      >
        {icons[status]}
        {status}
      </Badge>
    );
  };

  const formatDateRange = () => {
    if (!dateRange?.from || !dateRange?.to)
      return "Kein Datumsbereich ausgewählt";
    return `${format(dateRange.from, "dd.MM.yyyy")} - ${format(dateRange.to, "dd.MM.yyyy")}`;
  };

  const currentStatus = currentVersion
    ? versionStatuses[currentVersion]
    : undefined;

  // Define valid status transitions with proper typing
  const validTransitions: Record<string, readonly string[]> = {
    DRAFT: ["PUBLISHED", "ARCHIVED"] as const,
    PUBLISHED: ["ARCHIVED"] as const,
    ARCHIVED: [] as const,
  } as const;

  // Check if a status transition is valid
  const isValidTransition = (fromStatus: string, toStatus: string): boolean => {
    return (validTransitions[fromStatus] || []).includes(toStatus);
  };

  const canPublish = currentStatus === "DRAFT";
  const canArchive =
    currentStatus && isValidTransition(currentStatus, "ARCHIVED");

  // Group schedules by version
  const schedulesByVersion = schedules.reduce(
    (acc, schedule) => {
      if (!acc[schedule.version]) {
        acc[schedule.version] = [];
      }
      acc[schedule.version].push(schedule);
      return acc;
    },
    {} as Record<number, Schedule[]>,
  );

  // Calculate coverage percentage for each version
  const getCoveragePercentage = (version: number) => {
    const versionSchedules = schedulesByVersion[version] || [];
    const totalShifts = versionSchedules.length;
    const filledShifts = versionSchedules.filter((s) => !s.is_empty).length;
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
                Version {currentVersion}{" "}
                {getStatusBadge(versionStatuses[currentVersion] || "DRAFT")}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateNewVersion}
              disabled={isLoading || !dateRange?.from || !dateRange?.to}
              className="h-8"
              title={
                !dateRange?.from || !dateRange?.to
                  ? "Bitte wählen Sie einen Datumsbereich"
                  : undefined
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Neue Version
            </Button>
            <div className="text-sm text-muted-foreground">
              {formatDateRange()}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <Collapsible defaultOpen={true} className="w-full">
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 font-medium text-sm">
              <div className="flex items-center">
                <span>Versionsauswahl</span>
              </div>
              <div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Version</div>
                  <Select
                    value={currentVersion?.toString() || ""}
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
                        paginatedVersions.map((v) => (
                          <SelectItem
                            key={v}
                            value={v.toString()}
                            className="flex items-center"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>
                                Version {v}
                                {v === Math.max(...versions)
                                  ? " (Neueste)"
                                  : ""}
                              </span>
                              {versionStatuses[v] &&
                                getStatusBadge(versionStatuses[v])}
                            </div>
                          </SelectItem>
                        ))
                      )}

                      {versions.length > 0 && (
                        <div className="p-2 border-t mt-2">
                          <Pagination>
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious
                                  onClick={goToPreviousPage}
                                  className={
                                    currentPage <= 1
                                      ? "pointer-events-none opacity-50"
                                      : ""
                                  }
                                />
                              </PaginationItem>

                              {Array.from(
                                { length: Math.min(totalPages, 5) },
                                (_, i) => {
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
                                        onClick={() =>
                                          handlePageChange(pageToShow)
                                        }
                                        isActive={currentPage === pageToShow}
                                      >
                                        {pageToShow}
                                      </PaginationLink>
                                    </PaginationItem>
                                  );
                                },
                              )}

                              <PaginationItem>
                                <PaginationNext
                                  onClick={goToNextPage}
                                  className={
                                    currentPage >= totalPages
                                      ? "pointer-events-none opacity-50"
                                      : ""
                                  }
                                />
                              </PaginationItem>
                            </PaginationContent>
                          </Pagination>
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {currentVersion && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Abdeckung</div>
                    <div className="flex items-center gap-4">
                      <Progress
                        value={getCoveragePercentage(currentVersion)}
                        className="flex-1 h-2"
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {getCoveragePercentage(currentVersion)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-6" />

          <Collapsible defaultOpen={true} className="w-full">
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 font-medium text-sm">
              <div className="flex items-center">
                <span>Aktionen & Statistik</span>
              </div>
              <div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {canPublish && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        currentVersion && onPublishVersion(currentVersion)
                      }
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
                      onClick={() =>
                        currentVersion && onArchiveVersion(currentVersion)
                      }
                      disabled={isLoading || !currentVersion}
                      className="h-9"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archivieren
                    </Button>
                  )}

                  {currentVersion && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      disabled={isLoading || !currentVersion}
                      className="h-9 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Löschen
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
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Version löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion löscht Version {currentVersion} und alle zugehörigen
              Schichtpläne. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (currentVersion) {
                  onDeleteVersion(currentVersion);
                }
                setIsDeleteDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
