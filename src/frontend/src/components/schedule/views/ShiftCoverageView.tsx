import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Settings, Shift, Schedule } from '@/types';
import { format, parseISO, addMinutes } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { getSettings, getShifts } from '@/services/api';

// Component interfaces
interface ShiftCoverageViewProps {
    schedules: Schedule[];
    dateRange: DateRange | undefined;
    onDrop?: (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => Promise<void>;
    onUpdate?: (scheduleId: number, updates: any) => Promise<void>;
    isLoading?: boolean;
    employeeAbsences?: Record<number, any[]>;
    absenceTypes?: Array<{
        id: string;
        name: string;
        color: string;
        type: 'absence';
    }>;
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
    shiftStartInMinutes: number;
    shiftEndInMinutes: number;
    rangeStartInMinutes: number;
    rangeEndInMinutes: number;
    rangeWidthInMinutes: number;
    leftOffsetInMinutes: number;
    widthInMinutes: number;
}

// Revert to a simpler approach
interface EnhancedShift extends Shift {
    isEarlyShift: boolean;
    isLateShift: boolean;
}

interface TimeRange {
    startTime: string;
    endTime: string;
}

class TimeCalculator {
    private settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    parseTime(timeString: string): number {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    formatTime(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    calculateShiftPosition(shift: Shift, timeRange: TimeRange): { left: number; width: number; debug: ShiftDebugInfo } {
        const shiftStart = this.parseTime(shift.start_time);
        const shiftEnd = this.parseTime(shift.end_time);
        const rangeStart = this.parseTime(timeRange.startTime);
        const rangeEnd = this.parseTime(timeRange.endTime);
        const rangeWidth = rangeEnd - rangeStart;

        const debugInfo: ShiftDebugInfo = {
            shiftId: shift.id,
            originalShiftStart: shift.start_time,
            originalShiftEnd: shift.end_time,
            rangeStart: timeRange.startTime,
            rangeEnd: timeRange.endTime,
            isShiftBeforeRange: shiftEnd <= rangeStart,
            isShiftAfterRange: shiftStart >= rangeEnd,
            positioningDetails: {
                shiftStartInMinutes: shiftStart,
                shiftEndInMinutes: shiftEnd,
                rangeStartInMinutes: rangeStart,
                rangeEndInMinutes: rangeEnd,
                rangeWidthInMinutes: rangeWidth,
                leftOffsetInMinutes: Math.max(0, shiftStart - rangeStart),
                widthInMinutes: Math.min(shiftEnd, rangeEnd) - Math.max(shiftStart, rangeStart)
            }
        };

        // Check if shift is entirely outside the range
        if (shiftEnd <= rangeStart || shiftStart >= rangeEnd) {
            debugInfo.positioningResult = "Shift is outside the visible time range";
            return { left: 0, width: 0, debug: debugInfo };
        }

        // Calculate position
        const leftOffset = Math.max(0, shiftStart - rangeStart);
        const left = (leftOffset / rangeWidth) * 100;

        // Calculate width (capped to range)
        const visibleStart = Math.max(shiftStart, rangeStart);
        const visibleEnd = Math.min(shiftEnd, rangeEnd);
        const width = ((visibleEnd - visibleStart) / rangeWidth) * 100;

        return {
            left: Math.max(0, Math.min(left, 100)),
            width: Math.max(0, Math.min(width, 100 - left)),
            debug: debugInfo
        };
    }
}

// Keyholder time block component
const KeyholderTimeBlock = ({ isBefore, widthPercentage, minutes }: { isBefore: boolean; widthPercentage: number; minutes: number }) => {
    return (
        <div
            className={`absolute h-6 bg-blue-200 opacity-60 z-0 top-0 ${isBefore ? 'rounded-l-md border-l border-t border-b border-blue-300' : 'rounded-r-md border-r border-t border-b border-blue-300'}`}
            style={{
                [isBefore ? 'right' : 'left']: '100%',
                width: `${widthPercentage}%`,
            }}
        >
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-blue-800">
                {minutes} min
            </div>
        </div>
    );
};

// Shift block component
const ShiftBlock = ({ shift, day, position, index, totalShifts }: { shift: EnhancedShift; day: string; position: { left: number; width: number; debug: ShiftDebugInfo }; index: number; totalShifts: number }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    // Calculate top offset based on index (stagger shifts to avoid overlap)
    const topOffset = index * 30;

    return (
        <div 
            className="absolute h-6 bg-blue-500 text-white rounded shadow cursor-pointer hover:bg-blue-600 hover:z-10 transition-colors duration-150"
            style={{
                left: `${position.left}%`,
                width: `${position.width}%`,
                top: `${topOffset}px`,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="absolute inset-0 flex items-center px-2 text-xs whitespace-nowrap overflow-hidden">
                <span className="font-semibold">{shift.start_time} - {shift.end_time}</span>
            </div>
            
            {isHovered && (
                <div className="absolute top-full left-0 mt-1 bg-white text-black text-xs shadow-lg rounded p-2 z-50 w-48">
                    <p className="font-bold">{day}</p>
                    <p>Start: {shift.start_time}</p>
                    <p>End: {shift.end_time}</p>
                    <p>Duration: {shift.duration_hours}h</p>
                </div>
            )}
        </div>
    );
};

// Employee counter component
const EmployeeCounter = ({ shifts }: { shifts: EnhancedShift[] }) => {
    // Count early and late shifts
    const earlyShiftCount = shifts.filter(s => s.isEarlyShift).length;
    const lateShiftCount = shifts.filter(s => s.isLateShift).length;
    const totalShifts = shifts.length;

    return (
        <div className="flex justify-between text-xs">
            <div>
                <span className="font-semibold">Opening (Early):</span> {earlyShiftCount}
            </div>
            <div>
                <span className="font-semibold">Total Shifts:</span> {totalShifts}
            </div>
            <div>
                <span className="font-semibold">Closing (Late):</span> {lateShiftCount}
            </div>
        </div>
    );
};

// Legend component
const Legend = () => {
    return (
        <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>Schicht</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-200 rounded"></div>
                <span>Keyholder Zeit</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded"></div>
                <span>Geschlossen</span>
            </div>
        </div>
    );
};

// Main ShiftCoverageView component
export const ShiftCoverageView: React.FC<ShiftCoverageViewProps> = ({
    schedules,
    dateRange,
    isLoading,
    onDrop,
    onUpdate
}) => {
    // Fetch settings
    const { data: settings, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings
    });

    // Fetch shift templates
    const { data: shifts, isLoading: isLoadingShifts } = useQuery({
        queryKey: ['shifts'],
        queryFn: getShifts
    });

    if (isLoading || isLoadingSettings || isLoadingShifts) {
        return <Skeleton className="w-full h-[600px]" />;
    }

    if (!settings) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Konnte Einstellungen nicht laden</AlertDescription>
            </Alert>
        );
    }

    if (!shifts || shifts.length === 0) {
        return (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Keine Schichtvorlagen gefunden</AlertDescription>
            </Alert>
        );
    }

    if (!dateRange?.from || !dateRange?.to) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Bitte wählen Sie einen Datumsbereich aus</AlertDescription>
            </Alert>
        );
    }

