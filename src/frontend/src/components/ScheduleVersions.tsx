import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Schedule } from "@/types";
import { format } from "date-fns";
import { Check, Lock, Pencil } from "lucide-react";
import { VersionMeta } from "@/services/api";

interface ScheduleVersionsProps {
  /** All versions metadata */
  versions: VersionMeta[];
  /** Schedules for the current date range */
  schedules: Schedule[];
  /** Status mapping for versions */
  versionStatuses: Record<number, string>;
  /** Handler for publishing a version */
  onPublish: (version: number) => void;
  /** Handler for archiving a version */
  onArchive: (version: number) => void;
}

/**
 * ScheduleVersions displays a card with all schedule versions and their metadata
 * including status, date range and coverage percentage. It also provides
 * controls for version management (publish, archive, edit).
 */
export function ScheduleVersions({
  versions,
  schedules,
  versionStatuses,
  onPublish,
  onArchive,
}: ScheduleVersionsProps) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Versions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {versions.map((version) => (
            <VersionItem
              key={version.version}
              version={version}
              schedules={schedulesByVersion[version.version] || []}
              onPublish={onPublish}
              onArchive={onArchive}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface VersionItemProps {
  version: VersionMeta;
  schedules: Schedule[];
  onPublish: (version: number) => void;
  onArchive: (version: number) => void;
}

/**
 * Individual version item component extracted to improve code organization
 */
function VersionItem({
  version,
  schedules,
  onPublish,
  onArchive,
}: VersionItemProps) {
  const coverage = getCoveragePercentage(schedules);
  const status = version.status;
  const dateRange = getDateRangeFromSchedules(schedules);

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Version {version.version}</h3>
          {getStatusBadge(status)}
        </div>
        {dateRange.start && dateRange.end && (
          <p className="text-sm text-muted-foreground">
            {format(dateRange.start, "MMM d")} -{" "}
            {format(dateRange.end, "MMM d, yyyy")}
          </p>
        )}
        <p className="text-sm">Coverage: {coverage}%</p>
      </div>
      <div className="flex gap-2">
        {status === "DRAFT" && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onPublish(version.version)}
          >
            <Check className="w-4 h-4 mr-1" />
            Publish
          </Button>
        )}
        {status === "PUBLISHED" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onArchive(version.version)}
          >
            <Lock className="w-4 h-4 mr-1" />
            Archive
          </Button>
        )}
        {status === "DRAFT" && (
          <Button variant="ghost" size="sm">
            <Pencil className="w-4 h-4 mr-1" />
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Calculate the percentage of filled shifts in schedules
 */
function getCoveragePercentage(schedules: Schedule[]): number {
  const totalShifts = schedules.length;
  const filledShifts = schedules.filter((s) => !s.is_empty).length;
  return totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0;
}

/**
 * Get date range from schedules array
 */
function getDateRangeFromSchedules(schedules: Schedule[]): {
  start: Date | null;
  end: Date | null;
} {
  return schedules.reduce(
    (acc, schedule) => {
      const date = new Date(schedule.date);
      if (!acc.start || date < acc.start) acc.start = date;
      if (!acc.end || date > acc.end) acc.end = date;
      return acc;
    },
    { start: null as Date | null, end: null as Date | null },
  );
}

/**
 * Get appropriate badge for version status
 */
function getStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary">Draft</Badge>;
    case "PUBLISHED":
      return <Badge variant="default">Published</Badge>;
    case "ARCHIVED":
      return <Badge variant="outline">Archived</Badge>;
    default:
      return null;
  }
}
