import { addDays, startOfWeek, endOfWeek, addWeeks, getWeek } from 'date-fns';

export function getWeekDateRange(year: number, week: number, weekCount: number = 1) {
    const start = new Date(year, 0, 1 + (week - 1) * 7);
    const dayOfWeek = start.getDay();
    const diff = (dayOfWeek <= 4) ? (1 - dayOfWeek) : (8 - dayOfWeek);
    const startDate = new Date(start.setDate(start.getDate() + diff));
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (7 * weekCount) - 1);
    return { start: startDate, end: endDate };
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