    // Create calculator
    const calculator = new TimeCalculator(settings);

    // Configure time range for display
    const timeRange = {
        startTime: settings.general.store_opening || '09:00',
        endTime: settings.general.store_closing || '21:00'
    };

    // Get keyholder times
    const keyholderBeforeMinutes = settings.general.keyholder_before_minutes || 30;
    const keyholderAfterMinutes = settings.general.keyholder_after_minutes || 30;

    // Calculate keyholder percentages
    const totalMinutes = calculator.parseTime(timeRange.endTime) - calculator.parseTime(timeRange.startTime);
    const keyholderBeforeWidth = (keyholderBeforeMinutes / totalMinutes) * 100;
    const keyholderAfterWidth = (keyholderAfterMinutes / totalMinutes) * 100;

    // Generate time range markers
    const timelineLabels = [];
    let currentTime = calculator.parseTime(timeRange.startTime);
    const endTime = calculator.parseTime(timeRange.endTime);
    const step = 60; // 1 hour steps
    
    while (currentTime <= endTime) {
        timelineLabels.push(calculator.formatTime(currentTime));
        currentTime += step;
    }

    // Calculate container height based on number of shifts
    const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const basePadding = 20; // padding in pixels
    const itemHeight = 30; // height per shift item in pixels
    const maxShiftsPerDay = Math.max(...DAYS.map(day => shifts.filter(shift => 
        shift.active_days.includes(DAYS.indexOf(day))
    ).length));
    const containerHeight = Math.max(1, maxShiftsPerDay) * itemHeight;
    const containerHeightWithPadding = containerHeight + basePadding * 2;

    // Process shifts to add early/late flags
    const processedShifts: EnhancedShift[] = shifts.map(shift => {
        const shiftStart = calculator.parseTime(shift.start_time);
        const storeOpening = calculator.parseTime(settings.general.store_opening || '09:00');
        const storeClosing = calculator.parseTime(settings.general.store_closing || '21:00');
        
        return {
            ...shift,
            isEarlyShift: shiftStart <= storeOpening + 30, // Within 30 min of opening
            isLateShift: calculator.parseTime(shift.end_time) >= storeClosing - 30 // Within 30 min of closing
        };
    });

    return (
        <div className="py-4">
            <Card>
                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-6">Schichtabdeckung</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {DAYS.map((day, dayIndex) => {
                            const isStoreOpen = settings.general.opening_days[dayIndex.toString()];
                            
                            // Get shifts for this day
                            const dayShifts = processedShifts.filter(shift => 
                                shift.active_days.includes(dayIndex)
                            );

                            return (
                                <div key={day} className="relative">
                                    <div className="font-medium text-lg mb-3">{day}</div>

                                    {isStoreOpen ? (
                                        <div className="bg-muted rounded-lg p-4">
                                            {dayShifts.length === 0 ? (
                                                <div className="text-sm text-muted-foreground py-4 text-center">Keine Schichten geplant</div>
                                            ) : (
                                                <div>
                                                    {/* Container with relative positioning to maintain timeline reference */}
                                                    <div
                                                        className="relative w-full"
                                                        style={{ height: `${containerHeightWithPadding}px` }}
                                                    >
                                                        {/* Render time markers for reference */}
                                                        <div className="absolute inset-0 flex justify-between w-full pointer-events-none">
                                                            {timelineLabels.map((label, index) => (
                                                                <div key={index} className="h-full border-l border-dashed border-gray-300 opacity-30" />
                                                            ))}
                                                        </div>

                                                        {/* Shifts container */}
                                                        <div className="relative h-full pt-2">
                                                            {dayShifts.map((shift, shiftIndex) => {
                                                                const position = calculator.calculateShiftPosition(shift, timeRange);

                                                                // Calculate if early or late shift
                                                                const isEarlyShift = shift.isEarlyShift;
                                                                const isLateShift = shift.isLateShift;

                                                                // Early shift keyholder block
                                                                const earlyShiftKeyholderBlock = isEarlyShift ? (
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