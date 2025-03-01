import { Settings } from '@/types';
import { parse, format, differenceInMinutes, isAfter, isBefore, addMinutes, subMinutes } from 'date-fns';
import { TimeRange, ShiftDebugInfo, PositioningDetails } from '../types';

// Utility Functions
export const parseTime = (time: string): Date => parse(time, 'HH:mm', new Date());
export const formatHour = (date: Date): string => format(date, 'HH:mm');

export class TimeCalculator {
    private settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    calculateExtendedTimeRange(): TimeRange {
        // Get store opening and closing times
        const storeOpening = parseTime(this.settings.general.store_opening);
        const storeClosing = parseTime(this.settings.general.store_closing);

        // Calculate extended range with keyholder times
        const keyholderBeforeMinutes = this.settings.general.keyholder_before_minutes || 30;
        const keyholderAfterMinutes = this.settings.general.keyholder_after_minutes || 30;

        const rangeStart = subMinutes(storeOpening, keyholderBeforeMinutes);
        const rangeEnd = addMinutes(storeClosing, keyholderAfterMinutes);

        return { start: rangeStart, end: rangeEnd };
    }

    calculateTimelineLabels(timeRange: TimeRange): string[] {
        const labels: string[] = [];
        let currentTime = new Date(timeRange.start);

        while (isBefore(currentTime, timeRange.end) || currentTime.getTime() === timeRange.end.getTime()) {
            labels.push(formatHour(currentTime));
            currentTime = addMinutes(currentTime, 60); // Add 1 hour
        }

        return labels;
    }
} 