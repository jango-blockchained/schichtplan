import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Settings } from "@/types";
import { Shift } from "@/services/api";
import {
  parse,
  format,
  differenceInMinutes,
  isAfter,
  isBefore,
  addMinutes,
  subMinutes,
} from "date-fns";
import { Loader2 } from "lucide-react"; // Import Loader2

// Constants
const DAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
] as const;
const DEFAULT_KEYHOLDER_MINUTES = 30; // Default 30 minutes before and after store hours

// Utility Functions
const parseTime = (time: string): Date => parse(time, "HH:mm", new Date());
const formatHour = (date: Date): string => format(date, "HH:mm");

interface TimeRange {
  start: Date;
  end: Date;
}

interface ShiftCoverageViewProps {
  settings?: Settings | null; // Allow settings to be optional, null, or undefined
  shifts: Shift[];
}

// Debug interfaces
interface ShiftDebugInfo {
  shiftId: number;
  originalShiftStart: string;
  originalShiftEnd: string;
  rangeStart: string;
  rangeEnd: string;
  isShiftBeforeRange: boolean;
  isShiftAfterRange: boolean;
  positioningResult?: string | PositioningDetails;
}

interface PositioningDetails {
  totalDuration: number;
  shiftStartFromRangeStart: number;
  shiftDuration: number;
  left: number;
  width: number;
}

// Revert to a simpler approach
interface EnhancedShift extends Shift {
  isEarlyShift: boolean;
  isLateShift: boolean;
}

// Time Utility Class
class TimeCalculator {
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  calculateExtendedTimeRange(): TimeRange {
    const storeOpening = parseTime(this.settings.general.store_opening);
    const storeClosing = parseTime(this.settings.general.store_closing);

    // Use default keyholder times if not specified
    const keyholderBeforeMinutes =
      this.settings.general.keyholder_before_minutes ??
      DEFAULT_KEYHOLDER_MINUTES;
    const keyholderAfterMinutes =
      this.settings.general.keyholder_after_minutes ??
      DEFAULT_KEYHOLDER_MINUTES;

    const extendedStart = subMinutes(storeOpening, keyholderBeforeMinutes);
    const extendedEnd = addMinutes(storeClosing, keyholderAfterMinutes);

    return { start: extendedStart, end: extendedEnd };
  }

  calculateTimelineLabels(timeRange: TimeRange): string[] {
    const labels: string[] = [];
    const current = new Date(timeRange.start);

    while (current <= timeRange.end) {
      labels.push(formatHour(current));
      current.setHours(current.getHours() + 1);
    }

    return labels;
  }

  calculateShiftPosition(
    shift: Shift,
    timeRange: TimeRange,
  ): { left: number; width: number; debug: ShiftDebugInfo } {
    const shiftStart = parseTime(shift.start_time);
    const shiftEnd = parseTime(shift.end_time);
    const rangeStart = timeRange.start;
    const rangeEnd = timeRange.end;

    // Detailed debugging information
    const debugInfo: ShiftDebugInfo = {
      shiftId: shift.id,
      originalShiftStart: shift.start_time,
      originalShiftEnd: shift.end_time,
      rangeStart: formatHour(rangeStart),
      rangeEnd: formatHour(rangeEnd),
      isShiftBeforeRange: isBefore(shiftEnd, rangeStart),
      isShiftAfterRange: isAfter(shiftStart, rangeEnd),
    };

    // Check if shift is completely outside the range
    if (isBefore(shiftEnd, rangeStart) || isAfter(shiftStart, rangeEnd)) {
      debugInfo.positioningResult = "Outside Range";
      return {
        left: 0,
        width: 0,
        debug: debugInfo,
      };
    }

    // Clip shift to range
    const clippedStart = new Date(
      Math.max(shiftStart.getTime(), rangeStart.getTime()),
    );
    const clippedEnd = new Date(
      Math.min(shiftEnd.getTime(), rangeEnd.getTime()),
    );

    const totalDuration = differenceInMinutes(rangeEnd, rangeStart);
    const shiftStartFromRangeStart = differenceInMinutes(
      clippedStart,
      rangeStart,
    );
    const shiftDuration = differenceInMinutes(clippedEnd, clippedStart);

    const left = (shiftStartFromRangeStart / totalDuration) * 100;
    const width = (shiftDuration / totalDuration) * 100;

    const positioningDetails: PositioningDetails = {
      totalDuration,
      shiftStartFromRangeStart,
      shiftDuration,
      left,
      width,
    };

    debugInfo.positioningResult = positioningDetails;

    return {
      left: Math.max(0, Math.min(left, 100)),
      width: Math.max(0, Math.min(width, 100 - left)),
      debug: debugInfo,
    };
  }
}

// Subcomponents
const TimelineLabels: React.FC<{ labels: string[] }> = ({ labels }) => (
  <div className="flex justify-between w-full mb-4 px-2 border-b pb-3">
    {labels.map((label, index) => (
      <div key={index} className="text-sm font-medium text-muted-foreground">
        {label}
      </div>
    ))}
  </div>
);

