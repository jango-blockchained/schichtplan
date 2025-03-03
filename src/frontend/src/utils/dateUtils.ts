import { addDays, startOfWeek, endOfWeek, addWeeks, getWeek } from 'date-fns';
import { DateRange } from 'react-day-picker';

export function getWeekDateRange(year: number, week: number, weekCount: number = 1) {
    try {
        // Validate inputs
        if (isNaN(year) || year < 2000 || year > 2100) {
            console.error('Invalid year in getWeekDateRange:', year);
            year = new Date().getFullYear();
        }

        if (isNaN(week) || week < 1 || week > 53) {
            console.error('Invalid week in getWeekDateRange:', week);
            week = getWeek(new Date(), { weekStartsOn: 1 });
        }

        if (isNaN(weekCount) || weekCount < 1 || weekCount > 4) {
            console.error('Invalid weekCount in getWeekDateRange:', weekCount);
            weekCount = 1;
        }

        // Use the more accurate ISO week date calculation
        // Jan 4th is always in the first week of the ISO year
        const jan4 = new Date(year, 0, 4);
        // Go back to Monday of that week
        const firstMonday = startOfWeek(jan4, { weekStartsOn: 1 });

        // Calculate the start date of the target week
        const startDate = addDays(firstMonday, (week - 1) * 7);
        const endDate = addDays(startDate, (weekCount * 7) - 1);

        console.log('Week date calculation:', {
            year,
            week,
            weekCount,
            jan4: jan4.toISOString(),
            firstMonday: firstMonday.toISOString(),
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });

        return { start: startDate, end: endDate };
    } catch (error) {
        console.error('Error in getWeekDateRange:', error);
        // Fallback to current week
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = addDays(start, (weekCount * 7) - 1);
        return { start, end };
    }
}

// Enhanced function that handles year transitions (e.g., week 52 to week 1 of next year)
export function getDateRangeFromWeekAndCount(week: number, weekCount: number = 1): DateRange {
    if (isNaN(week) || week < 1 || week > 53) {
        console.error('Invalid week number in getDateRangeFromWeekAndCount:', week);
        // Fall back to current week
        week = getWeek(new Date(), { weekStartsOn: 1 });
    }

    if (isNaN(weekCount) || weekCount < 1 || weekCount > 4) {
        console.error('Invalid week count in getDateRangeFromWeekAndCount:', weekCount);
        // Fall back to 1 week
        weekCount = 1;
    }

    try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentWeek = getWeek(currentDate, { weekStartsOn: 1 });

        // Handle year transitions
        const targetYear = (week < currentWeek && week <= 8) ? currentYear + 1 : currentYear;

        const { start, end } = getWeekDateRange(targetYear, week, weekCount);

        // Validate the generated dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.error('Invalid date range generated:', { start, end, week, weekCount, targetYear });
            throw new Error('Invalid date range generated');
        }

        console.log('Generated date range:', {
            from: start.toISOString(),
            to: end.toISOString(),
            week,
            weekCount,
            targetYear
        });

        return {
            from: start,
            to: end
        };
    } catch (error) {
        console.error('Error in getDateRangeFromWeekAndCount:', error);
        // Fallback to current week
        const today = new Date();
        const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
        const endOfRange = addDays(startOfCurrentWeek, (weekCount * 7) - 1);

        return {
            from: startOfCurrentWeek,
            to: endOfRange
        };
    }
}

export function getCurrentWeek(): number {
    return getWeek(new Date(), { weekStartsOn: 1 });
}

export function getDateRangeForWeeks(startWeek: number, weekCount: number) {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const { start, end } = getWeekDateRange(year, startWeek, weekCount);
    return {
        from: start,
        to: end
    };
}

export function formatDateRange(from: Date, to: Date): string {
    return `KW${getWeek(from, { weekStartsOn: 1 })}${weekCount(from, to) > 1 ? `-${getWeek(to, { weekStartsOn: 1 })}` : ''} ${from.getFullYear()}`;
}

export function weekCount(from: Date, to: Date): number {
    const start = startOfWeek(from, { weekStartsOn: 1 });
    const end = endOfWeek(to, { weekStartsOn: 1 });
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.ceil(days / 7);
}

// Helper to get all available calendar weeks for the current year
export function getAvailableCalendarWeeks(includeNextYear: boolean = false): { value: string, label: string }[] {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentWeek = getWeek(currentDate, { weekStartsOn: 1 });
    const weeks = [];

    // Add weeks from current year
    for (let i = currentWeek; i <= 52; i++) {
        weeks.push({
            value: `${currentYear}-${i}`,
            label: `KW ${i} ${currentYear}`
        });
    }

    // Add weeks from next year if requested
    if (includeNextYear) {
        for (let i = 1; i <= 8; i++) {
            weeks.push({
                value: `${currentYear + 1}-${i}`,
                label: `KW ${i} ${currentYear + 1}`
            });
        }
    }

    return weeks;
} 