import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Settings, Shift } from '@/types';
import { parse, format, differenceInMinutes, isAfter, isBefore, addMinutes, subMinutes } from 'date-fns';

// Constants
const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const;
const DEFAULT_KEYHOLDER_MINUTES = 30; // Default 30 minutes before and after store hours

// Utility Functions
const parseTime = (time: string): Date => parse(time, 'HH:mm', new Date());
const formatHour = (date: Date): string => format(date, 'HH:mm');

interface TimeRange {
    start: Date;
    end: Date;
}

interface ShiftCoverageViewProps {
    settings: Settings;
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
        const keyholderBeforeMinutes = this.settings.general.keyholder_before_minutes ?? DEFAULT_KEYHOLDER_MINUTES;
        const keyholderAfterMinutes = this.settings.general.keyholder_after_minutes ?? DEFAULT_KEYHOLDER_MINUTES;

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

    calculateShiftPosition(shift: Shift, timeRange: TimeRange): { left: number; width: number; debug: ShiftDebugInfo } {
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
            isShiftAfterRange: isAfter(shiftStart, rangeEnd)
        };

        // Check if shift is completely outside the range
        if (isBefore(shiftEnd, rangeStart) || isAfter(shiftStart, rangeEnd)) {
            debugInfo.positioningResult = 'Outside Range';
            return {
                left: 0,
                width: 0,
                debug: debugInfo
            };
        }

        // Clip shift to range
        const clippedStart = new Date(Math.max(shiftStart.getTime(), rangeStart.getTime()));
        const clippedEnd = new Date(Math.min(shiftEnd.getTime(), rangeEnd.getTime()));

        const totalDuration = differenceInMinutes(rangeEnd, rangeStart);
        const shiftStartFromRangeStart = differenceInMinutes(clippedStart, rangeStart);
        const shiftDuration = differenceInMinutes(clippedEnd, clippedStart);

        const left = (shiftStartFromRangeStart / totalDuration) * 100;
        const width = (shiftDuration / totalDuration) * 100;

        const positioningDetails: PositioningDetails = {
            totalDuration,
            shiftStartFromRangeStart,
            shiftDuration,
            left,
            width
        };

        debugInfo.positioningResult = positioningDetails;

        return {
            left: Math.max(0, Math.min(left, 100)),
            width: Math.max(0, Math.min(width, 100 - left)),
            debug: debugInfo
        };
    }
}

