import React from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { DateRange } from "react-day-picker";
import { TimeGridLegend } from "./TimeGridLegend";

interface TimeGridHeaderProps {
  dateRange: DateRange | undefined;
  settings: any;
}

export function TimeGridHeader({ dateRange, settings }: TimeGridHeaderProps) {
  return (
    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50">
      <div>
        <CardTitle className="text-lg font-bold">Zeitraster Ansicht</CardTitle>
        {dateRange?.from && dateRange?.to && (
          <div className="text-sm text-muted-foreground mt-1 font-medium">
            {format(dateRange.from, "dd.MM.yyyy")} -{" "}
            {format(dateRange.to, "dd.MM.yyyy")}
          </div>
        )}
      </div>

      <TimeGridLegend settings={settings} />
    </CardHeader>
  );
}

// Map for German weekday abbreviations (exported for use in the main component)
export const weekdayAbbr: { [key: string]: string } = {
  Monday: "Mo",
  Tuesday: "Di",
  Wednesday: "Mi",
  Thursday: "Do",
  Friday: "Fr",
  Saturday: "Sa",
  Sunday: "So",
};
