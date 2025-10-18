/**
 * RealTimeConflictDetector Component
 * Detects scheduling conflicts in real-time and provides instant feedback
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface ScheduleConflict {
  id: string;
  type:
    | "overlap"
    | "double_booking"
    | "insufficient_rest"
    | "skill_mismatch"
    | "capacity_exceeded";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  affectedEmployees: string[];
  affectedShifts: string[];
  suggestedResolution?: string;
  timestamp: Date;
  resolved: boolean;
}

interface RealTimeConflictDetectorProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onConflictDetected?: (conflicts: ScheduleConflict[]) => void;
  onConflictResolved?: (conflictId: string) => void;
}

export const RealTimeConflictDetector: React.FC<
  RealTimeConflictDetectorProps
> = ({
  className,
  autoRefresh = true,
  refreshInterval = 15000, // 15 seconds
  onConflictDetected,
  onConflictResolved,
}) => {
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Simulate conflict detection (in real implementation, this would call an API)
  const detectConflicts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock conflicts data - in real implementation this would come from backend
      const mockConflicts: ScheduleConflict[] = [
        {
          id: "conflict-1",
          type: "overlap",
          severity: "critical",
          title: "Shift Overlap Detected",
          description:
            "Sarah Johnson is scheduled for overlapping shifts on Friday 2-6 PM and 4-8 PM",
          affectedEmployees: ["Sarah Johnson"],
          affectedShifts: ["shift-123", "shift-124"],
          suggestedResolution: "Remove the overlapping shift or adjust timings",
          timestamp: new Date(),
          resolved: false,
        },
        {
          id: "conflict-2",
          type: "insufficient_rest",
          severity: "high",
          title: "Insufficient Rest Period",
          description:
            "Mike Davis has less than 8 hours rest between shifts on Thursday",
          affectedEmployees: ["Mike Davis"],
          affectedShifts: ["shift-125", "shift-126"],
          suggestedResolution:
            "Add buffer time or reschedule one of the shifts",
          timestamp: new Date(),
          resolved: false,
        },
        {
          id: "conflict-3",
          type: "capacity_exceeded",
          severity: "medium",
          title: "Department Capacity Exceeded",
          description:
            "Kitchen department exceeds maximum capacity during lunch rush",
          affectedEmployees: ["John Smith", "Lisa Brown", "Tom Wilson"],
          affectedShifts: ["shift-127", "shift-128", "shift-129"],
          suggestedResolution: "Reduce concurrent shifts or add more staff",
          timestamp: new Date(),
          resolved: false,
        },
      ];

      // Filter out resolved conflicts and add new ones
      setConflicts((prev) => {
        const unresolved = prev.filter((c) => !c.resolved);
        const newConflicts = mockConflicts.filter(
          (mock) => !unresolved.some((existing) => existing.id === mock.id),
        );

        const allConflicts = [...unresolved, ...newConflicts];

        if (newConflicts.length > 0 && onConflictDetected) {
          onConflictDetected(newConflicts);
        }

        return allConflicts;
      });

      setLastChecked(new Date());
    } catch (error) {
      console.error("Failed to detect conflicts:", error);
      toast.error("Failed to check for scheduling conflicts");
    } finally {
      setIsLoading(false);
    }
  }, [onConflictDetected]);

  // Resolve conflict
  const resolveConflict = async (conflictId: string) => {
    try {
      // Mark as resolved
      setConflicts((prev) =>
        prev.map((conflict) =>
          conflict.id === conflictId
            ? { ...conflict, resolved: true }
            : conflict,
        ),
      );

      if (onConflictResolved) {
        onConflictResolved(conflictId);
      }

      toast.success("Conflict marked as resolved");
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
      toast.error("Failed to resolve conflict");
    }
  };

  // Dismiss conflict (without resolving)
  const dismissConflict = (conflictId: string) => {
    setConflicts((prev) =>
      prev.filter((conflict) => conflict.id !== conflictId),
    );
    toast.info("Conflict dismissed");
  };

  // Get severity color
  const getSeverityColor = (severity: ScheduleConflict["severity"]) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Get type icon
  const getTypeIcon = (type: ScheduleConflict["type"]) => {
    switch (type) {
      case "overlap":
        return <Clock className="h-4 w-4" />;
      case "double_booking":
        return <Users className="h-4 w-4" />;
      case "insufficient_rest":
        return <AlertTriangle className="h-4 w-4" />;
      case "skill_mismatch":
        return <Users className="h-4 w-4" />;
      case "capacity_exceeded":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // Auto-refresh conflict detection
  useEffect(() => {
    if (autoRefresh) {
      detectConflicts();
      const interval = setInterval(detectConflicts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, detectConflicts]);

  // Initial load
  useEffect(() => {
    detectConflicts();
  }, [detectConflicts]);

  const activeConflicts = conflicts.filter((c) => !c.resolved);
  const criticalConflicts = activeConflicts.filter(
    (c) => c.severity === "critical",
  );
  const highConflicts = activeConflicts.filter((c) => c.severity === "high");

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Conflict Detection
            {isLoading && (
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastChecked && (
              <span className="text-xs text-muted-foreground">
                Last: {lastChecked.toLocaleTimeString()}
              </span>
            )}
            <Button
              onClick={detectConflicts}
              disabled={isLoading}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              <RefreshCw
                className={cn("h-3 w-3", isLoading && "animate-spin")}
              />
            </Button>
          </div>
        </div>

        {/* Conflict Summary */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span>Critical: {criticalConflicts.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-orange-500 rounded-full" />
            <span>High: {highConflicts.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span>
              Medium:{" "}
              {activeConflicts.filter((c) => c.severity === "medium").length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span>
              Low: {activeConflicts.filter((c) => c.severity === "low").length}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-80">
          <div className="space-y-3">
            {activeConflicts.length > 0 ? (
              activeConflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(conflict.type)}
                      <span className="font-medium text-sm">
                        {conflict.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          getSeverityColor(conflict.severity),
                        )}
                      >
                        {conflict.severity}
                      </Badge>
                      <Button
                        onClick={() => dismissConflict(conflict.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-2">
                    {conflict.description}
                  </p>

                  {/* Affected Items */}
                  <div className="mb-2 space-y-1">
                    {conflict.affectedEmployees.length > 0 && (
                      <div className="text-xs">
                        <span className="font-medium">Employees:</span>{" "}
                        {conflict.affectedEmployees.join(", ")}
                      </div>
                    )}
                    {conflict.affectedShifts.length > 0 && (
                      <div className="text-xs">
                        <span className="font-medium">Shifts:</span>{" "}
                        {conflict.affectedShifts.length} affected
                      </div>
                    )}
                  </div>

                  {/* Suggested Resolution */}
                  {conflict.suggestedResolution && (
                    <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                      <span className="font-medium text-blue-800">
                        Suggestion:
                      </span>{" "}
                      <span className="text-blue-700">
                        {conflict.suggestedResolution}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {conflict.timestamp.toLocaleTimeString()}
                    </span>
                    <Button
                      onClick={() => resolveConflict(conflict.id)}
                      size="sm"
                      variant="outline"
                      className="text-xs h-6"
                    >
                      Mark Resolved
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Scanning for conflicts...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    No conflicts detected!
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
