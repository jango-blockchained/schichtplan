import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, addMinutes, subMinutes } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { getSettings, getShifts } from '@/services/api';
import { 
    TimeCalculator, 
    TimeRange,
    parseTime,
    formatHour
} from '@/components/core/shifts/utils';
import { 
    ShiftCoverageViewProps, 
    KeyholderTimeBlockProps, 
    ShiftBlockProps, 
    EmployeeCounterProps,
    EnhancedShift
} from './types';

// Constants
const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const;
const DEFAULT_KEYHOLDER_MINUTES = 30; // Default 30 minutes before and after store hours

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

const KeyholderTimeBlock: React.FC<KeyholderTimeBlockProps> = ({ isBefore, widthPercentage, minutes }) => (
    <div
        className={`absolute h-8 top-1/2 -translate-y-1/2 bg-yellow-100 border border-yellow-300 ${isBefore ? 'rounded-l-md' : 'rounded-r-md'}`}
        style={{
            [isBefore ? 'left' : 'right']: 0,
            width: `${widthPercentage}%`,
        }}
        title={`Keyholder time ${isBefore ? 'before opening' : 'after closing'} (${minutes} min)`}
    />
);

const ShiftBlock: React.FC<ShiftBlockProps> = ({ shift, day, position, index, totalShifts }) => {
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
        'bg-primary/20 border-primary text-primary-foreground',
        'bg-blue-100 border-blue-300 text-blue-900',
        'bg-green-100 border-green-300 text-green-900',
        'bg-purple-100 border-purple-300 text-purple-900'
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
                    minWidth: '40px',
                    height: `${blockHeight}px`,
                    top: `${top}px`,
                    zIndex: index + 1,
                }}
                title={`${shift.start_time}-${shift.end_time}`}
                onClick={() => setShowDebug(!showDebug)}
            >
                <div className="px-2 flex items-center justify-between w-full">
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-medium whitespace-nowrap">{shift.start_time}-{shift.end_time}</span>
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

const EmployeeCounter: React.FC<EmployeeCounterProps> = ({ shifts }) => {
    // Count early and late shifts
    const earlyShiftCount = shifts.filter(s => s.isEarlyShift).length;
    const lateShiftCount = shifts.filter(s => s.isLateShift).length;
    const totalShifts = shifts.length;

    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="font-medium">Early Shifts:</span> {earlyShiftCount}
            <span className="font-medium ml-4">Late Shifts:</span> {lateShiftCount}
            <span className="font-medium ml-4">Total Shifts:</span> {totalShifts}
        </div>
    );
};

const Legend: React.FC = () => (
    <div className="flex flex-wrap items-center gap-4 text-sm">
        {[
            { color: 'bg-muted', label: 'Öffnungszeit' },
            { color: 'bg-primary/20 border border-primary', label: 'Schicht 1' },
            { color: 'bg-blue-100 border border-blue-300', label: 'Schicht 2' },
            { color: 'bg-green-100 border border-green-300', label: 'Schicht 3' },
            { color: 'bg-purple-100 border border-purple-300', label: 'Schicht 4' },
            { color: 'bg-yellow-100 border border-yellow-300', label: 'Keyholder Zeit' },
            { color: 'bg-muted/30', label: 'Geschlossen' }
        ].map(({ color, label }) => (
            <div key={label} className="flex items-center space-x-2 bg-background/50 px-3 py-1.5 rounded-md">
                <div className={`w-4 h-4 ${color} rounded-sm border border-border`}></div>
                <span>{label}</span>
            </div>
        ))}
    </div>
);

/**
 * ShiftCoverageView component for visualizing shifts across days of the week
 */
