import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { TimeGridViewProps, ScheduleUpdate } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatMinutesToTime } from '../utils/scheduleUtils';
import { TimeSlotCell } from '../components/TimeSlotCell';
import { TimeGridHeader, weekdayAbbr } from '../components/TimeGridHeader';
import { TimeGridEmpty } from '../components/TimeGridEmpty';
import { useScheduleTimeGrid } from '@/hooks/useScheduleTimeGrid';

export function TimeGridView({
    schedules,
    dateRange,
    onDrop,
    onUpdate,
    isLoading: isLoadingProp,
    employeeAbsences,
    absenceTypes
}: TimeGridViewProps) {
    // Use our custom hook to manage schedule time grid data
    const {
        settings,
        employeeLookup,
        days,
        timeSlots,
        isLoading: isDataLoading,
        hasDateRange,
        hasOpeningDays
    } = useScheduleTimeGrid(dateRange);

    // Combine the component's loading prop with the hook's loading state
    const isLoading = isLoadingProp || isDataLoading;

    // Enhanced onDrop function that includes time updates
    const handleDrop = async (
        scheduleId: number,
        employeeId: number,
        newDate: Date,
        shiftId: number,
        newStartTime: string,
        newEndTime: string
    ) => {
        // Create update object with new properties
        const updates: ScheduleUpdate = {
            date: format(newDate, 'yyyy-MM-dd'),
            employee_id: employeeId,
            shift_id: shiftId,
            shift_start: newStartTime,
            shift_end: newEndTime
        };

        await onUpdate(scheduleId, updates);
    };

    // If we're loading or have empty states, show appropriate component
    if (isLoading || !hasDateRange || !hasOpeningDays) {
        return (
            <TimeGridEmpty 
                isLoading={isLoading}
                hasDateRange={hasDateRange}
                hasOpeningDays={hasOpeningDays}
            />
        );
    }

    return (
        <Card className="shadow-md border-slate-200">
            <TimeGridHeader dateRange={dateRange} settings={settings} />
            <CardContent className="p-0">
                <div className="w-full overflow-auto" style={{ maxWidth: '100%' }}>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b bg-slate-100">
                                <th className="sticky left-0 z-20 bg-slate-100 text-left p-2 font-semibold text-slate-700 min-w-[80px] w-[80px]">
                                    Zeit
                                </th>
                                {days.map((day, index) => (
                                    <th key={index} className="text-center p-2 font-semibold text-slate-700 min-w-[120px]">
                                        <div className="font-bold">{weekdayAbbr[format(day, 'EEEE', { locale: de })]}</div>
                                        <div className="text-xs">{format(day, 'dd.MM.yyyy')}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {timeSlots.map((slot, slotIndex) => (
                                <tr key={slotIndex} className={cn(
                                    "border-b hover:bg-slate-50/50",
                                    slotIndex % 4 === 0 && "border-t-2 border-t-slate-200" // Highlight hour boundaries
                                )}>
                                    <td className={cn(
                                        "font-medium sticky left-0 z-10 bg-slate-50 p-2 text-xs",
                                        slotIndex % 4 === 0 && "font-bold" // Make hour markers bold
                                    )}>
                                        {slot.label}
                                    </td>
                                    {days.map((day, dayIndex) => (
                                        <TimeSlotCell
                                            key={dayIndex}
                                            day={day}
                                            timeSlot={slot}
                                            schedules={schedules}
                                            onDrop={handleDrop}
                                            onUpdate={onUpdate}
                                            settings={settings}
                                            employeeAbsences={employeeAbsences}
                                            absenceTypes={absenceTypes}
                                            employeeLookup={employeeLookup}
                                        />
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
} 