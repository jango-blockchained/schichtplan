import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useStatisticsData } from "@/hooks/useStatisticsData";
import { Employee, Schedule } from "@/types";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { CoverageAnalysis } from "./Statistics/CoverageAnalysis";
import { ScheduleRecommendations } from "./Statistics/ScheduleRecommendations";
import { ShiftDistributionStats } from "./Statistics/ShiftDistributionStats";
import { StatisticsOverview } from "./Statistics/StatisticsOverview";
import { WeeklyBreakdown } from "./Statistics/WeeklyBreakdownEnhanced";
import { WorkloadAnalysis } from "./Statistics/WorkloadAnalysis";

interface ScheduleStatisticsProps {
  schedules: Schedule[];
  dateRange?: DateRange;
  employees?: Employee[];
  openingDays?: number[];
  version?: number;
}

export function ScheduleStatistics({
  schedules,
  dateRange,
  employees: propEmployees,
  openingDays = [0, 1, 2, 3, 4, 5, 6],
  version,
}: ScheduleStatisticsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [shiftDistributionOpen, setShiftDistributionOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [workloadOpen, setWorkloadOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);

  const {
    basicStats,
    shiftTypeStats,
    dailyCoverageStats,
    workloadStats,
    weeklyBreakdown,
    isLoading,
  } = useStatisticsData({
    schedules,
    dateRange,
    employees: propEmployees,
    openingDays,
    version,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Lade Statistiken...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasRecommendations =
    basicStats.breakCoverage < 50 ||
    workloadStats.overWorked.length > 0 ||
    dailyCoverageStats.minCoverage === 0;

  return (
    <div className="space-y-4">
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center justify-between w-full p-4 hover:bg-muted/50"
            >
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Schichtplan-Statistiken
              </h3>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Overview Section */}
              <Collapsible open={overviewOpen} onOpenChange={setOverviewOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center justify-between w-full p-2 hover:bg-muted/50"
                  >
                    <h4 className="text-sm font-medium text-foreground">Übersicht</h4>
                    {overviewOpen ? (
                      <ChevronDown className="h-4 w-4 text-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3">
                    <StatisticsOverview basicStats={basicStats} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Shift Distribution Section */}
              <Collapsible open={shiftDistributionOpen} onOpenChange={setShiftDistributionOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center justify-between w-full p-2 hover:bg-muted/50 border-t"
                  >
                    <h4 className="text-sm font-medium text-foreground">Schichtverteilung</h4>
                    {shiftDistributionOpen ? (
                      <ChevronDown className="h-4 w-4 text-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3">
                    <ShiftDistributionStats
                      shiftTypeStats={shiftTypeStats}
                      totalSchedules={basicStats.totalSchedules}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Coverage Analysis Section */}
              <Collapsible open={coverageOpen} onOpenChange={setCoverageOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center justify-between w-full p-2 hover:bg-muted/50 border-t"
                  >
                    <h4 className="text-sm font-medium text-foreground">Abdeckungsanalyse</h4>
                    {coverageOpen ? (
                      <ChevronDown className="h-4 w-4 text-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3">
                    <CoverageAnalysis dailyCoverageStats={dailyCoverageStats} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Workload Analysis Section */}
              <Collapsible open={workloadOpen} onOpenChange={setWorkloadOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center justify-between w-full p-2 hover:bg-muted/50 border-t"
                  >
                    <h4 className="text-sm font-medium text-foreground">Arbeitsbelastung</h4>
                    {workloadOpen ? (
                      <ChevronDown className="h-4 w-4 text-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3">
                    <WorkloadAnalysis workloadStats={workloadStats} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Weekly Breakdown Section */}
              <Collapsible open={weeklyOpen} onOpenChange={setWeeklyOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center justify-between w-full p-2 hover:bg-muted/50 border-t"
                  >
                    <h4 className="text-sm font-medium text-foreground">Wöchentliche Aufschlüsselung</h4>
                    {weeklyOpen ? (
                      <ChevronDown className="h-4 w-4 text-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3">
                    <WeeklyBreakdown weeklyBreakdown={weeklyBreakdown} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Recommendations Section */}
              {hasRecommendations && (
                <Collapsible open={recommendationsOpen} onOpenChange={setRecommendationsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center justify-between w-full p-2 hover:bg-muted/50 border-t"
                    >
                      <h4 className="text-sm font-medium text-foreground">Empfehlungen</h4>
                      {recommendationsOpen ? (
                        <ChevronDown className="h-4 w-4 text-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-foreground" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3">
                      <ScheduleRecommendations
                        basicStats={basicStats}
                        workloadStats={workloadStats}
                        dailyCoverageStats={dailyCoverageStats}
                        shiftTypeStats={shiftTypeStats}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