export const ShiftCoverageView: React.FC<ShiftCoverageViewProps> = ({ 
    settings,
    shifts,
    schedules,
    dateRange,
    isLoading,
    onDrop,
    onUpdate,
    employeeAbsences,
    absenceTypes,
    mode = 'shifts'
}) => {
    const [debugInfo, setDebugInfo] = useState<any[]>([]);
    
    // Fetch settings if not provided
    const { data: fetchedSettings, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['settings'],
        queryFn: getSettings,
        enabled: !settings
    });
    
    // Fetch shifts if not provided
    const { data: fetchedShifts, isLoading: isLoadingShifts } = useQuery({
        queryKey: ['shifts'],
        queryFn: getShifts,
        enabled: !shifts && mode === 'shifts'
    });
    
    const activeSettings = settings || fetchedSettings;
    const activeShifts = shifts || fetchedShifts || [];
    
    if (isLoading || isLoadingSettings || (mode === 'shifts' && isLoadingShifts)) {
        return <Skeleton className="w-full h-[600px]" />;
    }
    
    if (!activeSettings) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Konnte Einstellungen nicht laden</AlertDescription>
            </Alert>
        );
    }
    
    if (mode === 'shifts' && (!activeShifts || activeShifts.length === 0)) {
        return (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Keine Schichtvorlagen gefunden</AlertDescription>
            </Alert>
        );
    }
    
    if (mode === 'schedules' && (!schedules || schedules.length === 0)) {
        return (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Keine Schichten gefunden</AlertDescription>
            </Alert>
        );
    }
    
    if (mode === 'schedules' && (!dateRange?.from || !dateRange?.to)) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Bitte wählen Sie einen Datumsbereich aus</AlertDescription>
            </Alert>
        );
    }
    
    const calculator = new TimeCalculator(activeSettings);
    const timeRange = calculator.calculateExtendedTimeRange();
    const timelineLabels = calculator.calculateTimelineLabels(timeRange);
    
    // Use default keyholder times if not specified
    const keyholderBeforeMinutes = activeSettings.general.keyholder_before_minutes ?? DEFAULT_KEYHOLDER_MINUTES;
    const keyholderAfterMinutes = activeSettings.general.keyholder_after_minutes ?? DEFAULT_KEYHOLDER_MINUTES;
    
    const keyholderBeforeWidth = useMemo(() => {
        const rangeStartTime = parseTime(timeRange.start);
        const rangeEndTime = parseTime(timeRange.end);
        const totalMinutes = (rangeEndTime.getTime() - rangeStartTime.getTime()) / 60000;
        return (keyholderBeforeMinutes / totalMinutes) * 100;
    }, [timeRange, keyholderBeforeMinutes]);
    
    const keyholderAfterWidth = useMemo(() => {
        const rangeStartTime = parseTime(timeRange.start);
        const rangeEndTime = parseTime(timeRange.end);
        const totalMinutes = (rangeEndTime.getTime() - rangeStartTime.getTime()) / 60000;
        return (keyholderAfterMinutes / totalMinutes) * 100;
    }, [timeRange, keyholderAfterMinutes]);
    
    // Process shifts to add early/late flags
    const enhancedShifts: EnhancedShift[] = useMemo(() => {
        if (mode === 'shifts') {
            return activeShifts.map(shift => {
                // Check if this is an opening or closing shift
                const isEarlyShift = shift.start_time === activeSettings.general.store_opening;
                const isLateShift = shift.end_time === activeSettings.general.store_closing;
                
                return {
                    ...shift,
                    isEarlyShift,
                    isLateShift
                };
            });
        } else {
            // Process schedule data
            return [];
        }
    }, [activeShifts, activeSettings, mode]);
    
    // Calculate positions for each shift
    const shiftPositions = enhancedShifts.map(shift => {
        const position = calculator.calculateShiftPosition(shift, timeRange);
        return {
            ...shift,
            position
        };
    });
    
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
                            const isStoreOpen = activeSettings.general.opening_days[dayIndex.toString()];
                            
                            // Get shifts for this day
                            const dayShifts = enhancedShifts.filter(shift => 
                                typeof shift.active_days === 'object' && shift.active_days[dayIndex.toString()]
                            );
                            
                            // Calculate the height needed for all shifts
                            const blockHeight = 20; // Height of each shift block
                            const spacing = 4; // Spacing between blocks
                            const containerHeight = dayShifts.length * (blockHeight + spacing) || blockHeight;
                            // Add padding to container height
                            const containerHeightWithPadding = containerHeight + 16;
                            
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