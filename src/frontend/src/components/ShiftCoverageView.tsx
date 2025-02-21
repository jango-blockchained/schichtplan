import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Settings, Shift } from '@/types';
import { parse, format } from 'date-fns';

// Constants
const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const;

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

// Time Utility Class
class TimeCalculator {
    private settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    calculateExtendedTimeRange(): TimeRange {
        const storeOpening = parseTime(this.settings.general.store_opening);
        const storeClosing = parseTime(this.settings.general.store_closing);

        const extendedStart = new Date(storeOpening.getTime());
        extendedStart.setMinutes(storeOpening.getMinutes() - this.settings.general.keyholder_before_minutes);

        const extendedEnd = new Date(storeClosing.getTime());
        extendedEnd.setMinutes(storeClosing.getMinutes() + this.settings.general.keyholder_after_minutes);

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

    calculateShiftPosition(shift: Shift, timeRange: TimeRange): { left: number; width: number } {
        const totalDuration = timeRange.end.getTime() - timeRange.start.getTime();
        const shiftStart = parseTime(shift.start_time);
        const shiftEnd = parseTime(shift.end_time);

        const left = ((shiftStart.getTime() - timeRange.start.getTime()) / totalDuration) * 100;
        const width = ((shiftEnd.getTime() - shiftStart.getTime()) / totalDuration) * 100;

        return { left, width };
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
    position: { left: number; width: number };
}> = ({ shift, day, position }) => (
    <div
        key={`${shift.id}-${day}`}
        className="absolute h-8 top-1/2 -translate-y-1/2 bg-primary/20 border border-primary rounded-md overflow-hidden"
        style={{
            left: `${position.left}%`,
            width: `${position.width}%`,
            minWidth: '40px',
        }}
        title={`${shift.start_time}-${shift.end_time} (${shift.min_employees}-${shift.max_employees} MA)`}
    >
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium truncate px-1">
            {shift.min_employees}-{shift.max_employees} MA
        </div>
    </div>
);

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

    const keyholderBeforeWidth = useMemo(() =>
        (settings.general.keyholder_before_minutes / ((timeRange.end.getTime() - timeRange.start.getTime()) / 60000)) * 100,
        [settings, timeRange]
    );

    const keyholderAfterWidth = useMemo(() =>
        (settings.general.keyholder_after_minutes / ((timeRange.end.getTime() - timeRange.start.getTime()) / 60000)) * 100,
        [settings, timeRange]
    );

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
                                                minutes={settings.general.keyholder_before_minutes}
                                            />
                                            <KeyholderTimeBlock
                                                isBefore={false}
                                                widthPercentage={keyholderAfterWidth}
                                                minutes={settings.general.keyholder_after_minutes}
                                            />
                                            {dayShifts.map((shift) => (
                                                <ShiftBlock
                                                    key={shift.id}
                                                    shift={shift}
                                                    day={day}
                                                    position={timeCalculator.calculateShiftPosition(shift, timeRange)}
                                                />
                                            ))}
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