const KeyholderTimeBlock: React.FC<{
  isBefore: boolean;
  widthPercentage: number;
  minutes: number;
}> = ({ isBefore, widthPercentage, minutes }) => (
  <div
    className={`absolute h-8 top-1/2 -translate-y-1/2 bg-yellow-100 border border-yellow-300 ${isBefore ? "rounded-l-md" : "rounded-r-md"}`}
    style={{
      [isBefore ? "left" : "right"]: 0,
      width: `${widthPercentage}%`,
    }}
    title={`Keyholder time ${isBefore ? "before opening" : "after closing"} (${minutes} min)`}
  />
);

const ShiftBlock: React.FC<{
  shift: EnhancedShift;
  day: string;
  position: { left: number; width: number; debug?: any };
  index: number;
  totalShifts: number;
}> = ({ shift, day, position, index, totalShifts }) => {
  const [showDebug, setShowDebug] = useState(false);

  // Use the pre-calculated flags from the enhanced shifts
  const isEarlyShift = shift.isEarlyShift;
  const isLateShift = shift.isLateShift;

  // Calculate the height and top position for staggering
  const blockHeight = 20; // Height of each shift block
  const spacing = 4; // Spacing between blocks
  const top = index * (blockHeight + spacing);

  // Alternate background colors for better visibility
  const bgColors = [
    "bg-primary/20 border-primary text-primary-foreground",
    "bg-blue-100 border-blue-300 text-blue-900",
    "bg-green-100 border-green-300 text-green-900",
    "bg-purple-100 border-purple-300 text-purple-900",
  ];
  const bgColorClass = bgColors[index % bgColors.length];

  return (
    <>
      {/* Main shift block */}
      <div
        key={`${shift.id}-${day}`}
        className={`absolute border overflow-hidden flex items-center rounded-md ${bgColorClass}`}
        style={{
          left: `${position.left}%`,
          width: `${position.width}%`,
          minWidth: "40px",
          height: `${blockHeight}px`,
          top: `${top}px`,
          zIndex: index + 1,
        }}
        title={`${shift.start_time}-${shift.end_time}`}
        onClick={() => setShowDebug(!showDebug)}
      >
        <div className="px-2 flex items-center justify-between w-full">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium whitespace-nowrap">
              {shift.start_time}-{shift.end_time}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {(isEarlyShift || isLateShift) && (
              <span className="text-xs">🔑</span>
            )}
          </div>
        </div>

        {showDebug && position.debug && (
          <div className="absolute top-full left-0 bg-white border p-2 z-10 text-xs">
            <pre>{JSON.stringify(position.debug, null, 2)}</pre>
          </div>
        )}
      </div>
    </>
  );
};

const EmployeeCounter: React.FC<{ shifts: Shift[] }> = ({ shifts }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="font-medium">Total Shifts:</span> {shifts.length}
  </div>
);

const Legend: React.FC = () => (
  <div className="flex flex-wrap items-center gap-4 text-sm">
    {[
      { color: "bg-muted", label: "Öffnungszeit" },
      { color: "bg-primary/20 border border-primary", label: "Schicht 1" },
      { color: "bg-blue-100 border border-blue-300", label: "Schicht 2" },
      { color: "bg-green-100 border border-green-300", label: "Schicht 3" },
      { color: "bg-purple-100 border border-purple-300", label: "Schicht 4" },
      {
        color: "bg-yellow-100 border border-yellow-300",
        label: "Keyholder Zeit",
      },
      { color: "bg-muted/30", label: "Geschlossen" },
    ].map(({ color, label }) => (
      <div
        key={label}
        className="flex items-center space-x-2 bg-background/50 px-3 py-1.5 rounded-md"
      >
        <div
          className={`w-4 h-4 ${color} rounded-sm border border-border`}
        ></div>
        <span>{label}</span>
      </div>
    ))}
  </div>
);

