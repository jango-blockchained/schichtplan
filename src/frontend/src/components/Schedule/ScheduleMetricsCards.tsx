import React from "react";
import { Card } from "@/components/ui/card";
import { DateRange } from "react-day-picker";
import { Employee, Schedule } from "@/types";
import { useStatisticsData } from "@/hooks/useStatisticsData";

type Props = {
  schedules: Schedule[];
  dateRange?: DateRange;
  employees?: Employee[];
  openingDays?: number[];
  version?: number;
  className?: string;
};

export function ScheduleMetricsCards({
  schedules,
  dateRange,
  employees,
  openingDays,
  version,
  className,
}: Props) {
  const {
    employees: allEmployees,
    basicStats,
    dailyCoverageStats,
  } = useStatisticsData({
    schedules: schedules || [],
    dateRange,
    employees,
    openingDays,
    version,
  });

  const totalEmployees = allEmployees?.length || 0;
  const uniqueScheduledEmployees = basicStats.totalEmployees || 0;
  const utilization = totalEmployees > 0 ? (uniqueScheduledEmployees / totalEmployees) * 100 : 0;
  const breakCoverage = basicStats.breakCoverage || 0;
  const totalShifts = basicStats.totalSchedules || 0;
  const avgShiftsPerDay = dailyCoverageStats.avgCoverage || 0;
  const totalHours = basicStats.totalHours || 0;

  const numberFmt = (n: number, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : "0";

  return (
    <div className={"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 " + (className || "")}> 
      <MetricCard title="Schichten (Woche)" value={String(totalShifts)} subtitle={`${numberFmt(totalHours, 1)} Std gesamt`} />
      <MetricCard title="Ø Schichten/Tag" value={numberFmt(avgShiftsPerDay, 1)} subtitle="Durchschnittliche Abdeckung" />
      <MetricCard title="Mitarbeiter-Auslastung" value={`${numberFmt(utilization, 1)} %`} subtitle={`${uniqueScheduledEmployees}/${totalEmployees} im Einsatz`} />
      <MetricCard title="Pausen hinterlegt" value={`${numberFmt(breakCoverage, 1)} %`} subtitle="Anteil Schichten mit Pause" />
    </div>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <Card className="p-4 bg-background border border-border/60 shadow-sm">
      <div className="text-sm text-muted-foreground mb-1">{title}</div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    </Card>
  );
}

export default ScheduleMetricsCards;
