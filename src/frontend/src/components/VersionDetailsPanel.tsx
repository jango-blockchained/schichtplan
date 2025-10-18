/**
 * Version Details Panel Component
 *
 * Displays detailed information about a selected version,
 * including metadata, statistics, and quick actions.
 */

import { format } from "date-fns";
import {
  BarChart3,
  Calendar,
  Check,
  Clock,
  Edit3,
  FileText,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { VersionMeta } from "@/services/api";

interface VersionDetailsPanelProps {
  version?: VersionMeta;
  statistics?: {
    total_schedules: number;
    filled_schedules: number;
    empty_schedules: number;
    coverage_percentage: number;
    unique_employees: number;
    unique_dates: number;
  };
  onUpdateNotes?: (version: number, notes: string) => void;
  onPublish?: (version: number) => void;
  onArchive?: (version: number) => void;
  onDuplicate?: (version: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function VersionDetailsPanel({
  version,
  statistics,
  onUpdateNotes,
  onPublish,
  onArchive,
  onDuplicate,
  isLoading = false,
  className = "",
}: VersionDetailsPanelProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(version?.notes || "");

  // Handle notes editing
  const handleStartEdit = () => {
    setEditedNotes(version?.notes || "");
    setIsEditingNotes(true);
  };

  const handleSaveNotes = () => {
    if (version && onUpdateNotes) {
      onUpdateNotes(version.version, editedNotes);
    }
    setIsEditingNotes(false);
  };

  const handleCancelEdit = () => {
    setEditedNotes(version?.notes || "");
    setIsEditingNotes(false);
  };

  // Early return for no version selected
  if (!version) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <div className="text-lg font-medium mb-2">
            Keine Version ausgewählt
          </div>
          <div className="text-sm">
            Wählen Sie eine Version aus, um Details anzuzeigen.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Helper function to get status badge (matching Action Dock style)
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return (
          <Badge
            variant="outline"
            className="text-xs bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
          >
            draft
          </Badge>
        );
      case "PUBLISHED":
        return (
          <Badge
            variant="outline"
            className="text-xs bg-green-500/20 text-green-300 border-green-500/30"
          >
            published
          </Badge>
        );
      case "ARCHIVED":
        return (
          <Badge
            variant="outline"
            className="text-xs bg-gray-500/20 text-gray-300 border-gray-500/30"
          >
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

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd. MMMM yyyy");
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "dd.MM.yyyy, HH:mm");
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs font-mono">
              v{version.version}
            </Badge>
            {getStatusBadge(version.status)}
          </div>
          <div className="flex items-center gap-2">
            {/* Quick action buttons */}
            {version.status === "DRAFT" && onPublish && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPublish(version.version)}
                      disabled={isLoading}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
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

            {version.status === "PUBLISHED" && onArchive && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onArchive(version.version)}
                      disabled={isLoading}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Version archivieren</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {onDuplicate && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDuplicate(version.version)}
                      disabled={isLoading}
                    >
                      Duplizieren
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Version duplizieren</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Date Range */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Zeitraum
          </div>
          <div className="text-lg">
            {formatDate(version.date_range.start)} -{" "}
            {formatDate(version.date_range.end)}
          </div>
          {version.week_identifier && (
            <div className="text-sm text-muted-foreground">
              Woche: {version.week_identifier}
            </div>
          )}
        </div>

        <Separator />

        {/* Statistics */}
        {statistics && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Statistiken
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Mitarbeiter</div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {statistics.unique_employees}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Tage</div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{statistics.unique_dates}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  Schichten gesamt
                </div>
                <div className="font-medium">{statistics.total_schedules}</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Besetzt</div>
                <div className="font-medium text-green-600">
                  {statistics.filled_schedules}
                </div>
              </div>
            </div>

            {/* Coverage Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Abdeckung</span>
                <span className="font-medium">
                  {statistics.coverage_percentage.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={statistics.coverage_percentage}
                className="h-2"
              />
            </div>
          </div>
        )}

        <Separator />

        {/* Notes Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Notizen
            </div>
            {onUpdateNotes && !isEditingNotes && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                disabled={isLoading}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {isEditingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Fügen Sie Notizen hinzu..."
                className="min-h-[80px]"
                disabled={isLoading}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isLoading}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Speichern
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 mr-1" />
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              {version.notes ? (
                <div className="p-3 bg-muted/30 rounded-md whitespace-pre-wrap">
                  {version.notes}
                </div>
              ) : (
                <div className="text-muted-foreground italic">
                  Keine Notizen vorhanden
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Metadata */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            Metadaten
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Erstellt:</span>
              <span>{formatDateTime(version.created_at)}</span>
            </div>

            {version.updated_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aktualisiert:</span>
                <span>{formatDateTime(version.updated_at)}</span>
              </div>
            )}

            {version.base_version && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Basiert auf:</span>
                <span>Version {version.base_version}</span>
              </div>
            )}

            {version.is_week_based && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Typ:</span>
                <span>Wochenbasiert</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
