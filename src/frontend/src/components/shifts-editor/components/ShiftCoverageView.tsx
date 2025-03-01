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
    shift: EnhancedShift;
    day: string;
    position: { left: number; width: number; debug?: any };
    onEmployeeCountChange: (id: number, minEmployees: number, maxEmployees: number) => void;
}> = ({ shift, day, position, onEmployeeCountChange }) => {
    const [showDebug, setShowDebug] = useState(false);

    // Use the pre-calculated flags from the enhanced shifts
    const isEarlyShift = shift.isEarlyShift;
    const isLateShift = shift.isLateShift;

    return (
        <>
            {/* Main shift block */}
            <div
                key={`${shift.id}-${day}`}
                className="absolute h-8 top-1/2 -translate-y-1/2 bg-primary/20 border border-primary overflow-hidden flex items-center"
                style={{
                    left: `${position.left}%`,
                    width: `${position.width}%`,
                    minWidth: '40px',
                }}
                title={`${shift.start_time}-${shift.end_time}`}
                onClick={() => setShowDebug(!showDebug)}
            >
                <div className="px-2 flex items-center justify-between w-full">
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-medium whitespace-nowrap">{shift.start_time}-{shift.end_time}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-xs bg-primary/10 px-1 rounded-full">
                            {shift.min_employees}-{shift.max_employees} {shift.min_employees === 1 ? 'person' : 'people'}
                        </span>
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
    // Use string keys for the shiftEmployees record to avoid TypeScript errors
    const [shiftEmployees, setShiftEmployees] = useState<Record<string, { min: number, max: number }>>(
        shifts.reduce((acc, shift) => ({
            ...acc,
            [shift.id.toString()]: { min: shift.min_employees, max: shift.max_employees }
        }), {})
    );

    const handleEmployeeCountChange = (shiftId: number, minEmployees: number, maxEmployees: number) => {
        setShiftEmployees(prev => ({
            ...prev,
            [shiftId.toString()]: { min: minEmployees, max: maxEmployees }
        }));
    };

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

    // Calculate keyholder times for each shift with proper typing
    const enhancedShifts = useMemo(() => {
        return shifts.map(shift => {
            // Check if this is an opening or closing shift
            const isEarlyShift = shift.start_time === settings.general.store_opening;
            const isLateShift = shift.end_time === settings.general.store_closing;

            return {
                ...shift,
                isEarlyShift,
                isLateShift
            } as EnhancedShift;
        });
    }, [shifts, settings]);

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

    // Fix the type for shiftEmployees access
    const shiftPositions = enhancedShifts.map(shift => {
        const position = timeCalculator.calculateShiftPosition(shift, timeRange);
        const shiftIdStr = shift.id.toString();
        return {
            ...shift,
            min_employees: shiftEmployees[shiftIdStr]?.min || shift.min_employees,
            max_employees: shiftEmployees[shiftIdStr]?.max || shift.max_employees,
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
                        // Use type assertion to avoid TypeScript errors with active_days
                        const dayShifts = enhancedShifts.filter(shift =>
                            (shift.active_days as any)[dayIndex.toString()]
                        );

                        return (
                            <div key={day} className="relative h-12 flex items-center">
                                <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-16 text-sm font-medium">
                                    {day}
                                </div>

                                <div className={`h-10 rounded-md flex-grow relative ${isStoreOpen ? 'bg-muted' : 'bg-muted/30'}`}>
                                    {isStoreOpen && (
                                        <>
                                            {/* Render shift blocks with their keyholder extensions */}
                                            {dayShifts.map((shift) => {
                                                const position = timeCalculator.calculateShiftPosition(shift, timeRange);
                                                const shiftIdStr = shift.id.toString();

                                                // Calculate keyholder blocks for early and late shifts
                                                const earlyShiftKeyholderBlock = shift.isEarlyShift ? (
                                                    <div
                                                        key={`keyholder-before-${shift.id}`}
                                                        className="absolute h-8 top-1/2 -translate-y-1/2 bg-yellow-100 border border-yellow-300 rounded-l-md flex items-center justify-center"
                                                        style={{
                                                            right: `${100 - position.left}%`,
                                                            width: `${keyholderBeforeWidth}%`,
                                                        }}
                                                        title={`Keyholder time before opening (${keyholderBeforeMinutes} min)`}
                                                    >
                                                        <span className="text-xs">🔑 {keyholderBeforeMinutes}m</span>
                                                    </div>
                                                ) : null;

                                                const lateShiftKeyholderBlock = shift.isLateShift ? (
                                                    <div
                                                        key={`keyholder-after-${shift.id}`}
                                                        className="absolute h-8 top-1/2 -translate-y-1/2 bg-yellow-100 border border-yellow-300 rounded-r-md flex items-center justify-center"
                                                        style={{
                                                            left: `${position.left + position.width}%`,
                                                            width: `${keyholderAfterWidth}%`,
                                                        }}
                                                        title={`Keyholder time after closing (${keyholderAfterMinutes} min)`}
                                                    >
                                                        <span className="text-xs">🔑 {keyholderAfterMinutes}m</span>
                                                    </div>
                                                ) : null;

                                                return (
                                                    <React.Fragment key={shift.id}>
                                                        {earlyShiftKeyholderBlock}
                                                        <ShiftBlock
                                                            shift={{
                                                                ...shift,
                                                                min_employees: shiftEmployees[shiftIdStr]?.min || shift.min_employees,
                                                                max_employees: shiftEmployees[shiftIdStr]?.max || shift.max_employees
                                                            }}
                                                            day={day}
                                                            position={position}
                                                            onEmployeeCountChange={handleEmployeeCountChange}
                                                        />
                                                        {lateShiftKeyholderBlock}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>

                                {isStoreOpen && <EmployeeCounter shifts={dayShifts.map(shift => {
                                    const shiftIdStr = shift.id.toString();
                                    return {
                                        ...shift,
                                        min_employees: shiftEmployees[shiftIdStr]?.min || shift.min_employees,
                                        max_employees: shiftEmployees[shiftIdStr]?.max || shift.max_employees
                                    };
                                })} />}
                            </div>
                        );
                    })}
                </div>

                <Legend />
            </div>
        </Card>
    );
}; 