// Subcomponents
const TimelineLabels: React.FC<{ labels: string[] }> = ({ labels }) => (
    <div className="flex w-full text-xs text-muted-foreground mb-2">
        {labels.map((label) => (
            <div key={label} className="flex-1 text-center">
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
        className={`absolute h-8 top-1/2 -translate-y-1/2 bg-yellow-100 border border-yellow-300 ${isBefore ? 'rounded-l-md' : 'rounded-r-md'}`}
        style={{
            [isBefore ? 'left' : 'right']: 0,
            width: `${widthPercentage}%`,
        }}
        title={`Keyholder time ${isBefore ? 'before opening' : 'after closing'} (${minutes} min)`}
    />
);

const ShiftBlock: React.FC<{
    shift: Shift;
    day: string;
    position: { left: number; width: number; debug?: any };
}> = ({ shift, day, position }) => {
    const [showDebug, setShowDebug] = useState(false);

    return (
        <div
            key={`${shift.id}-${day}`}
            className="absolute h-8 top-1/2 -translate-y-1/2 bg-primary/20 border border-primary rounded-md overflow-hidden"
            style={{
                left: `${position.left}%`,
                width: `${position.width}%`,
                minWidth: '40px',
            }}
            title={`${shift.start_time}-${shift.end_time} (${shift.min_employees}-${shift.max_employees} MA)`}
            onClick={() => setShowDebug(!showDebug)}
        >
            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium truncate px-1">
                {shift.min_employees}-{shift.max_employees} MA
            </div>
            {showDebug && position.debug && (
                <div className="absolute top-full left-0 bg-white border p-2 z-10 text-xs">
                    <pre>{JSON.stringify(position.debug, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

const EmployeeCounter: React.FC<{ shifts: Shift[] }> = ({ shifts }) => {
    const totalMaxEmployees = shifts.reduce((acc, shift) => acc + shift.max_employees, 0);
    return (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">
                {totalMaxEmployees} MA max
            </span>
        </div>
    );
};

const Legend: React.FC = () => (
    <div className="mt-4 flex items-center space-x-4 text-xs text-muted-foreground">
        {[
            { color: 'bg-muted', label: 'Öffnungszeit' },
            { color: 'bg-primary/20 border border-primary', label: 'Schicht' },
            { color: 'bg-yellow-100 border border-yellow-300', label: 'Keyholder Zeit' },
            { color: 'bg-muted/30', label: 'Geschlossen' }
        ].map(({ color, label }) => (
            <div key={label} className="flex items-center space-x-2">
                <div className={`w-3 h-3 ${color} rounded-sm`}></div>
                <span>{label}</span>
            </div>
        ))}
    </div>
);

export const ShiftCoverageView: React.FC<ShiftCoverageViewProps> = ({ settings, shifts }) => {
    const timeCalculator = useMemo(() => new TimeCalculator(settings), [settings]);

    const timeRange = useMemo(() => timeCalculator.calculateExtendedTimeRange(), [settings]);
    const timelineLabels = useMemo(() => timeCalculator.calculateTimelineLabels(timeRange), [timeRange]);

    // Use default keyholder times if not specified
    const keyholderBeforeMinutes = settings.general.keyholder_before_minutes ?? DEFAULT_KEYHOLDER_MINUTES;
    const keyholderAfterMinutes = settings.general.keyholder_after_minutes ?? DEFAULT_KEYHOLDER_MINUTES;

    const keyholderBeforeWidth = useMemo(() =>
        (keyholderBeforeMinutes / ((timeRange.end.getTime() - timeRange.start.getTime()) / 60000)) * 100,
        [settings, timeRange]
    );

    const keyholderAfterWidth = useMemo(() =>
        (keyholderAfterMinutes / ((timeRange.end.getTime() - timeRange.start.getTime()) / 60000)) * 100,
        [settings, timeRange]
    );

    // Enhanced debugging
    console.group('Shift Coverage View Debug');
    console.log('Store Settings:', {
        opening: settings.general.store_opening,
        closing: settings.general.store_closing,
        keyholderBefore: keyholderBeforeMinutes,
        keyholderAfter: keyholderAfterMinutes
    });

    console.log('Extended Time Range:', {
        start: timeRange.start.toTimeString(),
        end: timeRange.end.toTimeString()
    });

    const shiftPositions = shifts.map(shift => {
        const position = timeCalculator.calculateShiftPosition(shift, timeRange);
        return {
            ...shift,
            position
        };
    });

    console.log('Shift Positions:', shiftPositions);
    console.groupEnd();

    return (
        <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-lg">Schichtabdeckung</h3>
            <div className="relative w-full">
                <TimelineLabels labels={timelineLabels} />

                <div className="space-y-2">
                    {DAYS.map((day, dayIndex) => {
                        const isStoreOpen = settings.general.opening_days[dayIndex.toString()];
                        const dayShifts = shifts.filter(shift => shift.active_days[dayIndex.toString()]);

                        return (
                            <div key={day} className="relative h-12 flex items-center">
                                <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-16 text-sm font-medium">
                                    {day}
                                </div>

                                <div className={`h-10 rounded-md flex-grow relative ${isStoreOpen ? 'bg-muted' : 'bg-muted/30'}`}>
                                    {isStoreOpen && (
                                        <>
                                            <KeyholderTimeBlock
                                                isBefore={true}
                                                widthPercentage={keyholderBeforeWidth}
                                                minutes={keyholderBeforeMinutes}
                                            />
                                            <KeyholderTimeBlock
                                                isBefore={false}
                                                widthPercentage={keyholderAfterWidth}
                                                minutes={keyholderAfterMinutes}
                                            />
                                            {dayShifts.map((shift) => {
                                                const position = timeCalculator.calculateShiftPosition(shift, timeRange);
                                                return (
                                                    <ShiftBlock
                                                        key={shift.id}
                                                        shift={shift}
                                                        day={day}
                                                        position={position}
                                                    />
                                                );
                                            })}
                                        </>
                                    )}
                                </div>

                                {isStoreOpen && <EmployeeCounter shifts={dayShifts} />}
                            </div>
                        );
                    })}
                </div>

                <Legend />
            </div>
        </Card>
    );
}; 