export const ShiftCoverageView: React.FC<ShiftCoverageViewProps> = ({
  settings,
  shifts,
}) => {
  const [debugInfo, setDebugInfo] = useState<ShiftDebugInfo[]>([]);

  // Add loading state check
  if (!settings) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span>Loading settings for coverage view...</span>
      </div>
    );
  }

  const calculator = new TimeCalculator(settings);
  const timeRange = calculator.calculateExtendedTimeRange();
  const timelineLabels = calculator.calculateTimelineLabels(timeRange);

  // Use default keyholder times if not specified
  const keyholderBeforeMinutes =
    settings.general.keyholder_before_minutes ?? DEFAULT_KEYHOLDER_MINUTES;
  const keyholderAfterMinutes =
    settings.general.keyholder_after_minutes ?? DEFAULT_KEYHOLDER_MINUTES;

  const keyholderBeforeWidth = useMemo(
    () =>
      (keyholderBeforeMinutes /
        ((timeRange.end.getTime() - timeRange.start.getTime()) / 60000)) *
      100,
    [settings, timeRange],
  );

  const keyholderAfterWidth = useMemo(
    () =>
      (keyholderAfterMinutes /
        ((timeRange.end.getTime() - timeRange.start.getTime()) / 60000)) *
      100,
    [settings, timeRange],
  );

  // Calculate keyholder times for each shift with proper typing
  const enhancedShifts = useMemo(() => {
    return shifts.map((shift) => {
      // Check if this is an opening or closing shift
      // Safely access settings.general here
      const isEarlyShift =
        shift.start_time === settings?.general?.store_opening;
      const isLateShift = shift.end_time === settings?.general?.store_closing;

      return {
        ...shift,
        isEarlyShift,
        isLateShift,
      } as EnhancedShift;
    });
  }, [shifts, settings]);

  // Enhanced debugging
  console.group("Shift Coverage View Debug");
  console.log("Store Settings:", {
    // Safely access settings.general here
    opening: settings?.general?.store_opening,
    closing: settings?.general?.store_closing,
    keyholderBefore: keyholderBeforeMinutes,
    keyholderAfter: keyholderAfterMinutes,
  });

  console.log("Extended Time Range:", {
    start: timeRange.start.toTimeString(),
    end: timeRange.end.toTimeString(),
  });

  // Fix the type for shiftEmployees access
  const shiftPositions = enhancedShifts.map((shift) => {
    const position = calculator.calculateShiftPosition(shift, timeRange);
    return {
      ...shift,
      position,
    };
  });

  console.log("Shift Positions:", shiftPositions);
  console.groupEnd();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Schichtabdeckung</h1>
      </div>

      <Card className="p-6">
        <div className="relative w-full">
          {/* Timeline container that serves as a reference for all shifts */}
          <div className="mb-6 sticky top-0 bg-background z-10">
            <TimelineLabels labels={timelineLabels} />
          </div>

          <div className="space-y-8">
            {DAYS.map((day, dayIndex) => {
              // Safely access settings.general here
              const isStoreOpen =
                settings?.general?.opening_days?.[dayIndex.toString()];
              // Use type assertion to avoid TypeScript errors with active_days
              const dayShifts = enhancedShifts.filter(
                (shift) => (shift.active_days as any)[dayIndex.toString()],
              );

              // Calculate the height needed for all shifts
              const blockHeight = 20; // Height of each shift block
              const spacing = 4; // Spacing between blocks
              const containerHeight =
                dayShifts.length * (blockHeight + spacing) || blockHeight;
              // Add padding to container height
              const containerHeightWithPadding = containerHeight + 16;

              return (
                <div key={day} className="relative">
                  <div className="font-medium text-lg mb-3">{day}</div>

                  {isStoreOpen ? (
                    <div className="bg-muted rounded-lg p-4">
                      {dayShifts.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-4 text-center">
                          Keine Schichten geplant
                        </div>
                      ) : (
                        <div>
                          {/* Container with relative positioning to maintain timeline reference */}
                          <div
                            className="relative w-full"
                            style={{
                              height: `${containerHeightWithPadding}px`,
                            }}
                          >
                            {/* Render time markers for reference */}
                            <div className="absolute inset-0 flex justify-between w-full pointer-events-none">
                              {timelineLabels.map((label, index) => (
                                <div
                                  key={index}
                                  className="h-full border-l border-dashed border-gray-300 opacity-30"
                                />
                              ))}
                            </div>

                            {/* Shifts container */}
                            <div className="relative h-full pt-2">
                              {dayShifts.map((shift, shiftIndex) => {
                                const position =
                                  calculator.calculateShiftPosition(
                                    shift,
                                    timeRange,
                                  );

                                // Calculate if early or late shift
                                const isEarlyShift = shift.isEarlyShift;
                                const isLateShift = shift.isLateShift;

                                // Early shift keyholder block
                                const earlyShiftKeyholderBlock =
                                  isEarlyShift ? (
                                    <KeyholderTimeBlock
                                      isBefore={true}
                                      widthPercentage={keyholderBeforeWidth}
                                      minutes={keyholderBeforeMinutes}
                                    />
                                  ) : null;

                                // Late shift keyholder block
                                const lateShiftKeyholderBlock = isLateShift ? (
                                  <KeyholderTimeBlock
                                    isBefore={false}
                                    widthPercentage={keyholderAfterWidth}
                                    minutes={keyholderAfterMinutes}
                                  />
                                ) : null;

                                return (
                                  <div key={shift.id} className="relative">
                                    {earlyShiftKeyholderBlock}
                                    <ShiftBlock
                                      shift={shift}
                                      day={day}
                                      position={position}
                                      index={shiftIndex}
                                      totalShifts={dayShifts.length}
                                    />
                                    {lateShiftKeyholderBlock}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t">
                        <EmployeeCounter shifts={dayShifts} />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground py-4 text-center">
                      Geschäft geschlossen
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t">
            <h3 className="text-lg font-semibold mb-3">Legende</h3>
            <Legend />
          </div>
        </div>
      </Card>
    </div>
  );
};
